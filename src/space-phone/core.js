(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpacePhoneCore = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const { normalizePhoneNumber } = require('./phone-number');
  const ACTIVE_STATUSES = new Set(['connecting', 'ringing', 'active', 'ending']);

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
    const timers = options.timers || { setInterval, clearInterval, setTimeout, clearTimeout };
    const logger = options.logger || console;
    if (!document || !win) return null;

    const state = {
      enabled: Boolean(bootstrap.enabled),
      status: 'idle',
      muted: false,
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
      clientListeners: [],
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
          <button type="button" class="is-danger" data-phone-hangup>Encerrar</button>
        </div>
      </div>
    `;

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
      root.querySelector('[data-phone-timer]').textContent = formatDuration(state.elapsedSeconds);
      root.querySelector('[data-phone-mute]').textContent = state.muted ? 'Desmutar' : 'Mutar';
      root.querySelector('[data-phone-mute]').disabled = !['active', 'ringing', 'connecting'].includes(state.status);
      root.querySelector('[data-phone-hangup]').disabled = !ACTIVE_STATUSES.has(state.status);
      const errorEl = root.querySelector('[data-phone-error]');
      errorEl.hidden = !state.error;
      errorEl.textContent = state.error;
    }

    function statusLabel(status) {
      return ({ idle: 'Pronto', connecting: 'Conectando', ringing: 'Chamando', active: 'Conectado', ending: 'Encerrando', ended: 'Encerrada', failed: 'Falhou' })[status] || 'Pronto';
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
        updateCallRecord({ status, ended_at: new Date().toISOString(), duration_seconds: state.elapsedSeconds }).catch(() => {});
      }
      if (status === 'ended' || status === 'failed' || status === 'idle') {
        state.activeStartedAt = 0;
        state.muted = false;
      }
      render();
    }

    function startClock() {
      const interval = timers.setInterval(() => {
        if (state.status === 'active' && state.activeStartedAt) {
          state.elapsedSeconds = Math.floor((now() - state.activeStartedAt) / 1000);
          render();
        }
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
      if (call && call !== notification) state.telnyxCall = call;
      const status = normalizeSdkStatus(call?.state || call?.status || notification.type || notification.event_type || notification.eventType);
      if (status) setStatus(status);
      const ids = {
        telnyx_call_control_id: call?.call_control_id || call?.callControlId,
        telnyx_call_leg_id: call?.call_leg_id || call?.callLegId,
        telnyx_call_session_id: call?.call_session_id || call?.callSessionId,
      };
      if (state.callRecord?.id && Object.values(ids).some(Boolean)) {
        updateCallRecord({ ...ids, status: state.status }).catch(() => {});
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

    async function updateCallRecord(patch = {}) {
      if (!state.callRecord?.id) return null;
      return apiFetch(bootstrap.callEndpoint || '/api/voice/calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: state.callRecord.id, ...patch }),
      });
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
        if (!win.navigator?.mediaDevices?.getUserMedia) throw new Error('Navegador sem suporte a microfone WebRTC.');
        const stream = await win.navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
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
        setStatus('connecting');
        return state.callRecord;
      } catch (error) {
        fail(error.message);
        throw error;
      }
    }

    async function hangup() {
      if (!ACTIVE_STATUSES.has(state.status)) return;
      setStatus('ending');
      try {
        if (state.telnyxCall?.hangup) await state.telnyxCall.hangup();
        else if (state.telnyxCall?.hangUp) await state.telnyxCall.hangUp();
      } catch (error) {
        logger.warn?.('[space-phone] hangup failed', error?.message || error);
      }
      const endedAt = new Date().toISOString();
      await updateCallRecord({ status: 'ended', ended_at: endedAt, duration_seconds: state.elapsedSeconds }).catch(() => {});
      setStatus('ended');
      timers.setTimeout(() => setStatus('idle'), 1800);
    }

    async function mute() {
      if (state.muted) return;
      try {
        if (state.telnyxCall?.muteAudio) state.telnyxCall.muteAudio();
        if (state.telnyxClient?.disableMicrophone) state.telnyxClient.disableMicrophone();
        state.muted = true;
        render();
      } catch (error) { fail(error.message); }
    }

    async function unmute() {
      if (!state.muted) return;
      try {
        if (state.telnyxCall?.unmuteAudio) state.telnyxCall.unmuteAudio();
        if (state.telnyxClient?.enableMicrophone) state.telnyxClient.enableMicrophone();
        state.muted = false;
        render();
      } catch (error) { fail(error.message); }
    }

    function bindDom() {
      win.addEventListener?.('beforeunload', () => cleanupClient({ disconnect: true }));
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

    function mount() {
      if (!state.enabled) return api;
      if (!root.parentNode) document.body.appendChild(root);
      bindDom();
      startClock();
      render();
      return api;
    }

    const api = { call, hangup, mute, unmute, cleanup: cleanupClient, getState: () => ({ ...state }), mount, normalizePhone };
    return api;
  }

  return { ACTIVE_STATUSES, createSpacePhone, formatDuration, normalizePhone, normalizeSdkStatus };
});
