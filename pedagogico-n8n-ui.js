(function () {
  const session = window.__SPACE_SESSION__ || {};
  const role = String(session.role || "").toLowerCase();
  if (role !== "admin") return;

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const api = async (path, options) => {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options && options.headers ? options.headers : {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "request_failed");
    return data;
  };

  const css = `
    .ped-n8n{margin-top:22px;display:grid;gap:16px}
    .ped-n8n-head{display:flex;justify-content:space-between;gap:12px;align-items:center}
    .ped-n8n-title{margin:0;font-size:18px;font-weight:950}
    .ped-n8n-sub{margin:4px 0 0;color:#aeb7c6}
    .ped-n8n-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}
    .ped-n8n-card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:linear-gradient(145deg,rgba(24,31,44,.88),rgba(8,12,21,.96));padding:16px;overflow:hidden}
    .ped-n8n-card h3{margin:0 0 12px;font-size:15px}
    .ped-n8n-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:12px 0;border-top:1px solid rgba(255,255,255,.08)}
    .ped-n8n-row:first-of-type{border-top:0}
    .ped-n8n-name{font-weight:950}
    .ped-n8n-meta{margin-top:4px;color:#aeb7c6;font-size:12px;line-height:1.45}
    .ped-n8n-pill{display:inline-flex;align-items:center;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:4px 8px;margin:4px 4px 0 0;font-size:11px;font-weight:900;color:#dce5f2;background:rgba(255,255,255,.06)}
    .ped-n8n-pill.warn{border-color:rgba(255,185,86,.36);color:#ffdca3}
    .ped-n8n-pill.good{border-color:rgba(87,214,144,.36);color:#9af0bd}
    .ped-n8n-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-content:flex-start}
    .ped-n8n-btn{border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);color:#fff;padding:9px 12px;font-weight:900;cursor:pointer}
    .ped-n8n-btn.primary{border-color:#ff5b52;background:#ff5b52}
    .ped-n8n-empty{color:#aeb7c6;padding:16px;border:1px dashed rgba(255,255,255,.14);border-radius:14px}
    .ped-n8n-status{color:#aeb7c6;font-size:12px;font-weight:800}
    @media(max-width:1100px){.ped-n8n-grid{grid-template-columns:1fr}.ped-n8n-row{grid-template-columns:1fr}}
  `;

  const ensureStyle = () => {
    if (document.querySelector("[data-ped-n8n-style]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-ped-n8n-style", "true");
    style.textContent = css;
    document.head.appendChild(style);
  };

  const state = { onboarding: [], alerts: [], loading: false };

  const flexgeBadges = (row) => {
    if (!row?.flexge_user_id) return [{ label: "Flexge não criado", tone: "warn" }];
    const badges = [{ label: "Flexge criado", tone: "good" }];
    const enrollment = String(row.flexge_enrollment_status || "").toLowerCase();
    if (row.flexge_course_id || row.flexge_group_id || ["active", "ativo", "vinculado"].includes(enrollment)) {
      badges.push({ label: "Flexge vinculado", tone: "good" });
    }
    const weekly = Number(row.flexge_weekly_study_minutes || 0);
    const goal = Number(row.flexge_weekly_goal_minutes || 0);
    if (goal > 0 && weekly < goal) badges.push({ label: weekly <= 0 ? "Baixo uso" : "Meta semanal abaixo", tone: "warn" });
    const lastAccess = row.flexge_last_access_at ? Date.parse(row.flexge_last_access_at) : 0;
    if (lastAccess && Date.now() - lastAccess > 7 * 86400000) badges.push({ label: "Sem acesso recente", tone: "warn" });
    if (weekly > 0 && (!goal || weekly >= goal)) badges.push({ label: "Bom uso", tone: "good" });
    return badges;
  };

  const renderOnboarding = () => {
    const el = document.querySelector("[data-ped-n8n-onboarding]");
    if (!(el instanceof HTMLElement)) return;
    if (!state.onboarding.length) {
      el.innerHTML = `<div class="ped-n8n-empty">Nenhum onboarding pedagógico encontrado.</div>`;
      return;
    }
    el.innerHTML = state.onboarding
      .map((row) => {
        const id = String(row.id || "");
        const status = String(row.status_onboarding || "novo");
        return `
          <div class="ped-n8n-row">
            <div>
              <div class="ped-n8n-name">${escapeHtml(row.aluno_nome || "Aluno sem nome")}</div>
              <div class="ped-n8n-meta">
                ${escapeHtml(row.plano || "Plano não informado")} · ${escapeHtml(row.email || row.telefone || "")}<br/>
                Primeira aula: ${escapeHtml(formatDate(row.primeira_aula_em))} · Professor: ${escapeHtml(row.professor_nome || "-")}
              </div>
              <span class="ped-n8n-pill ${status.includes("erro") ? "warn" : "good"}">${escapeHtml(status)}</span>
              <span class="ped-n8n-pill">Etapa: ${escapeHtml(row.etapa_atual || "-")}</span>
              ${flexgeBadges(row)
                .map((badge) => `<span class="ped-n8n-pill ${escapeHtml(badge.tone)}">${escapeHtml(badge.label)}</span>`)
                .join("")}
            </div>
            <div class="ped-n8n-actions">
              <button class="ped-n8n-btn primary" type="button" data-ped-n8n-first-lesson="${escapeHtml(id)}">Definir professor</button>
              <button class="ped-n8n-btn" type="button" data-ped-n8n-flexge="sync_progress" data-ped-n8n-aluno="${escapeHtml(row.aluno_id || row.email || "")}" data-ped-n8n-onboarding="${escapeHtml(id)}">Sync Flexge</button>
            </div>
          </div>`;
      })
      .join("");
  };

  const renderAlerts = () => {
    const el = document.querySelector("[data-ped-n8n-alerts]");
    if (!(el instanceof HTMLElement)) return;
    const openAlerts = state.alerts.filter((a) => String(a.status || "aberta") !== "resolvida");
    if (!openAlerts.length) {
      el.innerHTML = `<div class="ped-n8n-empty">Nenhum alerta pedagógico aberto.</div>`;
      return;
    }
    el.innerHTML = openAlerts
      .slice(0, 20)
      .map((row) => {
        return `
          <div class="ped-n8n-row">
            <div>
              <div class="ped-n8n-name">${escapeHtml(row.titulo || row.tipo || "Ocorrência")}</div>
              <div class="ped-n8n-meta">${escapeHtml(row.aluno_nome || "Aluno")} · ${escapeHtml(row.professor_nome || "Professor não informado")} · ${escapeHtml(formatDate(row.created_at))}</div>
              <span class="ped-n8n-pill warn">${escapeHtml(row.severidade || "media")}</span>
              <span class="ped-n8n-pill">${escapeHtml(row.status || "aberta")}</span>
            </div>
            <div class="ped-n8n-actions">
              <button class="ped-n8n-btn" type="button" data-ped-n8n-resolve-alert="${escapeHtml(row.id)}">Resolver</button>
            </div>
          </div>`;
      })
      .join("");
  };

  const render = () => {
    const root = document.querySelector("[data-ped-n8n-root]");
    if (!(root instanceof HTMLElement)) return;
    const status = root.querySelector("[data-ped-n8n-status]");
    if (status instanceof HTMLElement) status.textContent = state.loading ? "Carregando..." : "";
    renderOnboarding();
    renderAlerts();
  };

  const load = async () => {
    state.loading = true;
    render();
    try {
      const [onboarding, alerts] = await Promise.all([
        api("/api/pedagogico/onboarding").catch(() => ({ onboarding: [] })),
        api("/api/pedagogico/alerts").catch(() => ({ alerts: [] })),
      ]);
      state.onboarding = Array.isArray(onboarding.onboarding) ? onboarding.onboarding : [];
      state.alerts = Array.isArray(alerts.alerts) ? alerts.alerts : [];
    } finally {
      state.loading = false;
      render();
    }
  };

  const mount = () => {
    const container = document.querySelector("[data-admin-pedagogico]");
    if (!(container instanceof HTMLElement) || document.querySelector("[data-ped-n8n-root]")) return;
    ensureStyle();
    const root = document.createElement("section");
    root.className = "ped-n8n";
    root.setAttribute("data-ped-n8n-root", "true");
    root.innerHTML = `
      <div class="ped-n8n-head">
        <div>
          <h2 class="ped-n8n-title">Integrações pedagógicas n8n</h2>
          <p class="ped-n8n-sub">Onboarding, primeira aula, alertas e Flexge sem mexer no vídeo.</p>
        </div>
        <div class="ped-n8n-actions">
          <button class="ped-n8n-btn" type="button" data-ped-n8n-refresh>Atualizar</button>
          <span class="ped-n8n-status" data-ped-n8n-status></span>
        </div>
      </div>
      <div class="ped-n8n-grid">
        <article class="ped-n8n-card">
          <h3>Onboarding pedagógico</h3>
          <div data-ped-n8n-onboarding></div>
        </article>
        <article class="ped-n8n-card">
          <h3>Alertas pedagógicos</h3>
          <div data-ped-n8n-alerts></div>
        </article>
      </div>`;
    container.appendChild(root);
    load().catch(() => render());
  };

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const refresh = target.closest("[data-ped-n8n-refresh]");
    if (refresh) {
      load().catch(() => render());
      return;
    }
    const firstLesson = target.closest("[data-ped-n8n-first-lesson]");
    if (firstLesson instanceof HTMLElement) {
      const onboardingId = firstLesson.getAttribute("data-ped-n8n-first-lesson") || "";
      const professor_nome = window.prompt("Nome do professor:");
      if (!professor_nome) return;
      const data_primeira_aula = window.prompt("Data/hora da primeira aula em ISO. Ex: 2026-06-20T19:00:00-03:00");
      if (!data_primeira_aula) return;
      const professor_id = window.prompt("ID do professor (opcional):") || professor_nome;
      const professor_email = window.prompt("E-mail do professor (recomendado):") || "";
      const professor_telefone = window.prompt("Telefone do professor (opcional):") || "";
      const observacoes = window.prompt("Observações (opcional):") || "";
      await api("/api/pedagogico/professor-primeira-aula", {
        method: "POST",
        body: JSON.stringify({
          onboarding_id: onboardingId,
          professor_id,
          professor_nome,
          professor_email,
          professor_telefone,
          data_primeira_aula,
          duracao_minutos: 60,
          observacoes,
        }),
      });
      await load();
      return;
    }
    const resolve = target.closest("[data-ped-n8n-resolve-alert]");
    if (resolve instanceof HTMLElement) {
      const id = resolve.getAttribute("data-ped-n8n-resolve-alert") || "";
      const observacao = window.prompt("Observação de resolução:") || "";
      await api("/api/pedagogico/alerts", { method: "PATCH", body: JSON.stringify({ id, observacao }) });
      await load();
      return;
    }
    const flexge = target.closest("[data-ped-n8n-flexge]");
    if (flexge instanceof HTMLElement) {
      const action = flexge.getAttribute("data-ped-n8n-flexge") || "";
      const aluno_id = flexge.getAttribute("data-ped-n8n-aluno") || "";
      const onboarding_id = flexge.getAttribute("data-ped-n8n-onboarding") || "";
      await api("/api/pedagogico/flexge/action", { method: "POST", body: JSON.stringify({ action, aluno_id, onboarding_id }) });
      await load();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
