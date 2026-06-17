const { supabaseFetch } = require("./supabase-rest");

const TABLES = {
  onboarding: "n8n_onboarding_alunos_space",
  onboardingLegacy: "n8n_onboarding_pedagogico_space",
  lessons: "n8n_aulas_pedagogicas_space",
  registers: "n8n_registros_aula_space",
  alerts: "n8n_ocorrencias_pedagogicas_space",
  satisfaction: "n8n_satisfacao_alunos_space",
  flexge: "n8n_flexge_evolucao_alunos_space",
  teachers: "n8n_professores_space",
  reports: "n8n_relatorios_pedagogicos_space",
};

const safeEncode = (value) => encodeURIComponent(String(value || ""));

const isMissingRelation = (error) =>
  ["42P01", "PGRST205"].includes(String(error?.code || "")) ||
  /relation .* does not exist|could not find the table/i.test(String(error?.message || ""));

const fetchRows = async (path, { optional = false } = {}) => {
  try {
    const { data } = await supabaseFetch(path);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (optional && isMissingRelation(error)) return [];
    throw error;
  }
};

const fetchOnboardingRows = async (query = "select=*&limit=500") => {
  try {
    return await fetchRows(`/${TABLES.onboarding}?${query}`);
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    return fetchRows(`/${TABLES.onboardingLegacy}?${query}`, { optional: true });
  }
};

const uniqueRows = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = String(row?.id || JSON.stringify(row));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const listTeacherLessons = async ({ session, limit = 500, includeHistoryDays = 45 } = {}) => {
  const max = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const id = String(session?.sub || "").trim();
  const email = String(session?.email || "").trim().toLowerCase();
  const name = String(session?.name || "").trim();
  const since = new Date(Date.now() - Math.max(1, Number(includeHistoryDays) || 45) * 86400000).toISOString();
  const base = `select=*&inicio=gte.${safeEncode(since)}&order=inicio.asc.nullslast&limit=${max}`;
  const queries = [];
  if (id) queries.push(`/${TABLES.lessons}?${base}&professor_id=eq.${safeEncode(id)}`);
  if (email) queries.push(`/${TABLES.lessons}?${base}&professor_email=ilike.${safeEncode(email)}`);
  if (name) queries.push(`/${TABLES.lessons}?${base}&professor_nome=ilike.${safeEncode(name)}`);
  if (!queries.length) return [];

  const results = await Promise.all(
    queries.map((path) =>
      fetchRows(path).catch((error) => {
        if (String(error?.code || "") === "42703" || /column .* does not exist/i.test(String(error?.message || ""))) return [];
        throw error;
      })
    )
  );

  // Compatibilidade anterior à migration: professor_email ainda pode não existir.
  if (!results.flat().length && (id || name)) {
    const legacy = [];
    if (id) legacy.push(fetchRows(`/${TABLES.lessons}?${base}&professor_id=eq.${safeEncode(id)}`));
    if (name) legacy.push(fetchRows(`/${TABLES.lessons}?${base}&professor_nome=ilike.${safeEncode(name)}`));
    return uniqueRows((await Promise.all(legacy)).flat());
  }
  return uniqueRows(results.flat());
};

const listAllLessons = ({ limit = 1000 } = {}) => {
  const max = Math.max(1, Math.min(Number(limit) || 1000, 1000));
  return fetchRows(`/${TABLES.lessons}?select=*&order=inicio.desc.nullslast&limit=${max}`, { optional: true });
};

const listRegisters = ({ limit = 1000 } = {}) => {
  const max = Math.max(1, Math.min(Number(limit) || 1000, 1000));
  return fetchRows(`/${TABLES.registers}?select=*&order=created_at.desc.nullslast&limit=${max}`, { optional: true });
};

const statusOpen = (value) => !["resolvida", "resolvido", "fechada", "fechado"].includes(String(value || "").toLowerCase());
const dateKey = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
};

const loadAdminDashboard = async () => {
  let degraded = false;
  const safe = (promise) =>
    promise.catch(() => {
      degraded = true;
      return [];
    });
  const [onboarding, lessons, registers, alerts, satisfaction, flexge, teachers, reports] = await Promise.all([
    safe(fetchOnboardingRows("select=*&order=updated_at.desc.nullslast&limit=1000")),
    safe(listAllLessons({ limit: 1000 })),
    safe(listRegisters({ limit: 1000 })),
    safe(fetchRows(`/${TABLES.alerts}?select=*&order=created_at.desc.nullslast&limit=1000`, { optional: true })),
    safe(fetchRows(`/${TABLES.satisfaction}?select=*&order=created_at.desc.nullslast&limit=1000`, { optional: true })),
    safe(fetchRows(`/${TABLES.flexge}?select=*&order=flexge_last_sync_at.desc.nullslast&limit=1000`, { optional: true })),
    safe(fetchRows(`/${TABLES.teachers}?select=*&order=nome.asc.nullslast&limit=1000`, { optional: true })),
    safe(fetchRows(`/${TABLES.reports}?select=*&order=created_at.desc.nullslast&limit=200`, { optional: true })),
  ]);

  const today = dateKey(new Date());
  const registeredIds = new Set(registers.map((row) => String(row?.aula_id || "")).filter(Boolean));
  const pendingLessons = lessons.filter((row) => {
    const status = String(row?.status_aula || "").toLowerCase();
    const ended = row?.fim ? Date.parse(row.fim) < Date.now() : row?.inicio ? Date.parse(row.inicio) < Date.now() : false;
    return !registeredIds.has(String(row?.id || "")) && (ended || ["realizada", "pendente_registro"].includes(status));
  });
  const riskStudents = onboarding.filter((row) => {
    const level = String(row?.risco_nivel || "").toLowerCase();
    return ["alto", "critico", "crítico"].includes(level) || Number(row?.risco_score || row?.score_risco || 0) >= 70;
  });
  const scores = satisfaction.map((row) => Number(row?.nota)).filter(Number.isFinite);
  const npsScores = satisfaction.filter((row) => String(row?.tipo || "").toLowerCase() === "nps").map((row) => Number(row?.nota)).filter(Number.isFinite);
  const csatScores = satisfaction.filter((row) => String(row?.tipo || "").toLowerCase() === "csat").map((row) => Number(row?.nota)).filter(Number.isFinite);
  const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

  return {
    degraded,
    warning: degraded ? "Algumas fontes pedagógicas estão temporariamente indisponíveis." : undefined,
    metrics: {
      onboarding_em_andamento: onboarding.filter((row) => !["concluido", "concluído", "finalizado"].includes(String(row?.status_onboarding || "").toLowerCase())).length,
      alunos_sem_professor: onboarding.filter((row) => !row?.professor_id && !row?.professor_nome && !row?.professor_email).length,
      alunos_sem_primeira_aula: onboarding.filter((row) => !row?.primeira_aula_em).length,
      aulas_hoje: lessons.filter((row) => dateKey(row?.inicio) === today).length,
      aulas_pendentes_registro: pendingLessons.length,
      ocorrencias_abertas: alerts.filter((row) => statusOpen(row?.status)).length,
      alunos_em_risco: riskStudents.length,
      nps: average(npsScores),
      csat: average(csatScores.length ? csatScores : scores),
      flexge_criados: onboarding.filter((row) => row?.flexge_user_id || ["criado", "vinculado", "ativo"].includes(String(row?.flexge_status || "").toLowerCase())).length,
      flexge_total: onboarding.length,
    },
    onboarding,
    lessons,
    registers,
    pendingLessons,
    alerts,
    satisfaction,
    flexge,
    teachers,
    reports,
    riskStudents,
  };
};

const studentFilter = ({ alunoId, alunoNome }) => {
  if (alunoNome) return `aluno_nome=ilike.*${safeEncode(alunoNome)}*`;
  return `aluno_id=eq.${safeEncode(alunoId)}`;
};

const loadStudentCard = async ({ alunoId, alunoNome }) => {
  const filter = studentFilter({ alunoId, alunoNome });
  let degraded = false;
  const safe = (promise) =>
    promise.catch(() => {
      degraded = true;
      return [];
    });
  const [onboarding, lessons, registers, alerts, satisfaction, flexge, reports] = await Promise.all([
    safe(fetchOnboardingRows(`select=*&${filter}&order=updated_at.desc.nullslast&limit=10`)),
    safe(fetchRows(`/${TABLES.lessons}?select=*&${filter}&order=inicio.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.registers}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.alerts}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.satisfaction}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.flexge}?select=*&${filter}&order=flexge_last_sync_at.desc.nullslast&limit=10`, { optional: true })),
    safe(fetchRows(`/${TABLES.reports}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
  ]);
  const base = onboarding[0] || {};
  const evolution = flexge[0] || {};
  return {
    degraded,
    warning: degraded ? "Alguns dados da ficha estão temporariamente indisponíveis." : undefined,
    ...base,
    ...Object.fromEntries(Object.entries(evolution).filter(([, value]) => value != null && value !== "")),
    aluno_id: alunoId || base.aluno_id || evolution.aluno_id || "",
    aluno_nome: alunoNome || base.aluno_nome || "",
    onboarding: onboarding[0] || null,
    aulas: lessons,
    registros: registers,
    faltas: registers.filter((row) => String(row?.status || "").toLowerCase() === "falta"),
    remarcacoes: registers.filter((row) => String(row?.status || "").toLowerCase() === "remarcada"),
    ocorrencias: alerts,
    avaliacoes: satisfaction,
    flexge_evolucao: evolution || null,
    relatorios: reports,
  };
};

module.exports = {
  TABLES,
  fetchRows,
  fetchOnboardingRows,
  listTeacherLessons,
  listAllLessons,
  listRegisters,
  loadAdminDashboard,
  loadStudentCard,
  isMissingRelation,
};
