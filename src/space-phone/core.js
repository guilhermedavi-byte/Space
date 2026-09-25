(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpacePhoneCore = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const { normalizePhoneNumber } = require('./phone-number');
  const ACTIVE_STATUSES = new Set(['connecting', 'ringing', 'active', 'ending']);

  // Explicit SDK IDs only: call.id is a WebRTC dialog ID, not a Telnyx leg ID.
  function extractTelnyxIds(payload = {}) {
    const result = {};
    const seen = new Set();
    const visit = (value, depth = 0) => {
      if (!value || typeof value !== 'object' || seen.has(value) || depth > 4) return;
      seen.add(value);
      for (const [key, aliases] of Object.entries({
        telnyx_call_control_id: ['call_control_id', 'callControlId', 'telnyxCallControlId'],
        telnyx_call_leg_id: ['call_leg_id', 'callLegId', 'telnyxLegId'],
        telnyx_call_session_id: ['call_session_id', 'callSessionId', 'telnyxSessionId'],
      })) {
        for (const alias of [key, ...aliases]) {
          if (!result[key] && typeof value[alias] === 'string' && value[alias].trim()) result[key] = value[alias].trim();
        }
      }
      for (const key of ['call', 'telnyxIDs', 'data', 'params', 'options']) visit(value[key], depth + 1);
    };
    visit(payload);
    return result;
  }

  function normalizePhone(value, defaultCountry) {
    return normalizePhoneNumber(value, { defaultCountry });
  }


  function normalizeSdkStatus(value) {
    const raw = String(value || '').toLowerCase();
    if (/ring/.test(raw)) return 'ringing';
    if (/active|answer|answered|connected/.test(raw)) return 'active';
    if (/hangup|hangup|destroy|done|ended|disconnect/.test(raw)) return 'ended';
    if (/fail|error|reject/.test(raw)) return 'failed';
    if (/trying|requesting|new|early|connecting/.test(raw)) return 'connecting';
    return '';
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function safeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function createElement(document, tag, attrs = {}, html = '') {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') el.className = value;
      else if (key === 'textContent') el.textContent = value;
      else if (value != null) el.setAttribute(key, value);
    });
    if (html) el.innerHTML = html;
    return el;
  }

  function createSpacePhone(options = {}) {
    const win = options.window || (typeof window !== 'undefined' ? window : null);
    const document = options.document || win?.document;
    const TelnyxRTC = options.TelnyxRTC || win?.TelnyxRTC;
    const fetchWithAuth = options.fetchWithAuth || win?.fetchWithAuth || win?.fetch?.bind(win);
    const bootstrap = options.bootstrap || win?.__SPACE_PHONE_BOOTSTRAP__ || {};
    const now = options.now || (() => Date.now());
    const nodeTimers = typeof process !== 'undefined' && process.versions?.node;
    const timers = options.timers || {
      setInterval: (...args) => nodeTimers ? globalThis.setInterval(...args) : win.setInterval(...args),
      clearInterval: (...args) => nodeTimers ? globalThis.clearInterval(...args) : win.clearInterval(...args),
      setTimeout: (...args) => nodeTimers ? globalThis.setTimeout(...args) : win.setTimeout(...args),
      clearTimeout: (...args) => nodeTimers ? globalThis.clearTimeout(...args) : win.clearTimeout(...args),
    };
    const logger = options.logger || console;
    if (!document || !win) return null;

    const state = {
      enabled: Boolean(bootstrap.enabled),
      status: 'idle',
      muted: false,
      held: false,
      error: '',
      context: null,
      callRecord: null,
      telnyxClient: null,
      telnyxCall: null,
      activeStartedAt: 0,
      elapsedSeconds: 0,
      tokenLoaded: false,
      clientReady: false,
      clientReadyPromise: null,
      inputDeviceId: safeText(win.localStorage?.getItem?.('space_phone_input_device_id')),
      outputDeviceId: safeText(win.localStorage?.getItem?.('space_phone_output_device_id')),
      devices: { inputs: [], outputs: [], permission: 'unknown' },
      clientListeners: [],
      micPermissionKey: '',
    };

    const root = createElement(document, 'section', { className: 'space-phone is-idle', 'data-space-phone': '' });
    root.innerHTML = `
      <audio id="space-phone-remote-media" autoplay playsinline></audio>
      <div class="space-phone-shell">
        <div class="space-phone-topline"><span data-phone-status>Pronto</span><button type="button" data-phone-close aria-label="Ocultar telefone">×</button></div>
        <strong data-phone-title>Space Phone</strong>
        <span data-phone-number></span>
        <div class="space-phone-error" data-phone-error hidden></div>
        <div class="space-phone-controls">
          <span class="space-phone-timer" data-phone-timer>00:00</span>
          <button type="button" data-phone-mute>Mutar</button>
          <button type="button" data-panel-target="space-phone">Voltar para ligação</button>
          <button type="button" class="is-danger" data-phone-hangup>Encerrar</button>
        </div>
      </div>
    `;

    function snapshot() {
      return {
        enabled: state.enabled,
        status: state.status,
        muted: state.muted,
        held: state.held,
        error: state.error,
        context: state.context ? { ...state.context } : null,
        callRecord: state.callRecord ? { ...state.callRecord } : null,
        activeStartedAt: state.activeStartedAt,
        elapsedSeconds: currentElapsedSeconds(),
        clientReady: state.clientReady,
        inputDeviceId: state.inputDeviceId,
        outputDeviceId: state.outputDeviceId,
        devices: { inputs: [...state.devices.inputs], outputs: [...state.devices.outputs], permission: state.devices.permission },
      };
    }

    function emitChange() {
      try { win.dispatchEvent?.(new win.CustomEvent('space-phone:state', { detail: snapshot() })); } catch {}
    }

    function render() {
      if (!state.enabled) {
        root.remove();
        return;
      }
      const active = ACTIVE_STATUSES.has(state.status) || state.error;
      root.className = `space-phone ${active ? 'is-visible' : 'is-idle'} is-${state.status}`;
      root.querySelector('[data-phone-status]').textContent = statusLabel(state.status);
      root.querySelector('[data-phone-title]').textContent = safeText(state.context?.leadName) || 'Space Phone';
      root.querySelector('[data-phone-number]').textContent = safeText(state.context?.phoneNumber) || 'Nenhuma ligação ativa';
      updateTimerDom();
      root.querySelector('[data-phone-mute]').textContent = state.muted ? 'Desmutar' : 'Mutar';
      root.querySelector('[data-phone-mute]').disabled = !['active', 'ringing', 'connecting'].includes(state.status);
      root.querySelector('[data-phone-hangup]').disabled = !ACTIVE_STATUSES.has(state.status);
      const errorEl = root.querySelector('[data-phone-error]');
      errorEl.hidden = !state.error;
      errorEl.textContent = state.error;
      emitChange();
    }

    function statusLabel(status) {
      return ({ idle: 'Pronto', connecting: 'Conectando', ringing: 'Chamando', active: 'Conectado', ending: 'Encerrando', ended: 'Encerrada', failed: 'Falhou' })[status] || 'Pronto';
    }

    function currentElapsedSeconds() {
      if ((state.status === 'active' || state.status === 'ending') && state.activeStartedAt) {
        return Math.max(state.elapsedSeconds, Math.floor((now() - state.activeStartedAt) / 1000));
      }
      return state.elapsedSeconds;
    }

    function updateTimerDom() {
      const seconds = currentElapsedSeconds();
      state.elapsedSeconds = seconds;
      const timer = root.querySelector('[data-phone-timer]');
      if (timer) timer.textContent = formatDuration(seconds);
      return seconds;
    }

    function setStatus(status, extra = {}) {
      const previous = state.status;
      state.status = status;
      if (extra.error !== undefined) state.error = extra.error;
      if (status === 'ringing' && previous !== 'ringing') {
        updateCallRecord({ status: 'ringing' }).catch(() => {});
      }
      if (status === 'active' && !state.activeStartedAt) {
        state.activeStartedAt = now();
        updateCallRecord({ status: 'active', answered_at: new Date().toISOString() }).catch(() => {});
      }
      if ((status === 'ended' || status === 'failed') && previous !== status) {
        const duration = updateTimerDom();
        updateCallRecord({ ...extractTelnyxIds(state.telnyxCall), status, ended_at: new Date().toISOString(), duration_seconds: duration }).catch(() => {});
      }
      if (status === 'ended' || status === 'failed' || status === 'idle') {
        state.activeStartedAt = 0;
        state.muted = false;
        state.held = false;
      }
      render();
    }

    function startClock() {
      const interval = timers.setInterval(() => {
        if ((state.status === 'active' || state.status === 'ending') && state.activeStartedAt) updateTimerDom();
      }, 1000);
      if (interval && typeof interval.unref === 'function') interval.unref();
    }

    async function apiFetch(url, init) {
      const res = await fetchWithAuth(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || 'request_failed');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }

    function addClientListener(client, event, handler) {
      if (typeof client.on !== 'function') return;
      client.on(event, handler);
      state.clientListeners.push({ client, event, handler });
    }

    function removeClientListener(client, event, handler) {
      if (typeof client?.off === 'function') client.off(event, handler);
    }

    function cleanupClient({ disconnect = true } = {}) {
      const client = state.telnyxClient;
      state.clientListeners.forEach(item => removeClientListener(item.client, item.event, item.handler));
      state.clientListeners = [];
      state.clientReadyPromise = null;
      state.clientReady = false;
      if (disconnect && client?.disconnect) {
        try { client.disconnect(); } catch (error) { logger.warn?.('[space-phone] disconnect failed', error?.message || error); }
      }
      state.telnyxClient = null;
      state.telnyxCall = null;
    }

    function waitForReady(client, timeoutMs = Number(bootstrap.readyTimeoutMs || 12000) || 12000) {
      if (state.clientReady) return Promise.resolve();
      if (state.clientReadyPromise) return state.clientReadyPromise;
      state.clientReadyPromise = new Promise((resolve, reject) => {
        let settled = false;
        let timer;
        const on = (event, handler) => { if (typeof client.on === 'function') client.on(event, handler); };
        const off = (event, handler) => { if (typeof client.off === 'function') client.off(event, handler); };
        const done = (fn, value) => {
          if (settled) return;
          settled = true;
          timers.clearTimeout?.(timer);
          off('telnyx.ready', onReady);
          off('telnyx.error', onError);
          off('error', onError);
          fn(value);
        };
        const onReady = () => {
          state.clientReady = true;
          done(resolve);
        };
        const onError = error => done(reject, new Error(error?.message || 'Falha na autenticação Telnyx.'));
        timer = timers.setTimeout(() => done(reject, new Error('Telnyx não ficou pronta para chamada dentro do tempo esperado.')), Math.max(1000, timeoutMs));
        if (timer && typeof timer.unref === 'function') timer.unref();
        on('telnyx.ready', onReady);
        on('telnyx.error', onError);
        on('error', onError);
      }).finally(() => {
        state.clientReadyPromise = null;
      });
      return state.clientReadyPromise;
    }

    async function ensureClient() {
      if (state.telnyxClient && state.clientReady) return state.telnyxClient;
      if (state.telnyxClient && !state.clientReady) {
        await waitForReady(state.telnyxClient);
        return state.telnyxClient;
      }
      if (!TelnyxRTC) throw new Error('SDK Telnyx indisponível. Recarregue a página.');
      const tokenPayload = await apiFetch(bootstrap.tokenEndpoint || '/api/voice/telnyx/token', { method: 'POST' });
      const loginToken = tokenPayload.login_token;
      if (!loginToken) throw new Error('Token WebRTC não retornado.');
      const client = new TelnyxRTC({ login_token: loginToken });
      addClientListener(client, 'telnyx.notification', handleNotification);
      addClientListener(client, 'telnyx.error', error => fail(error?.message || 'Falha na Telnyx.'));
      addClientListener(client, 'error', error => fail(error?.message || 'Falha na conexão WebRTC.'));
      state.telnyxClient = client;
      const readyPromise = waitForReady(client);
      await client.connect();
      await readyPromise;
      return client;
    }

    function handleNotification(notification = {}) {
      const call = notification.call || notification.data?.call || notification.params?.call || notification;
      if (call && call !== notification && (typeof call.hangup === 'function' || typeof call.muteAudio === 'function')) state.telnyxCall = call;
      const status = normalizeSdkStatus(call?.state || call?.status || notification.type || notification.event_type || notification.eventType);
      if (status) setStatus(status);
      const ids = { ...extractTelnyxIds(state.telnyxCall), ...extractTelnyxIds(notification) };
      if (state.callRecord?.id && Object.keys(ids).length) {
        updateCallRecord(ids).catch(() => {});
      }
    }

    function attachCallListeners(call) {
      if (!call || typeof call.on !== 'function') return;
      ['telnyx.notification', 'notification', 'state', 'stateChange', 'error'].forEach(eventName => {
        try {
          call.on(eventName, payload => {
            if (eventName === 'error') fail(payload?.message || 'Chamada Telnyx falhou.');
            else handleNotification(payload || call);
          });
        } catch {}
      });
    }

    let callUpdateQueue = Promise.resolve();
    async function updateCallRecord(patch = {}) {
      if (!state.callRecord?.id) return null;
      const callId = state.callRecord.id;
      const result = callUpdateQueue.catch(() => {}).then(() => apiFetch(bootstrap.callEndpoint || '/api/voice/calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: callId, ...patch }),
      }));
      callUpdateQueue = result;
      return result;
    }

    function fail(message) {
      setStatus('failed', { error: friendlyError(message) });
    }

    function friendlyError(message) {
      const raw = String(message || '').trim();
      if (/permission|denied/i.test(raw)) return 'Permissão do microfone negada.';
      if (/identity_not_configured|credential/i.test(raw)) return 'Seu usuário ainda não possui credencial Telnyx para WebRTC.';
      if (/disabled/i.test(raw)) return 'Space Phone ainda não está habilitado.';
      return raw || 'Não foi possível iniciar a ligação.';
    }

    async function requestMicrophoneAccess(audio) {
      if (!win.navigator?.mediaDevices?.getUserMedia) throw new Error('Navegador sem suporte a microfone WebRTC.');
      const key = JSON.stringify(audio || true);
      if (state.devices.permission === 'granted' && state.micPermissionKey === key) return true;
      const stream = await win.navigator.mediaDevices.getUserMedia({ audio });
      state.devices.permission = 'granted';
      state.micPermissionKey = key;
      stream.getTracks().forEach(track => track.stop());
      return true;
    }

    async function call(input = {}) {
      if (!state.enabled) throw new Error('space_phone_disabled');
      if (ACTIVE_STATUSES.has(state.status)) throw new Error('Já existe uma ligação ativa.');
      const phoneNumber = normalizePhone(input.phoneNumber || input.to_number, bootstrap.defaultCountry || 'US');
      if (!phoneNumber) throw new Error('Telefone inválido. Use um número com DDI.');
      state.context = { ...input, phoneNumber };
      state.error = '';
      state.elapsedSeconds = 0;
      setStatus('connecting');
      try {
        const audio = input.micId || input.inputDeviceId || state.inputDeviceId ? { deviceId: { exact: input.micId || input.inputDeviceId || state.inputDeviceId } } : true;
        await requestMicrophoneAccess(audio);
        const created = await apiFetch(bootstrap.callEndpoint || '/api/voice/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, context: input }),
        });
        state.callRecord = created.call || null;
        await updateCallRecord({ status: 'connecting' }).catch(() => {});
        const client = await ensureClient();
        const remoteElement = document.getElementById('space-phone-remote-media');
        state.telnyxCall = client.newCall({
          destinationNumber: phoneNumber,
          callerNumber: state.callRecord?.from_number,
          remoteElement,
          audio: true,
          clientState: state.callRecord?.id,
        });
        attachCallListeners(state.telnyxCall);
        updateCallRecord(extractTelnyxIds(state.telnyxCall)).catch(() => {});
        await applyAudioDevices({ micId: input.micId || input.inputDeviceId, speakerId: input.speakerId || input.outputDeviceId }).catch(() => {});
        setStatus('connecting');
        return state.callRecord;
      } catch (error) {
        fail(error.message);
        throw error;
      }
    }

    function requireTelnyxCall(action) {
      if (!state.telnyxCall) throw new Error(`${action} indisponível: nenhuma ligação Telnyx ativa.`);
      return state.telnyxCall;
    }

    async function hangup() {
      if (!ACTIVE_STATUSES.has(state.status)) return;
      const finalIds = extractTelnyxIds(state.telnyxCall);
      updateCallRecord(finalIds).catch(() => {});
      setStatus('ending');
      try {
        await requireTelnyxCall('Hangup').hangup();
      } catch (error) {
        logger.warn?.('[space-phone] hangup failed', error?.message || error);
        fail(error.message);
        throw error;
      }
      const endedAt = new Date().toISOString();
      const duration = updateTimerDom();
      await updateCallRecord({ ...finalIds, ...extractTelnyxIds(state.telnyxCall), status: 'ended', ended_at: endedAt, duration_seconds: duration }).catch(() => {});
      setStatus('ended');
      const resetTimer = timers.setTimeout(() => setStatus('idle'), 1800);
      if (resetTimer && typeof resetTimer.unref === 'function') resetTimer.unref();
    }

    async function mute() {
      if (state.muted) return;
      try {
        requireTelnyxCall('Mute').muteAudio();
        state.muted = true;
        render();
      } catch (error) { fail(error.message); throw error; }
    }

    async function unmute() {
      if (!state.muted) return;
      try {
        requireTelnyxCall('Unmute').unmuteAudio();
        state.muted = false;
        render();
      } catch (error) { fail(error.message); throw error; }
    }

    async function hold() {
      if (state.held) return;
      try {
        await requireTelnyxCall('Hold').hold();
        state.held = true;
        render();
      } catch (error) { fail(error.message); throw error; }
    }

    async function unhold() {
      if (!state.held) return;
      try {
        await requireTelnyxCall('Resume').unhold();
        state.held = false;
        render();
      } catch (error) { fail(error.message); throw error; }
    }

    async function dtmf(digit) {
      const value = safeText(digit);
      if (!/^[0-9*#]$/.test(value)) return;
      try {
        return requireTelnyxCall('DTMF').dtmf(value);
      } catch (error) { fail(error.message); throw error; }
    }

    async function setAudioInputDevice(deviceId) {
      const value = safeText(deviceId);
      state.inputDeviceId = value;
      try { win.localStorage?.setItem?.('space_phone_input_device_id', value); } catch {}
      if (state.telnyxCall && value) await state.telnyxCall.setAudioInDevice(value);
      render();
      return value;
    }

    async function setAudioOutputDevice(deviceId) {
      const value = safeText(deviceId);
      state.outputDeviceId = value;
      try { win.localStorage?.setItem?.('space_phone_output_device_id', value); } catch {}
      if (state.telnyxCall && value) await state.telnyxCall.setAudioOutDevice(value);
      else await applyOutputDevice(value).catch(() => false);
      render();
      return value;
    }

    async function applyOutputDevice(deviceId = state.outputDeviceId) {
      const audioEl = document.getElementById('space-phone-remote-media');
      if (!audioEl || !deviceId || typeof audioEl.setSinkId !== 'function') return false;
      await audioEl.setSinkId(deviceId);
      return true;
    }

    async function applyAudioDevices({ micId, speakerId } = {}) {
      const input = safeText(micId || state.inputDeviceId);
      const output = safeText(speakerId || state.outputDeviceId);
      if (input) await setAudioInputDevice(input);
      if (output) await setAudioOutputDevice(output);
    }

    async function refreshDevices({ requestPermission = false } = {}) {
      if (!win.navigator?.mediaDevices?.enumerateDevices) return state.devices;
      if (requestPermission && win.navigator.mediaDevices.getUserMedia) {
        try {
          await requestMicrophoneAccess(true);
        } catch {
          state.devices.permission = 'denied';
        }
      }
      const devices = await win.navigator.mediaDevices.enumerateDevices();
      state.devices = {
        ...state.devices,
        inputs: devices.filter(device => device.kind === 'audioinput').map(device => ({ deviceId: device.deviceId, label: device.label || 'Microfone' })),
        outputs: devices.filter(device => device.kind === 'audiooutput').map(device => ({ deviceId: device.deviceId, label: device.label || 'Saída' })),
      };
      render();
      return state.devices;
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      const handler = event => listener(event.detail || snapshot());
      win.addEventListener?.('space-phone:state', handler);
      listener(snapshot());
      return () => win.removeEventListener?.('space-phone:state', handler);
    }

    function bindDom() {
      win.addEventListener?.('beforeunload', () => cleanupClient({ disconnect: true }));
      win.navigator?.mediaDevices?.addEventListener?.('devicechange', () => refreshDevices().catch(() => {}));
      root.querySelector('[data-phone-close]').addEventListener('click', () => root.classList.remove('is-visible'));
      root.querySelector('[data-phone-hangup]').addEventListener('click', () => hangup());
      root.querySelector('[data-phone-mute]').addEventListener('click', () => state.muted ? unmute() : mute());
      document.addEventListener('click', event => {
        const trigger = event.target.closest?.('[data-space-phone-call]');
        if (!trigger) return;
        event.preventDefault();
        call({
          phoneNumber: trigger.getAttribute('data-space-phone-call'),
          leadId: trigger.getAttribute('data-space-phone-lead-id') || '',
          opportunityId: trigger.getAttribute('data-space-phone-opportunity-id') || '',
          leadName: trigger.getAttribute('data-space-phone-lead-name') || '',
          source: trigger.getAttribute('data-space-phone-source') || 'crm',
        }).catch(() => {});
      });
    }

    let mounted = false;
    function mount() {
      if (!state.enabled || mounted) return api;
      mounted = true;
      if (!root.parentNode) document.body.appendChild(root);
      bindDom();
      startClock();
      render();
      return api;
    }

    const api = { call, hangup, mute, unmute, hold, unhold, resume: unhold, dtmf, setAudioInputDevice, setAudioOutputDevice, refreshDevices, subscribe, cleanup: cleanupClient, getState: snapshot, mount, normalizePhone };
    return api;
  }

  return { ACTIVE_STATUSES, extractTelnyxIds, createSpacePhone, formatDuration, normalizePhone, normalizeSdkStatus };
});
