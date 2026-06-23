const { sendJson } = require("./_lib/http");
const { getSessionFromRequest } = require("./_lib/session");
const { supabaseFetch } = require("./_lib/supabase-rest");

const isAdmin = (session) => String(session?.role || "").trim().toLowerCase() === "admin";

const readRows = async (path) => {
  try {
    const { data } = await supabaseFetch(path);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("[space-office] data source failed", path, error?.message || error);
    return [];
  }
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (!isAdmin(session)) {
    sendJson(res, 403, { error: "admin_only" });
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const [logs, onboarding, alerts] = await Promise.all([
    readRows("/n8n_logs_pedagogico_space?select=*&order=updated_at.desc.nullslast&limit=40"),
    readRows("/n8n_onboarding_alunos_space?select=*&order=updated_at.desc.nullslast&limit=30"),
    readRows("/n8n_ocorrencias_pedagogicas_space?select=*&order=created_at.desc.nullslast&limit=30"),
  ]);

  const openAlerts = alerts.filter((row) => String(row.status || "aberta").toLowerCase() !== "resolvida");
  const activeLogs = logs.filter((row) => ["pendente", "enviado", "processando"].includes(String(row.status || "").toLowerCase()));
  const failedLogs = logs.filter((row) => String(row.status || "").toLowerCase() === "erro");

  sendJson(res, 200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      running: activeLogs.length,
      completed: logs.filter((row) => String(row.status || "").toLowerCase() === "sucesso").length,
      alerts: openAlerts.length,
      failures: failedLogs.length,
      onboarding: onboarding.length,
    },
    logs,
    onboarding,
    alerts: openAlerts,
  });
};
