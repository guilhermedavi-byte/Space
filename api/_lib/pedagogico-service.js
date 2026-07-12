const { supabaseFetch } = require("./supabase-rest");
const { listCollectionAsAdmin } = require("./firestore-admin");

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
  financeStudents: "n8n_alunos_financeiro_space",
  adminStudentPreferences: "n8n_preferencias_alunos_pedagogico_space",
};

// OWNERSHIP: cadastro=Firestore, operação=Supabase (contrato 2026-07-12)
// - cadastro: nome, email, telefone, tipo, ativo, plano, professorId, cancelamento
// - operação: onboarding, financeiro, registros, ocorrências e telemetria operacional
// - merges abaixo deixam Firestore vencer em cadastro quando presente
// - Supabase só preenche buracos cadastrais e domina campos operacionais

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

const fetchRowsWithFallback = async (paths, { optional = false } = {}) => {
  const candidates = Array.isArray(paths) ? paths.filter(Boolean) : [paths].filter(Boolean);
  let lastError = null;
  for (const path of candidates) {
    try {
      return await fetchRows(path, { optional });
    } catch (error) {
      lastError = error;
      const raw = `${error?.code || ""} ${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
      const canTryNext =
        String(error?.code || "") === "42703" ||
        raw.includes("column") ||
        raw.includes("schema cache") ||
        raw.includes("could not find");
      if (!canTryNext) throw error;
    }
  }
  if (optional && lastError && isMissingRelation(lastError)) return [];
  if (lastError) throw lastError;
  return [];
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

const normalizeIdentity = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeName = (value) =>
  normalizeIdentity(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const compactName = (value) => normalizeName(value).replace(/\s+/g, "");

const namesMatch = (a, b) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const lc = compactName(left);
  const rc = compactName(right);
  return Boolean(lc && rc && (lc.includes(rc) || rc.includes(lc)));
};

const emailsMatch = (a, b) => {
  const left = normalizeIdentity(a);
  const right = normalizeIdentity(b);
  return Boolean(left && right && left === right);
};

const idsMatch = (a, b) => {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  return Boolean(left && right && left === right);
};

const teacherMatchesSession = (row, session) =>
  idsMatch(session?.sub, row?.professor_id || row?.teacher_id || row?.professorId) ||
  emailsMatch(session?.email, row?.professor_email || row?.teacher_email || row?.professorEmail) ||
  namesMatch(session?.name, row?.professor_nome || row?.teacher_name || row?.professorName);

const resolveTeacherFirestoreLink = async ({ session, usersCache } = {}) => {
  const teacherIds = new Set();
  const sessionId = String(session?.sub || "").trim();
  const sessionEmail = normalizeIdentity(session?.email);
  if (sessionId) teacherIds.add(sessionId);
  (Array.isArray(usersCache) ? usersCache : []).forEach((row) => {
    if (!row || typeof row !== "object") return;
    const tipo = normalizeIdentity(row?.tipo);
    if (!["teacher", "professor"].includes(tipo)) return;
    const email = normalizeIdentity(row?.email);
    if (!sessionEmail || email !== sessionEmail) return;
    const id = String(row?.id || "").trim();
    if (id) teacherIds.add(id);
  });
  return { teacherIds };
};

const loadFirestoreStudentsForTeacher = async ({ session } = {}) => {
  try {
    const users = await listCollectionAsAdmin("users", { pageSize: 1500 });
    const { teacherIds } = await resolveTeacherFirestoreLink({ session, usersCache: users });
    return (Array.isArray(users) ? users : [])
      .filter((row) => {
        const tipo = normalizeIdentity(row?.tipo);
        const professorId = String(row?.professorId || "").trim();
        return ["student", "aluno"].includes(tipo) && professorId && teacherIds.has(professorId);
      })
      .map((row) => {
        const id = String(row?.id || "").trim();
        return {
          id,
          firestore_doc_id: id,
          aluno_id: id,
          aluno_nome: row?.nome || "Aluno",
          professor_id: String(row?.professorId || "").trim(),
          professor_nome: String(row?.professorNome || "").trim(),
          plano: String(row?.plano || "").trim(),
          email: String(row?.email || "").trim(),
          telefone: String(row?.telefone || "").trim(),
          status: row?.ativo === false ? "inativo" : "ativo",
          source: "firestore",
        };
      });
  } catch (error) {
    console.warn("[pedagogico] firestore students unavailable", error);
    return [];
  }
};

const onlyDigits = (value) => String(value || "").replace(/\D+/g, "");

const studentIdentityKey = (row) => {
  const firestoreDocId = String(row?.firestore_doc_id || row?.firestoreDocId || "").trim();
  if (firestoreDocId) return `firestore:${firestoreDocId}`;
  const email = normalizeIdentity(row?.email || row?.aluno_email || row?.student_email);
  if (email) return `email:${email}`;
  const phone = onlyDigits(row?.telefone || row?.whatsapp || row?.phone);
  if (phone) return `phone:${phone}`;
  const id = String(row?.aluno_id || row?.student_id || row?.id || "").trim();
  if (id) return `id:${id}`;
  return `name:${normalizeIdentity(row?.aluno_nome || row?.nome || row?.name || row?.student_name)}`;
};

const mergePedagogicalStudents = ({ onboarding, financeStudents, preferences }) => {
  const preferenceMap = new Map(
    preferences.map((row) => [String(row?.aluno_chave || ""), String(row?.status || "ativo").toLowerCase()])
  );
  const merged = new Map();
  const add = (row, source) => {
    if (!row || typeof row !== "object") return;
    const effectiveSource =
      source === "pedagogico" && String(row?.source || "").trim().toLowerCase() === "firestore"
        ? "firestore"
        : source;
    const key = studentIdentityKey(row);
    if (!key || key === "name:") return;
    const previous = merged.get(key) || {};
    const combined = effectiveSource === "pedagogico" ? { ...previous, ...row } : { ...row, ...previous };
    const firestoreDocId = String(row?.firestore_doc_id || previous?.firestore_doc_id || "").trim();
    const firestoreNome = effectiveSource === "firestore" ? String(row?.aluno_nome || row?.nome || "").trim() : String(previous?.firestore_nome || "").trim();
    const supabaseNome = effectiveSource !== "firestore" ? String(row?.aluno_nome || row?.nome || "").trim() : String(previous?.supabase_nome || "").trim();
    const firestoreEmail = effectiveSource === "firestore" ? String(row?.email || row?.aluno_email || "").trim() : String(previous?.firestore_email || "").trim();
    const supabaseEmail = effectiveSource !== "firestore" ? String(row?.email || row?.aluno_email || "").trim() : String(previous?.supabase_email || "").trim();
    const firestoreTelefone = effectiveSource === "firestore" ? String(row?.telefone || "").trim() : String(previous?.firestore_telefone || "").trim();
    const supabaseTelefone = effectiveSource !== "firestore" ? String(row?.telefone || row?.whatsapp || row?.phone || "").trim() : String(previous?.supabase_telefone || "").trim();
    const firestorePlano = effectiveSource === "firestore" ? String(row?.plano || row?.plan || "").trim() : String(previous?.firestore_plano || "").trim();
    const supabasePlano = effectiveSource !== "firestore" ? String(row?.plano || row?.plan || "").trim() : String(previous?.supabase_plano || "").trim();
    const firestoreProfessorId =
      effectiveSource === "firestore" ? String(row?.professor_id || row?.teacher_id || row?.professorId || "").trim() : String(previous?.firestore_professor_id || "").trim();
    const supabaseProfessorId =
      effectiveSource !== "firestore" ? String(row?.professor_id || row?.teacher_id || row?.professorId || "").trim() : String(previous?.supabase_professor_id || "").trim();
    const firestoreProfessorNome =
      effectiveSource === "firestore" ? String(row?.professor_nome || row?.teacher_name || row?.professorName || "").trim() : String(previous?.firestore_professor_nome || "").trim();
    const supabaseProfessorNome =
      effectiveSource !== "firestore" ? String(row?.professor_nome || row?.teacher_name || row?.professorName || "").trim() : String(previous?.supabase_professor_nome || "").trim();
    const sourceStatus = String(combined.status || combined.status_financeiro || combined.status_onboarding || "ativo").toLowerCase();
    const preferredStatus = preferenceMap.get(key);
    const alunoId = String(combined.aluno_id || combined.student_id || combined.id || key).trim();
    const alunoNome = firestoreNome || supabaseNome || combined.aluno_nome || combined.nome || combined.name || combined.student_name || "Aluno";
    merged.set(key, {
      ...combined,
      firestore_doc_id: firestoreDocId || null,
      firestore_nome: firestoreNome || "",
      firestore_email: firestoreEmail || "",
      firestore_telefone: firestoreTelefone || "",
      firestore_plano: firestorePlano || "",
      firestore_professor_id: firestoreProfessorId || "",
      firestore_professor_nome: firestoreProfessorNome || "",
      supabase_nome: supabaseNome || "",
      supabase_email: supabaseEmail || "",
      supabase_telefone: supabaseTelefone || "",
      supabase_plano: supabasePlano || "",
      supabase_professor_id: supabaseProfessorId || "",
      supabase_professor_nome: supabaseProfessorNome || "",
      id: alunoId,
      aluno_id: alunoId,
      aluno_nome: alunoNome,
      nome: alunoNome,
      email: firestoreEmail || supabaseEmail || combined.email || combined.aluno_email || combined.student_email || "",
      telefone: firestoreTelefone || supabaseTelefone || combined.telefone || combined.whatsapp || combined.phone || "",
      plano: firestorePlano || supabasePlano || combined.plano || combined.plan || combined.contrato || "",
      professor_id: firestoreProfessorId || supabaseProfessorId || combined.professor_id || combined.teacher_id || combined.professorId || "",
      professor_nome: firestoreProfessorNome || supabaseProfessorNome || combined.professor_nome || combined.teacher_name || combined.professorName || "",
      professor_email: combined.professor_email || combined.teacher_email || combined.professorEmail || "",
      status_financeiro: previous.status_financeiro || previous.status || row.status_financeiro || row.status || "",
      aluno_chave: key,
      source: previous.source ? `${previous.source},${effectiveSource}` : effectiveSource,
      status_acesso: preferredStatus || (["inativo", "cancelado"].includes(sourceStatus) ? "inativo" : "ativo"),
      ativo_acesso: (preferredStatus || (["inativo", "cancelado"].includes(sourceStatus) ? "inativo" : "ativo")) === "ativo",
    });
  };
  financeStudents.forEach((row) => add(row, "financeiro"));
  onboarding.forEach((row) => add(row, "pedagogico"));
  return Array.from(merged.values());
};

const fetchFinanceStudents = ({ limit = 1000 } = {}) => {
  const max = Math.max(1, Math.min(Number(limit) || 1000, 2000));
  return fetchRowsWithFallback(
    [
      `/${TABLES.financeStudents}?select=*&order=updated_at.desc.nullslast&limit=${max}`,
      `/${TABLES.financeStudents}?select=*&order=created_at.desc.nullslast&limit=${max}`,
      `/${TABLES.financeStudents}?select=*&limit=${max}`,
    ],
    { optional: true }
  );
};

const sortTeacherRows = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((a, b) => {
      const left = String(a?.nome || a?.name || a?.professor_nome || a?.teacher_name || "").trim();
      const right = String(b?.nome || b?.name || b?.professor_nome || b?.teacher_name || "").trim();
      return left.localeCompare(right, "pt-BR");
    });

const fetchTeachersRows = async ({ limit = 1000 } = {}) => {
  const max = Math.max(1, Math.min(Number(limit) || 1000, 1000));
  const paths = [
    `/${TABLES.teachers}?select=*&order=nome.asc.nullslast&limit=${max}`,
    `/${TABLES.teachers}?select=*&order=updated_at.desc.nullslast&limit=${max}`,
    `/${TABLES.teachers}?select=*&limit=${max}`,
  ];
  try {
    const rows = await fetchRowsWithFallback(paths, { optional: true });
    return sortTeacherRows(rows);
  } catch (error) {
    console.error("[pedagogico] teachers source fetch failed", {
      paths,
      code: error?.code || "",
      message: error?.message || "",
      details: error?.details || "",
      hint: error?.hint || "",
    });
    throw error;
  }
};

const loadAdminDashboard = async ({ session } = {}) => {
  let degraded = false;
  let degradedReason = "";
  const safe = (label, promise) =>
    promise.catch((error) => {
      degraded = true;
      if (!degradedReason) degradedReason = label;
      console.error("[pedagogico] dashboard source failed", {
        label,
        code: error?.code || "",
        message: error?.message || "",
        details: error?.details || "",
        hint: error?.hint || "",
        stack: error?.stack || "",
      });
      return [];
    });
  const adminId = String(session?.sub || session?.email || "").trim();
  const [onboarding, lessons, registers, alerts, satisfaction, flexge, teachers, reports, financeStudents, preferences] = await Promise.all([
    safe("onboarding", fetchOnboardingRows("select=*&order=updated_at.desc.nullslast&limit=1000")),
    safe("lessons", listAllLessons({ limit: 1000 })),
    safe("registers", listRegisters({ limit: 1000 })),
    safe("alerts", fetchRows(`/${TABLES.alerts}?select=*&order=created_at.desc.nullslast&limit=1000`, { optional: true })),
    safe("satisfaction", fetchRows(`/${TABLES.satisfaction}?select=*&order=created_at.desc.nullslast&limit=1000`, { optional: true })),
    safe("flexge", fetchRows(`/${TABLES.flexge}?select=*&order=flexge_last_sync_at.desc.nullslast&limit=1000`, { optional: true })),
    safe("teachers", fetchTeachersRows({ limit: 1000 })),
    safe("reports", fetchRows(`/${TABLES.reports}?select=*&order=created_at.desc.nullslast&limit=200`, { optional: true })),
    safe("financeStudents", fetchFinanceStudents({ limit: 1000 })),
    adminId
      ? safe(
          "studentPreferences",
          fetchRows(
            `/${TABLES.adminStudentPreferences}?select=*&admin_id=eq.${safeEncode(adminId)}&limit=2000`,
            { optional: true }
          )
        )
      : [],
  ]);
  const students = mergePedagogicalStudents({ onboarding, financeStudents, preferences });

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
    degradedReason: degraded ? degradedReason || "unknown_source" : "",
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
      alunos_sincronizados_financeiro: financeStudents.length,
    },
    students,
    financeStudents,
    studentPreferences: preferences,
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

const lessonToTeacherEvent = (lesson) => {
  if (!lesson || typeof lesson !== "object") return null;
  const id = String(lesson.id || "").trim();
  if (!id) return null;
  const start = lesson.inicio ? new Date(lesson.inicio) : null;
  const end = lesson.fim ? new Date(lesson.fim) : null;
  const startMin = start && !Number.isNaN(start.getTime()) ? start.getHours() * 60 + start.getMinutes() : 0;
  const endMin = end && !Number.isNaN(end.getTime()) ? end.getHours() * 60 + end.getMinutes() : startMin + 30;
  return {
    id,
    type: "lesson",
    title: lesson.aluno_nome || "Aluno",
    alunoId: String(lesson.aluno_id || lesson.aluno_nome || "").trim(),
    alunoNome: lesson.aluno_nome || "",
    professorId: String(lesson.professor_id || "").trim(),
    professorNome: lesson.professor_nome || "",
    dateKey: dateKey(lesson.inicio),
    startMin,
    endMin,
    status: String(lesson.status_aula || "agendada").toLowerCase(),
    liveLessonId: id,
    liveUrl: `/aula/${encodeURIComponent(id)}`,
    payload: lesson,
  };
};

const registerToTeacherLog = (row) => {
  if (!row || typeof row !== "object") return null;
  const id = String(row.id || row.aula_id || "").trim();
  if (!id) return null;
  return {
    id,
    eventId: String(row.aula_id || "").trim(),
    professorId: String(row.professor_id || "").trim(),
    alunoId: String(row.aluno_id || row.aluno_nome || "").trim(),
    statusAula: String(row.status || row.status_aula || "").trim().toLowerCase(),
    criadoEm: row.created_at || null,
    atualizadoEm: row.updated_at || row.created_at || null,
    payload: {
      ...row,
      conteudoTrabalhado: row.conteudo_trabalhado || row.conteudo_aula || "",
      engajamentoNota: row.engajamento || "",
      humorAluno: row.humor || row.humor_aluno || "",
      observacoesInternas: row.observacoes || "",
      riscoEvasao: row.risco_evasao || "",
      avisosCoordenacao: [],
    },
  };
};

const loadTeacherStudents = async ({ session } = {}) => {
  const safe = (promise) => promise.catch(() => []);
  const [onboarding, financeStudents, lessons, registers, firestoreStudentRows] = await Promise.all([
    safe(fetchOnboardingRows("select=*&order=updated_at.desc.nullslast&limit=1000")),
    safe(fetchFinanceStudents({ limit: 1000 })),
    safe(listTeacherLessons({ session, limit: 1000, includeHistoryDays: 3650 })),
    safe(listRegisters({ limit: 1000 })),
    safe(loadFirestoreStudentsForTeacher({ session })),
  ]);

  const assignedKeys = new Set();
  onboarding.filter((row) => teacherMatchesSession(row, session)).forEach((row) => assignedKeys.add(studentIdentityKey(row)));
  financeStudents.filter((row) => teacherMatchesSession(row, session)).forEach((row) => assignedKeys.add(studentIdentityKey(row)));
  lessons.forEach((row) => {
    const key = studentIdentityKey(row);
    if (key && key !== "name:") assignedKeys.add(key);
  });
  registers.filter((row) => teacherMatchesSession(row, session)).forEach((row) => {
    const key = studentIdentityKey(row);
    if (key && key !== "name:") assignedKeys.add(key);
  });
  firestoreStudentRows.forEach((row) => {
    const key = studentIdentityKey(row);
    if (key && key !== "name:") assignedKeys.add(key);
  });

  const lessonStudentRows = lessons.map((row) => ({
    id: row.aluno_id || row.aluno_nome || "",
    aluno_id: row.aluno_id || row.aluno_nome || "",
    aluno_nome: row.aluno_nome || "Aluno",
    professor_id: row.professor_id || "",
    professor_nome: row.professor_nome || "",
    plano: row.plano || "",
    status: "ativo",
  }));
  const registerStudentRows = registers
    .filter((row) => teacherMatchesSession(row, session))
    .map((row) => ({
      id: row.aluno_id || row.aluno_nome || "",
      aluno_id: row.aluno_id || row.aluno_nome || "",
      aluno_nome: row.aluno_nome || "Aluno",
      professor_id: row.professor_id || "",
      professor_nome: row.professor_nome || "",
      status: "ativo",
    }));

  const students = mergePedagogicalStudents({
    onboarding: [...onboarding, ...lessonStudentRows, ...registerStudentRows, ...firestoreStudentRows],
    financeStudents,
    preferences: [],
  }).filter((row) => assignedKeys.has(row.aluno_chave || studentIdentityKey(row)));

  const events = lessons.map(lessonToTeacherEvent).filter(Boolean);
  const logs = registers.filter((row) => teacherMatchesSession(row, session)).map(registerToTeacherLog).filter(Boolean);
  const eventsById = new Map(events.map((event) => [String(event.id), event]));
  const logsByAluno = new Map();
  logs.forEach((log) => {
    const alunoId = String(log.alunoId || "").trim();
    if (!alunoId) return;
    const bucket = logsByAluno.get(alunoId) || [];
    bucket.push(log);
    logsByAluno.set(alunoId, bucket);
  });

  const summaries = students
    .map((student) => {
      const alunoId = String(student.aluno_id || student.id || student.aluno_nome || "").trim();
      const studentLogs = logsByAluno.get(alunoId) || logs.filter((log) => namesMatch(log?.payload?.aluno_nome, student.aluno_nome));
      const studentEvents = events.filter((event) => idsMatch(event.alunoId, alunoId) || namesMatch(event.alunoNome || event.title, student.aluno_nome));
      const lastEvent = studentEvents
        .slice()
        .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")) || (Number(b.startMin) || 0) - (Number(a.startMin) || 0))[0];
      const lastLog = studentLogs
        .slice()
        .sort((a, b) => Date.parse(b.atualizadoEm || b.criadoEm || "") - Date.parse(a.atualizadoEm || a.criadoEm || ""))[0];
      const lastLessonLabel = lastEvent?.dateKey
        ? `${lastEvent.dateKey.split("-").reverse().join("/")} • ${String(Math.floor((lastEvent.startMin || 0) / 60)).padStart(2, "0")}:${String((lastEvent.startMin || 0) % 60).padStart(2, "0")}`
        : "—";
      return {
        alunoId,
        nome: student.aluno_nome || student.nome || "Aluno",
        email: student.email || "",
        telefone: student.telefone || "",
        plano: student.plano || "",
        accessStatus: student.ativo_acesso === false ? "Inativo" : "Ativo",
        lastLessonLabel,
        totalLogs: studentLogs.length,
        riskLabel: student.risco_nivel || (Number(student.risco_score || student.score_risco || 0) >= 70 ? "Alto" : "Sem dados"),
        statusLabel:
          lastLog?.statusAula === "realizada"
            ? "Realizada"
            : lastLog?.statusAula === "falta"
              ? "Falta"
              : lastLog?.statusAula === "remarcada"
                ? "Remarcada"
                : "Sem dados",
        hasAlert: Number(student.risco_score || student.score_risco || 0) >= 70,
      };
    })
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

  return { students, summaries, events, logs };
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
  const [onboarding, lessons, registers, alerts, satisfaction, flexge, reports, financeStudents] = await Promise.all([
    safe(fetchOnboardingRows(`select=*&${filter}&order=updated_at.desc.nullslast&limit=10`)),
    safe(fetchRows(`/${TABLES.lessons}?select=*&${filter}&order=inicio.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.registers}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.alerts}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.satisfaction}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(fetchRows(`/${TABLES.flexge}?select=*&${filter}&order=flexge_last_sync_at.desc.nullslast&limit=10`, { optional: true })),
    safe(fetchRows(`/${TABLES.reports}?select=*&${filter}&order=created_at.desc.nullslast&limit=100`, { optional: true })),
    safe(
      fetchRowsWithFallback(
        [
          `/${TABLES.financeStudents}?select=*&${filter}&order=updated_at.desc.nullslast&limit=10`,
          `/${TABLES.financeStudents}?select=*&${filter}&order=created_at.desc.nullslast&limit=10`,
          `/${TABLES.financeStudents}?select=*&${filter}&limit=10`,
        ],
        { optional: true }
      )
    ),
  ]);
  const finance = financeStudents[0] || {};
  // OWNERSHIP: cadastro=Firestore, operação=Supabase (contrato 2026-07-12)
  // Esta ficha operacional é Supabase-only; aqui só mesclamos fontes operacionais.
  const base = { ...(onboarding[0] || {}), ...finance };
  const evolution = flexge[0] || {};
  return {
    degraded,
    warning: degraded ? "Alguns dados da ficha estão temporariamente indisponíveis." : undefined,
    ...base,
    ...Object.fromEntries(Object.entries(evolution).filter(([, value]) => value != null && value !== "")),
    aluno_id: alunoId || base.aluno_id || evolution.aluno_id || "",
    aluno_nome: alunoNome || base.aluno_nome || "",
    onboarding: onboarding[0] || null,
    financeiro: financeStudents[0] || null,
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
  loadTeacherStudents,
  studentIdentityKey,
  mergePedagogicalStudents,
  fetchFinanceStudents,
  isMissingRelation,
};
