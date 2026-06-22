const { getSessionFromRequest } = require("./_lib/session");
const { getVideoProvider } = require("./_lib/video-provider");
const { fetchLessonById, canAccessLesson, canEditLesson, normalizeRole } = require("./_lib/live-lessons");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const safeJsonForHtml = (value) => JSON.stringify(value ?? {}).replace(/</g, "\\u003c");

const sendRedirect = (res, location) => {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};

const formatDateTime = (value, timezone) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Horario nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone || "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const statusLabel = (status) => {
  const s = String(status || "").toLowerCase();
  const map = {
    agendada: "Agendada",
    aguardando_inicio: "Aguardando inicio",
    ao_vivo: "Ao vivo",
    realizada: "Realizada",
    falta: "Falta",
    remarcada: "Remarcada",
    cancelada: "Cancelada",
    pendente_registro: "Pendente de registro",
  };
  return map[s] || "Agendada";
};

const buildHtml = ({ user, lesson, joinData, canEdit }) => {
  const role = normalizeRole(user.role);
  const isTeacher = role === "teacher";
  const isAdmin = role === "admin";
  const title = lesson.titulo || `Aula ${lesson.aluno_nome || ""}`.trim() || "Sala de aula";
  const fallback = String(lesson.google_meet_link_fallback || "").trim();
  const hasRealRoom = ["iframe", "jitsi-external-api"].includes(joinData.embedKind) && joinData.joinUrl;
  const usesJitsiApi = joinData.embedKind === "jitsi-external-api" && joinData.externalApiUrl && joinData.domain && joinData.roomId;
  const isCancelled = lesson.status_aula === "cancelada";
  const isEnded = ["realizada", "falta", "remarcada"].includes(lesson.status_aula);
  const canTeach = Boolean((isTeacher || isAdmin) && canEdit);

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space | ${escapeHtml(title)}</title>
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <link rel="stylesheet" href="/styles.css" />
    <style>
      body.live-class-body{min-height:100vh;margin:0;background:#070b13;color:#f8fafc;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .live-class-shell{min-height:100vh;padding:26px 34px;background:radial-gradient(circle at 12% 8%,rgba(255,91,82,.2),transparent 34%),radial-gradient(circle at 92% 3%,rgba(53,94,174,.24),transparent 38%),#070b13}
      .live-class-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin:0 auto 16px;max-width:1680px}
      .live-class-eyebrow{margin:0 0 8px;color:#ff6a61;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
      .live-class-title{margin:0;font-size:32px;line-height:1;font-weight:950}
      .live-class-sub{margin:8px 0 0;color:#b8bfcc}
      .live-class-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
      .live-class-btn{border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;padding:11px 15px;font-weight:900;text-decoration:none;cursor:pointer}
      .live-class-btn.primary{border-color:#ff5b52;background:#ff5b52;box-shadow:0 16px 34px rgba(255,91,82,.25)}
      .live-class-btn:disabled{opacity:.48;cursor:not-allowed}
      .live-class-grid{display:grid;grid-template-columns:minmax(860px,1fr) 340px;gap:18px;max-width:1680px;margin:0 auto;align-items:start}
      .live-class-video-card,.live-class-side-card,.live-class-register{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:linear-gradient(145deg,rgba(24,31,44,.88),rgba(8,12,21,.96));box-shadow:0 24px 70px rgba(0,0,0,.3);overflow:hidden}
      .live-class-video-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(7,11,19,.36)}
      .live-class-person{display:flex;align-items:center;gap:12px;min-width:0}
      .live-class-avatar{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#ff5b52,#2f6bb8);font-weight:950}
      .live-class-person strong{display:block;font-size:18px}
      .live-class-person span{display:block;color:#b8bfcc;font-size:13px}
      .live-class-status{border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 11px;background:rgba(255,255,255,.08);font-weight:900}
      .live-class-stage{height:min(76vh,860px);min-height:660px;background:linear-gradient(135deg,#050914,#0b101c);display:grid;place-items:center;position:relative}
      .live-class-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
      .live-class-placeholder{max-width:560px;text-align:center;padding:34px}
      .live-class-placeholder-icon{width:86px;height:86px;margin:0 auto 18px;border-radius:28px;display:grid;place-items:center;background:rgba(255,91,82,.14);border:1px solid rgba(255,91,82,.26);font-size:34px;font-weight:950}
      .live-class-placeholder h2{margin:0 0 10px;font-size:26px}
      .live-class-placeholder p{margin:0;color:#bdc5d1;line-height:1.55}
      .live-class-side{display:grid;gap:12px;align-content:start;max-height:calc(100vh - 132px);overflow:auto;padding-right:2px}
      .live-class-side-card{padding:16px;background:linear-gradient(150deg,rgba(30,38,53,.88),rgba(9,14,24,.96))}
      .live-class-side-title{margin:0 0 12px;font-size:15px;font-weight:950}
      details.live-class-side-card{padding:0}
      details.live-class-side-card summary{list-style:none;cursor:pointer;padding:15px 16px;font-size:15px;font-weight:950}
      details.live-class-side-card summary::-webkit-details-marker{display:none}
      details.live-class-side-card summary::after{content:"+";float:right;color:#ff6a61}
      details.live-class-side-card[open] summary::after{content:"-"}
      .live-class-details-body{padding:0 16px 16px}
      .live-class-info{display:grid;gap:8px}
      .live-class-info-row{border-radius:12px;background:rgba(255,255,255,.06);padding:10px 11px;border:1px solid rgba(255,255,255,.04)}
      .live-class-info-row span{display:block;color:#8f98aa;font-size:11px;font-weight:900;text-transform:uppercase}
      .live-class-info-row strong{display:block;margin-top:4px;color:#fff;word-break:break-word}
      .live-class-recording{display:grid;gap:10px}
      .live-class-recording-actions{display:flex;gap:8px;flex-wrap:wrap}
      .live-class-recording-status{min-height:18px;color:#aeb7c6;font-size:12px;font-weight:800;line-height:1.4}
      .live-class-transcript{width:100%;min-height:88px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;padding:12px;font:inherit;resize:vertical}
      .live-class-register{grid-column:1/-1;padding:20px}
      .live-class-register[hidden]{display:none}
      .live-class-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .live-class-field{display:grid;gap:6px}
      .live-class-field.wide{grid-column:1/-1}
      .live-class-field label{font-size:11px;color:#9aa3b5;font-weight:900;text-transform:uppercase}
      .live-class-field input,.live-class-field select,.live-class-field textarea{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;padding:12px;font:inherit}
      .live-class-field textarea{min-height:86px;resize:vertical}
      .live-class-register-actions{margin-top:12px;display:flex;gap:10px;justify-content:flex-end}
      .live-class-note{color:#aeb7c6;line-height:1.5}
      @media(max-width:1280px){.live-class-grid{grid-template-columns:1fr}.live-class-side{max-height:none;overflow:visible}}
      @media(max-width:980px){.live-class-shell{padding:20px 14px}.live-class-top{display:grid}.live-class-stage{min-height:420px;height:58vh}.live-class-form{grid-template-columns:1fr}.live-class-title{font-size:28px}}
    </style>
  </head>
  <body class="live-class-body">
    <script>window.__SPACE_LIVE_CLASS__=${safeJsonForHtml({ lesson, user: { role, name: user.name, email: user.email }, joinData, canEdit })};</script>
    <main class="live-class-shell">
      <header class="live-class-top">
        <div>
          <p class="live-class-eyebrow">SALA DE AULA AO VIVO</p>
          <h1 class="live-class-title">${escapeHtml(title)}</h1>
          <p class="live-class-sub">${escapeHtml(formatDateTime(lesson.inicio, lesson.timezone))} · ${escapeHtml(lesson.aluno_nome || "Aluno")} com ${escapeHtml(lesson.professor_nome || "Professor")}</p>
        </div>
        <div class="live-class-actions">
          <a class="live-class-btn" href="/app">Voltar</a>
          ${
            fallback
              ? `<a class="live-class-btn" href="${escapeHtml(fallback)}" target="_blank" rel="noopener">Meet fallback</a>`
              : ""
          }
          ${canTeach && !isCancelled && !isEnded ? `<button class="live-class-btn primary" type="button" data-live-status="ao_vivo">Iniciar aula</button>` : ""}
          ${canTeach && !isCancelled && !isEnded ? `<button class="live-class-btn" type="button" data-live-status="pendente_registro">Finalizar aula</button>` : ""}
          ${canTeach ? `<button class="live-class-btn" type="button" data-live-toggle-register>Registrar aula</button>` : ""}
        </div>
      </header>

      <section class="live-class-grid">
        <article class="live-class-video-card">
          <div class="live-class-video-head">
            <div class="live-class-person">
              <div class="live-class-avatar">${escapeHtml((lesson.aluno_nome || "A").slice(0, 2).toUpperCase())}</div>
              <div>
                <strong>${escapeHtml(lesson.aluno_nome || "Aluno")}</strong>
                <span>Aula com ${escapeHtml(lesson.professor_nome || "Professor")}</span>
              </div>
            </div>
            <span class="live-class-status" data-live-status-label>${escapeHtml(statusLabel(lesson.status_aula))}</span>
          </div>
          <div class="live-class-stage">
            ${
              isCancelled
                ? `<div class="live-class-placeholder"><div class="live-class-placeholder-icon">!</div><h2>Aula cancelada</h2><p>Esta sala nao pode ser acessada porque a aula foi cancelada.</p></div>`
                : isEnded
                  ? `<div class="live-class-placeholder"><div class="live-class-placeholder-icon">OK</div><h2>Aula encerrada</h2><p>A videochamada desta aula ja foi encerrada.</p></div>`
                  : usesJitsiApi
                    ? `<div class="live-class-frame" data-jitsi-stage></div>`
                    : hasRealRoom
                    ? `<iframe class="live-class-frame" src="${escapeHtml(joinData.joinUrl)}" allow="camera; microphone; fullscreen; display-capture"></iframe>`
                    : `<div class="live-class-placeholder"><div class="live-class-placeholder-icon">▶</div><h2>Sala dentro da plataforma</h2><p>${escapeHtml(joinData.message || "Sala de video pronta para integracao com provider.")}</p></div>`
            }
          </div>
        </article>

        <aside class="live-class-side">
          <article class="live-class-side-card">
            <p class="live-class-side-title">Dados da aula</p>
            <div class="live-class-info">
              <div class="live-class-info-row"><span>Status</span><strong data-live-status-side>${escapeHtml(statusLabel(lesson.status_aula))}</strong></div>
              <div class="live-class-info-row"><span>Horario</span><strong>${escapeHtml(formatDateTime(lesson.inicio, lesson.timezone))}</strong></div>
              <div class="live-class-info-row"><span>Plano</span><strong>${escapeHtml(lesson.plano || "Sem plano informado")}</strong></div>
              <div class="live-class-info-row"><span>Codigo da sala</span><strong>${escapeHtml(joinData.roomId || "Sala ainda nao criada")}</strong></div>
            </div>
          </article>
          ${
            isTeacher || isAdmin
              ? `<details class="live-class-side-card" open>
                  <summary>Briefing pedagogico</summary>
                  <div class="live-class-details-body">
                    <div class="live-class-info">
                      <div class="live-class-info-row"><span>Objetivo</span><strong>${escapeHtml(lesson.objetivo_aluno || "Sem dados")}</strong></div>
                      <div class="live-class-info-row"><span>Nivel declarado</span><strong>${escapeHtml(lesson.nivel_declarado || "Sem dados")}</strong></div>
                      <div class="live-class-info-row"><span>Briefing</span><strong>${escapeHtml(lesson.briefing_pedagogico || "Sem briefing cadastrado")}</strong></div>
                      <div class="live-class-info-row"><span>Observacoes</span><strong>${escapeHtml(lesson.observacoes || "Sem observacoes")}</strong></div>
                    </div>
                  </div>
                </details>
                <details class="live-class-side-card">
                  <summary>Gravação e transcrição</summary>
                  <div class="live-class-details-body">
                    <div class="live-class-recording">
                      <p class="live-class-note">Salva por aluno em pasta separada. O arquivo da aula depende do gravador Jitsi/Jibri ativo na VPS.</p>
                      <div class="live-class-recording-actions">
                        <button class="live-class-btn primary" type="button" data-live-recording="start">Gravar aula</button>
                        <button class="live-class-btn" type="button" data-live-recording="stop">Parar gravação</button>
                      </div>
                      <div class="live-class-recording-status" data-live-recording-status>Gravação ainda não iniciada.</div>
                      <textarea class="live-class-transcript" data-live-transcript placeholder="Cole ou revise a transcrição da aula aqui..."></textarea>
                      <button class="live-class-btn" type="button" data-live-recording="save_transcript">Salvar transcrição</button>
                    </div>
                  </div>
                </details>`
              : ""
          }
        </aside>

        ${
          canTeach
            ? `<section class="live-class-register" data-live-register-panel hidden>
                <p class="live-class-side-title">Registrar aula</p>
                <form class="live-class-form" data-live-register-form>
                  <div class="live-class-field">
                    <label>Status</label>
                    <select name="status">
                      <option value="realizada">Realizada</option>
                      <option value="falta">Falta</option>
                      <option value="remarcada">Remarcada</option>
                    </select>
                  </div>
                  <div class="live-class-field">
                    <label>Engajamento</label>
                    <select name="engajamento"><option value="">Selecionar</option><option>Alto</option><option>Medio</option><option>Baixo</option></select>
                  </div>
                  <div class="live-class-field">
                    <label>Humor</label>
                    <input name="humor" placeholder="Ex: animado, cansado..." />
                  </div>
                  <div class="live-class-field wide"><label>Conteudo trabalhado</label><textarea name="conteudo_trabalhado"></textarea></div>
                  <div class="live-class-field wide"><label>Observacoes</label><textarea name="observacoes"></textarea></div>
                  <div class="live-class-field"><label>Dificuldades percebidas</label><input name="dificuldades_percebidas" /></div>
                  <div class="live-class-field"><label>Proximo foco</label><input name="proximo_foco" /></div>
                  <div class="live-class-field"><label>Motivo da falta / nova data</label><input name="motivo_falta" placeholder="Use se aplicavel" /></div>
                  <div class="live-class-register-actions live-class-field wide">
                    <button class="live-class-btn primary" type="submit">Salvar registro</button>
                  </div>
                </form>
              </section>`
            : ""
        }
      </section>
    </main>
    ${usesJitsiApi ? `<script src="${escapeHtml(joinData.externalApiUrl)}"></script>` : ""}
    <script>
      const state = window.__SPACE_LIVE_CLASS__ || {};
      const redirectToLessonEnd = () => {
        const id = state && state.lesson && state.lesson.id ? encodeURIComponent(state.lesson.id) : "";
        if (!id) return;
        window.location.href = "/aula/" + id + "/encerramento";
      };
      const bootJitsi = () => {
        const holder = document.querySelector("[data-jitsi-stage]");
        const join = state && state.joinData ? state.joinData : {};
        if (!holder || !join.domain || !join.roomId || typeof window.JitsiMeetExternalAPI !== "function") return;
        const api = new window.JitsiMeetExternalAPI(join.domain, {
          roomName: join.roomId,
          parentNode: holder,
          width: "100%",
          height: "100%",
          userInfo: {
            displayName: state.user && state.user.name ? state.user.name : ""
          },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableClosePage: false,
            enableWelcomePage: false
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            MOBILE_APP_PROMO: false
          }
        });
        window.__SPACE_JITSI_API__ = api;
        api.addListener("videoConferenceLeft", redirectToLessonEnd);
        api.addListener("readyToClose", redirectToLessonEnd);
      };
      bootJitsi();
      const recordingStatus = document.querySelector("[data-live-recording-status]");
      const transcriptEl = document.querySelector("[data-live-transcript]");
      const setRecordingStatus = (text) => {
        if (recordingStatus) recordingStatus.textContent = text || "";
      };
      const runRecordingAction = async (action) => {
        const buttons = document.querySelectorAll("[data-live-recording]");
        buttons.forEach((btn) => { btn.disabled = true; });
        try {
          if (action === "start" && window.__SPACE_JITSI_API__) {
            window.__SPACE_JITSI_API__.executeCommand("startRecording", { mode: "file", shouldShare: false });
          }
          if (action === "stop" && window.__SPACE_JITSI_API__) {
            window.__SPACE_JITSI_API__.executeCommand("stopRecording", "file");
          }
          const body = { action };
          if (action === "save_transcript") {
            body.transcricao_texto = transcriptEl ? transcriptEl.value : "";
          }
          const res = await fetch("/api/live-lessons/" + encodeURIComponent(state.lesson.id) + "/recording", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data && data.error || "recording_failed");
          if (action === "start") setRecordingStatus("Gravação solicitada. Pasta do aluno: " + ((data.recording && data.recording.pasta_drive_nome) || "aluno"));
          else if (action === "stop") setRecordingStatus("Gravação parada. O arquivo será processado pelo gravador configurado.");
          else setRecordingStatus("Transcrição salva na aula.");
        } catch (error) {
          setRecordingStatus("Não foi possível executar agora. Confira se o Jibri/gravador está configurado.");
        } finally {
          buttons.forEach((btn) => { btn.disabled = false; });
        }
      };
      document.querySelectorAll("[data-live-recording]").forEach((btn) => {
        btn.addEventListener("click", () => runRecordingAction(btn.dataset.liveRecording || ""));
      });
      const registerPanel = document.querySelector("[data-live-register-panel]");
      const registerToggle = document.querySelector("[data-live-toggle-register]");
      if (registerPanel && registerToggle) {
        registerToggle.addEventListener("click", () => {
          const shouldHide = !registerPanel.hidden;
          registerPanel.hidden = shouldHide;
          registerToggle.textContent = shouldHide ? "Registrar aula" : "Ocultar registro";
          if (!shouldHide) registerPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      const setStatusText = (label) => {
        document.querySelectorAll("[data-live-status-label],[data-live-status-side]").forEach((el) => { el.textContent = label; });
      };
      document.querySelectorAll("[data-live-status]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            const res = await fetch("/api/live-lessons/" + encodeURIComponent(state.lesson.id) + "/status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status_aula: btn.dataset.liveStatus })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data && data.error || "status_failed");
            setStatusText(data && data.label ? data.label : "Atualizado");
          } catch (error) {
            alert("Nao foi possivel atualizar a aula agora.");
          } finally {
            btn.disabled = false;
          }
        });
      });
      const form = document.querySelector("[data-live-register-form]");
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const submit = form.querySelector("button[type=submit]");
          if (submit) submit.disabled = true;
          const payload = Object.fromEntries(new FormData(form).entries());
          try {
            const res = await fetch("/api/live-lessons/" + encodeURIComponent(state.lesson.id) + "/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data && data.error || "register_failed");
            setStatusText(data && data.label ? data.label : "Realizada");
            alert("Registro salvo.");
          } catch (error) {
            alert("Nao foi possivel salvar o registro agora.");
          } finally {
            if (submit) submit.disabled = false;
          }
        });
      }
    </script>
  </body>
</html>`;
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendRedirect(res, "/");
    return;
  }

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/aula", `https://${host}`);
  const id = String(url.searchParams.get("id") || "").trim();
  if (!id) {
    res.statusCode = 404;
    res.end("Aula nao encontrada.");
    return;
  }

  let lesson;
  try {
    lesson = await fetchLessonById(id);
  } catch (error) {
    console.error("[live-classroom] lesson load failed", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Nao foi possivel carregar a aula.");
    return;
  }

  if (!lesson) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Aula nao encontrada.");
    return;
  }

  if (!canAccessLesson(session, lesson)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Voce nao tem permissao para acessar esta aula.");
    return;
  }

  const provider = getVideoProvider(lesson.video_provider);
  const joinData = await provider.getJoinData({ lesson, role: normalizeRole(session.role) });
  const html = buildHtml({
    user: { role: session.role, name: session.name, email: session.email },
    lesson,
    joinData,
    canEdit: canEditLesson(session, lesson),
  });

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
};
