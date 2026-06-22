const { getSessionFromRequest } = require("./_lib/session");
const { fetchLessonById, canAccessLesson, normalizeRole } = require("./_lib/live-lessons");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const safeJsonForHtml = (value) => JSON.stringify(value ?? {}).replace(/</g, "\\u003c");

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isStudentViewer = (session, lesson) => {
  const role = normalizeRole(session.role);
  if (role === "student") return true;
  if (role === "admin") return false;
  if (role === "teacher") return false;
  const sessionId = String(session.sub || "").trim();
  const lessonStudentId = String(lesson.aluno_id || "").trim();
  if (sessionId && lessonStudentId && sessionId === lessonStudentId) return true;
  const sessionName = normalizeName(session.name);
  const studentName = normalizeName(lesson.aluno_nome);
  if (sessionName && studentName && sessionName === studentName) return true;
  return role === "admin";
};

const sendRedirect = (res, location) => {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};

const buildHtml = ({ lesson, session }) => {
  const isStudent = isStudentViewer(session, lesson);
  const teacherName = lesson.professor_nome || "seu professor";
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Space | Aula encerrada</title>
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
    <style>
      *{box-sizing:border-box}
      body{min-height:100vh;margin:0;background:radial-gradient(circle at 16% 12%,rgba(255,91,82,.24),transparent 30%),radial-gradient(circle at 88% 6%,rgba(47,107,184,.28),transparent 36%),#070b13;color:#fff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .end-shell{min-height:100vh;display:grid;place-items:center;padding:28px}
      .end-card{width:min(760px,100%);border:1px solid rgba(255,255,255,.14);border-radius:24px;background:linear-gradient(145deg,rgba(25,32,46,.92),rgba(8,12,21,.98));box-shadow:0 26px 80px rgba(0,0,0,.38);padding:30px}
      .end-logo{display:flex;align-items:center;margin-bottom:26px}
      .end-logo img{display:block;width:158px;max-width:52vw;height:auto;object-fit:contain}
      .end-kicker{margin:0 0 8px;color:#ff6a61;font-size:12px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
      h1{margin:0;font-size:36px;line-height:1.04}
      .end-sub{margin:12px 0 24px;color:#b9c1cf;line-height:1.55}
      .rating{display:grid;grid-template-columns:repeat(10,1fr);gap:8px;margin:10px 0 18px}
      .rating button{height:46px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.07);color:#fff;font-weight:950;cursor:pointer}
      .rating button.is-selected{border-color:#ff5b52;background:#ff5b52;box-shadow:0 12px 26px rgba(255,91,82,.25)}
      label{display:block;margin:18px 0 8px;color:#aab4c4;font-size:12px;font-weight:950;text-transform:uppercase}
      textarea{width:100%;min-height:120px;border:1px solid rgba(255,255,255,.14);border-radius:16px;background:rgba(255,255,255,.07);color:#fff;padding:14px;font:inherit;resize:vertical}
      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap}
      .btn{border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;padding:12px 18px;font-weight:950;text-decoration:none;cursor:pointer}
      .btn.primary{border-color:#ff5b52;background:#ff5b52}
      .status{min-height:22px;margin-top:14px;color:#b9c1cf}
      .thanks{border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);padding:18px;color:#c6cfdb;line-height:1.55}
      @media(max-width:640px){.end-card{padding:22px}.rating{grid-template-columns:repeat(5,1fr)}h1{font-size:30px}}
    </style>
  </head>
  <body>
    <main class="end-shell">
      <section class="end-card">
        <div class="end-logo"><img src="/assets/space-logo.png" alt="Space" /></div>
        <p class="end-kicker">AULA ENCERRADA</p>
        <h1>Obrigado pela aula.</h1>
        <p class="end-sub">${escapeHtml(lesson.aluno_nome || session.name || "Aluno")}, sua opinião ajuda a Space a melhorar cada aula.</p>
        ${
          isStudent
            ? `<form data-feedback-form>
                <label>Avalie ${escapeHtml(teacherName)} de 1 a 10</label>
                <div class="rating" data-rating>
                  ${Array.from({ length: 10 }, (_, i) => `<button type="button" data-rate="${i + 1}">${i + 1}</button>`).join("")}
                </div>
                <input type="hidden" name="nota" data-rating-value />
                <label>Deixe uma mensagem, se quiser</label>
                <textarea name="mensagem" placeholder="Conte como foi sua experiência na aula..."></textarea>
                <div class="actions">
                  <a class="btn" href="/app">Voltar para plataforma</a>
                  <button class="btn primary" type="submit">Enviar avaliação</button>
                </div>
                <div class="status" data-feedback-status></div>
              </form>`
            : `<div class="thanks">A chamada foi encerrada. O registro pedagógico da aula fica disponível para o professor dentro da própria sala ou no painel pedagógico.</div>
               <div class="actions"><a class="btn primary" href="/app">Voltar para plataforma</a></div>`
        }
      </section>
    </main>
    <script>
      window.__SPACE_END__=${safeJsonForHtml({ lessonId: lesson.id })};
      const form = document.querySelector("[data-feedback-form]");
      const statusEl = document.querySelector("[data-feedback-status]");
      const valueEl = document.querySelector("[data-rating-value]");
      document.querySelectorAll("[data-rate]").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll("[data-rate]").forEach((el) => el.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          if (valueEl) valueEl.value = btn.dataset.rate || "";
        });
      });
      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const payload = Object.fromEntries(new FormData(form).entries());
          if (!payload.nota) {
            if (statusEl) statusEl.textContent = "Escolha uma nota antes de enviar.";
            return;
          }
          const submit = form.querySelector("button[type=submit]");
          if (submit) submit.disabled = true;
          try {
            const res = await fetch("/api/live-lessons/" + encodeURIComponent(window.__SPACE_END__.lessonId) + "/feedback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("feedback_failed");
            form.innerHTML = '<div class="thanks"><strong>Avaliação enviada.</strong><br/>Obrigado por ajudar a Space a melhorar suas aulas.</div><div class="actions"><a class="btn primary" href="/app">Voltar para plataforma</a></div>';
          } catch (error) {
            if (statusEl) statusEl.textContent = "Não foi possível enviar agora. Tente novamente em instantes.";
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
  const url = new URL(req.url || "/api/aula-encerramento", `https://${host}`);
  const id = String(url.searchParams.get("id") || "").trim();
  if (!id) {
    res.statusCode = 404;
    res.end("Aula nao encontrada.");
    return;
  }

  try {
    const lesson = await fetchLessonById(id);
    if (!lesson) {
      res.statusCode = 404;
      res.end("Aula nao encontrada.");
      return;
    }
    if (!canAccessLesson(session, lesson)) {
      res.statusCode = 403;
      res.end("Voce nao tem permissao para acessar esta aula.");
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(buildHtml({ lesson, session }));
  } catch (error) {
    console.error("[live-classroom] ending page failed", error);
    res.statusCode = 500;
    res.end("Nao foi possivel carregar o encerramento da aula.");
  }
};
