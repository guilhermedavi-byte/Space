const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { normalizeRole } = require("../_lib/live-lessons");
const { supabaseFetch } = require("../_lib/supabase-rest");

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const canUseStudentCard = (session) => {
  const role = normalizeRole(session?.role);
  return role === "admin" || role === "teacher";
};

const fetchSafe = async (path) => {
  try {
    const { data } = await supabaseFetch(path);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("[pedagogico] student card partial load failed", path, error);
    return [];
  }
};

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }
  if (!canUseStudentCard(session)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const alunoId = String(req.query?.aluno_id || req.query?.student_id || "").trim();
  const alunoNome = String(req.query?.aluno_nome || req.query?.name || "").trim();
  if (!alunoId && !alunoNome) {
    sendJson(res, 400, { error: "missing_student" });
    return;
  }

  const byId = alunoId ? `aluno_id=eq.${safeEncode(alunoId)}` : "";
  const byName = alunoNome ? `aluno_nome=ilike.*${safeEncode(alunoNome)}*` : "";
  const filter = byId || byName;

  const [onboarding, aulas, registros, alertas, avaliacoes] = await Promise.all([
    fetchSafe(`/n8n_onboarding_pedagogico_space?select=*&${filter}&order=updated_at.desc.nullslast&limit=10`),
    fetchSafe(`/n8n_aulas_pedagogicas_space?select=*&${filter}&order=inicio.desc.nullslast&limit=100`),
    fetchSafe(`/n8n_registros_aula_space?select=*&${filter}&order=created_at.desc.nullslast&limit=100`),
    fetchSafe(`/n8n_ocorrencias_pedagogicas_space?select=*&${filter}&order=created_at.desc.nullslast&limit=100`),
    fetchSafe(`/n8n_avaliacoes_aula_space?select=*&${filter}&order=created_at.desc.nullslast&limit=100`),
  ]);

  sendJson(res, 200, {
    ok: true,
    ficha: {
      aluno_id: alunoId,
      aluno_nome: alunoNome,
      onboarding: onboarding[0] || null,
      aulas,
      registros,
      faltas: registros.filter((r) => String(r?.status || "").toLowerCase() === "falta"),
      remarcacoes: registros.filter((r) => String(r?.status || "").toLowerCase() === "remarcada"),
      ocorrencias: alertas,
      avaliacoes,
    },
  });
};
