// Admin > Controle Pedagógico (gestão de aulas recorrentes/templates)
let adminPedagogicoState = {
  isLoading: false,
  loadedAt: 0,
  teachers: [],
  teachersById: new Map(),
  students: [],
  studentsById: new Map(),
  classes: [],
  groups: [],
  groupsById: new Map(),
  plans: [],
  plansById: new Map(),
  surveys: [],
  teacherAlerts: [],
  pedagogicalFeedbacks: [],
  liveLessonFeedbacks: [],
  lessonLogs: [],
  groupsByClassId: new Map(),
  onboardingContents: [],
  onboardingContentsAll: [],
  onboardingQuizzes: [],
  teacherOnboardingProgressAll: [],
  teacherQuizSubmissionsAll: [],
  pedagogicalOps: { metrics: {}, onboarding: [], alerts: [], pendingLessons: [], riskStudents: [], flexge: [] },
  filters: {
    teacherId: "",
    dow: "",
    type: "",
    studentId: "",
    status: "",
    plan: "",
  },
  activeGroup: "operacao", // operacao | alunosTurmas | professores | qualidade | gestao
  activeTab: "overview", // subtabs: overview | agenda | aulas | conflitos | alunos | turmas | vinculos | professores | feedbacks | onboarding | pesquisas | npscsat | avisos | planos | relatorios | configuracoes
  conflicts: [],
};

const setAdminPedagogicoStatus = (text, tone = "") => {
  if (!(adminPedStatus instanceof HTMLElement)) return;
  adminPedStatus.textContent = String(text || "");
  adminPedStatus.dataset.tone = String(tone || "");
};

const normalizeClassType = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "group" || raw === "grupo" || raw === "em_grupo") return "group";
  return "individual";
};

const normalizeClassStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "paused" || raw === "pausada" || raw === "pausado") return "paused";
  if (
    raw === "ended" ||
    raw === "encerrada" ||
    raw === "encerrado" ||
    raw === "inactive" ||
    raw === "inativa" ||
    raw === "inativo" ||
    raw === "cancelado" ||
    raw === "cancelada" ||
    raw === "cancelled" ||
    raw === "canceled" ||
    raw === "deleted"
  )
    return "ended";
  return "active";
};

const normalizePlanKeyLoose = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("diamond")) return "diamond";
  if (raw.includes("gold")) return "gold";
  if (raw.includes("turma")) return "turma";
  return raw;
};

const slugifyClassRoomPart = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const buildAdminPedClassLiveUrl = (classRow) => {
  const c = classRow && typeof classRow === "object" ? classRow : {};
  const firstStudent = (Array.isArray(c.studentNames) && c.studentNames[0]) || (Array.isArray(c.studentIds) && c.studentIds[0]) || "";
  const title = c.title || c.groupName || (c.type === "group" ? "turma" : firstStudent) || "aula";
  const teacher = c.teacherName || c.teacherId || "professor";
  const days = (Array.isArray(c.daysOfWeek) ? c.daysOfWeek : []).map(daysLabelShort).join("-");
  const time = Number.isFinite(Number(c.startMin)) ? formatHmFromMinutes(c.startMin).replace(/:/g, "") : "";
  const parts = [
    "space",
    "aula",
    slugifyClassRoomPart(title),
    slugifyClassRoomPart(firstStudent),
    slugifyClassRoomPart(teacher),
    slugifyClassRoomPart(days),
    slugifyClassRoomPart(time),
    slugifyClassRoomPart(c.id),
  ].filter(Boolean);
  const roomId = parts.join("-").slice(0, 180) || `space-aula-${Date.now()}`;
  const origin = typeof window !== "undefined" && window.location && window.location.origin ? window.location.origin : "";
  const displayTitle = `Space Aula ${title}`;
  return `${origin}/sala/${encodeURIComponent(roomId)}?title=${encodeURIComponent(displayTitle)}`;
};

const normalizeDaysOfWeek = (value) => {
  const out = [];
  const arr = Array.isArray(value) ? value : [];
  arr.forEach((item) => {
    const n = Number(item);
    if (Number.isFinite(n) && n >= 0 && n <= 6) {
      if (!out.includes(n)) out.push(n);
      return;
    }
    const raw = String(item || "").trim().toLowerCase();
    const map = {
      mon: 1,
      monday: 1,
      seg: 1,
      tue: 2,
      tuesday: 2,
      ter: 2,
      wed: 3,
      wednesday: 3,
      qua: 3,
      thu: 4,
      thursday: 4,
      qui: 4,
      fri: 5,
      friday: 5,
      sex: 5,
      sat: 6,
      saturday: 6,
      sab: 6,
      dom: 0,
      sun: 0,
      sunday: 0,
    };
    const dow = map[raw];
    if (dow != null && !out.includes(dow)) out.push(dow);
  });
  out.sort((a, b) => a - b);
  return out;
};

const normalizeMinutesValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return clampInt(Math.round(value), 0, 24 * 60, 0);
  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (/^\d{2}:\d{2}$/.test(raw)) {
    const mins = timeToMinutes(raw);
    return Number.isFinite(mins) ? clampInt(mins, 0, 24 * 60, 0) : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? clampInt(Math.round(n), 0, 24 * 60, 0) : 0;
};

const normalizeClassRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;

  const type = normalizeClassType(src.type);
  const status = src.deletedAt || src.deleted_at || src.cancelledAt || src.canceladoEm ? "ended" : normalizeClassStatus(src.status || src.statusAula);
  const title = String(src.title || "").trim();
  const teacherId = String(src.teacherId || src.professorId || "").trim();
  const teacherName = String(src.teacherName || src.professorNome || src.professorName || "").trim();
  const groupId = String(src.groupId || "").trim();
  const groupName = String(src.groupName || "").trim();
  const planId = String(src.planId || "").trim();
  const planName = String(src.planName || "").trim();
  const plan = normalizePlanKeyLoose(src.plan || src.plano || planName || "");
  const daysOfWeek = normalizeDaysOfWeek(src.daysOfWeek || src.weekDays || src.diasSemana || []);
  const startMin = normalizeMinutesValue(src.startMin ?? src.startTime ?? src.horaInicio);
  const endMin = normalizeMinutesValue(src.endMin ?? src.endTime ?? src.horaFim);
  const startDate = String(src.startDate || src.startDateKey || src.dateKey || "").trim();
  const endDate = String(src.endDate || src.endDateKey || "").trim();

  const studentIdsRaw = Array.isArray(src.studentIds) ? src.studentIds : Array.isArray(src.alunoIds) ? src.alunoIds : [];
  const studentIds = studentIdsRaw.map((v) => String(v || "").trim()).filter(Boolean);
  const studentNamesRaw = Array.isArray(src.studentNames) ? src.studentNames : Array.isArray(src.alunoNomes) ? src.alunoNomes : [];
  const studentNames = studentNamesRaw.map((v) => String(v || "").trim()).filter(Boolean);

  const createdAtMs = parseFirestoreDateToMs(src.createdAt || src.criadoEm);
  const updatedAtMs = parseFirestoreDateToMs(src.updatedAt || src.atualizadoEm);

  return {
    id: docId,
    type,
    status,
    title,
    teacherId,
    teacherName,
    groupId,
    groupName,
    planId,
    planName,
    plan,
    daysOfWeek,
    startMin,
    endMin,
    startDate: isValidDateKey(startDate) ? startDate : "",
    endDate: isValidDateKey(endDate) ? endDate : "",
    studentIds,
    studentNames,
    notes: String(src.notes || src.observacoes || "").trim(),
    createdAtMs,
    updatedAtMs,
    createdBy: String(src.createdBy || "").trim(),
    updatedBy: String(src.updatedBy || "").trim(),
  };
};

const fetchClassesFromFirestore = async () => {
  let sourceRows = null;
  if (currentRole === "admin") {
    const response = await fetchWithAuth("/api/admin-data?collection=classes");
    if (response.ok) {
      const payload = await response.json().catch(() => null);
      sourceRows = Array.isArray(payload?.rows) ? payload.rows : [];
    }
  }

  if (!sourceRows) {
    const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_pedagogico");
    const user = await waitForFirebaseAuthReady(firebase, 5000);
    if (!user) {
      const e = new Error("firebase_not_authenticated");
      e.code = "auth/no-current-user";
      throw e;
    }
    const col = firebase.collection(firebase.primaryDb, "classes");
    const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_classes_list");
    sourceRows = [];
    snap.forEach((docSnap) => sourceRows.push({ id: docSnap.id, ...(docSnap.data ? docSnap.data() : {}) }));
  }

  const rows = [];
  sourceRows.forEach((data) => {
    const row = normalizeClassRow({ id: data.id, data });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => {
    const ta = String(a.teacherName || "").localeCompare(String(b.teacherName || ""), "pt-BR");
    if (ta) return ta;
    const sa = (a.startMin || 0) - (b.startMin || 0);
    if (sa) return sa;
    return String(a.id).localeCompare(String(b.id));
  });
  return rows;
};

const fetchLiveLessonsForAdminPedagogico = async () => {
  const res = await fetchWithAuth("/api/live-lessons?scope=dashboard&limit=500");
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "live_lessons_failed");
  return Array.isArray(data?.lessons) ? data.lessons : [];
};

const normalizeLiveLessonsAsAdminClasses = (lessons) => {
  return (Array.isArray(lessons) ? lessons : [])
    .map((lesson) => {
      const ui = normalizeLiveLessonForUi(lesson);
      if (!ui) return null;
      const date = parseDateKey(ui.dateKey);
      const statusRaw = String(ui.status || "").toLowerCase();
      const ended = ["realizada", "falta", "cancelada"].includes(statusRaw);
      return {
        id: `live:${ui.id}`,
        liveLessonId: ui.id,
        type: "individual",
        status: ended ? "ended" : "active",
        title: String(lesson.titulo || ui.aluno || "Aula"),
        teacherId: ui.professorId,
        teacherName: ui.professor,
        groupId: "",
        groupName: "",
        planId: "",
        planName: String(lesson.plano || ""),
        plan: normalizePlanKeyLoose(lesson.plano || ""),
        daysOfWeek: date ? [date.getDay()] : [],
        startMin: ui.startMin,
        endMin: ui.endMin,
        startDate: ui.dateKey,
        endDate: ui.dateKey,
        studentIds: ui.alunoId ? [ui.alunoId] : [],
        studentNames: ui.aluno ? [ui.aluno] : [],
        notes: String(lesson.observacoes || lesson.briefing_pedagogico || ""),
        createdAtMs: Date.parse(lesson.created_at || "") || 0,
        updatedAtMs: Date.parse(lesson.updated_at || "") || 0,
        source: "supabase",
      };
    })
    .filter(Boolean);
};

const mergeAdminPedagogicoClasses = (classes, liveClasses) => {
  const out = [];
  const seen = new Set();
  [...(Array.isArray(classes) ? classes : []), ...(Array.isArray(liveClasses) ? liveClasses : [])].forEach((row) => {
    if (!row || typeof row !== "object") return;
    const key = String(row.id || row.liveLessonId || "").trim();
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    out.push(row);
  });
  return out;
};

const normalizePlanStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "inactive" || raw === "inativo" || raw === "desativado") return "inactive";
  return "active";
};

const normalizePlanType = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "group" || raw === "grupo") return "group";
  if (raw === "hybrid" || raw === "hibrido" || raw === "híbrido") return "hybrid";
  return "individual";
};

const normalizePlanRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const name = String(src.name || src.nome || "").trim();
  const monthlyPrice = Number.isFinite(Number(src.monthlyPrice)) ? Number(src.monthlyPrice) : src.monthlyPrice ?? null;
  const weeklyClasses = Number.isFinite(Number(src.weeklyClasses)) ? Number(src.weeklyClasses) : src.weeklyClasses ?? null;
  const type = normalizePlanType(src.type);
  const description = String(src.description || src.descricao || "").trim();
  const status = normalizePlanStatus(src.status);
  const createdAtMs = parseFirestoreDateToMs(src.createdAt || src.criadoEm);
  const updatedAtMs = parseFirestoreDateToMs(src.updatedAt || src.atualizadoEm);
  return {
    id: docId,
    name: name || "Plano",
    monthlyPrice,
    weeklyClasses,
    type,
    description,
    status,
    createdAtMs,
    updatedAtMs,
  };
};

const fetchPlansFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_plans");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const col = firebase.collection(firebase.primaryDb, "plans");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_plans_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizePlanRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  return rows;
};

const normalizeGroupRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const name = String(src.name || src.nome || src.groupName || "").trim();
  const teacherId = String(src.teacherId || src.professorId || "").trim();
  const teacherName = String(src.teacherName || src.professorNome || src.professorName || "").trim();
  const planId = String(src.planId || "").trim();
  const planName = String(src.planName || src.plan || src.plano || "").trim();
  const classId = String(src.classId || "").trim();
  const status = normalizeClassStatus(src.status);
  const daysOfWeek = normalizeDaysOfWeek(src.daysOfWeek || src.weekDays || src.diasSemana || []);
  const startMin = normalizeMinutesValue(src.startMin ?? src.startTime ?? src.horaInicio);
  const endMin = normalizeMinutesValue(src.endMin ?? src.endTime ?? src.horaFim);
  const studentIdsRaw = Array.isArray(src.studentIds) ? src.studentIds : Array.isArray(src.alunoIds) ? src.alunoIds : [];
  const studentIds = studentIdsRaw.map((v) => String(v || "").trim()).filter(Boolean);
  const studentNamesRaw = Array.isArray(src.studentNames) ? src.studentNames : Array.isArray(src.alunoNomes) ? src.alunoNomes : [];
  const studentNames = studentNamesRaw.map((v) => String(v || "").trim()).filter(Boolean);
  const createdAtMs = parseFirestoreDateToMs(src.createdAt || src.criadoEm);
  const updatedAtMs = parseFirestoreDateToMs(src.updatedAt || src.atualizadoEm);
  return {
    id: docId,
    name: name || "Turma",
    teacherId,
    teacherName,
    planId,
    planName,
    classId,
    daysOfWeek,
    startMin,
    endMin,
    status,
    studentIds,
    studentNames,
    notes: String(src.notes || src.observacoes || "").trim(),
    createdAtMs,
    updatedAtMs,
  };
};

const fetchGroupsFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_groups");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const col = firebase.collection(firebase.primaryDb, "groups");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_groups_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeGroupRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  return rows;
};

const normalizeTeacherAlertStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "resolved" || raw === "resolvido") return "resolved";
  if (raw === "analysis" || raw === "em_analise" || raw === "em análise" || raw === "em analise") return "analysis";
  return "open";
};

const normalizeTeacherAlertPriority = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "high" || raw === "alta") return "high";
  if (raw === "medium" || raw === "media" || raw === "média") return "medium";
  return "low";
};

const normalizeTeacherAlertRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const createdAtMs = parseFirestoreDateToMs(src.createdAt || src.criadoEm);
  const resolvedAtMs = parseFirestoreDateToMs(src.resolvedAt || src.resolvedAts);
  return {
    id: docId,
    teacherId: String(src.teacherId || "").trim(),
    teacherName: String(src.teacherName || "").trim(),
    studentId: String(src.studentId || "").trim(),
    studentName: String(src.studentName || "").trim(),
    category: String(src.category || "").trim(),
    priority: normalizeTeacherAlertPriority(src.priority),
    description: String(src.description || "").trim(),
    status: normalizeTeacherAlertStatus(src.status),
    coordinatorNotes: String(src.coordinatorNotes || "").trim(),
    createdAtMs,
    resolvedAtMs,
  };
};

const fetchTeacherAlertsFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_teacher_alerts");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const col = firebase.collection(firebase.primaryDb, "teacherAlerts");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_teacher_alerts_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeTeacherAlertRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return rows;
};

const normalizeOnboardingContentRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const type = normalizeOnboardingContentType(src.type);
  const status = normalizeOnboardingStatus(src.status);
  const order = Number.isFinite(Number(src.order)) ? Number(src.order) : 0;
  const required = src.required !== false;
  return {
    id: docId,
    title: String(src.title || "").trim() || "Conteúdo",
    description: String(src.description || "").trim(),
    type,
    order,
    required,
    status,
    videoUrl: String(src.videoUrl || "").trim(),
    documentUrl: String(src.documentUrl || "").trim(),
    storagePath: String(src.storagePath || "").trim(),
    fileName: String(src.fileName || "").trim(),
    fileType: String(src.fileType || "").trim(),
    fileSize: Number.isFinite(Number(src.fileSize)) ? Number(src.fileSize) : 0,
    estimatedDuration: String(src.estimatedDuration || "").trim(),
    quizId: String(src.quizId || "").trim(),
    createdAtMs: parseFirestoreDateToMs(src.createdAt),
    updatedAtMs: parseFirestoreDateToMs(src.updatedAt),
    createdBy: String(src.createdBy || "").trim(),
    updatedBy: String(src.updatedBy || "").trim(),
  };
};

const fetchOnboardingContentsFromFirestore = async ({ includeInactive = false } = {}) => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_onboarding_contents");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }

  const baseCol = firebase.collection(firebase.primaryDb, "onboardingContents");
  const q = includeInactive
    ? firebase.query(baseCol, firebase.orderBy("order", "asc"))
    : firebase.query(baseCol, firebase.where("status", "==", "active"), firebase.orderBy("order", "asc"));
  const snap = await withTimeout(firebase.getDocs(q), 12_000, "firestore_onboarding_contents_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeOnboardingContentRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => (a.order || 0) - (b.order || 0));
  return rows;
};

const normalizeOnboardingQuizRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const questionsRaw = Array.isArray(src.questions) ? src.questions : [];
  const questions = questionsRaw
    .map((q) => {
      if (!q || typeof q !== "object") return null;
      const qid = String(q.id || "").trim() || `q_${Math.random().toString(36).slice(2, 8)}`;
      const type = normalizeQuizQuestionType(q.type);
      const required = q.required !== false;
      const points = Number.isFinite(Number(q.points)) ? Number(q.points) : 0;
      const options = Array.isArray(q.options) ? q.options.map((o) => String(o || "")) : [];
      const correctAnswer = q.correctAnswer ?? "";
      return {
        id: qid,
        questionText: String(q.questionText || q.text || "").trim(),
        type,
        options,
        correctAnswer,
        points,
        required,
      };
    })
    .filter(Boolean);

  return {
    id: docId,
    contentId: String(src.contentId || "").trim(),
    title: String(src.title || "").trim() || "Quiz",
    description: String(src.description || "").trim(),
    showResultToTeacher: src.showResultToTeacher !== false,
    questions,
    createdAtMs: parseFirestoreDateToMs(src.createdAt),
    updatedAtMs: parseFirestoreDateToMs(src.updatedAt),
  };
};

const fetchOnboardingQuizzesFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_onboarding_quizzes");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const col = firebase.collection(firebase.primaryDb, "onboardingQuizzes");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_onboarding_quizzes_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeOnboardingQuizRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR"));
  return rows;
};

const normalizeTeacherOnboardingProgressRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const teacherId = String(src.teacherId || "").trim();
  const contentId = String(src.contentId || "").trim();
  if (!teacherId || !contentId) return null;
  return {
    id: docId,
    teacherId,
    teacherName: String(src.teacherName || "").trim(),
    contentId,
    status: normalizeTeacherOnboardingProgressStatus(src.status),
    startedAtMs: parseFirestoreDateToMs(src.startedAt),
    completedAtMs: parseFirestoreDateToMs(src.completedAt),
    updatedAtMs: parseFirestoreDateToMs(src.updatedAt),
    lastAccessAtMs: parseFirestoreDateToMs(src.lastAccessAt),
  };
};

const fetchTeacherOnboardingProgressFromFirestore = async ({ teacherId }) => {
  const id = String(teacherId || "").trim();
  if (!id) return [];
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_teacher_onboarding_progress");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const q = firebase.query(firebase.collection(firebase.primaryDb, "teacherOnboardingProgress"), firebase.where("teacherId", "==", id));
  const snap = await withTimeout(firebase.getDocs(q), 12_000, "firestore_teacher_onboarding_progress_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeTeacherOnboardingProgressRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  return rows;
};

const normalizeTeacherQuizSubmissionRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const teacherId = String(src.teacherId || "").trim();
  const quizId = String(src.quizId || "").trim();
  if (!teacherId || !quizId) return null;
  return {
    id: docId,
    teacherId,
    teacherName: String(src.teacherName || "").trim(),
    quizId,
    contentId: String(src.contentId || "").trim(),
    answers: Array.isArray(src.answers) ? src.answers : [],
    score: Number.isFinite(Number(src.score)) ? Number(src.score) : 0,
    maxScore: Number.isFinite(Number(src.maxScore)) ? Number(src.maxScore) : 0,
    submittedAtMs: parseFirestoreDateToMs(src.submittedAt),
    status: String(src.status || "").trim(),
  };
};

const fetchTeacherQuizSubmissionsFromFirestore = async ({ teacherId }) => {
  const id = String(teacherId || "").trim();
  if (!id) return [];
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_teacher_quiz_submissions");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const q = firebase.query(firebase.collection(firebase.primaryDb, "teacherQuizSubmissions"), firebase.where("teacherId", "==", id));
  const snap = await withTimeout(firebase.getDocs(q), 12_000, "firestore_teacher_quiz_submissions_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeTeacherQuizSubmissionRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => (b.submittedAtMs || 0) - (a.submittedAtMs || 0));
  return rows;
};

const fetchAllTeacherOnboardingProgressFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_onboarding_progress_all");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const col = firebase.collection(firebase.primaryDb, "teacherOnboardingProgress");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_teacher_onboarding_progress_all");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeTeacherOnboardingProgressRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  return rows;
};

const fetchAllTeacherQuizSubmissionsFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_teacher_quiz_submissions_all");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const col = firebase.collection(firebase.primaryDb, "teacherQuizSubmissions");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_teacher_quiz_submissions_all");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeTeacherQuizSubmissionRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  return rows;
};

const normalizeSurveyRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const nps = Number.isFinite(Number(src.nps)) ? Number(src.nps) : null;
  const csat = Number.isFinite(Number(src.csat)) ? Number(src.csat) : null;
  const createdAtMs = parseFirestoreDateToMs(src.createdAt || src.criadoEm);
  return {
    id: docId,
    studentId: String(src.studentId || "").trim(),
    studentName: String(src.studentName || "").trim(),
    teacherId: String(src.teacherId || "").trim(),
    teacherName: String(src.teacherName || "").trim(),
    classId: String(src.classId || "").trim(),
    groupId: String(src.groupId || "").trim(),
    nps,
    csat,
    comment: String(src.comment || "").trim(),
    createdAtMs,
  };
};

const fetchSurveysFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_surveys");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const col = firebase.collection(firebase.primaryDb, "surveys");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_surveys_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizeSurveyRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return rows;
};

const normalizePedFeedbackRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;
  const createdAtMs = parseFirestoreDateToMs(src.createdAt || src.criadoEm);
  const readAtMs = parseFirestoreDateToMs(src.readAt);
  return {
    id: docId,
    teacherId: String(src.teacherId || "").trim(),
    teacherName: String(src.teacherName || "").trim(),
    classId: String(src.classId || "").trim(),
    studentId: String(src.studentId || "").trim(),
    groupId: String(src.groupId || "").trim(),
    observationDate: String(src.observationDate || "").trim(),
    classType: normalizeClassType(src.classType || src.type),
    generalScore: Number.isFinite(Number(src.generalScore)) ? Number(src.generalScore) : null,
    strengths: String(src.strengths || "").trim(),
    improvements: String(src.improvements || "").trim(),
    actionPlan: String(src.actionPlan || "").trim(),
    freeNotes: String(src.freeNotes || "").trim(),
    createdBy: String(src.createdBy || "").trim(),
    createdAtMs,
    readByTeacher: src.readByTeacher === true,
    readAtMs,
    payload: src,
  };
};

const fetchPedagogicalFeedbacksFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_feedbacks");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }
  const col = firebase.collection(firebase.primaryDb, "pedagogicalFeedbacks");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_feedbacks_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const row = normalizePedFeedbackRow({ id: docSnap.id, data: docSnap.data ? docSnap.data() : null });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return rows;
};

const fetchLiveLessonFeedbacks = async () => {
  try {
    const res = await fetchWithAuth("/api/live-lessons/feedbacks?limit=500");
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "live_lesson_feedbacks_failed");
    return {
      summary: data?.summary && typeof data.summary === "object" ? data.summary : {},
      feedbacks: Array.isArray(data?.feedbacks) ? data.feedbacks : [],
    };
  } catch (error) {
    console.error("[live-lessons] feedbacks load failed:", error);
    return { summary: {}, feedbacks: [] };
  }
};

const daysLabelShort = (dow) => {
  const n = Number(dow);
  if (n === 1) return "Seg";
  if (n === 2) return "Ter";
  if (n === 3) return "Qua";
  if (n === 4) return "Qui";
  if (n === 5) return "Sex";
  if (n === 6) return "Sáb";
  if (n === 0) return "Dom";
  return "—";
};

const classesOverlap = (a, b) => {
  const aStart = Number(a?.startMin) || 0;
  const aEnd = Number(a?.endMin) || 0;
  const bStart = Number(b?.startMin) || 0;
  const bEnd = Number(b?.endMin) || 0;
  return aStart < bEnd && bStart < aEnd;
};

const classDateRangesOverlap = (a, b) => {
  const aStart = String(a?.startDate || "");
  const aEnd = String(a?.endDate || "");
  const bStart = String(b?.startDate || "");
  const bEnd = String(b?.endDate || "");
  const aTo = aEnd && isValidDateKey(aEnd) ? aEnd : "9999-12-31";
  const bTo = bEnd && isValidDateKey(bEnd) ? bEnd : "9999-12-31";
  const aFrom = aStart && isValidDateKey(aStart) ? aStart : "0000-01-01";
  const bFrom = bStart && isValidDateKey(bStart) ? bStart : "0000-01-01";
  return aFrom <= bTo && bFrom <= aTo;
};

const computeAdminPedagogicoConflicts = (classes) => {
  const arr = Array.isArray(classes) ? classes : [];
  const active = arr.filter((c) => c && normalizeClassStatus(c.status) !== "ended");
  const conflicts = [];
  for (let i = 0; i < active.length; i += 1) {
    const a = active[i];
    for (let j = i + 1; j < active.length; j += 1) {
      const b = active[j];
      if (!a || !b) continue;
      if (!classDateRangesOverlap(a, b)) continue;
      const aDays = new Set(Array.isArray(a.daysOfWeek) ? a.daysOfWeek : []);
      const bDays = new Set(Array.isArray(b.daysOfWeek) ? b.daysOfWeek : []);
      const hasDay = [...aDays].some((d) => bDays.has(d));
      if (!hasDay) continue;
      if (!classesOverlap(a, b)) continue;

      const isTeacherConflict = a.teacherId && b.teacherId && a.teacherId === b.teacherId;
      const aStudents = new Set(Array.isArray(a.studentIds) ? a.studentIds : []);
      const bStudents = new Set(Array.isArray(b.studentIds) ? b.studentIds : []);
      const sharedStudents = [...aStudents].filter((id) => bStudents.has(id));
      const isStudentConflict = sharedStudents.length > 0;

      if (!isTeacherConflict && !isStudentConflict) continue;

      const reason = isTeacherConflict
        ? "Professor com duas aulas no mesmo horário"
        : "Aluno com duas aulas no mesmo horário";

      conflicts.push({
        reason,
        teacherId: a.teacherId || b.teacherId || "",
        classA: a,
        classB: b,
        sharedStudents,
      });
    }
  }
  return conflicts;
};

const adminPedagogicoFilteredClasses = () => {
  const all = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  const f = adminPedagogicoState.filters || {};
  const teacherId = String(f.teacherId || "").trim();
  const dow = String(f.dow || "").trim();
  const type = String(f.type || "").trim().toLowerCase();
  const studentId = String(f.studentId || "").trim();
  const status = String(f.status || "").trim().toLowerCase();
  const plan = String(f.plan || "").trim().toLowerCase();

  return all.filter((c) => {
    if (!c) return false;
    if (teacherId && String(c.teacherId || "") !== teacherId) return false;
    if (dow) {
      const n = Number(dow);
      const days = Array.isArray(c.daysOfWeek) ? c.daysOfWeek : [];
      if (!Number.isFinite(n) || !days.includes(n)) return false;
    }
    if (type && String(c.type || "") !== type) return false;
    if (studentId) {
      const ids = Array.isArray(c.studentIds) ? c.studentIds : [];
      if (!ids.includes(studentId)) return false;
    }
    if (status && normalizeClassStatus(c.status) !== normalizeClassStatus(status)) return false;
    if (plan && String(c.plan || "").toLowerCase() !== plan) return false;
    return true;
  });
};

const renderAdminPedagogicoMetrics = () => {
  const classes = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  const active = classes.filter((c) => normalizeClassStatus(c?.status) === "active");
  const conflicts = Array.isArray(adminPedagogicoState.conflicts) ? adminPedagogicoState.conflicts : [];
  const teachers = Array.isArray(adminPedagogicoState.teachers) ? adminPedagogicoState.teachers : [];
  const students = Array.isArray(adminPedagogicoState.students) ? adminPedagogicoState.students : [];
  const groups = Array.isArray(adminPedagogicoState.groups) ? adminPedagogicoState.groups : [];
  const surveys = Array.isArray(adminPedagogicoState.surveys) ? adminPedagogicoState.surveys : [];
  const teacherAlerts = Array.isArray(adminPedagogicoState.teacherAlerts) ? adminPedagogicoState.teacherAlerts : [];
  const feedbacks = Array.isArray(adminPedagogicoState.pedagogicalFeedbacks) ? adminPedagogicoState.pedagogicalFeedbacks : [];
  const liveFeedbacks = Array.isArray(adminPedagogicoState.liveLessonFeedbacks) ? adminPedagogicoState.liveLessonFeedbacks : [];
  const lessonLogs = Array.isArray(adminPedagogicoState.lessonLogs) ? adminPedagogicoState.lessonLogs : [];
  const ops = adminPedagogicoState.pedagogicalOps && typeof adminPedagogicoState.pedagogicalOps === "object" ? adminPedagogicoState.pedagogicalOps : {};
  const opsMetrics = ops.metrics && typeof ops.metrics === "object" ? ops.metrics : {};

  const setKpi = (key, { value = "—", sub = "", badge = "", badgeTone = "" } = {}) => {
    const vEl = document.querySelector(`[data-admin-ped-kpi-value="${CSS.escape(String(key))}"]`);
    const sEl = document.querySelector(`[data-admin-ped-kpi-sub="${CSS.escape(String(key))}"]`);
    const bEl = document.querySelector(`[data-admin-ped-kpi-badge="${CSS.escape(String(key))}"]`);
    if (vEl instanceof HTMLElement) vEl.textContent = String(value);
    if (sEl instanceof HTMLElement) sEl.textContent = String(sub || "");
    if (bEl instanceof HTMLElement) {
      bEl.textContent = String(badge || "");
      bEl.hidden = !badge;
      bEl.classList.remove("is-danger", "is-warn");
      if (badgeTone === "danger") bEl.classList.add("is-danger");
      if (badgeTone === "warn") bEl.classList.add("is-warn");
    }
  };

  const studentsActive = students.filter((s) => s && typeof s === "object" && s.ativo).length;
  const teachersActive = teachers.filter((t) => t && typeof t === "object" && t.ativo).length;
  const groupsActive = groups.filter((g) => normalizeClassStatus(g?.status) === "active").length;

  const npsRows = surveys.map((s) => (Number.isFinite(s?.nps) ? Number(s.nps) : NaN)).filter((n) => Number.isFinite(n));
  const csatRows = surveys.map((s) => (Number.isFinite(s?.csat) ? Number(s.csat) : NaN)).filter((n) => Number.isFinite(n));
  const npsAvg = npsRows.length ? npsRows.reduce((a, b) => a + b, 0) / npsRows.length : NaN;
  const csatAvg = csatRows.length ? csatRows.reduce((a, b) => a + b, 0) / csatRows.length : NaN;

  const alertsOpen = teacherAlerts.filter((a) => String(a?.status || "") !== "resolved").length;
  const feedbackPending = feedbacks.filter((f) => !(f && typeof f === "object" && f.readByTeacher === true)).length;
  const lowLiveRatings = liveFeedbacks.filter((f) => Number(f?.notaProfessor) <= 6).length;

  const studentsRiskSet = new Set();
  lessonLogs.forEach((log) => {
    const risk = String(log?.payload?.riscoEvasao || log?.payload?.risco_evasao || "").trim().toLowerCase();
    if (risk === "alto" || risk === "high") {
      const alunoId = String(log?.alunoId || "").trim();
      if (alunoId) studentsRiskSet.add(alunoId);
    }
  });

  const todayDow = (() => {
    const d = new Date();
    const js = d.getDay();
    if (js === 0) return 0;
    return js;
  })();
  const today = todayDow ? active.filter((c) => (Array.isArray(c.daysOfWeek) ? c.daysOfWeek : []).includes(todayDow)) : [];
  const todayInd = today.filter((c) => normalizeClassType(c?.type) === "individual");
  const todayGrp = today.filter((c) => normalizeClassType(c?.type) === "group");

  const linkedStudents = new Set();
  active.forEach((c) => (Array.isArray(c.studentIds) ? c.studentIds : []).forEach((id) => (id ? linkedStudents.add(String(id)) : null)));
  let studentsNoClass = 0;
  (Array.isArray(students) ? students : []).forEach((s) => {
    if (!s || typeof s !== "object" || !s.ativo) return;
    const id = String(s.id || "").trim();
    if (!id) return;
    if (!linkedStudents.has(id)) studentsNoClass += 1;
  });

  const noTeacher = active.filter((c) => !String(c.teacherId || "").trim()).length;
  const criticalCount = conflicts.length + noTeacher + studentsNoClass;

  setKpi("classesToday", {
    value: String(Number(opsMetrics.aulas_hoje ?? today.length) || 0),
    sub: Number(opsMetrics.aulas_pendentes_registro || 0)
      ? `${opsMetrics.aulas_pendentes_registro} aula(s) pendente(s) de registro.`
      : today.length
        ? `${todayInd.length} individuais · ${todayGrp.length} em grupo`
        : "Nenhuma aula hoje.",
  });

  setKpi("critical", {
    value: String(
      Number(opsMetrics.alunos_sem_professor || 0) +
        Number(opsMetrics.alunos_sem_primeira_aula || 0) +
        Number(opsMetrics.ocorrencias_abertas || 0)
    ),
    sub: `Sem professor: ${Number(opsMetrics.alunos_sem_professor || 0)} · Sem primeira aula: ${Number(
      opsMetrics.alunos_sem_primeira_aula || 0
    )} · Ocorrências: ${Number(opsMetrics.ocorrencias_abertas || 0)}`,
    badge:
      Number(opsMetrics.alunos_sem_professor || 0) +
        Number(opsMetrics.alunos_sem_primeira_aula || 0) +
        Number(opsMetrics.ocorrencias_abertas || 0) >
      0
        ? "Crítico"
        : "",
    badgeTone: "danger",
  });

  setKpi("risk", {
    value: String(Number(opsMetrics.alunos_em_risco ?? studentsRiskSet.size) || 0),
    sub: "Risco consolidado do onboarding e das ocorrências pedagógicas.",
    badge: Number(opsMetrics.alunos_em_risco ?? studentsRiskSet.size) ? "Atenção" : "",
    badgeTone: Number(opsMetrics.alunos_em_risco ?? studentsRiskSet.size) ? "warn" : "",
  });

  setKpi("feedbackPending", {
    value: String(feedbackPending + lowLiveRatings),
    sub: lowLiveRatings
      ? `${lowLiveRatings} avaliação baixa de aula ao vivo · ${feedbackPending} feedbacks pedagógicos pendentes.`
      : feedbackPending
        ? "Professores aguardando devolutiva."
        : "Nenhum feedback pendente.",
    badge: feedbackPending || lowLiveRatings ? "Atenção" : "",
    badgeTone: feedbackPending || lowLiveRatings ? "warn" : "",
  });

  setKpi("teachersActive", {
    value: String(teachersActive),
    sub: `${teachersActive}/${teachers.length || 0} ativos`,
  });
  setKpi("groupsActive", {
    value: String(groupsActive),
    sub: `${groupsActive}/${groups.length || 0} ativas`,
  });
  setKpi("npsAvg", {
    value:
      opsMetrics.nps != null && Number.isFinite(Number(opsMetrics.nps))
        ? Number(opsMetrics.nps).toFixed(1)
        : surveys.length && Number.isFinite(npsAvg)
          ? npsAvg.toFixed(1)
          : "Sem dados",
    sub: "Baseado nas respostas disponíveis.",
  });
  setKpi("csatAvg", {
    value:
      opsMetrics.csat != null && Number.isFinite(Number(opsMetrics.csat))
        ? Number(opsMetrics.csat).toFixed(1)
        : surveys.length && Number.isFinite(csatAvg)
          ? csatAvg.toFixed(1)
          : "Sem dados",
    sub: `Flexge: ${Number(opsMetrics.flexge_criados || 0)}/${Number(opsMetrics.flexge_total || 0)} alunos provisionados.`,
  });
  setKpi("conflicts", {
    value: String(conflicts.length),
    sub: conflicts.length ? "Requer resolução." : "0 conflitos.",
  });
  setKpi("studentsNoClass", {
    value: String(studentsNoClass),
    sub: studentsNoClass ? "Existem alunos ativos sem aula vinculada." : "0 alunos sem aula.",
  });
};

const ADMIN_PED_NAV_GROUPS = [
  {
    key: "operacao",
    label: "Operação",
    tabs: [
      { key: "overview", label: "Visão Geral" },
      { key: "agenda", label: "Agenda" },
      { key: "aulas", label: "Aulas" },
      { key: "conflitos", label: "Conflitos" },
    ],
  },
  {
    key: "alunosTurmas",
    label: "Alunos & Turmas",
    tabs: [
      { key: "alunos", label: "Alunos" },
      { key: "turmas", label: "Turmas" },
      { key: "vinculos", label: "Vínculos" },
    ],
  },
  {
    key: "professores",
    label: "Professores",
    tabs: [
      { key: "professores", label: "Professores" },
      { key: "feedbacks", label: "Feedbacks" },
      { key: "onboarding", label: "Onboarding" },
    ],
  },
  {
    key: "qualidade",
    label: "Qualidade",
    tabs: [
      { key: "pesquisas", label: "Pesquisas" },
      { key: "npscsat", label: "NPS/CSAT" },
      { key: "avisos", label: "Avisos" },
    ],
  },
  {
    key: "gestao",
    label: "Gestão",
    tabs: [
      { key: "planos", label: "Planos" },
      { key: "relatorios", label: "Relatórios" },
      { key: "configuracoes", label: "Configurações" },
    ],
  },
];

const adminPedFindGroupForTab = (tabKey) => {
  const t = String(tabKey || "").trim();
  const group = ADMIN_PED_NAV_GROUPS.find((g) => g.tabs.some((t2) => String(t2.key) === t));
  return group ? String(group.key) : "operacao";
};

const adminPedEnsureNavState = () => {
  const groupKeys = new Set(ADMIN_PED_NAV_GROUPS.map((g) => String(g.key)));
  const desiredTab = String(adminPedagogicoState.activeTab || "overview").trim() || "overview";
  const desiredGroup = String(adminPedagogicoState.activeGroup || "").trim();
  const groupFromTab = adminPedFindGroupForTab(desiredTab);
  const nextGroup = desiredGroup && groupKeys.has(desiredGroup) ? desiredGroup : groupFromTab;
  adminPedagogicoState.activeGroup = nextGroup;

  const group = ADMIN_PED_NAV_GROUPS.find((g) => g.key === nextGroup) || ADMIN_PED_NAV_GROUPS[0];
  if (!group || !Array.isArray(group.tabs) || !group.tabs.length) {
    adminPedagogicoState.activeTab = "overview";
    return;
  }
  const tabAllowed = group.tabs.some((t) => String(t.key) === desiredTab);
  if (!tabAllowed) {
    adminPedagogicoState.activeTab = String(group.tabs[0].key);
  }
};

const renderAdminPedagogicoTabs = () => {
  adminPedEnsureNavState();
  const activeGroup = String(adminPedagogicoState.activeGroup || "operacao");
  const activeTab = String(adminPedagogicoState.activeTab || "overview");

  document.querySelectorAll("[data-admin-ped-group]").forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const key = String(btn.getAttribute("data-admin-ped-group") || "");
    const isActive = key === activeGroup;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const group = ADMIN_PED_NAV_GROUPS.find((g) => g.key === activeGroup) || ADMIN_PED_NAV_GROUPS[0];
  if (adminPedSubtabs instanceof HTMLElement) {
    adminPedSubtabs.innerHTML = (group?.tabs || [])
      .map((t) => {
        const isActive = String(t.key) === activeTab;
        return `<button class="admin-ped-subtab ${isActive ? "is-active" : ""}" type="button" role="tab" aria-selected="${isActive ? "true" : "false"}" data-admin-ped-tab="${escapeHtml(
          String(t.key)
        )}">${escapeHtml(String(t.label || t.key))}</button>`;
      })
      .join("");
  }

  document.querySelectorAll("[data-admin-ped-panel]").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    const name = String(panel.getAttribute("data-admin-ped-panel") || "");
    const isActive = name === activeTab;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
};

const formatShortDateFromMs = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

const renderAdminLiveClassroomSnapshot = async () => {
  const root = document.querySelector("[data-admin-live-classroom-snapshot]");
  if (!(root instanceof HTMLElement)) return;
  root.innerHTML = `<div class="admin-ped-empty-inline"><div class="admin-ped-empty-title">Carregando salas ao vivo...</div><div class="admin-ped-empty-sub">Buscando aulas no Supabase.</div></div>`;
  try {
    const res = await fetchWithAuth("/api/live-lessons?scope=dashboard&limit=200");
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "live_lessons_failed");
    const summary = data?.summary && typeof data.summary === "object" ? data.summary : {};
    const lessons = Array.isArray(data?.lessons) ? data.lessons : [];
    const cards = [
      ["Aulas ao vivo agora", summary.liveNow],
      ["Proximas aulas de hoje", summary.upcomingToday],
      ["Aguardando inicio", summary.waitingStart],
      ["Sem sala de video", summary.noVideoRoom],
      ["Sem registro", summary.noRegister],
      ["Canceladas", summary.cancelled],
      ["Professores em aula", summary.teachersInClass],
      ["Alunos em aula", summary.studentsInClass],
    ];
    const upcoming = lessons
      .slice()
      .sort((a, b) => Date.parse(a.inicio || "") - Date.parse(b.inicio || ""))
      .slice(0, 4);
    root.innerHTML = `
      <div class="admin-ped-live-grid">
        ${cards
          .map(
            ([label, value]) => `
              <div class="admin-ped-qualitymini-metric">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(String(Number(value) || 0))}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="admin-ped-mini-list">
        ${
          upcoming.length
            ? upcoming
                .map((lesson) => {
                  const start = lesson.inicio ? formatShortDate(new Date(lesson.inicio)) : "Sem horario";
                  const who = `${lesson.aluno_nome || "Aluno"} · ${lesson.professor_nome || "Professor"}`;
                  return `<a class="admin-ped-mini-row" href="/aula/${encodeURIComponent(lesson.id)}"><div class="admin-ped-mini-title">${escapeHtml(
                    who
                  )}</div><div class="admin-ped-mini-sub">${escapeHtml(start)}</div></a>`;
                })
                .join("")
            : `<div class="admin-ped-empty-inline"><div class="admin-ped-empty-title">Nenhuma aula ao vivo encontrada.</div><div class="admin-ped-empty-sub">Quando o n8n popular a tabela, elas aparecem aqui.</div></div>`
        }
      </div>
    `;
  } catch (error) {
    console.error("[admin-ped] live classroom snapshot failed", error);
    root.innerHTML = `<div class="admin-ped-empty-inline"><div class="admin-ped-empty-title">Nao foi possivel carregar aulas ao vivo.</div><div class="admin-ped-empty-sub">Confira Supabase e tabela n8n_aulas_pedagogicas_space.</div></div>`;
  }
};

const renderAdminPedagogicoOverview = () => {
  if (!(adminPedOverview instanceof HTMLElement)) return;

  const classes = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  const teachersById = adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById : new Map();
  const studentsById = adminPedagogicoState.studentsById instanceof Map ? adminPedagogicoState.studentsById : new Map();
  const alerts = Array.isArray(adminPedagogicoState.teacherAlerts) ? adminPedagogicoState.teacherAlerts : [];
  const feedbacks = Array.isArray(adminPedagogicoState.pedagogicalFeedbacks) ? adminPedagogicoState.pedagogicalFeedbacks : [];
  const surveys = Array.isArray(adminPedagogicoState.surveys) ? adminPedagogicoState.surveys : [];
  const lessonLogs = Array.isArray(adminPedagogicoState.lessonLogs) ? adminPedagogicoState.lessonLogs : [];
  const conflicts = Array.isArray(adminPedagogicoState.conflicts) ? adminPedagogicoState.conflicts : [];
  const ops = adminPedagogicoState.pedagogicalOps && typeof adminPedagogicoState.pedagogicalOps === "object" ? adminPedagogicoState.pedagogicalOps : {};
  const opsMetrics = ops.metrics && typeof ops.metrics === "object" ? ops.metrics : {};

  const activeClasses = classes.filter((c) => normalizeClassStatus(c?.status) === "active");
  const noTeacher = activeClasses.filter((c) => !String(c.teacherId || "").trim());
  const noStudent = activeClasses.filter((c) => normalizeClassType(c?.type) === "individual" && (!Array.isArray(c.studentIds) || !c.studentIds.length));
  const noGroup = activeClasses.filter((c) => normalizeClassType(c?.type) === "group" && !String(c.groupName || "").trim());

  const linkedStudents = new Set();
  activeClasses.forEach((c) => {
    (Array.isArray(c.studentIds) ? c.studentIds : []).forEach((id) => {
      const s = String(id || "").trim();
      if (s) linkedStudents.add(s);
    });
  });
  const studentsNoClass = [];
  studentsById.forEach((meta, id) => {
    const isActive = meta && typeof meta === "object" ? meta.ativo !== false : true;
    if (!isActive) return;
    if (!linkedStudents.has(String(id))) studentsNoClass.push(meta);
  });
  studentsNoClass.sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR"));

  const todayDow = (() => {
    const d = new Date();
    const js = d.getDay(); // 0..6 (Sun..Sat)
    if (js === 0) return 0;
    return js; // 1..6 (Seg..Sáb)
  })();

  const todayClasses = todayDow
    ? activeClasses
        .filter((c) => (Array.isArray(c.daysOfWeek) ? c.daysOfWeek : []).includes(todayDow))
        .slice()
        .sort((a, b) => (a.startMin || 0) - (b.startMin || 0))
    : [];

  const alertsOpen = alerts.filter((a) => String(a?.status || "") !== "resolved").length;
  const feedbackPending = feedbacks.filter((f) => !(f && typeof f === "object" && f.readByTeacher === true)).length;

  const studentsRiskSet = new Set();
  lessonLogs.forEach((log) => {
    const risk = String(log?.payload?.riscoEvasao || log?.payload?.risco_evasao || "").trim().toLowerCase();
    if (risk === "alto" || risk === "high") {
      const alunoId = String(log?.alunoId || "").trim();
      if (alunoId) studentsRiskSet.add(alunoId);
    }
  });

  const teachers = Array.isArray(adminPedagogicoState.teachers) ? adminPedagogicoState.teachers : [];
  const activeTeachers = teachers.filter((t) => t && typeof t === "object" && t.ativo);
  const feedbackByTeacher = new Map();
  feedbacks.forEach((f) => {
    const tid = String(f?.teacherId || "").trim();
    if (!tid) return;
    const ms = Number(f?.createdAtMs || 0);
    const prev = feedbackByTeacher.get(tid) || 0;
    feedbackByTeacher.set(tid, Math.max(prev, ms));
  });
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const teachersNoRecentFeedback = activeTeachers.filter((t) => {
    const tid = String(t.id || "").trim();
    const last = feedbackByTeacher.get(tid) || 0;
    return !last || now - last > THIRTY_DAYS;
  });

  const studentsWithSurvey = new Set(surveys.map((s) => String(s?.studentId || "").trim()).filter(Boolean));
  const studentsNoSurvey = [];
  studentsById.forEach((meta, id) => {
    const isActive = meta && typeof meta === "object" ? meta.ativo !== false : true;
    if (!isActive) return;
    if (!studentsWithSurvey.has(String(id))) studentsNoSurvey.push(meta);
  });

  const workItems = [
    { title: "Conflitos de agenda", priority: "Crítico", count: conflicts.length, actionTab: "conflitos", actionLabel: conflicts.length ? "Resolver" : "OK" },
    { title: "Aulas sem professor", priority: "Crítico", count: noTeacher.length, actionTab: "aulas", actionLabel: noTeacher.length ? "Ver aulas" : "OK" },
    { title: "Alunos ativos sem aula vinculada", priority: "Crítico", count: studentsNoClass.length, actionTab: "vinculos", actionLabel: studentsNoClass.length ? "Vincular alunos" : "OK" },
    { title: "Alunos em risco", priority: "Atenção", count: studentsRiskSet.size, actionTab: "alunos", actionLabel: studentsRiskSet.size ? "Ver alunos" : "OK" },
    { title: "Avisos dos professores (abertos)", priority: "Atenção", count: alertsOpen, actionTab: "avisos", actionLabel: alertsOpen ? "Ver avisos" : "OK" },
    { title: "Feedbacks pendentes (não lidos)", priority: "Atenção", count: feedbackPending, actionTab: "feedbacks", actionLabel: "Ver feedbacks" },
    { title: "Professores sem feedback recente", priority: "Normal", count: teachersNoRecentFeedback.length, actionTab: "feedbacks", actionLabel: teachersNoRecentFeedback.length ? "Enviar feedback" : "OK" },
    { title: "Alunos sem pesquisa respondida", priority: "Normal", count: studentsNoSurvey.length, actionTab: "pesquisas", actionLabel: "Ver pesquisas" },
  ];

  const priorityPill = (priority) => {
    const p = String(priority || "");
    if (p === "Crítico") return `<span class="admin-ped-pill is-ended">Crítico</span>`;
    if (p === "Atenção") return `<span class="admin-ped-pill is-paused">Atenção</span>`;
    return `<span class="admin-ped-pill">Normal</span>`;
  };

  const emptyBlock = (title, sub, ctaLabel, ctaTab) => `
    <div class="admin-ped-empty-inline">
      <div class="admin-ped-empty-title">${escapeHtml(title)}</div>
      <div class="admin-ped-empty-sub">${escapeHtml(sub)}</div>
      ${ctaLabel ? `<button class="admin-ped-action" type="button" data-admin-ped-nav="${escapeHtml(String(ctaTab || ""))}">${escapeHtml(ctaLabel)}</button>` : ""}
    </div>
  `;

  const agendaItem = (c) => {
    const time = `${formatHmFromMinutes(c.startMin || 0)}–${formatHmFromMinutes(c.endMin || 0)}`;
    const typeLabel = c.type === "group" ? "Grupo" : "Individual";
    const who =
      c.type === "group"
        ? String(c.groupName || c.title || "Turma")
        : (c.studentNames && c.studentNames[0]) || (c.studentIds && c.studentIds[0]) || "Aluno";
    const teacher = c.teacherName || String(teachersById.get(String(c.teacherId || ""))?.nome || "Professor");
    const status = normalizeClassStatus(c.status);
    const statusLabel = status === "active" ? "Ativa" : status === "paused" ? "Pausada" : "Encerrada";
    const badgeClass = status === "active" ? "is-active" : status === "paused" ? "is-paused" : "is-ended";
    const plan = c.plan ? String(c.plan).toUpperCase() : "";
    return `
      <button class="admin-ped-agendaquick-item" type="button" data-admin-ped-class-open="${escapeHtml(String(c.id || ""))}">
        <div class="admin-ped-agendaquick-time">${escapeHtml(time)}</div>
        <div class="admin-ped-agendaquick-main">
          <div class="admin-ped-agendaquick-title">${escapeHtml(who)}</div>
          <div class="admin-ped-agendaquick-sub">${escapeHtml(`${teacher} · ${typeLabel}${plan ? ` · ${plan}` : ""}`)}</div>
        </div>
        <span class="admin-ped-pill ${badgeClass}">${escapeHtml(statusLabel)}</span>
      </button>
    `;
  };

  const npsVals = surveys.map((s) => (Number.isFinite(s?.nps) ? Number(s.nps) : NaN)).filter((n) => Number.isFinite(n));
  const csatVals = surveys.map((s) => (Number.isFinite(s?.csat) ? Number(s.csat) : NaN)).filter((n) => Number.isFinite(n));
  const npsAvg = npsVals.length ? npsVals.reduce((a, b) => a + b, 0) / npsVals.length : NaN;
  const csatAvg = csatVals.length ? csatVals.reduce((a, b) => a + b, 0) / csatVals.length : NaN;

  const recentAlerts = alerts.slice().sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)).slice(0, 5);
  const recentFeedbacks = feedbacks.slice().sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)).slice(0, 5);

  const metricValue = (key) => {
    const value = opsMetrics[key];
    return value == null || value === "" ? "Sem dados" : String(value);
  };
  const scoreValue = (key) => {
    const value = opsMetrics[key];
    return value == null || value === "" || !Number.isFinite(Number(value)) ? "Sem dados" : Number(value).toFixed(1);
  };

  adminPedOverview.innerHTML = `
    <div class="admin-ped-ops-summary">
      ${[
        ["Onboardings em andamento", metricValue("onboarding_em_andamento")],
        ["Alunos sem professor", metricValue("alunos_sem_professor")],
        ["Sem primeira aula", metricValue("alunos_sem_primeira_aula")],
        ["Aulas hoje", metricValue("aulas_hoje")],
        ["Pendentes de registro", metricValue("aulas_pendentes_registro")],
        ["Ocorrências abertas", metricValue("ocorrencias_abertas")],
        ["Alunos em risco", metricValue("alunos_em_risco")],
        ["NPS", scoreValue("nps")],
        ["CSAT", scoreValue("csat")],
        ["Flexge", `${metricValue("flexge_criados")} / ${metricValue("flexge_total")}`],
      ]
        .map(
          ([label, value]) => `
            <article class="admin-ped-ops-summary-card">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </article>
          `
        )
        .join("")}
    </div>
    <div class="admin-ped-op">
      <section class="admin-ped-op-block">
        <div class="admin-ped-op-head">
          <div>
            <div class="admin-ped-op-title">Pendências para resolver</div>
            <div class="admin-ped-op-sub">O que precisa de ação para manter a operação rodando.</div>
          </div>
        </div>
        <div class="admin-ped-workqueue">
          ${workItems
            .map((item) => {
              const isOk = item.count === 0;
              const toneCls = item.priority === "Crítico" ? "is-danger" : item.priority === "Atenção" ? "is-warn" : "";
              const btnDisabled = isOk ? "disabled" : "";
              return `
                <div class="admin-ped-workitem ${isOk ? "is-ok" : ""}">
                  <div>
                    <div class="admin-ped-workitem-title">${escapeHtml(item.title)}</div>
                    <div class="admin-ped-workitem-meta">
                      ${priorityPill(item.priority)}
                      <span class="admin-ped-pill ${toneCls}">${escapeHtml(String(item.count))}</span>
                    </div>
                  </div>
                  <div class="admin-ped-workitem-actions">
                    <button class="admin-ped-action ${toneCls}" type="button" data-admin-ped-nav="${escapeHtml(String(item.actionTab || ""))}" ${btnDisabled}>${escapeHtml(
                item.actionLabel
              )}</button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>

      <section class="admin-ped-op-grid">
        <article class="surface-card admin-ped-op-card">
          <div class="admin-ped-op-cardhead">
            <div>
              <div class="admin-ped-op-cardtitle">Salas ao vivo</div>
              <div class="admin-ped-op-cardsub">Operacao das aulas embarcadas na plataforma.</div>
            </div>
            <button class="admin-ped-action is-muted" type="button" data-admin-ped-nav="aulas">Ver aulas</button>
          </div>
          <div data-admin-live-classroom-snapshot></div>
        </article>

        <article class="surface-card admin-ped-op-card">
          <div class="admin-ped-op-cardhead">
            <div>
              <div class="admin-ped-op-cardtitle">Agenda de hoje</div>
              <div class="admin-ped-op-cardsub">Próximas aulas do dia.</div>
            </div>
            <button class="admin-ped-action is-muted" type="button" data-admin-ped-nav="agenda">Ver agenda</button>
          </div>
          <div class="admin-ped-agendaquick">
            ${
              todayDow === 0
                ? emptyBlock("Hoje é domingo", "Sem aulas recorrentes configuradas para domingo.", "Criar aula", "")
                : todayClasses.length
                  ? todayClasses.slice(0, 10).map(agendaItem).join("")
                  : emptyBlock("Nenhuma aula agendada para hoje.", "Crie uma aula para iniciar a operação.", "Criar aula", "")
            }
          </div>
        </article>

        <article class="surface-card admin-ped-op-card">
          <div class="admin-ped-op-cardhead">
            <div>
              <div class="admin-ped-op-cardtitle">Qualidade pedagógica</div>
              <div class="admin-ped-op-cardsub">Satisfação (NPS/CSAT) e pontos de atenção.</div>
            </div>
            <button class="admin-ped-action is-muted" type="button" data-admin-ped-nav="npscsat">Ver detalhes</button>
          </div>
          ${
            surveys.length
              ? `<div class="admin-ped-qualitymini">
                  <div class="admin-ped-qualitymini-metric">
                    <span>NPS médio</span>
                    <strong>${escapeHtml(Number.isFinite(npsAvg) ? npsAvg.toFixed(1) : "Sem dados")}</strong>
                  </div>
                  <div class="admin-ped-qualitymini-metric">
                    <span>CSAT médio</span>
                    <strong>${escapeHtml(Number.isFinite(csatAvg) ? csatAvg.toFixed(1) : "Sem dados")}</strong>
                  </div>
                  <div class="admin-ped-qualitymini-note">Use o painel para identificar detratores e professores para acompanhamento.</div>
                </div>`
              : emptyBlock("Nenhuma pesquisa respondida ainda.", "Quando houver respostas, você verá NPS/CSAT, detratores e comentários.", "Ver pesquisas", "pesquisas")
          }
        </article>

        <article class="surface-card admin-ped-op-card">
          <div class="admin-ped-op-cardhead">
            <div>
              <div class="admin-ped-op-cardtitle">Avisos recentes</div>
              <div class="admin-ped-op-cardsub">Sinais do professor que pedem acompanhamento.</div>
            </div>
            <button class="admin-ped-action is-muted" type="button" data-admin-ped-nav="avisos">Ver avisos</button>
          </div>
          <div class="admin-ped-mini-list">
            ${
              recentAlerts.length
                ? recentAlerts
                    .map((a) => {
                      const who = a.studentName || a.studentId || "Aluno";
                      const when = formatShortDateFromMs(a.createdAtMs);
                      const title = `${who} · ${a.category || "Aviso"}`;
                      return `<div class="admin-ped-mini-row"><div class="admin-ped-mini-title">${escapeHtml(
                        title
                      )}</div><div class="admin-ped-mini-sub">${escapeHtml(when)}</div></div>`;
                    })
                    .join("")
                : emptyBlock("Nenhum aviso recente.", "Sem alertas abertos agora.", "Ver avisos", "avisos")
            }
          </div>
        </article>

        <article class="surface-card admin-ped-op-card">
          <div class="admin-ped-op-cardhead">
            <div>
              <div class="admin-ped-op-cardtitle">Feedbacks recentes</div>
              <div class="admin-ped-op-cardsub">Devolutivas pedagógicas enviadas aos professores.</div>
            </div>
            <button class="admin-ped-action is-muted" type="button" data-admin-ped-nav="feedbacks">Ver feedbacks</button>
          </div>
          <div class="admin-ped-mini-list">
            ${
              recentFeedbacks.length
                ? recentFeedbacks
                    .map((f) => {
                      const when = formatShortDateFromMs(f.createdAtMs);
                      const prof = f.teacherName ? f.teacherName : f.teacherId ? f.teacherId : "Professor";
                      const score = Number.isFinite(Number(f.generalScore)) ? String(f.generalScore) : "—";
                      return `<div class="admin-ped-mini-row"><div class="admin-ped-mini-title">${escapeHtml(
                        prof
                      )}</div><div class="admin-ped-mini-sub">${escapeHtml(`${when} · ${score}`)}</div></div>`;
                    })
                    .join("")
                : emptyBlock("Nenhum feedback enviado ainda.", "Envie um feedback estruturado para iniciar o acompanhamento.", "Enviar feedback", "feedbacks")
            }
          </div>
        </article>
      </section>
    </div>
  `;

  if (adminPedEmptyOverview instanceof HTMLElement) {
    const hasAny = classes.length || alerts.length || feedbacks.length || surveys.length;
    adminPedEmptyOverview.hidden = Boolean(hasAny);
  }
  renderAdminLiveClassroomSnapshot();
};

const pedStatusPillHtml = (status) => {
  const s = String(status || "").trim().toLowerCase();
  const cls = s === "active" ? "is-active" : s === "paused" ? "is-paused" : s === "ended" ? "is-ended" : "";
  const label = s === "active" ? "Ativa" : s === "paused" ? "Pausada" : s === "ended" ? "Encerrada" : "—";
  return `<span class="admin-ped-pill ${cls}">${escapeHtml(label)}</span>`;
};

const renderAdminPedagogicoGroups = () => {
  if (!(adminPedGroups instanceof HTMLElement)) return;
  const groups = Array.isArray(adminPedagogicoState.groups) ? adminPedagogicoState.groups : [];
  if (adminPedEmptyGroups instanceof HTMLElement) adminPedEmptyGroups.hidden = groups.length > 0;
  adminPedGroups.innerHTML = `
    <div class="admin-ped-list">
      ${groups
        .map((g) => {
          const when = g.updatedAtMs ? `Atualizado em ${formatShortDateFromMs(g.updatedAtMs)}` : g.createdAtMs ? `Criado em ${formatShortDateFromMs(g.createdAtMs)}` : "";
          const days = (Array.isArray(g.daysOfWeek) ? g.daysOfWeek : []).map(daysLabelShort).join(", ") || "—";
          const time =
            Number.isFinite(Number(g.startMin)) && Number.isFinite(Number(g.endMin)) && g.endMin > g.startMin
              ? `${formatHmFromMinutes(g.startMin)}–${formatHmFromMinutes(g.endMin)}`
              : "—";
          const plan = g.planName ? String(g.planName) : g.planId ? g.planId : "—";
          const teacher = g.teacherName ? g.teacherName : g.teacherId ? g.teacherId : "—";
          const count = Array.isArray(g.studentIds) ? g.studentIds.length : 0;
          return `
            <div class="admin-ped-row">
              <div>
                <div class="admin-ped-row-title">${escapeHtml(g.name || "Turma")}</div>
                <div class="admin-ped-row-sub">${escapeHtml(`${teacher} · ${days} · ${time}`)}</div>
                <div class="admin-ped-row-meta">
                  ${pedStatusPillHtml(g.status)}
                  ${plan ? `<span class="admin-ped-pill is-plan">${escapeHtml(String(plan))}</span>` : ""}
                  <span class="admin-ped-pill">${escapeHtml(`${count} aluno${count === 1 ? "" : "s"}`)}</span>
                  ${when ? `<span class="admin-ped-pill">${escapeHtml(when)}</span>` : ""}
                </div>
              </div>
              <div class="admin-ped-row-actions">
                <button class="admin-ped-action" type="button" data-admin-ped-group-edit="${escapeHtml(g.id)}">Editar</button>
                <button class="admin-ped-action is-muted" type="button" data-admin-ped-group-toggle="${escapeHtml(g.id)}">${
            normalizeClassStatus(g.status) === "active" ? "Pausar" : "Ativar"
          }</button>
                <button class="admin-ped-action is-danger" type="button" data-admin-ped-group-delete="${escapeHtml(g.id)}">Excluir</button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const planTypeLabel = (type) => {
  const t = String(type || "").trim().toLowerCase();
  if (t === "group") return "Grupo";
  if (t === "hybrid") return "Híbrido";
  return "Individual";
};

const renderAdminPedagogicoPlansPanel = () => {
  if (!(adminPedPlans instanceof HTMLElement)) return;
  const plans = Array.isArray(adminPedagogicoState.plans) ? adminPedagogicoState.plans : [];
  if (adminPedEmptyPlans instanceof HTMLElement) adminPedEmptyPlans.hidden = plans.length > 0;

  const statusPill = (status) => {
    const s = String(status || "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
    const cls = s === "active" ? "is-active" : "is-ended";
    const label = s === "active" ? "Ativo" : "Inativo";
    return `<span class="admin-ped-pill ${cls}">${escapeHtml(label)}</span>`;
  };

  adminPedPlans.innerHTML = `
    <div class="admin-ped-list">
      ${plans
        .map((p) => {
          const price = Number.isFinite(Number(p.monthlyPrice)) ? `R$ ${Number(p.monthlyPrice).toFixed(2)}` : "—";
          const weekly = Number.isFinite(Number(p.weeklyClasses)) ? `${Number(p.weeklyClasses)} aula(s)/sem` : "—";
          return `
            <div class="admin-ped-row">
              <div>
                <div class="admin-ped-row-title">${escapeHtml(p.name || "Plano")}</div>
                <div class="admin-ped-row-sub">${escapeHtml(`${planTypeLabel(p.type)} · ${weekly} · ${price}`)}</div>
                <div class="admin-ped-row-meta">
                  ${statusPill(p.status)}
                </div>
              </div>
              <div class="admin-ped-row-actions">
                <button class="admin-ped-action" type="button" data-admin-ped-plan-edit="${escapeHtml(p.id)}">Editar</button>
                <button class="admin-ped-action is-muted" type="button" data-admin-ped-plan-toggle="${escapeHtml(p.id)}">${
            String(p.status || "").toLowerCase() === "inactive" ? "Ativar" : "Desativar"
          }</button>
                <button class="admin-ped-action is-danger" type="button" data-admin-ped-plan-delete="${escapeHtml(p.id)}">Excluir</button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderAdminPedagogicoStudentsPanel = () => {
  if (!(adminPedStudents instanceof HTMLElement)) return;
  const students = Array.isArray(adminPedagogicoState.students) ? adminPedagogicoState.students : [];
  const teachersById = adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById : new Map();
  const groupsById = adminPedagogicoState.groupsById instanceof Map ? adminPedagogicoState.groupsById : new Map();

  const lessonLogs = Array.isArray(adminPedagogicoState.lessonLogs) ? adminPedagogicoState.lessonLogs : [];
  const riskByStudent = new Map();
  lessonLogs.forEach((log) => {
    const alunoId = String(log?.alunoId || "").trim();
    if (!alunoId) return;
    const updatedAt = String(log?.atualizadoEm || log?.criadoEm || "").trim();
    const ms = updatedAt ? Date.parse(updatedAt) : NaN;
    const prev = riskByStudent.get(alunoId) || null;
    if (prev && Number.isFinite(prev.ms) && Number.isFinite(ms) && ms < prev.ms) return;
    const raw = String(log?.payload?.riscoEvasao || log?.payload?.risco_evasao || "").trim().toLowerCase();
    const risk = raw === "alto" || raw === "high" ? "Alto" : raw === "medio" || raw === "médio" ? "Médio" : raw === "baixo" ? "Baixo" : "";
    riskByStudent.set(alunoId, { ms: Number.isFinite(ms) ? ms : 0, risk });
  });

  const rows = students
    .slice()
    .sort((a, b) => String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR"))
    .map((s) => {
      const teacherId = String(s?.professorId || s?.teacherId || "").trim();
      const teacherName = teacherId ? String(teachersById.get(teacherId)?.nome || "").trim() : "";
      const groupId = String(s?.groupId || "").trim();
      const groupName = groupId ? String(groupsById.get(groupId)?.name || "").trim() : String(s?.groupName || "").trim();
      const plan = String(s?.plano || "").trim() || "Sem plano";
      const accessActive = s?.ativo_acesso !== false && String(s?.status_acesso || "ativo") !== "inativo";
      const statusLabel = accessActive ? "Ativo" : "Inativo";
      const risk = (riskByStudent.get(String(s.id || "")) || {}).risk || "—";
      return {
        id: String(s.id || ""),
        nome: String(s.nome || "Aluno"),
        email: String(s.email || ""),
        statusLabel,
        teacherId,
        teacherName,
        groupId,
        groupName,
        plan,
        risk,
        alunoChave: String(s.aluno_chave || ""),
        source: String(s.source || ""),
        accessActive,
      };
    });

  if (adminPedEmptyStudents instanceof HTMLElement) adminPedEmptyStudents.hidden = rows.length > 0;

  adminPedStudents.innerHTML = `
    <div class="admin-ped-list">
      ${rows
        .map((r) => {
          const statusCls = r.statusLabel === "Ativo" ? "is-active" : "is-ended";
          return `
            <div class="admin-ped-row">
              <div>
                <div class="admin-ped-row-title">${escapeHtml(r.nome)}</div>
                <div class="admin-ped-row-sub">${escapeHtml(r.email || "—")}</div>
                <div class="admin-ped-row-meta">
                  <span class="admin-ped-pill ${statusCls}">${escapeHtml(r.statusLabel)}</span>
                  ${r.source.includes("financeiro") ? `<span class="admin-ped-pill">Financeiro sincronizado</span>` : ""}
                  <span class="admin-ped-pill is-plan">${escapeHtml(r.plan)}</span>
                  ${r.teacherName ? `<span class="admin-ped-pill">${escapeHtml(r.teacherName)}</span>` : `<span class="admin-ped-pill">Sem professor</span>`}
                  ${r.groupName ? `<span class="admin-ped-pill">${escapeHtml(r.groupName)}</span>` : `<span class="admin-ped-pill">Sem turma</span>`}
                  <span class="admin-ped-pill">${escapeHtml(`Risco: ${r.risk}`)}</span>
                </div>
              </div>
              <div class="admin-ped-row-actions">
                <button class="admin-ped-action" type="button" data-admin-ped-student-open="${escapeHtml(r.id)}">Ficha</button>
                <button class="admin-ped-action" type="button" data-admin-ped-student-link="${escapeHtml(r.id)}">Vincular</button>
                <button class="admin-ped-action is-muted" type="button" data-admin-ped-student-new-class="${escapeHtml(
                  r.id
                )}">Criar aula</button>
                ${
                  r.alunoChave
                    ? `<button class="admin-ped-action ${r.accessActive ? "is-danger" : ""}" type="button"
                         data-admin-ped-student-access-status="${escapeHtml(r.alunoChave)}"
                         data-admin-ped-student-next-status="${r.accessActive ? "inativo" : "ativo"}">
                         ${r.accessActive ? "Deixar inativo só para mim" : "Ativar no meu acesso"}
                       </button>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderAdminPedagogicoLinksPanel = () => {
  if (!(adminPedLinks instanceof HTMLElement)) return;
  const students = Array.isArray(adminPedagogicoState.students) ? adminPedagogicoState.students : [];
  const activeStudents = students.filter((s) => s && typeof s === "object" && s.ativo);
  const teachersById = adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById : new Map();
  const groupsById = adminPedagogicoState.groupsById instanceof Map ? adminPedagogicoState.groupsById : new Map();
  const classes = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  const activeClasses = classes.filter((c) => normalizeClassStatus(c?.status) === "active");

  const linkedStudents = new Set();
  activeClasses.forEach((c) => (Array.isArray(c.studentIds) ? c.studentIds : []).forEach((id) => (id ? linkedStudents.add(String(id)) : null)));

  const noTeacher = activeStudents.filter((s) => !String(s.professorId || s.teacherId || "").trim());
  const noGroup = activeStudents.filter((s) => !String(s.groupId || "").trim());
  const noClass = activeStudents.filter((s) => !linkedStudents.has(String(s.id || "")));

  const cap = (list) => list.slice(0, 8);
  const rowHtml = (s, extraAction) => {
    const sid = String(s.id || "");
    const teacherId = String(s.professorId || s.teacherId || "").trim();
    const groupId = String(s.groupId || "").trim();
    const teacher = teacherId ? String(teachersById.get(teacherId)?.nome || "").trim() : "";
    const group = groupId ? String(groupsById.get(groupId)?.name || "").trim() : String(s.groupName || "").trim();
    const plan = String(s.plano || "").trim() || "Sem plano";
    return `
      <div class="admin-ped-link-row">
        <div>
          <div class="admin-ped-link-title">${escapeHtml(String(s.nome || "Aluno"))}</div>
          <div class="admin-ped-link-sub">${escapeHtml(String(s.email || ""))}</div>
          <div class="admin-ped-link-meta">
            <span class="admin-ped-pill is-plan">${escapeHtml(plan)}</span>
            ${teacher ? `<span class="admin-ped-pill">${escapeHtml(teacher)}</span>` : `<span class="admin-ped-pill">Sem professor</span>`}
            ${group ? `<span class="admin-ped-pill">${escapeHtml(group)}</span>` : `<span class="admin-ped-pill">Sem turma</span>`}
          </div>
        </div>
        <div class="admin-ped-link-actions">
          <button class="admin-ped-action" type="button" data-admin-ped-student-link="${escapeHtml(sid)}">Vincular</button>
          ${extraAction || ""}
        </div>
      </div>
    `;
  };

  const block = (title, desc, list, extra) => {
    const rows = cap(list)
      .map((s) => rowHtml(s, extra ? extra(s) : ""))
      .join("");
    return `
      <section class="admin-ped-link-block">
        <div class="admin-ped-link-blockhead">
          <div>
            <div class="admin-ped-link-blocktitle">${escapeHtml(title)}</div>
            <div class="admin-ped-link-blocksub">${escapeHtml(desc)}</div>
          </div>
          <div class="admin-ped-link-badge">${escapeHtml(String(list.length))}</div>
        </div>
        <div class="admin-ped-link-list">
          ${rows || `<div class="admin-ped-empty-inline"><div class="admin-ped-empty-title">Tudo certo</div><div class="admin-ped-empty-sub">Nenhuma pendência agora.</div></div>`}
        </div>
      </section>
    `;
  };

  if (adminPedEmptyLinks instanceof HTMLElement) adminPedEmptyLinks.hidden = !(noTeacher.length === 0 && noClass.length === 0 && noGroup.length === 0);

  adminPedLinks.innerHTML = `
    <div class="admin-ped-links-grid">
      ${block("Alunos sem professor", "Conecte alunos ativos a um professor responsável.", noTeacher)}
      ${block(
        "Alunos sem aula",
        "Alunos ativos sem aula vinculada na agenda recorrente.",
        noClass,
        (s) => `<button class="admin-ped-action is-muted" type="button" data-admin-ped-student-new-class="${escapeHtml(String(s.id || ""))}">Criar aula</button>`
      )}
      ${block("Alunos sem turma", "Quando fizer sentido, organize alunos em turmas.", noGroup)}
    </div>
  `;
};

const renderAdminPedagogicoSurveysPanel = () => {
  if (!(adminPedSurveys instanceof HTMLElement)) return;
  const surveys = Array.isArray(adminPedagogicoState.surveys) ? adminPedagogicoState.surveys : [];
  const nps = surveys.map((s) => (Number.isFinite(s?.nps) ? Number(s.nps) : NaN)).filter((n) => Number.isFinite(n));
  const csat = surveys.map((s) => (Number.isFinite(s?.csat) ? Number(s.csat) : NaN)).filter((n) => Number.isFinite(n));
  const npsAvg = nps.length ? nps.reduce((a, b) => a + b, 0) / nps.length : NaN;
  const csatAvg = csat.length ? csat.reduce((a, b) => a + b, 0) / csat.length : NaN;
  if (adminPedEmptySurveys instanceof HTMLElement) adminPedEmptySurveys.hidden = surveys.length > 0;

  const recent = surveys.slice(0, 50);
  adminPedSurveys.innerHTML = `
    <div class="admin-ped-overview-grid">
      <div class="admin-ped-overview-card">
        <div class="admin-ped-overview-title">Médias</div>
        <ul class="admin-ped-overview-list">
          <li class="admin-ped-overview-item"><span>NPS médio</span><strong>${escapeHtml(Number.isFinite(npsAvg) ? npsAvg.toFixed(1) : "Sem dados")}</strong></li>
          <li class="admin-ped-overview-item"><span>CSAT médio</span><strong>${escapeHtml(Number.isFinite(csatAvg) ? csatAvg.toFixed(1) : "Sem dados")}</strong></li>
        </ul>
      </div>
      <div class="admin-ped-overview-card">
        <div class="admin-ped-overview-title">Últimas respostas</div>
        <ul class="admin-ped-overview-list">
          ${
            recent.length
              ? recent
                  .slice(0, 6)
                  .map((s) => {
                    const who = s.studentName || s.studentId || "Aluno";
                    const when = formatShortDateFromMs(s.createdAtMs);
                    const label = `${who} · NPS ${Number.isFinite(s.nps) ? s.nps : "—"} · CSAT ${Number.isFinite(s.csat) ? s.csat : "—"}`;
                    return `<li class="admin-ped-overview-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(when)}</strong></li>`;
                  })
                  .join("")
              : `<li class="admin-ped-overview-item"><span>Sem respostas</span><strong>—</strong></li>`
          }
        </ul>
      </div>
    </div>
  `;
};

const renderAdminPedagogicoNpsCsatPanel = () => {
  if (!(adminPedQuality instanceof HTMLElement)) return;
  const surveys = Array.isArray(adminPedagogicoState.surveys) ? adminPedagogicoState.surveys : [];
  if (adminPedEmptyQuality instanceof HTMLElement) adminPedEmptyQuality.hidden = surveys.length > 0;

  if (!surveys.length) {
    adminPedQuality.innerHTML = `
      <div class="admin-ped-empty-inline">
        <div class="admin-ped-empty-title">Nenhuma pesquisa respondida ainda.</div>
        <div class="admin-ped-empty-sub">Assim que os alunos responderem NPS/CSAT, esta área vira um painel de qualidade e ações.</div>
        <button class="admin-ped-action" type="button" data-admin-ped-open-surveys>Ver pesquisas</button>
      </div>
    `;
    return;
  }

  const nps = surveys.map((s) => (Number.isFinite(s?.nps) ? Number(s.nps) : NaN)).filter((n) => Number.isFinite(n));
  const csat = surveys.map((s) => (Number.isFinite(s?.csat) ? Number(s.csat) : NaN)).filter((n) => Number.isFinite(n));
  const npsAvg = nps.length ? nps.reduce((a, b) => a + b, 0) / nps.length : NaN;
  const csatAvg = csat.length ? csat.reduce((a, b) => a + b, 0) / csat.length : NaN;

  const bucket = { promoters: 0, neutrals: 0, detractors: 0 };
  surveys.forEach((s) => {
    if (!Number.isFinite(s?.nps)) return;
    if (s.nps >= 9) bucket.promoters += 1;
    else if (s.nps >= 7) bucket.neutrals += 1;
    else bucket.detractors += 1;
  });

  const byTeacher = new Map();
  surveys.forEach((s) => {
    const tid = String(s.teacherId || "").trim();
    if (!tid) return;
    if (!byTeacher.has(tid)) byTeacher.set(tid, []);
    byTeacher.get(tid).push(s);
  });

  const teacherRows = [...byTeacher.entries()]
    .map(([tid, rows]) => {
      const tnps = rows.map((r) => (Number.isFinite(r?.nps) ? Number(r.nps) : NaN)).filter((n) => Number.isFinite(n));
      const tcsat = rows.map((r) => (Number.isFinite(r?.csat) ? Number(r.csat) : NaN)).filter((n) => Number.isFinite(n));
      const avgN = tnps.length ? tnps.reduce((a, b) => a + b, 0) / tnps.length : NaN;
      const avgC = tcsat.length ? tcsat.reduce((a, b) => a + b, 0) / tcsat.length : NaN;
      return {
        id: tid,
        name: String(adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById.get(tid)?.nome || "Professor" : "Professor"),
        nps: Number.isFinite(avgN) ? avgN : NaN,
        csat: Number.isFinite(avgC) ? avgC : NaN,
        total: rows.length,
      };
    })
    .sort((a, b) => (Number.isFinite(b.nps) ? b.nps : -1) - (Number.isFinite(a.nps) ? a.nps : -1));

  const best = teacherRows.slice(0, 3);
  const worst = teacherRows
    .slice()
    .filter((t) => Number.isFinite(t.nps) || Number.isFinite(t.csat))
    .sort((a, b) => (Number.isFinite(a.nps) ? a.nps : 999) - (Number.isFinite(b.nps) ? b.nps : 999))
    .slice(0, 3);

  const recentComments = surveys
    .slice()
    .filter((s) => String(s.comment || "").trim())
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .slice(0, 5);

  const listLine = (label, value) => `<li class="admin-ped-overview-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`;

  adminPedQuality.innerHTML = `
    <div class="admin-ped-overview-grid">
      <div class="admin-ped-overview-card">
        <div class="admin-ped-overview-title">Médias</div>
        <ul class="admin-ped-overview-list">
          ${listLine("NPS médio geral", Number.isFinite(npsAvg) ? npsAvg.toFixed(1) : "Sem dados")}
          ${listLine("CSAT médio geral", Number.isFinite(csatAvg) ? csatAvg.toFixed(1) : "Sem dados")}
          ${listLine("Promotores", String(bucket.promoters))}
          ${listLine("Neutros", String(bucket.neutrals))}
          ${listLine("Detratores", String(bucket.detractors))}
        </ul>
      </div>
      <div class="admin-ped-overview-card">
        <div class="admin-ped-overview-title">Professores (melhor)</div>
        <ul class="admin-ped-overview-list">
          ${
            best.length
              ? best
                  .map((t) => listLine(t.name, `NPS ${Number.isFinite(t.nps) ? t.nps.toFixed(1) : "—"} · ${t.total} resp.`))
                  .join("")
              : `<li class="admin-ped-overview-item"><span>Sem dados</span><strong>—</strong></li>`
          }
        </ul>
      </div>
      <div class="admin-ped-overview-card">
        <div class="admin-ped-overview-title">Professores (acompanhar)</div>
        <ul class="admin-ped-overview-list">
          ${
            worst.length
              ? worst
                  .map((t) => listLine(t.name, `NPS ${Number.isFinite(t.nps) ? t.nps.toFixed(1) : "—"} · ${t.total} resp.`))
                  .join("")
              : `<li class="admin-ped-overview-item"><span>Sem dados</span><strong>—</strong></li>`
          }
        </ul>
      </div>
      <div class="admin-ped-overview-card">
        <div class="admin-ped-overview-title">Comentários recentes</div>
        <ul class="admin-ped-overview-list">
          ${
            recentComments.length
              ? recentComments
                  .map((s) => {
                    const who = s.studentName || "Aluno";
                    const when = formatShortDateFromMs(s.createdAtMs);
                    const label = `${who} · NPS ${Number.isFinite(s.nps) ? s.nps : "—"} · CSAT ${Number.isFinite(s.csat) ? s.csat : "—"}`;
                    return `<li class="admin-ped-overview-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(when)}</strong></li>`;
                  })
                  .join("")
              : `<li class="admin-ped-overview-item"><span>Sem comentários</span><strong>—</strong></li>`
          }
        </ul>
      </div>
    </div>
  `;
};

const renderAdminPedagogicoAlertsPanel = () => {
  if (!(adminPedAlerts instanceof HTMLElement)) return;
  const alerts = Array.isArray(adminPedagogicoState.teacherAlerts) ? adminPedagogicoState.teacherAlerts : [];
  if (adminPedEmptyAlerts instanceof HTMLElement) adminPedEmptyAlerts.hidden = alerts.length > 0;

  const priorityPill = (p) => {
    const v = String(p || "").toLowerCase();
    const label = v === "high" ? "Alta" : v === "medium" ? "Média" : "Baixa";
    const cls = v === "high" ? "is-paused" : v === "medium" ? "is-plan" : "";
    return `<span class="admin-ped-pill ${cls}">${escapeHtml(label)}</span>`;
  };

  const statusPill = (s) => {
    const v = String(s || "").toLowerCase();
    const label = v === "resolved" ? "Resolvido" : v === "analysis" ? "Em análise" : "Aberto";
    const cls = v === "resolved" ? "is-ended" : v === "analysis" ? "is-plan" : "is-active";
    return `<span class="admin-ped-pill ${cls}">${escapeHtml(label)}</span>`;
  };

  adminPedAlerts.innerHTML = `
    <div class="admin-ped-list">
      ${alerts
        .map((a) => {
          const title = `${a.studentName || "Aluno"} · ${a.teacherName || "Professor"}`;
          const when = formatShortDateFromMs(a.createdAtMs);
          const sub = `${a.category || "Aviso"} · ${when}`;
          return `
            <div class="admin-ped-row">
              <div>
                <div class="admin-ped-row-title">${escapeHtml(title)}</div>
                <div class="admin-ped-row-sub">${escapeHtml(sub)}</div>
                <div class="admin-ped-row-meta">
                  ${statusPill(a.status)}
                  ${priorityPill(a.priority)}
                </div>
              </div>
              <div class="admin-ped-row-actions">
                <button class="admin-ped-action" type="button" data-admin-ped-alert-view="${escapeHtml(a.id)}">Ver</button>
                ${
                  String(a.status || "") !== "resolved"
                    ? `<button class="admin-ped-action is-muted" type="button" data-admin-ped-alert-resolve="${escapeHtml(
                        a.id
                      )}">Resolver</button>`
                    : ""
                }
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderAdminPedagogicoFeedbacksPanel = () => {
  if (!(adminPedFeedbacks instanceof HTMLElement)) return;
  const items = Array.isArray(adminPedagogicoState.pedagogicalFeedbacks) ? adminPedagogicoState.pedagogicalFeedbacks : [];
  const liveItems = Array.isArray(adminPedagogicoState.liveLessonFeedbacks) ? adminPedagogicoState.liveLessonFeedbacks : [];
  if (adminPedEmptyFeedbacks instanceof HTMLElement) adminPedEmptyFeedbacks.hidden = items.length + liveItems.length > 0;

  const liveAverage = (() => {
    const scores = liveItems.map((f) => Number(f?.notaProfessor)).filter((n) => Number.isFinite(n));
    if (!scores.length) return "—";
    const avg = scores.reduce((acc, n) => acc + n, 0) / scores.length;
    return avg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  })();
  const lowLive = liveItems.filter((f) => Number(f?.notaProfessor) <= 6).length;

  adminPedFeedbacks.innerHTML = `
    <div class="admin-ped-list">
      ${
        liveItems.length
          ? `
            <div class="admin-ped-row">
              <div>
                <div class="admin-ped-row-title">Avaliações de aulas ao vivo</div>
                <div class="admin-ped-row-sub">Média geral ${escapeHtml(liveAverage)} · ${escapeHtml(String(liveItems.length))} resposta(s)</div>
                <div class="admin-ped-row-meta">
                  <span class="admin-ped-pill is-plan">Tipo Uber: professor vê só média</span>
                  ${lowLive ? `<span class="admin-ped-pill is-paused">${escapeHtml(String(lowLive))} baixa(s)</span>` : `<span class="admin-ped-pill is-active">Sem alerta</span>`}
                </div>
              </div>
            </div>
            ${liveItems
              .slice()
              .sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0))
              .map((f) => {
                const when = formatShortDateFromMs(f.createdAtMs);
                const score = Number.isFinite(Number(f.notaProfessor)) ? String(f.notaProfessor) : "—";
                const low = Number(f.notaProfessor) <= 6;
                const title = `${f.alunoNome || "Aluno"} avaliou ${f.professorNome || "Professor"}`;
                const msg = String(f.mensagem || "").trim() || "Sem mensagem.";
                return `
                  <div class="admin-ped-row">
                    <div>
                      <div class="admin-ped-row-title">${escapeHtml(title)}</div>
                      <div class="admin-ped-row-sub">${escapeHtml(`${when} · Nota ${score}`)}</div>
                      <div class="admin-ped-row-meta">
                        <span class="admin-ped-pill ${low ? "is-paused" : "is-active"}">${escapeHtml(low ? "Atenção" : "OK")}</span>
                        <span class="admin-ped-pill">Aula #${escapeHtml(String(f.aulaId || "—"))}</span>
                      </div>
                      <div class="admin-ped-row-sub" style="margin-top:8px;">${escapeHtml(msg)}</div>
                    </div>
                  </div>
                `;
              })
              .join("")}
          `
          : ""
      }
      ${items
        .map((f) => {
          const when = formatShortDateFromMs(f.createdAtMs);
          const score = Number.isFinite(Number(f.generalScore)) ? String(f.generalScore) : "—";
          const status = f.readByTeacher ? `<span class="admin-ped-pill is-ended">Lido</span>` : `<span class="admin-ped-pill is-active">Novo</span>`;
          const title = f.teacherName || "Professor";
          const sub = `${when} · Nota ${score}`;
          return `
            <div class="admin-ped-row">
              <div>
                <div class="admin-ped-row-title">${escapeHtml(title)}</div>
                <div class="admin-ped-row-sub">${escapeHtml(sub)}</div>
                <div class="admin-ped-row-meta">${status}</div>
              </div>
              <div class="admin-ped-row-actions">
                <button class="admin-ped-action" type="button" data-admin-ped-feedback-view="${escapeHtml(f.id)}">Ver</button>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderAdminPedagogicoReportsPanel = () => {
  if (!(adminPedReports instanceof HTMLElement)) return;
  adminPedReports.innerHTML = `
    <div class="admin-ped-reports-grid">
      <div class="admin-ped-report">
        <div class="admin-ped-report-title">Relatório de alunos ativos</div>
        <div class="admin-ped-report-sub">Exporta CSV com alunos ativos, plano, professor e turma.</div>
        <button class="admin-ped-action" type="button" data-admin-ped-report="students_active">Exportar CSV</button>
      </div>
      <div class="admin-ped-report">
        <div class="admin-ped-report-title">Relatório de aulas</div>
        <div class="admin-ped-report-sub">Exporta CSV com aulas cadastradas (tipo, professor, alunos/turma, dias, horário, plano, status).</div>
        <button class="admin-ped-action" type="button" data-admin-ped-report="classes">Exportar CSV</button>
      </div>
      <div class="admin-ped-report">
        <div class="admin-ped-report-title">Relatório de turmas</div>
        <div class="admin-ped-report-sub">Exporta CSV com turmas, professor, plano e quantidade de alunos.</div>
        <button class="admin-ped-action" type="button" data-admin-ped-report="groups">Exportar CSV</button>
      </div>
      <div class="admin-ped-report">
        <div class="admin-ped-report-title">Relatório de feedbacks</div>
        <div class="admin-ped-report-sub">Exporta CSV com feedbacks enviados e status (novo/lido).</div>
        <button class="admin-ped-action" type="button" data-admin-ped-report="feedbacks">Exportar CSV</button>
      </div>
      <div class="admin-ped-report">
        <div class="admin-ped-report-title">Relatório de avisos</div>
        <div class="admin-ped-report-sub">Exporta CSV com avisos dos professores e status.</div>
        <button class="admin-ped-action" type="button" data-admin-ped-report="alerts">Exportar CSV</button>
      </div>
      <div class="admin-ped-report">
        <div class="admin-ped-report-title">Relatório de pesquisas</div>
        <div class="admin-ped-report-sub">Exporta CSV com NPS/CSAT e comentários.</div>
        <button class="admin-ped-action" type="button" data-admin-ped-report="surveys">Exportar CSV</button>
      </div>
    </div>
  `;
};

const renderAdminPedagogicoOnboardingPanel = () => {
  if (!(adminOnboardingContentsEl instanceof HTMLElement)) return;
  const contents = Array.isArray(adminPedagogicoState.onboardingContents) ? adminPedagogicoState.onboardingContents : [];
  const quizzes = Array.isArray(adminPedagogicoState.onboardingQuizzes) ? adminPedagogicoState.onboardingQuizzes : [];
  const quizzesByContentId = new Map(quizzes.map((q) => [String(q.contentId || ""), q]));

  if (adminOnboardingEmptyEl instanceof HTMLElement) adminOnboardingEmptyEl.hidden = contents.length > 0;

  adminOnboardingContentsEl.innerHTML = contents
    .map((c, idx) => {
      const typeLabel = c.type === "quiz" ? "Quiz" : c.type === "document" ? "Documento" : "Vídeo";
      const statusLabel = c.status === "inactive" ? "Inativo" : "Ativo";
      const statusCls = c.status === "inactive" ? "is-ended" : "is-active";
      const reqLabel = c.required ? "Obrigatório" : "Opcional";
      const quiz = quizzesByContentId.get(String(c.id)) || (c.quizId ? quizzes.find((q) => String(q.id) === String(c.quizId)) : null);
      const quizMeta = c.type === "quiz" ? (quiz ? `${quiz.questions?.length || 0} pergunta(s)` : "Quiz não configurado") : "";
      return `
        <div class="admin-onboarding-content">
          <div>
            <div class="admin-onboarding-content-title">${escapeHtml(`${idx + 1}. ${c.title || "Conteúdo"}`)}</div>
            <div class="admin-onboarding-content-sub">${escapeHtml(c.description || "")}</div>
            <div class="admin-onboarding-content-meta">
              <span class="admin-ped-pill ${statusCls}">${escapeHtml(statusLabel)}</span>
              <span class="admin-ped-pill">${escapeHtml(typeLabel)}</span>
              <span class="admin-ped-pill is-plan">${escapeHtml(reqLabel)}</span>
              ${quizMeta ? `<span class="admin-ped-pill">${escapeHtml(quizMeta)}</span>` : ""}
            </div>
          </div>
          <div class="admin-onboarding-actions">
            <button class="admin-ped-action" type="button" data-admin-onboarding-edit="${escapeHtml(c.id)}">Editar</button>
            <button class="admin-ped-action is-muted" type="button" data-admin-onboarding-toggle="${escapeHtml(c.id)}">${
        c.status === "inactive" ? "Ativar" : "Desativar"
      }</button>
            <button class="admin-ped-action is-muted" type="button" data-admin-onboarding-move="up" data-admin-onboarding-id="${escapeHtml(
              c.id
            )}" ${idx === 0 ? "disabled" : ""}>↑</button>
            <button class="admin-ped-action is-muted" type="button" data-admin-onboarding-move="down" data-admin-onboarding-id="${escapeHtml(
              c.id
            )}" ${idx === contents.length - 1 ? "disabled" : ""}>↓</button>
            <button class="admin-ped-action is-danger" type="button" data-admin-onboarding-delete="${escapeHtml(c.id)}">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");

  renderAdminOnboardingPerformance();
};

const adminOnboardingGetContentRow = (contentId) => {
  const id = String(contentId || "").trim();
  if (!id) return null;
  return (Array.isArray(adminPedagogicoState.onboardingContentsAll) ? adminPedagogicoState.onboardingContentsAll : []).find((c) => String(c?.id || "") === id) || null;
};

const adminOnboardingGetQuizRowForContent = (contentId) => {
  const cid = String(contentId || "").trim();
  if (!cid) return null;
  return (Array.isArray(adminPedagogicoState.onboardingQuizzes) ? adminPedagogicoState.onboardingQuizzes : []).find((q) => String(q?.contentId || "") === cid) || null;
};

const adminOnboardingNextOrder = () => {
  const all = Array.isArray(adminPedagogicoState.onboardingContentsAll) ? adminPedagogicoState.onboardingContentsAll : [];
  const maxOrder = all.reduce((acc, c) => Math.max(acc, Number.isFinite(Number(c?.order)) ? Number(c.order) : 0), 0);
  return maxOrder + 1;
};

const adminOnboardingModalSyncTypeSections = () => {
  if (activeModalKind !== "admin-onboarding-content") return;
  if (!(modalBody instanceof HTMLElement)) return;
  const typeEl = modalBody.querySelector("[data-admin-onboarding-type]");
  const type = typeEl instanceof HTMLSelectElement ? normalizeOnboardingContentType(typeEl.value) : "video";
  modalBody.querySelectorAll("[data-admin-onboarding-type-section]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    el.hidden = String(el.getAttribute("data-admin-onboarding-type-section") || "").trim() !== type;
  });

  // Refresh quiz question numbering + per-type UI.
  if (type === "quiz") {
    const list = modalBody.querySelector("[data-admin-onboarding-quiz-questions]");
    if (list instanceof HTMLElement) {
      const rows = [...list.querySelectorAll("[data-admin-onboarding-q]")];
      rows.forEach((row, idx) => {
        if (!(row instanceof HTMLElement)) return;
        const num = row.querySelector("[data-admin-onboarding-q-num]");
        if (num instanceof HTMLElement) num.textContent = `Pergunta ${idx + 1}`;
        adminOnboardingModalSyncQuestionUI(row);
      });
    }
  }
};

const adminOnboardingModalCreateQuestionRowHtml = ({ q } = {}) => {
  const row = q && typeof q === "object" ? q : {};
  const qid = String(row.id || "").trim() || `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const type = normalizeQuizQuestionType(row.type);
  const required = row.required !== false;
  const points = Number.isFinite(Number(row.points)) ? Number(row.points) : 0;
  const options = Array.isArray(row.options) ? row.options.map((o) => String(o || "")) : [];
  const correct = row.correctAnswer ?? "";

  const optsHtml =
    type === "multiple_choice"
      ? `
        <div class="admin-onboarding-q-options" data-admin-onboarding-q-options>
          <div class="admin-onboarding-q-options-head">
            <div class="admin-onboarding-q-options-title">Alternativas</div>
            <button class="admin-ped-action is-muted" type="button" data-admin-onboarding-q-option-add>+ Alternativa</button>
          </div>
          <div class="admin-onboarding-q-options-list">
            ${(options.length ? options : ["", ""]).map((opt) => {
              return `
                <div class="admin-onboarding-q-option">
                  <input class="modal-input" type="text" value="${escapeHtml(String(opt))}" placeholder="Alternativa" data-admin-onboarding-q-option />
                  <button class="admin-ped-action is-danger" type="button" data-admin-onboarding-q-option-remove aria-label="Remover alternativa">✕</button>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `
      : `<div class="admin-onboarding-q-options" data-admin-onboarding-q-options hidden></div>`;

  return `
    <div class="admin-onboarding-q" data-admin-onboarding-q data-admin-onboarding-qid="${escapeHtml(qid)}">
      <div class="admin-onboarding-q-head">
        <div class="admin-onboarding-q-num" data-admin-onboarding-q-num>Pergunta</div>
        <button class="admin-ped-action is-danger" type="button" data-admin-onboarding-q-remove>Remover</button>
      </div>
      <label class="modal-field">
        <span>Pergunta</span>
        <input class="modal-input" type="text" value="${escapeHtml(String(row.questionText || ""))}" placeholder="Digite a pergunta..." data-admin-onboarding-q-text />
      </label>
      <div class="admin-onboarding-q-grid">
        <label class="modal-field">
          <span>Tipo</span>
          <select class="modal-input" data-admin-onboarding-q-type>
            <option value="multiple_choice" ${type === "multiple_choice" ? "selected" : ""}>Múltipla escolha</option>
            <option value="true_false" ${type === "true_false" ? "selected" : ""}>Verdadeiro/Falso</option>
            <option value="short_answer" ${type === "short_answer" ? "selected" : ""}>Resposta curta</option>
          </select>
        </label>
        <label class="modal-field">
          <span>Pontos</span>
          <input class="modal-input" type="number" min="0" step="1" value="${escapeHtml(String(points))}" data-admin-onboarding-q-points />
        </label>
        <label class="admin-onboarding-q-check">
          <input type="checkbox" ${required ? "checked" : ""} data-admin-onboarding-q-required />
          <span>Obrigatória</span>
        </label>
      </div>
      ${optsHtml}
      <div class="admin-onboarding-q-correct" data-admin-onboarding-q-correct>
        <label class="modal-field" data-admin-onboarding-q-correct-short hidden>
          <span>Resposta correta (opcional)</span>
          <input class="modal-input" type="text" value="${escapeHtml(String(correct))}" placeholder="Resposta correta" data-admin-onboarding-q-correct-input />
        </label>
        <label class="modal-field" data-admin-onboarding-q-correct-tf hidden>
          <span>Resposta correta (opcional)</span>
          <select class="modal-input" data-admin-onboarding-q-correct-tf-select>
            <option value="">—</option>
            <option value="Verdadeiro" ${String(correct) === "Verdadeiro" ? "selected" : ""}>Verdadeiro</option>
            <option value="Falso" ${String(correct) === "Falso" ? "selected" : ""}>Falso</option>
          </select>
        </label>
        <label class="modal-field" data-admin-onboarding-q-correct-mc hidden>
          <span>Resposta correta (opcional)</span>
          <input class="modal-input" type="text" value="${escapeHtml(String(correct))}" placeholder="Deve bater com uma alternativa" data-admin-onboarding-q-correct-mc-input />
        </label>
      </div>
    </div>
  `;
};

const adminOnboardingModalSyncQuestionUI = (qEl) => {
  if (!(qEl instanceof HTMLElement)) return;
  const typeEl = qEl.querySelector("[data-admin-onboarding-q-type]");
  const type = typeEl instanceof HTMLSelectElement ? normalizeQuizQuestionType(typeEl.value) : "multiple_choice";
  const optionsWrap = qEl.querySelector("[data-admin-onboarding-q-options]");
  if (optionsWrap instanceof HTMLElement) {
    optionsWrap.hidden = type !== "multiple_choice";
  }
  const correctShort = qEl.querySelector("[data-admin-onboarding-q-correct-short]");
  const correctTf = qEl.querySelector("[data-admin-onboarding-q-correct-tf]");
  const correctMc = qEl.querySelector("[data-admin-onboarding-q-correct-mc]");
  if (correctShort instanceof HTMLElement) correctShort.hidden = type !== "short_answer";
  if (correctTf instanceof HTMLElement) correctTf.hidden = type !== "true_false";
  if (correctMc instanceof HTMLElement) correctMc.hidden = type !== "multiple_choice";
};

const adminOnboardingModalCollectQuiz = ({ contentId }) => {
  if (!(modalBody instanceof HTMLElement)) return null;
  const cid = String(contentId || "").trim();
  if (!cid) return null;

  const titleEl = modalBody.querySelector("[data-admin-onboarding-quiz-title]");
  const descEl = modalBody.querySelector("[data-admin-onboarding-quiz-desc]");
  const showEl = modalBody.querySelector("[data-admin-onboarding-quiz-show]");
  const questionsWrap = modalBody.querySelector("[data-admin-onboarding-quiz-questions]");

  const title = titleEl instanceof HTMLInputElement ? titleEl.value.trim() : "";
  const description = descEl instanceof HTMLTextAreaElement ? descEl.value.trim() : "";
  const showResultToTeacher = showEl instanceof HTMLInputElement ? showEl.checked : true;
  const rows = questionsWrap instanceof HTMLElement ? [...questionsWrap.querySelectorAll("[data-admin-onboarding-q]")] : [];

  const questions = rows
    .map((row) => {
      if (!(row instanceof HTMLElement)) return null;
      const qid = String(row.getAttribute("data-admin-onboarding-qid") || "").trim() || `q_${Math.random().toString(36).slice(2, 8)}`;
      const textEl = row.querySelector("[data-admin-onboarding-q-text]");
      const typeEl = row.querySelector("[data-admin-onboarding-q-type]");
      const pointsEl = row.querySelector("[data-admin-onboarding-q-points]");
      const reqEl = row.querySelector("[data-admin-onboarding-q-required]");

      const questionText = textEl instanceof HTMLInputElement ? textEl.value.trim() : "";
      const type = typeEl instanceof HTMLSelectElement ? normalizeQuizQuestionType(typeEl.value) : "multiple_choice";
      const points = pointsEl instanceof HTMLInputElement ? Number(pointsEl.value) : 0;
      const required = reqEl instanceof HTMLInputElement ? reqEl.checked : true;

      const options =
        type === "multiple_choice"
          ? [...row.querySelectorAll("[data-admin-onboarding-q-option]")]
              .map((el) => (el instanceof HTMLInputElement ? el.value.trim() : ""))
              .filter((v) => v)
          : type === "true_false"
            ? ["Verdadeiro", "Falso"]
            : [];

      const correct = (() => {
        if (type === "true_false") {
          const sel = row.querySelector("[data-admin-onboarding-q-correct-tf-select]");
          return sel instanceof HTMLSelectElement ? sel.value : "";
        }
        if (type === "multiple_choice") {
          const input = row.querySelector("[data-admin-onboarding-q-correct-mc-input]");
          return input instanceof HTMLInputElement ? input.value.trim() : "";
        }
        const input = row.querySelector("[data-admin-onboarding-q-correct-input]");
        return input instanceof HTMLInputElement ? input.value.trim() : "";
      })();

      if (!questionText) return null;
      return {
        id: qid,
        questionText,
        type,
        options,
        correctAnswer: correct,
        points: Number.isFinite(points) ? Math.max(0, Math.round(points)) : 0,
        required,
      };
    })
    .filter(Boolean);

  if (!title.trim()) return { error: "Informe o título do quiz.", quiz: null };
  if (!questions.length) return { error: "Adicione pelo menos 1 pergunta (com texto) para salvar o quiz.", quiz: null };

  return {
    error: "",
    quiz: {
      id: cid,
      contentId: cid,
      title: title.trim(),
      description,
      showResultToTeacher,
      questions,
    },
  };
};

const openAdminOnboardingContentModal = ({ mode, contentId } = {}) => {
  if (currentRole !== "admin") return;
  const m = mode === "edit" ? "edit" : "create";
  const row = m === "edit" ? adminOnboardingGetContentRow(contentId) : null;
  const baseType = row ? normalizeOnboardingContentType(row.type) : "video";
  const baseOrder = row ? (Number.isFinite(Number(row.order)) ? Number(row.order) : 0) : adminOnboardingNextOrder();
  const quizRow = row && baseType === "quiz" ? adminOnboardingGetQuizRowForContent(row.id) : null;

  adminOnboardingDraft = {
    mode: m,
    contentId: row?.id ? String(row.id) : "",
  };

  activeModalKind = "admin-onboarding-content";

  openModal({
    title: m === "edit" ? "Editar conteúdo de onboarding" : "Adicionar conteúdo de onboarding",
    bodyHtml: `
      <div class="modal-form admin-onboarding-modal">
        <label class="modal-field">
          <span>Título</span>
          <input class="modal-input" type="text" value="${escapeHtml(String(row?.title || ""))}" placeholder="Ex: Metodologia Space" data-admin-onboarding-title />
        </label>
        <label class="modal-field">
          <span>Descrição</span>
          <textarea class="modal-textarea" rows="3" placeholder="Descreva o objetivo deste conteúdo..." data-admin-onboarding-desc>${escapeHtml(
            String(row?.description || "")
          )}</textarea>
        </label>

        <div class="admin-onboarding-modal-grid">
          <label class="modal-field">
            <span>Tipo</span>
            <select class="modal-input" data-admin-onboarding-type ${m === "edit" ? "" : ""}>
              <option value="video" ${baseType === "video" ? "selected" : ""}>Vídeo</option>
              <option value="document" ${baseType === "document" ? "selected" : ""}>Documento</option>
              <option value="quiz" ${baseType === "quiz" ? "selected" : ""}>Quiz</option>
            </select>
          </label>
          <label class="modal-field">
            <span>Ordem na trilha</span>
            <input class="modal-input" type="number" min="1" step="1" value="${escapeHtml(String(baseOrder || 1))}" data-admin-onboarding-order />
          </label>
          <label class="modal-field">
            <span>Status</span>
            <select class="modal-input" data-admin-onboarding-status>
              <option value="active" ${row?.status !== "inactive" ? "selected" : ""}>Ativo</option>
              <option value="inactive" ${row?.status === "inactive" ? "selected" : ""}>Inativo</option>
            </select>
          </label>
          <label class="admin-onboarding-modal-check">
            <input type="checkbox" ${row ? (row.required ? "checked" : "") : "checked"} data-admin-onboarding-required />
            <span>Obrigatório</span>
          </label>
        </div>

        <section data-admin-onboarding-type-section="video">
          <div class="admin-onboarding-modal-sectiontitle">Vídeo</div>
          <div class="admin-onboarding-modal-grid">
            <label class="modal-field">
              <span>Upload (MP4, MOV, WEBM)</span>
              <input class="modal-input" type="file" accept=".mp4,.mov,.webm" data-admin-onboarding-video-file />
            </label>
            <label class="modal-field">
              <span>Ou link externo</span>
              <input class="modal-input" type="url" value="${escapeHtml(String(row?.videoUrl || ""))}" placeholder="https://..." data-admin-onboarding-video-url />
            </label>
          </div>
          <label class="modal-field">
            <span>Duração estimada</span>
            <input class="modal-input" type="text" value="${escapeHtml(String(row?.estimatedDuration || ""))}" placeholder="Ex: 12 min" data-admin-onboarding-duration />
          </label>
          ${row?.videoUrl ? `<div class="admin-student-panel-note">Vídeo atual configurado.</div>` : ""}
        </section>

        <section data-admin-onboarding-type-section="document" hidden>
          <div class="admin-onboarding-modal-sectiontitle">Documento</div>
          <label class="modal-field">
            <span>Upload (PDF, DOC, DOCX, PNG, JPG, JPEG)</span>
            <input class="modal-input" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" data-admin-onboarding-doc-file />
          </label>
          ${row?.documentUrl ? `<div class="admin-student-panel-note">Documento atual: <a href="${escapeHtml(
            String(row.documentUrl)
          )}" target="_blank" rel="noopener">${escapeHtml(String(row.fileName || "Abrir"))}</a></div>` : ""}
        </section>

        <section data-admin-onboarding-type-section="quiz" hidden>
          <div class="admin-onboarding-modal-sectiontitle">Quiz</div>
          <label class="modal-field">
            <span>Título do quiz</span>
            <input class="modal-input" type="text" value="${escapeHtml(String(quizRow?.title || row?.title || "Quiz"))}" data-admin-onboarding-quiz-title />
          </label>
          <label class="modal-field">
            <span>Descrição do quiz</span>
            <textarea class="modal-textarea" rows="2" data-admin-onboarding-quiz-desc placeholder="Instruções para o professor...">${escapeHtml(
              String(quizRow?.description || row?.description || "")
            )}</textarea>
          </label>
          <label class="admin-onboarding-modal-check">
            <input type="checkbox" ${quizRow?.showResultToTeacher !== false ? "checked" : ""} data-admin-onboarding-quiz-show />
            <span>Mostrar resultado ao professor</span>
          </label>

          <div class="admin-onboarding-quizbuilder">
            <div class="admin-onboarding-quizbuilder-head">
              <div class="admin-onboarding-quizbuilder-title">Perguntas</div>
              <button class="admin-ped-action" type="button" data-admin-onboarding-quiz-add-q>+ Adicionar pergunta</button>
            </div>
            <div class="admin-onboarding-quizbuilder-qs" data-admin-onboarding-quiz-questions>
              ${(quizRow?.questions?.length ? quizRow.questions : [{ id: "", questionText: "", type: "multiple_choice", options: ["", ""], points: 1, required: true }])
                .map((q) => adminOnboardingModalCreateQuestionRowHtml({ q }))
                .join("")}
            </div>
            <div class="admin-student-panel-note">Dica: em múltipla escolha, a “resposta correta” deve bater com uma alternativa.</div>
          </div>
        </section>

        <div class="modal-inline-error" data-admin-onboarding-error hidden>—</div>
      </div>
    `,
    primaryLabel: "Salvar",
    secondaryLabel: "Cancelar",
    hideSecondary: false,
    showTrash: false,
    onPrimary: () => {
      const errorEl = modalBody?.querySelector("[data-admin-onboarding-error]");
      const setError = (msg) => {
        if (!(errorEl instanceof HTMLElement)) return;
        errorEl.textContent = String(msg || "");
        errorEl.hidden = !msg;
      };
      setError("");

      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;

      (async () => {
        try {
          await saveAdminOnboardingContentFromModal({ existingContentId: row?.id || "" });
          closeModal();
          adminPedagogicoState.activeTab = "onboarding";
          await renderAdminControlePedagogicoPanel({ force: true });
          renderAdminPedagogicoTabs();
        } catch (err) {
          console.error("[admin] onboarding content save failed:", err);
          setError("Não foi possível salvar agora.");
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
        }
      })();

      return false;
    },
    onSecondary: () => {
      closeModal();
      return false;
    },
  });

  adminOnboardingModalSyncTypeSections();
};

const saveAdminOnboardingContentFromModal = async ({ existingContentId } = {}) => {
  if (currentRole !== "admin") throw new Error("not_admin");
  if (!(modalBody instanceof HTMLElement)) throw new Error("no_modal");

  const mode = adminOnboardingDraft?.mode === "edit" ? "edit" : "create";
  const titleEl = modalBody.querySelector("[data-admin-onboarding-title]");
  const descEl = modalBody.querySelector("[data-admin-onboarding-desc]");
  const typeEl = modalBody.querySelector("[data-admin-onboarding-type]");
  const orderEl = modalBody.querySelector("[data-admin-onboarding-order]");
  const requiredEl = modalBody.querySelector("[data-admin-onboarding-required]");
  const statusEl = modalBody.querySelector("[data-admin-onboarding-status]");
  const videoFileEl = modalBody.querySelector("[data-admin-onboarding-video-file]");
  const videoUrlEl = modalBody.querySelector("[data-admin-onboarding-video-url]");
  const durationEl = modalBody.querySelector("[data-admin-onboarding-duration]");
  const docFileEl = modalBody.querySelector("[data-admin-onboarding-doc-file]");

  const title = titleEl instanceof HTMLInputElement ? titleEl.value.trim() : "";
  const description = descEl instanceof HTMLTextAreaElement ? descEl.value.trim() : "";
  const type = typeEl instanceof HTMLSelectElement ? normalizeOnboardingContentType(typeEl.value) : "video";
  const orderRaw = orderEl instanceof HTMLInputElement ? Number(orderEl.value) : adminOnboardingNextOrder();
  const order = Number.isFinite(orderRaw) ? Math.max(1, Math.round(orderRaw)) : adminOnboardingNextOrder();
  const required = requiredEl instanceof HTMLInputElement ? requiredEl.checked : true;
  const status = statusEl instanceof HTMLSelectElement ? normalizeOnboardingStatus(statusEl.value) : "active";

  if (!title) throw new Error("missing_title");

  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_onboarding_save");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) throw new Error("not-authenticated");

  const existingRow = mode === "edit" ? adminOnboardingGetContentRow(existingContentId) : null;

  const contentRef =
    mode === "edit" && existingRow?.id
      ? firebase.doc(firebase.primaryDb, "onboardingContents", String(existingRow.id))
      : firebase.doc(firebase.collection(firebase.primaryDb, "onboardingContents"));
  const contentId = String(contentRef.id || "");

  // Optional file uploads.
  let patchMedia = {};

  if (type === "video") {
    const file = videoFileEl instanceof HTMLInputElement ? (videoFileEl.files && videoFileEl.files[0] ? videoFileEl.files[0] : null) : null;
    const url = videoUrlEl instanceof HTMLInputElement ? videoUrlEl.value.trim() : "";
    const estimatedDuration = durationEl instanceof HTMLInputElement ? durationEl.value.trim() : "";

    if (file) {
      const check = isAllowedOnboardingVideoFile(file);
      if (!check.ok) throw new Error(check.reason || "invalid_video");
      // Replace existing stored file if any.
      if (existingRow?.storagePath) {
        try {
          await withTimeout(firebase.deleteObject(firebase.ref(firebase.primaryStorage, existingRow.storagePath)), 15_000, "storage_delete_old_onboarding_asset");
        } catch (err) {
          console.error("[admin] onboarding: failed to delete old video (continuing):", err);
        }
      }
      const meta = await uploadOnboardingAssetToStorage({ contentId, file, kind: "video" });
      patchMedia = {
        videoUrl: meta.fileUrl,
        documentUrl: "",
        storagePath: meta.storagePath,
        fileName: meta.fileName,
        fileType: meta.fileType,
        fileSize: meta.fileSize,
        estimatedDuration,
        uploadedAt: meta.uploadedAt,
        uploadedBy: meta.uploadedBy,
      };
    } else if (url) {
      patchMedia = {
        videoUrl: url,
        estimatedDuration,
      };
    } else if (existingRow?.videoUrl) {
      patchMedia = { estimatedDuration };
    } else {
      patchMedia = { videoUrl: "", estimatedDuration };
    }
  }

  if (type === "document") {
    const file = docFileEl instanceof HTMLInputElement ? (docFileEl.files && docFileEl.files[0] ? docFileEl.files[0] : null) : null;
    if (file) {
      const check = isAllowedOnboardingDocumentFile(file);
      if (!check.ok) throw new Error(check.reason || "invalid_document");
      if (existingRow?.storagePath) {
        try {
          await withTimeout(firebase.deleteObject(firebase.ref(firebase.primaryStorage, existingRow.storagePath)), 15_000, "storage_delete_old_onboarding_doc");
        } catch (err) {
          console.error("[admin] onboarding: failed to delete old doc (continuing):", err);
        }
      }
      const meta = await uploadOnboardingAssetToStorage({ contentId, file, kind: "document" });
      patchMedia = {
        documentUrl: meta.fileUrl,
        videoUrl: "",
        storagePath: meta.storagePath,
        fileName: meta.fileName,
        fileType: meta.fileType,
        fileSize: meta.fileSize,
        uploadedAt: meta.uploadedAt,
        uploadedBy: meta.uploadedBy,
      };
    } else if (existingRow?.documentUrl) {
      patchMedia = {};
    } else {
      patchMedia = { documentUrl: "" };
    }
  }

  if (type === "quiz") {
    // Clear media fields for quiz.
    patchMedia = { videoUrl: "", documentUrl: "" };
  }

  const basePayload = {
    title,
    description,
    type,
    order,
    required,
    status,
    ...patchMedia,
    quizId: type === "quiz" ? contentId : "",
    updatedAt: firebase.serverTimestamp(),
    updatedBy: String(user.uid || ""),
  };

  if (mode === "create") {
    basePayload.createdAt = firebase.serverTimestamp();
    basePayload.createdBy = String(user.uid || "");
  }

  await withTimeout(firebase.setDoc(contentRef, basePayload, { merge: true }), 12_000, "firestore_onboarding_content_merge");

  if (type === "quiz") {
    const collected = adminOnboardingModalCollectQuiz({ contentId });
    if (collected?.error) throw new Error(collected.error);
    const quiz = collected?.quiz;
    if (!quiz) throw new Error("invalid_quiz");
    const quizRef = firebase.doc(firebase.primaryDb, "onboardingQuizzes", contentId);
    const quizPayload = {
      contentId,
      title: quiz.title,
      description: quiz.description,
      showResultToTeacher: quiz.showResultToTeacher,
      questions: quiz.questions,
      updatedAt: firebase.serverTimestamp(),
      ...(mode === "create" ? { createdAt: firebase.serverTimestamp() } : null),
    };
    await withTimeout(firebase.setDoc(quizRef, quizPayload, { merge: true }), 12_000, "firestore_onboarding_quiz_merge");
  }
};

const toggleAdminOnboardingContentStatus = async ({ contentId } = {}) => {
  const id = String(contentId || "").trim();
  if (!id) return;
  const row = adminOnboardingGetContentRow(id);
  if (!row) return;

  const nextStatus = row.status === "inactive" ? "active" : "inactive";
  try {
    const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_onboarding_toggle");
    const user = await waitForFirebaseAuthReady(firebase, 5000);
    if (!user) throw new Error("not-authenticated");
    await withTimeout(
      firebase.setDoc(
        firebase.doc(firebase.primaryDb, "onboardingContents", id),
        { status: nextStatus, updatedAt: firebase.serverTimestamp(), updatedBy: String(user.uid || "") },
        { merge: true },
      ),
      12_000,
      "firestore_onboarding_toggle_merge"
    );
    adminPedagogicoState.activeTab = "onboarding";
    await renderAdminControlePedagogicoPanel({ force: true });
    renderAdminPedagogicoTabs();
  } catch (e) {
    console.error("[admin] onboarding toggle failed:", e);
  }
};

const swapAdminOnboardingContentOrder = async ({ fromId, direction } = {}) => {
  const id = String(fromId || "").trim();
  const dir = String(direction || "").trim().toLowerCase();
  if (!id || (dir !== "up" && dir !== "down")) return;

  const contents = Array.isArray(adminPedagogicoState.onboardingContents) ? adminPedagogicoState.onboardingContents : [];
  const idx = contents.findIndex((c) => String(c?.id || "") === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= contents.length) return;
  const a = contents[idx];
  const b = contents[swapIdx];
  if (!a?.id || !b?.id) return;

  try {
    const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_onboarding_reorder");
    const user = await waitForFirebaseAuthReady(firebase, 5000);
    if (!user) throw new Error("not-authenticated");

    const aOrder = Number.isFinite(Number(a.order)) ? Number(a.order) : idx + 1;
    const bOrder = Number.isFinite(Number(b.order)) ? Number(b.order) : swapIdx + 1;
    await Promise.all([
      withTimeout(
        firebase.setDoc(firebase.doc(firebase.primaryDb, "onboardingContents", String(a.id)), { order: bOrder, updatedAt: firebase.serverTimestamp(), updatedBy: String(user.uid || "") }, { merge: true }),
        12_000,
        "firestore_onboarding_order_a"
      ),
      withTimeout(
        firebase.setDoc(firebase.doc(firebase.primaryDb, "onboardingContents", String(b.id)), { order: aOrder, updatedAt: firebase.serverTimestamp(), updatedBy: String(user.uid || "") }, { merge: true }),
        12_000,
        "firestore_onboarding_order_b"
      ),
    ]);

    adminPedagogicoState.activeTab = "onboarding";
    await renderAdminControlePedagogicoPanel({ force: true });
    renderAdminPedagogicoTabs();
  } catch (e) {
    console.error("[admin] onboarding reorder failed:", e);
  }
};

const deleteAdminOnboardingContent = async ({ contentId } = {}) => {
  const id = String(contentId || "").trim();
  if (!id) return;
  const row = adminOnboardingGetContentRow(id);
  if (!row) return;

  const progressAll = Array.isArray(adminPedagogicoState.teacherOnboardingProgressAll) ? adminPedagogicoState.teacherOnboardingProgressAll : [];
  const hasProgress = progressAll.some((p) => String(p?.contentId || "") === id);

  openModal({
    title: "Excluir conteúdo",
    bodyHtml: `
      <div style="display:grid; gap:10px;">
        <p style="margin:0; color: rgba(255,255,255,0.75); font-size: 13px; line-height: 1.45;">
          Tem certeza que deseja excluir <strong>${escapeHtml(row.title || "este conteúdo")}</strong>?
        </p>
        ${
          hasProgress
            ? `<p style="margin:0; color: rgba(255,174,86,0.95); font-size: 12px; line-height: 1.45;">
                Atenção: já existe progresso de professores para este conteúdo. Isso pode afetar relatórios e histórico.
              </p>
              <label class="modal-field">
                <span>Digite EXCLUIR para confirmar</span>
                <input class="modal-input" type="text" placeholder="EXCLUIR" data-admin-onboarding-delete-confirm />
              </label>`
            : `<p style="margin:0; color: rgba(255,255,255,0.45); font-size: 12px; line-height: 1.45;">
                Esta ação remove o conteúdo da trilha. Arquivos enviados serão removidos do storage quando possível.
              </p>`
        }
        <div class="modal-inline-error" data-admin-onboarding-delete-error hidden>—</div>
      </div>
    `,
    primaryLabel: "Excluir",
    secondaryLabel: "Cancelar",
    onPrimary: () => {
      const errEl = modalBody?.querySelector("[data-admin-onboarding-delete-error]");
      const confirmEl = modalBody?.querySelector("[data-admin-onboarding-delete-confirm]");
      const setErr = (msg) => {
        if (!(errEl instanceof HTMLElement)) return;
        errEl.textContent = String(msg || "");
        errEl.hidden = !msg;
      };
      setErr("");
      if (hasProgress) {
        const value = confirmEl instanceof HTMLInputElement ? confirmEl.value.trim().toUpperCase() : "";
        if (value !== "EXCLUIR") {
          setErr("Confirmação incorreta.");
          return false;
        }
      }

      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;

      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_onboarding_delete");
          const user = await waitForFirebaseAuthReady(firebase, 5000);
          if (!user) throw new Error("not-authenticated");

          if (row.storagePath) {
            try {
              await withTimeout(firebase.deleteObject(firebase.ref(firebase.primaryStorage, row.storagePath)), 15_000, "storage_delete_onboarding_asset");
            } catch (e) {
              console.error("[admin] onboarding: failed to delete storage asset (continuing):", e);
            }
          }
          // Delete quiz doc (submissions/progress remain for history).
          try {
            await withTimeout(firebase.deleteDoc(firebase.doc(firebase.primaryDb, "onboardingQuizzes", id)), 12_000, "firestore_onboarding_quiz_delete");
          } catch (e) {
            // ok
          }
          await withTimeout(firebase.deleteDoc(firebase.doc(firebase.primaryDb, "onboardingContents", id)), 12_000, "firestore_onboarding_content_delete");
          closeModal();
          adminPedagogicoState.activeTab = "onboarding";
          await renderAdminControlePedagogicoPanel({ force: true });
          renderAdminPedagogicoTabs();
        } catch (e) {
          console.error("[admin] onboarding delete failed:", e);
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
        }
      })();
      return false;
    },
  });
};

const openAdminOnboardingTeacherDetailsModal = ({ teacherId } = {}) => {
  const tid = String(teacherId || "").trim();
  if (!tid) return;
  const teachersById = adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById : new Map();
  const teacherName = String(teachersById.get(tid)?.nome || "Professor");

  const contents = Array.isArray(adminPedagogicoState.onboardingContentsAll) ? adminPedagogicoState.onboardingContentsAll.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
  const progress = (Array.isArray(adminPedagogicoState.teacherOnboardingProgressAll) ? adminPedagogicoState.teacherOnboardingProgressAll : []).filter((p) => String(p?.teacherId || "") === tid);
  const progressByContent = new Map(progress.map((p) => [String(p.contentId), p]));
  const subs = (Array.isArray(adminPedagogicoState.teacherQuizSubmissionsAll) ? adminPedagogicoState.teacherQuizSubmissionsAll : []).filter((s) => String(s?.teacherId || "") === tid);

  const statusFor = (contentId) => {
    const st = normalizeTeacherOnboardingProgressStatus(progressByContent.get(String(contentId))?.status);
    if (st === "completed") return { label: "Concluído", cls: "is-active" };
    if (st === "in_progress") return { label: "Em andamento", cls: "is-paused" };
    return { label: "Não iniciado", cls: "is-ended" };
  };

  const contentRowsHtml = contents
    .map((c, idx) => {
      const p = progressByContent.get(String(c.id)) || null;
      const st = statusFor(c.id);
      const started = p?.startedAtMs ? formatShortDateFromMs(p.startedAtMs) : "—";
      const done = p?.completedAtMs ? formatShortDateFromMs(p.completedAtMs) : "—";
      const typeLabel = c.type === "quiz" ? "Quiz" : c.type === "document" ? "Documento" : "Vídeo";
      return `
        <div class="admin-onboarding-detail-row">
          <div class="admin-onboarding-detail-title">${escapeHtml(`${idx + 1}. ${c.title || "Conteúdo"}`)}</div>
          <div class="admin-onboarding-detail-meta">
            <span class="admin-ped-pill ${st.cls}">${escapeHtml(st.label)}</span>
            <span class="admin-ped-pill">${escapeHtml(typeLabel)}</span>
            ${c.required ? `<span class="admin-ped-pill is-plan">Obrigatório</span>` : `<span class="admin-ped-pill">Opcional</span>`}
            <span class="admin-ped-pill">Início: ${escapeHtml(started)}</span>
            <span class="admin-ped-pill">Conclusão: ${escapeHtml(done)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  const subsHtml =
    subs.length === 0
      ? `<div class="admin-student-panel-note">Nenhum quiz respondido ainda.</div>`
      : subs
          .slice()
          .sort((a, b) => (b.submittedAtMs || 0) - (a.submittedAtMs || 0))
          .map((s) => {
            const when = s.submittedAtMs ? formatShortDateFromMs(s.submittedAtMs) : "—";
            const head = `Quiz ${escapeHtml(String(s.quizId || ""))} · ${escapeHtml(when)} · ${escapeHtml(`${s.score}/${s.maxScore}`)}`;
            const answers = Array.isArray(s.answers) ? s.answers : [];
            return `
              <details class="admin-onboarding-detail-quiz">
                <summary>${head}</summary>
                <div class="admin-onboarding-detail-quiz-body">
                  ${answers
                    .map((a) => {
                      const ok = a.isCorrect == null ? "—" : a.isCorrect ? "Correta" : "Incorreta";
                      const badge = a.isCorrect == null ? "is-paused" : a.isCorrect ? "is-active" : "is-ended";
                      return `
                        <div class="admin-onboarding-detail-answer">
                          <div class="admin-onboarding-detail-answer-q">${escapeHtml(String(a.questionText || ""))}</div>
                          <div class="admin-onboarding-detail-answer-meta">
                            <span class="admin-ped-pill ${badge}">${escapeHtml(ok)}</span>
                            <span class="admin-ped-pill">Pontuação: ${escapeHtml(`${a.pointsEarned ?? 0}/${a.maxPoints ?? 0}`)}</span>
                          </div>
                          <div class="admin-onboarding-detail-answer-sub">
                            <div><strong>Professor:</strong> ${escapeHtml(String(a.teacherAnswer ?? ""))}</div>
                            <div><strong>Correta:</strong> ${escapeHtml(String(a.correctAnswer ?? ""))}</div>
                          </div>
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              </details>
            `;
          })
          .join("");

  openModal({
    title: `Onboarding · ${teacherName}`,
    bodyHtml: `
      <div class="admin-onboarding-detail">
        <div class="admin-onboarding-detail-section">
          <div class="admin-onboarding-detail-sectiontitle">Progresso por conteúdo</div>
          ${contentRowsHtml || `<div class="admin-student-panel-note">Sem trilha cadastrada.</div>`}
        </div>
        <div class="admin-onboarding-detail-section">
          <div class="admin-onboarding-detail-sectiontitle">Respostas de quizzes</div>
          ${subsHtml}
        </div>
      </div>
    `,
    primaryLabel: "Fechar",
    secondaryLabel: "—",
    hideSecondary: true,
    onPrimary: () => {
      closeModal();
      return false;
    },
  });
};

const resetAdminOnboardingTeacher = ({ teacherId } = {}) => {
  const tid = String(teacherId || "").trim();
  if (!tid) return;
  const teachersById = adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById : new Map();
  const teacherName = String(teachersById.get(tid)?.nome || "Professor");

  openModal({
    title: "Resetar onboarding",
    bodyHtml: `
      <div style="display:grid; gap:10px;">
        <p style="margin:0; color: rgba(255,255,255,0.75); font-size: 13px; line-height: 1.45;">
          Resetar progresso e respostas de quiz de <strong>${escapeHtml(teacherName)}</strong>?
        </p>
        <p style="margin:0; color: rgba(255,174,86,0.95); font-size: 12px; line-height: 1.45;">
          Atenção: o professor poderá refazer a trilha. Esta ação remove os registros atuais de progresso e submissões.
        </p>
        <label class="modal-field">
          <span>Digite RESETAR para confirmar</span>
          <input class="modal-input" type="text" placeholder="RESETAR" data-admin-onboarding-reset-confirm />
        </label>
        <div class="modal-inline-error" data-admin-onboarding-reset-error hidden>—</div>
      </div>
    `,
    primaryLabel: "Resetar",
    secondaryLabel: "Cancelar",
    onPrimary: () => {
      const confirmEl = modalBody?.querySelector("[data-admin-onboarding-reset-confirm]");
      const errEl = modalBody?.querySelector("[data-admin-onboarding-reset-error]");
      const setErr = (msg) => {
        if (!(errEl instanceof HTMLElement)) return;
        errEl.textContent = String(msg || "");
        errEl.hidden = !msg;
      };
      setErr("");
      const value = confirmEl instanceof HTMLInputElement ? confirmEl.value.trim().toUpperCase() : "";
      if (value !== "RESETAR") {
        setErr("Confirmação incorreta.");
        return false;
      }

      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;

      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_onboarding_reset");
          const user = await waitForFirebaseAuthReady(firebase, 5000);
          if (!user) throw new Error("not-authenticated");

          const progressQ = firebase.query(firebase.collection(firebase.primaryDb, "teacherOnboardingProgress"), firebase.where("teacherId", "==", tid));
          const subQ = firebase.query(firebase.collection(firebase.primaryDb, "teacherQuizSubmissions"), firebase.where("teacherId", "==", tid));
          const [pSnap, sSnap] = await Promise.all([
            withTimeout(firebase.getDocs(progressQ), 12_000, "firestore_onboarding_progress_list_for_reset"),
            withTimeout(firebase.getDocs(subQ), 12_000, "firestore_onboarding_submissions_list_for_reset"),
          ]);

          const deletions = [];
          pSnap.forEach((d) => deletions.push(withTimeout(firebase.deleteDoc(d.ref), 12_000, "firestore_onboarding_progress_delete")));
          sSnap.forEach((d) => deletions.push(withTimeout(firebase.deleteDoc(d.ref), 12_000, "firestore_onboarding_submission_delete")));
          await Promise.allSettled(deletions);

          closeModal();
          adminPedagogicoState.activeTab = "onboarding";
          await renderAdminControlePedagogicoPanel({ force: true });
          renderAdminPedagogicoTabs();
        } catch (e) {
          console.error("[admin] onboarding reset failed:", e);
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
        }
      })();

      return false;
    },
  });
};

const computeTeacherOnboardingStatus = ({ teacherId, requiredContents, progressByTeacher }) => {
  const rows = progressByTeacher.get(String(teacherId)) || [];
  const map = new Map(rows.map((r) => [String(r.contentId), r]));
  const base = requiredContents.length ? requiredContents : [];
  if (!base.length) return { status: "Sem trilha", pct: 0, done: 0, total: 0 };
  const done = base.filter((c) => normalizeTeacherOnboardingProgressStatus(map.get(c.id)?.status) === "completed").length;
  const inProgress = base.some((c) => normalizeTeacherOnboardingProgressStatus(map.get(c.id)?.status) === "in_progress");
  const pct = Math.round((done / Math.max(1, base.length)) * 100);
  const status = done === 0 && !inProgress ? "Não iniciado" : done >= base.length ? "Concluído" : "Em andamento";
  return { status, pct, done, total: base.length };
};

const renderAdminOnboardingPerformance = () => {
  if (!(adminOnboardingPerfEl instanceof HTMLElement)) return;
  const teachers = Array.isArray(adminPedagogicoState.teachers) ? adminPedagogicoState.teachers : [];
  const contents = Array.isArray(adminPedagogicoState.onboardingContents) ? adminPedagogicoState.onboardingContents : [];
  const requiredContents = contents.filter((c) => c.required && c.status !== "inactive");

  const progressRows = Array.isArray(adminPedagogicoState.teacherOnboardingProgressAll) ? adminPedagogicoState.teacherOnboardingProgressAll : [];
  const subs = Array.isArray(adminPedagogicoState.teacherQuizSubmissionsAll) ? adminPedagogicoState.teacherQuizSubmissionsAll : [];

  const progressByTeacher = new Map();
  progressRows.forEach((r) => {
    const tid = String(r.teacherId || "").trim();
    if (!tid) return;
    if (!progressByTeacher.has(tid)) progressByTeacher.set(tid, []);
    progressByTeacher.get(tid).push(r);
  });

  const subsByTeacher = new Map();
  subs.forEach((s) => {
    const tid = String(s.teacherId || "").trim();
    if (!tid) return;
    if (!subsByTeacher.has(tid)) subsByTeacher.set(tid, []);
    subsByTeacher.get(tid).push(s);
  });

  const rows = teachers
    .slice()
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
    .map((t) => {
      const tid = String(t.id || "");
      const prog = computeTeacherOnboardingStatus({ teacherId: tid, requiredContents, progressByTeacher });
      const tSubs = subsByTeacher.get(tid) || [];
      const quizzesRespondidos = tSubs.length;
      const scores = tSubs.filter((s) => Number.isFinite(Number(s.score)) && Number.isFinite(Number(s.maxScore)) && Number(s.maxScore) > 0);
      const avg = scores.length ? (scores.reduce((acc, s) => acc + Number(s.score) / Number(s.maxScore), 0) / scores.length) * 100 : NaN;
      const lastAccess = (progressByTeacher.get(tid) || []).reduce((best, r) => Math.max(best, r.lastAccessAtMs || r.updatedAtMs || 0), 0);
      return {
        id: tid,
        name: String(t.nome || "Professor"),
        status: prog.status,
        pct: prog.pct,
        done: prog.done,
        total: prog.total,
        quizzesRespondidos,
        avgScorePct: Number.isFinite(avg) ? Math.round(avg) : null,
        lastAccess,
      };
    });

  if (adminOnboardingPerfEmptyEl instanceof HTMLElement) {
    adminOnboardingPerfEmptyEl.hidden = rows.length > 0;
  }

  adminOnboardingPerfEl.innerHTML = `
    <div class="admin-onboarding-row is-head">
      <div>Professor</div>
      <div>Progresso</div>
      <div>Quizzes</div>
      <div>Ações</div>
    </div>
    ${rows
      .map((r) => {
        const sub = `${r.done}/${r.total} concluídos${r.avgScorePct != null ? ` · Média ${r.avgScorePct}%` : ""}`;
        const last = r.lastAccess ? `Último acesso: ${formatShortDateFromMs(r.lastAccess)}` : "Sem acesso";
        return `
          <div class="admin-onboarding-row">
            <div>
              <div class="admin-onboarding-cell-title">${escapeHtml(r.name)}</div>
              <div class="admin-onboarding-cell-sub">${escapeHtml(`${r.status} · ${last}`)}</div>
            </div>
            <div class="admin-onboarding-cell-title">${escapeHtml(`${r.pct}%`)}</div>
            <div class="admin-onboarding-cell-title">${escapeHtml(String(r.quizzesRespondidos))}</div>
            <div class="admin-onboarding-actions">
              <button class="admin-ped-action" type="button" data-admin-onboarding-perf-view="${escapeHtml(r.id)}">Ver detalhes</button>
              <button class="admin-ped-action is-danger" type="button" data-admin-onboarding-perf-reset="${escapeHtml(r.id)}">Resetar</button>
            </div>
          </div>
        `;
      })
      .join("")}
  `;
};

const renderAdminPedagogicoAgenda = () => {
  if (!(adminPedAgenda instanceof HTMLElement)) return;
  const classes = adminPedagogicoFilteredClasses();
  if (adminPedError instanceof HTMLElement) adminPedError.hidden = true;

  if (!classes.length) {
    adminPedAgenda.innerHTML = "";
    if (adminPedEmpty instanceof HTMLElement) adminPedEmpty.hidden = false;
    return;
  }
  if (adminPedEmpty instanceof HTMLElement) adminPedEmpty.hidden = true;

  const teachersById = adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById : new Map();
  const byTeacher = new Map();
  classes.forEach((c) => {
    const tid = String(c.teacherId || "");
    if (!byTeacher.has(tid)) byTeacher.set(tid, []);
    byTeacher.get(tid).push(c);
  });

  const sortedTeacherIds = [...byTeacher.keys()].sort((a, b) => {
    const an = String(teachersById.get(a)?.nome || teachersById.get(a)?.name || "");
    const bn = String(teachersById.get(b)?.nome || teachersById.get(b)?.name || "");
    return an.localeCompare(bn, "pt-BR");
  });

  const days = [1, 2, 3, 4, 5, 6];
  adminPedAgenda.innerHTML = sortedTeacherIds
    .map((teacherId) => {
      const teacher = teachersById.get(teacherId) || {};
      const teacherName = String(teacher.nome || teacher.name || "Professor").trim() || "Professor";
      const items = byTeacher.get(teacherId) || [];

      const dayBuckets = new Map(days.map((d) => [d, []]));
      items.forEach((c) => {
        (Array.isArray(c.daysOfWeek) ? c.daysOfWeek : []).forEach((d) => {
          if (!dayBuckets.has(d)) return;
          dayBuckets.get(d).push(c);
        });
      });
      days.forEach((d) => {
        dayBuckets.get(d).sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
      });

      const dayCols = days
        .map((d) => {
          const list = dayBuckets.get(d) || [];
          const listHtml = list
            .map((c) => {
              const time = `${formatHmFromMinutes(c.startMin)}–${formatHmFromMinutes(c.endMin)}`;
              const status = normalizeClassStatus(c.status);
              const statusLabel = status === "active" ? "Ativa" : status === "paused" ? "Pausada" : "Encerrada";
              const badgeClass = status === "active" ? "is-active" : status === "paused" ? "is-paused" : "is-ended";
              const typeLabel = c.type === "group" ? "Grupo" : "Individual";
              const who =
                c.type === "group"
                  ? `${(Array.isArray(c.studentIds) ? c.studentIds.length : 0) || 0} alunos`
                  : (c.studentNames && c.studentNames[0]) || (c.studentIds && c.studentIds[0]) || "Aluno";
              const plan = c.plan ? String(c.plan).toUpperCase() : "";
              return `
                <button class="admin-ped-slot" type="button" data-admin-ped-class-open="${escapeHtml(c.id)}">
                  <div class="admin-ped-slot-top">
                    <span class="admin-ped-slot-time">${escapeHtml(time)}</span>
                    <span class="admin-ped-slot-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
                  </div>
                  <div class="admin-ped-slot-title">${escapeHtml(c.title || typeLabel)}</div>
                  <div class="admin-ped-slot-meta">${escapeHtml(who)}${plan ? ` · ${escapeHtml(plan)}` : ""}</div>
                </button>
              `;
            })
            .join("");

          return `
            <div class="admin-ped-day-col">
              <div class="admin-ped-day-head">${escapeHtml(daysLabelShort(d))}</div>
              <div class="admin-ped-day-items">${listHtml || `<div class="admin-ped-day-empty">—</div>`}</div>
            </div>
          `;
        })
        .join("");

      return `
        <article class="admin-ped-teacher-block">
          <header class="admin-ped-teacher-head">${escapeHtml(teacherName)}</header>
          <div class="admin-ped-week">${dayCols}</div>
        </article>
      `;
    })
    .join("");
};

const renderAdminPedagogicoClassesList = () => {
  if (!(adminPedClasses instanceof HTMLElement)) return;
  const classes = adminPedagogicoFilteredClasses();
  if (adminPedEmptyClasses instanceof HTMLElement) adminPedEmptyClasses.hidden = classes.length > 0;
  adminPedClasses.innerHTML = classes
    .map((c) => {
      const typeLabel = c.type === "group" ? "Grupo" : "Individual";
      const status = normalizeClassStatus(c.status);
      const statusLabel = status === "active" ? "Ativa" : status === "paused" ? "Pausada" : "Encerrada";
      const badgeClass = status === "active" ? "is-active" : status === "paused" ? "is-paused" : "is-ended";
      const whenDays = (Array.isArray(c.daysOfWeek) ? c.daysOfWeek : []).map(daysLabelShort).join(", ");
      const time = `${formatHmFromMinutes(c.startMin)}–${formatHmFromMinutes(c.endMin)}`;
      const liveUrl = buildAdminPedClassLiveUrl(c);
      const who =
        c.type === "group"
          ? `${(Array.isArray(c.studentIds) ? c.studentIds.length : 0) || 0} alunos`
          : (c.studentNames && c.studentNames[0]) || (c.studentIds && c.studentIds[0]) || "Aluno";
      return `
        <div class="admin-ped-class-row">
          <div class="admin-ped-class-main">
            <div class="admin-ped-class-title">${escapeHtml(c.title || typeLabel)}</div>
            <div class="admin-ped-class-sub">${escapeHtml(whenDays)} · ${escapeHtml(time)} · ${escapeHtml(who)}</div>
          </div>
          <div class="admin-ped-class-meta">
            <span class="admin-ped-pill ${badgeClass}">${escapeHtml(statusLabel)}</span>
            ${c.plan ? `<span class="admin-ped-pill is-plan">${escapeHtml(String(c.plan).toUpperCase())}</span>` : ""}
          </div>
          <div class="admin-ped-class-actions">
            <a class="admin-ped-action is-muted" href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener">Entrar</a>
            <button class="admin-ped-action is-muted" type="button" data-admin-ped-class-copy-live="${escapeHtml(liveUrl)}">Copiar link</button>
            <button class="admin-ped-action" type="button" data-admin-ped-class-edit="${escapeHtml(c.id)}">Editar</button>
            <button class="admin-ped-action is-muted" type="button" data-admin-ped-class-toggle="${escapeHtml(c.id)}">${status === "active" ? "Desativar" : "Ativar"}</button>
            <button class="admin-ped-action is-danger" type="button" data-admin-ped-class-delete="${escapeHtml(c.id)}">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");
};

const renderAdminPedagogicoTeachersPanel = () => {
  if (!(adminPedTeachers instanceof HTMLElement)) return;
  const teachers = Array.isArray(adminPedagogicoState.teachers) ? adminPedagogicoState.teachers : [];
  const classes = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  const byTeacher = new Map();
  classes.forEach((c) => {
    const tid = String(c.teacherId || "");
    if (!tid) return;
    if (!byTeacher.has(tid)) byTeacher.set(tid, []);
    byTeacher.get(tid).push(c);
  });

  adminPedTeachers.innerHTML = teachers
    .slice()
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
    .map((t) => {
      const list = byTeacher.get(String(t.id || "")) || [];
      const total = list.length;
      const indiv = list.filter((c) => c.type === "individual").length;
      const group = list.filter((c) => c.type === "group").length;
      const students = new Set();
      list.forEach((c) => (Array.isArray(c.studentIds) ? c.studentIds : []).forEach((id) => students.add(id)));
      return `
        <div class="admin-ped-teacher-row">
          <div class="admin-ped-teacher-name">${escapeHtml(String(t.nome || "Professor"))}</div>
          <div class="admin-ped-teacher-stats">
            <span>${escapeHtml(String(total))} aulas</span>
            <span>${escapeHtml(String(indiv))} individuais</span>
            <span>${escapeHtml(String(group))} grupos</span>
            <span>${escapeHtml(String(students.size))} alunos</span>
          </div>
        </div>
      `;
    })
    .join("");
};

const renderAdminPedagogicoConflicts = () => {
  if (!(adminPedConflicts instanceof HTMLElement)) return;
  const conflicts = Array.isArray(adminPedagogicoState.conflicts) ? adminPedagogicoState.conflicts : [];
  if (adminPedEmptyConflicts instanceof HTMLElement) adminPedEmptyConflicts.hidden = conflicts.length > 0;
  adminPedConflicts.innerHTML = conflicts
    .map((c) => {
      const a = c.classA || {};
      const b = c.classB || {};
      const day = (() => {
        const setA = new Set(Array.isArray(a.daysOfWeek) ? a.daysOfWeek : []);
        const setB = new Set(Array.isArray(b.daysOfWeek) ? b.daysOfWeek : []);
        const shared = [...setA].find((d) => setB.has(d));
        return shared != null ? daysLabelShort(shared) : "—";
      })();
      const time = `${formatHmFromMinutes(a.startMin)}–${formatHmFromMinutes(a.endMin)}`;
      return `
        <div class="admin-ped-conflict-row">
          <div class="admin-ped-conflict-title">${escapeHtml(c.reason || "Conflito")}</div>
          <div class="admin-ped-conflict-sub">${escapeHtml(day)} · ${escapeHtml(time)}</div>
          <div class="admin-ped-conflict-meta">
            <button class="admin-ped-action" type="button" data-admin-ped-class-edit="${escapeHtml(a.id || "")}">Ver aula A</button>
            <button class="admin-ped-action" type="button" data-admin-ped-class-edit="${escapeHtml(b.id || "")}">Ver aula B</button>
          </div>
        </div>
      `;
    })
    .join("");
};

const runAdminPedagogicoRenderers = () => {
  const renderers = [
    renderAdminPedagogicoMetrics,
    renderAdminPedagogicoTabs,
    renderAdminPedagogicoOverview,
    renderAdminPedagogicoAgenda,
    renderAdminPedagogicoClassesList,
    renderAdminPedagogicoGroups,
    renderAdminPedagogicoStudentsPanel,
    renderAdminPedagogicoTeachersPanel,
    renderAdminPedagogicoPlansPanel,
    renderAdminPedagogicoSurveysPanel,
    renderAdminPedagogicoNpsCsatPanel,
    renderAdminPedagogicoAlertsPanel,
    renderAdminPedagogicoFeedbacksPanel,
    renderAdminPedagogicoReportsPanel,
    renderAdminPedagogicoOnboardingPanel,
    renderAdminPedagogicoConflicts,
    renderAdminPedagogicoLinksPanel,
  ];
  let failed = 0;
  renderers.forEach((render) => {
    try {
      render();
    } catch (error) {
      failed += 1;
      console.error("[admin-ped] partial render failed", render?.name || "unknown", error);
    }
  });
  return failed;
};

const renderAdminControlePedagogicoPanel = async ({ force = false } = {}) => {
  if (currentRole !== "admin") return;
  if (!(adminPedRoot instanceof HTMLElement)) return;
  if (adminPedagogicoState.isLoading) return;

  const now = Date.now();
  if (!force && adminPedagogicoState.loadedAt && now - adminPedagogicoState.loadedAt < 45_000) {
    const failed = runAdminPedagogicoRenderers();
    setAdminPedagogicoStatus(failed ? "Alguns blocos não puderam ser exibidos agora." : "", failed ? "warn" : "");
    return;
  }

  adminPedagogicoState.isLoading = true;
  setAdminPedagogicoStatus("Carregando…");
  if (adminPedError instanceof HTMLElement) adminPedError.hidden = true;

  try {
    const [
      teachers,
      students,
      classes,
      groups,
      plans,
      surveys,
      teacherAlerts,
      pedagogicalFeedbacks,
      liveLessonFeedbacksData,
      lessonLogs,
      onboardingContentsAll,
      onboardingQuizzes,
      onboardingProgressAll,
      teacherQuizSubmissionsAll,
      liveLessons,
      pedagogicalOps,
    ] =
      await Promise.all([
      fetchUserRowsFromFirestore("teacher").catch((error) => {
        console.error("[admin-ped] teachers load failed", error);
        return [];
      }),
      fetchUserRowsFromFirestore("student").catch((error) => {
        console.error("[admin-ped] students load failed", error);
        return [];
      }),
      fetchClassesFromFirestore().catch((error) => {
        console.error("[admin-ped] classes load failed", error);
        return [];
      }),
      fetchGroupsFromFirestore().catch(() => []),
      fetchPlansFromFirestore().catch(() => []),
      fetchSurveysFromFirestore().catch(() => []),
      fetchTeacherAlertsFromFirestore().catch(() => []),
      fetchPedagogicalFeedbacksFromFirestore().catch(() => []),
      fetchLiveLessonFeedbacks().catch(() => ({ summary: {}, feedbacks: [] })),
      fetchLessonLogsFromFirestore().catch(() => []),
      fetchOnboardingContentsFromFirestore({ includeInactive: true }).catch(() => []),
      fetchOnboardingQuizzesFromFirestore().catch(() => []),
      fetchAllTeacherOnboardingProgressFromFirestore().catch(() => []),
      fetchAllTeacherQuizSubmissionsFromFirestore().catch(() => []),
      fetchLiveLessonsForAdminPedagogico().catch((error) => {
        console.error("[admin-ped] Supabase lessons load failed", error);
        return [];
      }),
      fetchWithAuth("/api/pedagogico/dashboard")
        .then(async (res) => (res.ok ? res.json() : { metrics: {} }))
        .catch(() => ({ metrics: {} })),
    ]);

    const liveClasses = normalizeLiveLessonsAsAdminClasses(liveLessons);
    const liveTeachers = liveClasses
      .filter((row) => row.teacherId || row.teacherName)
      .map((row) => ({
        id: row.teacherId || `name:${row.teacherName}`,
        nome: row.teacherName || "Professor",
        ativo: true,
        source: "supabase",
      }));
    const liveStudents = liveClasses.flatMap((row) =>
      row.studentIds.map((id, index) => ({
        id: id || `name:${row.studentNames[index] || ""}`,
        nome: row.studentNames[index] || "Aluno",
        ativo: true,
        professorId: row.teacherId || "",
        source: "supabase",
      }))
    );
    const opsStudents = (Array.isArray(pedagogicalOps?.students) ? pedagogicalOps.students : []).map((row) => ({
      ...row,
      id: String(row.id || row.aluno_id || row.aluno_chave || ""),
      nome: String(row.nome || row.aluno_nome || "Aluno"),
      email: String(row.email || ""),
      ativo: row.ativo_acesso !== false,
      ativo_acesso: row.ativo_acesso !== false,
      status_acesso: row.status_acesso || "ativo",
      professorId: row.professor_id || "",
      plano: row.plano || "",
      source: row.source || "supabase",
    }));
    const personMergeKey = (row) => {
      const email = String(row?.email || "").trim().toLowerCase();
      if (email) return `email:${email}`;
      const phone = String(row?.telefone || "").replace(/\D+/g, "");
      if (phone) return `phone:${phone}`;
      const name = String(row?.nome || row?.aluno_nome || "").trim().toLowerCase();
      return name ? `name:${name}` : `id:${String(row?.id || "")}`;
    };
    const mergePeople = (primary, fallback) => {
      const byId = new Map();
      [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])].forEach((row) => {
        if (!row || typeof row !== "object") return;
        const key = personMergeKey(row);
        if (!key || key === "id:") return;
        const previous = byId.get(key);
        byId.set(key, previous ? { ...row, ...previous, aluno_chave: row.aluno_chave || previous.aluno_chave } : row);
      });
      return Array.from(byId.values());
    };

    adminPedagogicoState.teachers = mergePeople(teachers, liveTeachers);
    adminPedagogicoState.teachersById = new Map(adminPedagogicoState.teachers.map((t) => [String(t.id || ""), t]));
    adminPedagogicoState.students = mergePeople(students, [...opsStudents, ...liveStudents]);
    adminPedagogicoState.studentsById = new Map(adminPedagogicoState.students.map((s) => [String(s.id || ""), s]));
    adminPedagogicoState.classes = mergeAdminPedagogicoClasses(classes, liveClasses);
    adminPedagogicoState.groups = Array.isArray(groups) ? groups : [];
    adminPedagogicoState.groupsById = new Map(adminPedagogicoState.groups.map((g) => [String(g.id || ""), g]));
    adminPedagogicoState.groupsByClassId = new Map(
      adminPedagogicoState.groups.filter((g) => g && g.classId).map((g) => [String(g.classId || ""), g])
    );
    adminPedagogicoState.plans = Array.isArray(plans) ? plans : [];
    adminPedagogicoState.plansById = new Map(adminPedagogicoState.plans.map((p) => [String(p.id || ""), p]));
    adminPedagogicoState.surveys = Array.isArray(surveys) ? surveys : [];
    adminPedagogicoState.teacherAlerts = Array.isArray(teacherAlerts) ? teacherAlerts : [];
    adminPedagogicoState.pedagogicalFeedbacks = Array.isArray(pedagogicalFeedbacks) ? pedagogicalFeedbacks : [];
    adminPedagogicoState.liveLessonFeedbacks = Array.isArray(liveLessonFeedbacksData?.feedbacks) ? liveLessonFeedbacksData.feedbacks : [];
    adminPedagogicoState.lessonLogs = Array.isArray(lessonLogs) ? lessonLogs : [];
    adminPedagogicoState.onboardingContentsAll = Array.isArray(onboardingContentsAll) ? onboardingContentsAll : [];
    adminPedagogicoState.onboardingContents = adminPedagogicoState.onboardingContentsAll.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    adminPedagogicoState.onboardingQuizzes = Array.isArray(onboardingQuizzes) ? onboardingQuizzes : [];
    adminPedagogicoState.teacherOnboardingProgressAll = Array.isArray(onboardingProgressAll) ? onboardingProgressAll : [];
    adminPedagogicoState.teacherQuizSubmissionsAll = Array.isArray(teacherQuizSubmissionsAll) ? teacherQuizSubmissionsAll : [];
    adminPedagogicoState.pedagogicalOps =
      pedagogicalOps && typeof pedagogicalOps === "object"
        ? pedagogicalOps
        : { metrics: {}, onboarding: [], alerts: [], pendingLessons: [], riskStudents: [], flexge: [] };
    adminPedagogicoState.conflicts = computeAdminPedagogicoConflicts(adminPedagogicoState.classes);
    adminPedagogicoState.loadedAt = Date.now();

    const teacherSelect = adminPedRoot.querySelector('[data-admin-ped-filter="teacherId"]');
    if (teacherSelect instanceof HTMLSelectElement) {
      const selected = String(adminPedagogicoState.filters.teacherId || "");
      teacherSelect.innerHTML =
        `<option value="">Todos</option>` +
        adminPedagogicoState.teachers
          .slice()
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
          .map((t) => `<option value="${escapeHtml(String(t.id))}">${escapeHtml(String(t.nome || "Professor"))}</option>`)
          .join("");
      teacherSelect.value = selected;
    }

    const studentSelect = adminPedRoot.querySelector('[data-admin-ped-filter="studentId"]');
    if (studentSelect instanceof HTMLSelectElement) {
      const selected = String(adminPedagogicoState.filters.studentId || "");
      studentSelect.innerHTML =
        `<option value="">Todos</option>` +
        adminPedagogicoState.students
          .slice()
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
          .map((s) => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(String(s.nome || "Aluno"))}</option>`)
          .join("");
      studentSelect.value = selected;
    }

    const planSelect = adminPedRoot.querySelector('[data-admin-ped-filter="plan"]');
    if (planSelect instanceof HTMLSelectElement) {
      const selected = String(adminPedagogicoState.filters.plan || "");
      const plans = Array.isArray(adminPedagogicoState.plans) ? adminPedagogicoState.plans : [];
      const keys = plans
        .filter((p) => p && typeof p === "object" && String(p.status || "").toLowerCase() !== "inactive")
        .map((p) => normalizePlanKeyLoose(p.name))
        .filter(Boolean);
      const unique = [...new Set(keys.length ? keys : ["turma", "gold", "diamond"])]
        .slice()
        .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
      planSelect.innerHTML = `<option value="">Todos</option>` + unique.map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k.toUpperCase())}</option>`).join("");
      planSelect.value = selected;
    }

    const failed = runAdminPedagogicoRenderers();
    const degraded = Boolean(adminPedagogicoState.pedagogicalOps?.degraded);
    setAdminPedagogicoStatus(
      failed || degraded ? "Painel carregado com alguns dados temporariamente indisponíveis." : "",
      failed || degraded ? "warn" : ""
    );
  } catch (error) {
    console.error("[admin] controle-pedagogico load failed:", error);
    setAdminPedagogicoStatus("Não foi possível carregar agora.", "error");
    if (adminPedError instanceof HTMLElement) adminPedError.hidden = false;
  } finally {
    adminPedagogicoState.isLoading = false;
  }
};

const findAdminPedClassById = (id) => {
  const safe = String(id || "").trim();
  if (!safe) return null;
  const arr = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  return arr.find((c) => String(c?.id || "") === safe) || null;
};

const buildAdminPedDaysCheckboxesHtml = (selectedDays) => {
    // Admin > Controle Pedagógico: close "+ Nova ação" menu when clicking elsewhere.
    const pedActionMenuPopover = document.querySelector("[data-admin-ped-new-action-menu]");
    const pedActionMenuTrigger = document.querySelector("[data-admin-ped-new-action]");
    if (
      pedActionMenuPopover instanceof HTMLElement &&
      !pedActionMenuPopover.hidden &&
      !(target.closest("[data-admin-ped-actionmenu]") instanceof Element)
    ) {
      pedActionMenuPopover.hidden = true;
      if (pedActionMenuTrigger instanceof HTMLButtonElement) pedActionMenuTrigger.setAttribute("aria-expanded", "false");
    }

    if (currentRole === "teacher") {
      const onboardingItem = target.closest("[data-teacher-onboarding-item]");
      if (onboardingItem instanceof HTMLButtonElement) {
        event.preventDefault();
        const contentId = String(onboardingItem.getAttribute("data-teacher-onboarding-item") || "").trim();
        if (contentId) {
          teacherOnboardingSetCurrent({ contentId }).catch(() => {});
        }
        return;
      }

      const onboardingPrev = target.closest("[data-teacher-onboarding-prev]");
      if (onboardingPrev instanceof HTMLButtonElement) {
        event.preventDefault();
        const contents = Array.isArray(teacherOnboardingState.contents) ? teacherOnboardingState.contents : [];
        const currentId = String(teacherOnboardingState.currentContentId || "");
        const idx = contents.findIndex((c) => String(c.id) === currentId);
        const prev = idx > 0 ? contents[idx - 1] : null;
        if (prev?.id) teacherOnboardingSetCurrent({ contentId: prev.id }).catch(() => {});
        return;
      }

      const onboardingNext = target.closest("[data-teacher-onboarding-next]");
      if (onboardingNext instanceof HTMLButtonElement) {
        event.preventDefault();
        const contents = Array.isArray(teacherOnboardingState.contents) ? teacherOnboardingState.contents : [];
        const currentId = String(teacherOnboardingState.currentContentId || "");
        const idx = contents.findIndex((c) => String(c.id) === currentId);
        const next = idx >= 0 && idx < contents.length - 1 ? contents[idx + 1] : null;
        if (next?.id) teacherOnboardingSetCurrent({ contentId: next.id }).catch(() => {});
        return;
      }

      const onboardingComplete = target.closest("[data-teacher-onboarding-complete]");
      if (onboardingComplete instanceof HTMLButtonElement) {
        event.preventDefault();
        const contents = Array.isArray(teacherOnboardingState.contents) ? teacherOnboardingState.contents : [];
        const currentId = String(teacherOnboardingState.currentContentId || "");
        const row = contents.find((c) => String(c.id) === currentId) || null;
        if (!row) return;
        if (row.type === "quiz") {
          const quiz = teacherOnboardingState.quizzesByContentId instanceof Map ? teacherOnboardingState.quizzesByContentId.get(row.id) || null : null;
          const submitted =
            quiz && teacherOnboardingState.submissionsByQuizId instanceof Map ? teacherOnboardingState.submissionsByQuizId.get(quiz.id) || null : null;
          if (!submitted) {
            setTeacherOnboardingStatus("Envie as respostas do quiz para concluir este conteúdo.", "error");
            return;
          }
        }
        upsertTeacherOnboardingProgress({ contentId: row.id, nextStatus: "completed" })
          .then(() => {
            setTeacherOnboardingStatus("Conteúdo marcado como concluído.");
            renderTeacherOnboardingItemsList();
            renderTeacherOnboardingProgress();
            renderTeacherOnboardingCurrent();
          })
          .catch(() => {
            setTeacherOnboardingStatus("Não foi possível salvar agora.", "error");
          });
        return;
      }

      const quizSubmit = target.closest("[data-teacher-onboarding-quiz-submit]");
      if (quizSubmit instanceof HTMLButtonElement) {
        event.preventDefault();
        const quizId = String(quizSubmit.getAttribute("data-teacher-onboarding-quiz-submit") || "").trim();
        submitTeacherOnboardingQuiz({ quizId }).catch(() => {
          setTeacherOnboardingStatus("Não foi possível enviar agora.", "error");
        });
        return;
      }

      const teacherHistoryClose = target.closest("[data-teacher-student-history-close]");
      if (teacherHistoryClose instanceof HTMLElement) {
        event.preventDefault();
        closeTeacherStudentHistoryDrawer();
        return;
      }

      const teacherHistoryFilterBtn = target.closest("[data-teacher-student-history-filter]");
      if (teacherHistoryFilterBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const next = String(teacherHistoryFilterBtn.getAttribute("data-teacher-student-history-filter") || "all").trim();
        teacherStudentsState.history.filter = next || "all";
        document.querySelectorAll("[data-teacher-student-history-filter]").forEach((btn) => {
          if (!(btn instanceof HTMLButtonElement)) return;
          const isActive =
            String(btn.getAttribute("data-teacher-student-history-filter") || "") === String(teacherStudentsState.history.filter || "all");
          btn.classList.toggle("is-active", isActive);
          btn.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        renderTeacherStudentHistoryDrawer();
        return;
      }

      const teacherActionsTrigger = target.closest("[data-teacher-student-actions-trigger]");
      if (teacherActionsTrigger instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(teacherActionsTrigger.getAttribute("data-teacher-student-actions-trigger") || "").trim();
        openTeacherStudentActionsPopover({ triggerEl: teacherActionsTrigger, alunoId });
        return;
      }

      const teacherAction = target.closest("[data-teacher-student-action]");
      if (teacherAction instanceof HTMLButtonElement) {
        const action = String(teacherAction.getAttribute("data-teacher-student-action") || "").trim();
        if (action === "history") {
          event.preventDefault();
          const alunoId = String(teacherAction.getAttribute("data-teacher-student-aluno") || "").trim();
          closeTeacherStudentActionsPopover();
          openTeacherStudentHistoryDrawer({ alunoId }).catch(() => {});
          return;
        }
      }
    }

    const teacherFeedbackView = target.closest("[data-teacher-v4-feedback-view]");
    if (teacherFeedbackView instanceof HTMLButtonElement) {
      if (currentRole === "teacher") {
        event.preventDefault();
        const feedbackId = String(teacherFeedbackView.getAttribute("data-teacher-v4-feedback-view") || "").trim();
        openTeacherPedFeedbackModal({ feedbackId });
        return;
      }
    }

    const pedClose = target.closest("[data-pedagogico-drawer-close]");
    if (pedClose instanceof HTMLElement) {
      event.preventDefault();
      closePedagogicoDrawer();
      return;
    }

    const pedSave = target.closest("[data-pedagogico-save]");
    if (pedSave instanceof HTMLButtonElement) {
      event.preventDefault();
      savePedagogicoLog({ autosave: false }).catch(() => {});
      return;
    }

    // (Clique nos itens do Controle Pedagógico é tratado na fase de captura acima.)

    // Admin manage tables: actions menu + operations.
    if (currentRole === "admin") {
      const adminPedNewAction = target.closest("[data-admin-ped-new-action]");
      if (adminPedNewAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const menu = document.querySelector("[data-admin-ped-new-action-menu]");
        const isOpen = menu instanceof HTMLElement ? !menu.hidden : false;
        if (menu instanceof HTMLElement) {
          menu.hidden = isOpen;
        }
        adminPedNewAction.setAttribute("aria-expanded", isOpen ? "false" : "true");
        return;
      }

      const adminPedNewActionItem = target.closest("[data-admin-ped-new-action-item]");
      if (adminPedNewActionItem instanceof HTMLButtonElement) {
        event.preventDefault();
        const kind = String(adminPedNewActionItem.getAttribute("data-admin-ped-new-action-item") || "").trim();
        const menu = document.querySelector("[data-admin-ped-new-action-menu]");
        const trigger = document.querySelector("[data-admin-ped-new-action]");
        if (menu instanceof HTMLElement) menu.hidden = true;
        if (trigger instanceof HTMLButtonElement) trigger.setAttribute("aria-expanded", "false");

        renderAdminControlePedagogicoPanel({ force: false })
          .then(() => {
            if (kind === "class_individual") {
              openAdminPedClassModal({ mode: "create", prefill: { type: "individual" } });
              return;
            }
            if (kind === "class_group") {
              openAdminPedClassModal({ mode: "create", prefill: { type: "group" } });
              return;
            }
            if (kind === "group") {
              openAdminPedGroupModal({ mode: "create" });
              return;
            }
            if (kind === "link") {
              openAdminPedQuickLinkModal();
              return;
            }
            if (kind === "plan") {
              openAdminPedPlanModal({ mode: "create" });
              return;
            }
            if (kind === "feedback") {
              openAdminPedFeedbackModal({ mode: "create" });
              return;
            }
            if (kind === "report") {
              adminPedagogicoState.activeGroup = "gestao";
              adminPedagogicoState.activeTab = "relatorios";
              renderAdminPedagogicoTabs();
              renderAdminPedagogicoReportsPanel();
              return;
            }
          })
          .catch(() => {});
        return;
      }

      // Admin > Controle Pedagógico > Onboarding (tab)
      const adminOnboardingAdd = target.closest("[data-admin-onboarding-add]");
      if (adminOnboardingAdd instanceof HTMLButtonElement) {
        event.preventDefault();
        renderAdminControlePedagogicoPanel({ force: false })
          .then(() => openAdminOnboardingContentModal({ mode: "create" }))
          .catch(() => openAdminOnboardingContentModal({ mode: "create" }));
        return;
      }

      const adminOnboardingEdit = target.closest("[data-admin-onboarding-edit]");
      if (adminOnboardingEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const contentId = String(adminOnboardingEdit.getAttribute("data-admin-onboarding-edit") || "").trim();
        if (contentId) openAdminOnboardingContentModal({ mode: "edit", contentId });
        return;
      }

      const adminOnboardingToggle = target.closest("[data-admin-onboarding-toggle]");
      if (adminOnboardingToggle instanceof HTMLButtonElement) {
        event.preventDefault();
        const contentId = String(adminOnboardingToggle.getAttribute("data-admin-onboarding-toggle") || "").trim();
        toggleAdminOnboardingContentStatus({ contentId }).catch(() => {});
        return;
      }

      const adminOnboardingMove = target.closest("[data-admin-onboarding-move]");
      if (adminOnboardingMove instanceof HTMLButtonElement) {
        event.preventDefault();
        const direction = String(adminOnboardingMove.getAttribute("data-admin-onboarding-move") || "").trim();
        const fromId = String(adminOnboardingMove.getAttribute("data-admin-onboarding-id") || "").trim();
        swapAdminOnboardingContentOrder({ fromId, direction }).catch(() => {});
        return;
      }

      const adminOnboardingDelete = target.closest("[data-admin-onboarding-delete]");
      if (adminOnboardingDelete instanceof HTMLButtonElement) {
        event.preventDefault();
        const contentId = String(adminOnboardingDelete.getAttribute("data-admin-onboarding-delete") || "").trim();
        deleteAdminOnboardingContent({ contentId }).catch(() => {});
        return;
      }

      const adminOnboardingPerfView = target.closest("[data-admin-onboarding-perf-view]");
      if (adminOnboardingPerfView instanceof HTMLButtonElement) {
        event.preventDefault();
        const teacherId = String(adminOnboardingPerfView.getAttribute("data-admin-onboarding-perf-view") || "").trim();
        if (teacherId) openAdminOnboardingTeacherDetailsModal({ teacherId });
        return;
      }

      const adminOnboardingPerfReset = target.closest("[data-admin-onboarding-perf-reset]");
      if (adminOnboardingPerfReset instanceof HTMLButtonElement) {
        event.preventDefault();
        const teacherId = String(adminOnboardingPerfReset.getAttribute("data-admin-onboarding-perf-reset") || "").trim();
        resetAdminOnboardingTeacher({ teacherId });
        return;
      }

      // Admin onboarding modal (quiz builder) interactions.
      if (activeModalKind === "admin-onboarding-content" && modalBody instanceof HTMLElement && target instanceof Element && target.closest(".admin-onboarding-modal")) {
        const typeEl = modalBody.querySelector("[data-admin-onboarding-type]");
        const type = typeEl instanceof HTMLSelectElement ? normalizeOnboardingContentType(typeEl.value) : "video";

        const typeChanged = target.closest("[data-admin-onboarding-type]");
        if (typeChanged instanceof HTMLSelectElement) {
          event.preventDefault();
          adminOnboardingModalSyncTypeSections();
          return;
        }

        if (type === "quiz") {
          const addQ = target.closest("[data-admin-onboarding-quiz-add-q]");
          if (addQ instanceof HTMLButtonElement) {
            event.preventDefault();
            const list = modalBody.querySelector("[data-admin-onboarding-quiz-questions]");
            if (list instanceof HTMLElement) {
              list.insertAdjacentHTML("beforeend", adminOnboardingModalCreateQuestionRowHtml({ q: { id: "", questionText: "", type: "multiple_choice", options: ["", ""], points: 1, required: true } }));
              adminOnboardingModalSyncTypeSections();
            }
            return;
          }

          const removeQ = target.closest("[data-admin-onboarding-q-remove]");
          if (removeQ instanceof HTMLButtonElement) {
            event.preventDefault();
            const row = removeQ.closest("[data-admin-onboarding-q]");
            if (row instanceof HTMLElement) {
              row.remove();
              adminOnboardingModalSyncTypeSections();
            }
            return;
          }

          const addOpt = target.closest("[data-admin-onboarding-q-option-add]");
          if (addOpt instanceof HTMLButtonElement) {
            event.preventDefault();
            const qRow = addOpt.closest("[data-admin-onboarding-q]");
            const list = qRow instanceof HTMLElement ? qRow.querySelector(".admin-onboarding-q-options-list") : null;
            if (list instanceof HTMLElement) {
              list.insertAdjacentHTML(
                "beforeend",
                `<div class="admin-onboarding-q-option">
                  <input class="modal-input" type="text" value="" placeholder="Alternativa" data-admin-onboarding-q-option />
                  <button class="admin-ped-action is-danger" type="button" data-admin-onboarding-q-option-remove aria-label="Remover alternativa">✕</button>
                </div>`
              );
              adminOnboardingModalSyncTypeSections();
            }
            return;
          }

          const removeOpt = target.closest("[data-admin-onboarding-q-option-remove]");
          if (removeOpt instanceof HTMLButtonElement) {
            event.preventDefault();
            const optRow = removeOpt.closest(".admin-onboarding-q-option");
            if (optRow instanceof HTMLElement) {
              optRow.remove();
              adminOnboardingModalSyncTypeSections();
            }
            return;
          }

          const qType = target.closest("[data-admin-onboarding-q-type]");
          if (qType instanceof HTMLSelectElement) {
            event.preventDefault();
            const qRow = qType.closest("[data-admin-onboarding-q]");
            adminOnboardingModalSyncQuestionUI(qRow);
            return;
          }
        }
      }

      const adminPedNewClass = target.closest("[data-admin-ped-new-class]");
      if (adminPedNewClass instanceof HTMLButtonElement) {
        event.preventDefault();
        // Ensure data is available (teachers/students/classes) before opening the modal.
        renderAdminControlePedagogicoPanel({ force: false })
          .then(() => {
            openAdminPedClassModal({ mode: "create" });
          })
          .catch(() => {
            openAdminPedClassModal({ mode: "create" });
          });
        return;
      }

      const adminPedNewGroup = target.closest("[data-admin-ped-new-group]");
      if (adminPedNewGroup instanceof HTMLButtonElement) {
        event.preventDefault();
        renderAdminControlePedagogicoPanel({ force: false })
          .then(() => openAdminPedGroupModal({ mode: "create" }))
          .catch(() => openAdminPedGroupModal({ mode: "create" }));
        return;
      }

      const adminPedNewPlan = target.closest("[data-admin-ped-new-plan]");
      if (adminPedNewPlan instanceof HTMLButtonElement) {
        event.preventDefault();
        renderAdminControlePedagogicoPanel({ force: false })
          .then(() => openAdminPedPlanModal({ mode: "create" }))
          .catch(() => openAdminPedPlanModal({ mode: "create" }));
        return;
      }

      const adminPedNewFeedback = target.closest("[data-admin-ped-new-feedback]");
      if (adminPedNewFeedback instanceof HTMLButtonElement) {
        event.preventDefault();
        renderAdminControlePedagogicoPanel({ force: false })
          .then(() => openAdminPedFeedbackModal({ mode: "create" }))
          .catch(() => openAdminPedFeedbackModal({ mode: "create" }));
        return;
      }

      const adminPedGenerateReport = target.closest("[data-admin-ped-generate-report]");
      if (adminPedGenerateReport instanceof HTMLButtonElement) {
        event.preventDefault();
        adminPedagogicoState.activeTab = "relatorios";
        renderAdminPedagogicoTabs();
        renderAdminPedagogicoReportsPanel();
        return;
      }

      const adminPedGroupBtn = target.closest("[data-admin-ped-group]");
      if (adminPedGroupBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const group = String(adminPedGroupBtn.getAttribute("data-admin-ped-group") || "").trim();
        if (group) {
          adminPedagogicoState.activeGroup = group;
          const groupDef = ADMIN_PED_NAV_GROUPS.find((g) => String(g.key) === group);
          adminPedagogicoState.activeTab = groupDef?.tabs?.[0]?.key ? String(groupDef.tabs[0].key) : "overview";
          renderAdminPedagogicoTabs();
          // Render the initial panel for the group (best effort).
          renderAdminPedagogicoOverview();
          renderAdminPedagogicoAgenda();
          renderAdminPedagogicoClassesList();
          renderAdminPedagogicoGroups();
          renderAdminPedagogicoStudentsPanel();
          renderAdminPedagogicoTeachersPanel();
          renderAdminPedagogicoPlansPanel();
          renderAdminPedagogicoSurveysPanel();
          renderAdminPedagogicoAlertsPanel();
          renderAdminPedagogicoFeedbacksPanel();
          renderAdminPedagogicoOnboardingPanel();
          renderAdminPedagogicoConflicts();
          renderAdminPedagogicoNpsCsatPanel();
          renderAdminPedagogicoLinksPanel();
        }
        return;
      }

      const adminPedTab = target.closest("[data-admin-ped-tab]");
      if (adminPedTab instanceof HTMLButtonElement) {
        event.preventDefault();
        const tab = String(adminPedTab.getAttribute("data-admin-ped-tab") || "").trim();
        if (tab) {
          adminPedagogicoState.activeTab = tab;
          adminPedagogicoState.activeGroup = adminPedFindGroupForTab(tab);
          renderAdminPedagogicoTabs();
        }
        return;
      }

      const adminPedNav = target.closest("[data-admin-ped-nav]");
      if (adminPedNav instanceof HTMLButtonElement) {
        event.preventDefault();
        const tab = String(adminPedNav.getAttribute("data-admin-ped-nav") || "").trim();
        if (!tab) {
          renderAdminControlePedagogicoPanel({ force: false })
            .then(() => openAdminPedClassModal({ mode: "create" }))
            .catch(() => openAdminPedClassModal({ mode: "create" }));
          return;
        }
        adminPedagogicoState.activeTab = tab;
        adminPedagogicoState.activeGroup = adminPedFindGroupForTab(tab);
        renderAdminPedagogicoTabs();
        // Render target panel (best effort).
        if (tab === "overview") renderAdminPedagogicoOverview();
        else if (tab === "agenda") renderAdminPedagogicoAgenda();
        else if (tab === "aulas") renderAdminPedagogicoClassesList();
        else if (tab === "conflitos") renderAdminPedagogicoConflicts();
        else if (tab === "alunos") renderAdminPedagogicoStudentsPanel();
        else if (tab === "turmas") renderAdminPedagogicoGroups();
        else if (tab === "vinculos") renderAdminPedagogicoLinksPanel();
        else if (tab === "professores") renderAdminPedagogicoTeachersPanel();
        else if (tab === "feedbacks") renderAdminPedagogicoFeedbacksPanel();
        else if (tab === "onboarding") renderAdminPedagogicoOnboardingPanel();
        else if (tab === "pesquisas") renderAdminPedagogicoSurveysPanel();
        else if (tab === "npscsat") renderAdminPedagogicoNpsCsatPanel();
        else if (tab === "avisos") renderAdminPedagogicoAlertsPanel();
        else if (tab === "planos") renderAdminPedagogicoPlansPanel();
        else if (tab === "relatorios") renderAdminPedagogicoReportsPanel();
        return;
      }

      const adminPedKpiAction = target.closest("[data-admin-ped-kpi-action]");
      if (adminPedKpiAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const k = String(adminPedKpiAction.getAttribute("data-admin-ped-kpi-action") || "").trim();
        if (k === "classesToday") {
          adminPedagogicoState.activeGroup = "operacao";
          adminPedagogicoState.activeTab = "agenda";
          renderAdminPedagogicoTabs();
          renderAdminPedagogicoAgenda();
          return;
        }
        if (k === "critical") {
          adminPedagogicoState.activeGroup = "operacao";
          adminPedagogicoState.activeTab = "overview";
          renderAdminPedagogicoTabs();
          renderAdminPedagogicoOverview();
          return;
        }
        if (k === "risk") {
          adminPedagogicoState.activeGroup = "alunosTurmas";
          adminPedagogicoState.activeTab = "alunos";
          renderAdminPedagogicoTabs();
          renderAdminPedagogicoStudentsPanel();
          return;
        }
        if (k === "feedbackPending") {
          adminPedagogicoState.activeGroup = "professores";
          adminPedagogicoState.activeTab = "feedbacks";
          renderAdminPedagogicoTabs();
          renderAdminPedagogicoFeedbacksPanel();
          openAdminPedFeedbackModal({ mode: "create" });
          return;
        }
        return;
      }

      const adminPedQuickLink = target.closest("[data-admin-ped-quick-link]");
      if (adminPedQuickLink instanceof HTMLButtonElement) {
        event.preventDefault();
        openAdminPedQuickLinkModal();
        return;
      }

      const adminPedOpenSurveys = target.closest("[data-admin-ped-open-surveys]");
      if (adminPedOpenSurveys instanceof HTMLButtonElement) {
        event.preventDefault();
        adminPedagogicoState.activeGroup = "qualidade";
        adminPedagogicoState.activeTab = "pesquisas";
        renderAdminPedagogicoTabs();
        renderAdminPedagogicoSurveysPanel();
        return;
      }

      const adminPedGroupEdit = target.closest("[data-admin-ped-group-edit]");
      if (adminPedGroupEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const groupId = String(adminPedGroupEdit.getAttribute("data-admin-ped-group-edit") || "").trim();
        const row =
          (Array.isArray(adminPedagogicoState.groups) ? adminPedagogicoState.groups : []).find((g) => String(g?.id || "") === groupId) || null;
        if (row) openAdminPedGroupModal({ mode: "edit", groupRow: row });
        return;
      }

      const adminPedGroupToggle = target.closest("[data-admin-ped-group-toggle]");
      if (adminPedGroupToggle instanceof HTMLButtonElement) {
        event.preventDefault();
        const groupId = String(adminPedGroupToggle.getAttribute("data-admin-ped-group-toggle") || "").trim();
        toggleAdminPedGroupStatus({ groupId });
        return;
      }

      const adminPedGroupDelete = target.closest("[data-admin-ped-group-delete]");
      if (adminPedGroupDelete instanceof HTMLButtonElement) {
        event.preventDefault();
        const groupId = String(adminPedGroupDelete.getAttribute("data-admin-ped-group-delete") || "").trim();
        deleteAdminPedGroup({ groupId });
        return;
      }

      const adminPedPlanEdit = target.closest("[data-admin-ped-plan-edit]");
      if (adminPedPlanEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const planId = String(adminPedPlanEdit.getAttribute("data-admin-ped-plan-edit") || "").trim();
        const row =
          (Array.isArray(adminPedagogicoState.plans) ? adminPedagogicoState.plans : []).find((p) => String(p?.id || "") === planId) || null;
        if (row) openAdminPedPlanModal({ mode: "edit", planRow: row });
        return;
      }

      const adminPedPlanToggle = target.closest("[data-admin-ped-plan-toggle]");
      if (adminPedPlanToggle instanceof HTMLButtonElement) {
        event.preventDefault();
        const planId = String(adminPedPlanToggle.getAttribute("data-admin-ped-plan-toggle") || "").trim();
        toggleAdminPedPlanStatus({ planId });
        return;
      }

      const adminPedPlanDelete = target.closest("[data-admin-ped-plan-delete]");
      if (adminPedPlanDelete instanceof HTMLButtonElement) {
        event.preventDefault();
        const planId = String(adminPedPlanDelete.getAttribute("data-admin-ped-plan-delete") || "").trim();
        deleteAdminPedPlan({ planId });
        return;
      }

      const adminPedAlertView = target.closest("[data-admin-ped-alert-view]");
      if (adminPedAlertView instanceof HTMLButtonElement) {
        event.preventDefault();
        const alertId = String(adminPedAlertView.getAttribute("data-admin-ped-alert-view") || "").trim();
        openAdminPedAlertViewModal({ alertId });
        return;
      }

      const adminPedAlertResolve = target.closest("[data-admin-ped-alert-resolve]");
      if (adminPedAlertResolve instanceof HTMLButtonElement) {
        event.preventDefault();
        const alertId = String(adminPedAlertResolve.getAttribute("data-admin-ped-alert-resolve") || "").trim();
        resolveAdminPedAlert({ alertId });
        return;
      }

      const adminPedFeedbackView = target.closest("[data-admin-ped-feedback-view]");
      if (adminPedFeedbackView instanceof HTMLButtonElement) {
        event.preventDefault();
        const feedbackId = String(adminPedFeedbackView.getAttribute("data-admin-ped-feedback-view") || "").trim();
        openAdminPedFeedbackViewModal({ feedbackId });
        return;
      }

      const adminPedStudentOpen = target.closest("[data-admin-ped-student-open]");
      if (adminPedStudentOpen instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(adminPedStudentOpen.getAttribute("data-admin-ped-student-open") || "").trim();
        openAdminStudentHistoryDrawer({ alunoId }).catch(() => {});
        return;
      }

      const adminPedStudentAccessStatus = target.closest("[data-admin-ped-student-access-status]");
      if (adminPedStudentAccessStatus instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoChave = String(adminPedStudentAccessStatus.getAttribute("data-admin-ped-student-access-status") || "").trim();
        const nextStatus = String(adminPedStudentAccessStatus.getAttribute("data-admin-ped-student-next-status") || "").trim();
        if (!alunoChave || !["ativo", "inativo"].includes(nextStatus)) return;
        adminPedStudentAccessStatus.disabled = true;
        setAdminPedagogicoStatus(nextStatus === "inativo" ? "Marcando como inativo no seu acesso…" : "Ativando no seu acesso…");
        fetchWithAuth("/api/pedagogico/dashboard", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set_student_status", aluno_chave: alunoChave, status: nextStatus }),
        })
          .then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "student_status_failed");
            adminPedagogicoState.loadedAt = 0;
            await renderAdminControlePedagogicoPanel({ force: true });
            setAdminPedagogicoStatus(
              nextStatus === "inativo"
                ? "Aluno inativo apenas no seu acesso. O acesso de outros administradores não foi alterado."
                : "Aluno reativado no seu acesso.",
              "success"
            );
          })
          .catch((error) => {
            console.error("[admin-ped] student access status failed", error);
            adminPedStudentAccessStatus.disabled = false;
            setAdminPedagogicoStatus(
              error?.message === "PGRST205" || error?.message === "42P01"
                ? "A tabela de preferências por acesso ainda precisa ser criada no Supabase."
                : "Não foi possível alterar o status no seu acesso agora.",
              "error"
            );
          });
        return;
      }

      const adminPedStudentLink = target.closest("[data-admin-ped-student-link]");
      if (adminPedStudentLink instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(adminPedStudentLink.getAttribute("data-admin-ped-student-link") || "").trim();
        openAdminPedStudentLinkModal({ studentId: alunoId });
        return;
      }

      const adminPedStudentNewClass = target.closest("[data-admin-ped-student-new-class]");
      if (adminPedStudentNewClass instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(adminPedStudentNewClass.getAttribute("data-admin-ped-student-new-class") || "").trim();
        const meta = adminPedagogicoState.studentsById instanceof Map ? adminPedagogicoState.studentsById.get(alunoId) || null : null;
        const teacherId = String(meta?.professorId || meta?.teacherId || "").trim();
        const plan = String(meta?.plano || "").trim();
        openAdminPedClassModal({
          mode: "create",
          prefill: { type: "individual", teacherId, plan, studentIds: alunoId ? [alunoId] : [] },
        });
        return;
      }

      const adminPedReportBtn = target.closest("[data-admin-ped-report]");
      if (adminPedReportBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const kind = String(adminPedReportBtn.getAttribute("data-admin-ped-report") || "").trim();
        if (!kind) return;
        const filenameBase = `relatorio_${kind}_${createDateKey(new Date())}.csv`;
        if (kind === "students_active") {
          const teachersById = adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById : new Map();
          const groupsById = adminPedagogicoState.groupsById instanceof Map ? adminPedagogicoState.groupsById : new Map();
          const rows = (Array.isArray(adminPedagogicoState.students) ? adminPedagogicoState.students : [])
            .filter((s) => s && typeof s === "object" && s.ativo)
            .map((s) => {
              const teacherId = String(s.professorId || s.teacherId || "").trim();
              const groupId = String(s.groupId || "").trim();
              return {
                alunoId: String(s.id || ""),
                nome: String(s.nome || ""),
                email: String(s.email || ""),
                plano: String(s.plano || ""),
                professor: teacherId ? String(teachersById.get(teacherId)?.nome || "") : "",
                turma: groupId ? String(groupsById.get(groupId)?.name || "") : String(s.groupName || ""),
                pais: String(s.pais || ""),
                estadoEua: String(s.estadoEua || ""),
              };
            });
          adminPedDownloadCsv({ filename: filenameBase, rows });
          return;
        }
        if (kind === "classes") {
          const rows = (Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : []).map((c) => ({
            id: String(c.id || ""),
            tipo: c.type === "group" ? "Grupo" : "Individual",
            professor: String(c.teacherName || ""),
            turma: String(c.groupName || ""),
            alunos: Array.isArray(c.studentNames) && c.studentNames.length ? c.studentNames.join(", ") : "",
            dias: Array.isArray(c.daysOfWeek) ? c.daysOfWeek.map(daysLabelShort).join(", ") : "",
            horario: `${formatHmFromMinutes(c.startMin || 0)}-${formatHmFromMinutes(c.endMin || 0)}`,
            plano: String(c.planName || c.plan || ""),
            status: String(c.status || ""),
          }));
          adminPedDownloadCsv({ filename: filenameBase, rows });
          return;
        }
        if (kind === "groups") {
          const rows = (Array.isArray(adminPedagogicoState.groups) ? adminPedagogicoState.groups : []).map((g) => ({
            id: String(g.id || ""),
            nome: String(g.name || ""),
            professor: String(g.teacherName || ""),
            plano: String(g.planName || ""),
            alunos: Array.isArray(g.studentNames) ? String(g.studentNames.length) : "0",
            dias: Array.isArray(g.daysOfWeek) ? g.daysOfWeek.map(daysLabelShort).join(", ") : "",
            horario: `${formatHmFromMinutes(g.startMin || 0)}-${formatHmFromMinutes(g.endMin || 0)}`,
            status: String(g.status || ""),
          }));
          adminPedDownloadCsv({ filename: filenameBase, rows });
          return;
        }
        if (kind === "feedbacks") {
          const liveRows = (Array.isArray(adminPedagogicoState.liveLessonFeedbacks) ? adminPedagogicoState.liveLessonFeedbacks : []).map((f) => ({
            id: String(f.id || ""),
            origem: "Aula ao vivo",
            aluno: String(f.alunoNome || ""),
            professor: String(f.professorNome || ""),
            data: f.createdAtMs ? formatShortDateFromMs(f.createdAtMs) : "",
            tipo: "Aluno avaliou professor",
            notaGeral: Number.isFinite(Number(f.notaProfessor)) ? String(f.notaProfessor) : "",
            mensagem: String(f.mensagem || ""),
            status: Number(f.notaProfessor) <= 6 ? "Atenção" : "OK",
          }));
          const pedagogicalRows = (Array.isArray(adminPedagogicoState.pedagogicalFeedbacks) ? adminPedagogicoState.pedagogicalFeedbacks : []).map((f) => ({
            id: String(f.id || ""),
            origem: "Feedback pedagógico",
            aluno: String(f.studentId || ""),
            professor: String(f.teacherName || ""),
            data: String(f.observationDate || ""),
            tipo: f.classType === "group" ? "Grupo" : "Individual",
            notaGeral: Number.isFinite(Number(f.generalScore)) ? String(f.generalScore) : "",
            mensagem: String(f.freeNotes || ""),
            status: f.readByTeacher ? "Lido" : "Novo",
          }));
          const rows = liveRows.concat(pedagogicalRows);
          adminPedDownloadCsv({ filename: filenameBase, rows });
          return;
        }
        if (kind === "alerts") {
          const rows = (Array.isArray(adminPedagogicoState.teacherAlerts) ? adminPedagogicoState.teacherAlerts : []).map((a) => ({
            id: String(a.id || ""),
            professor: String(a.teacherName || ""),
            aluno: String(a.studentName || ""),
            categoria: String(a.category || ""),
            prioridade: String(a.priority || ""),
            status: String(a.status || ""),
            data: formatShortDateFromMs(a.createdAtMs),
          }));
          adminPedDownloadCsv({ filename: filenameBase, rows });
          return;
        }
        if (kind === "surveys") {
          const rows = (Array.isArray(adminPedagogicoState.surveys) ? adminPedagogicoState.surveys : []).map((s) => ({
            id: String(s.id || ""),
            aluno: String(s.studentName || ""),
            professor: String(s.teacherName || ""),
            nps: Number.isFinite(Number(s.nps)) ? String(s.nps) : "",
            csat: Number.isFinite(Number(s.csat)) ? String(s.csat) : "",
            comentario: String(s.comment || ""),
            data: formatShortDateFromMs(s.createdAtMs),
          }));
          adminPedDownloadCsv({ filename: filenameBase, rows });
          return;
        }
        return;
      }

      const adminPedClassOpen = target.closest("[data-admin-ped-class-open]");
      if (adminPedClassOpen instanceof HTMLButtonElement) {
        event.preventDefault();
        const classId = String(adminPedClassOpen.getAttribute("data-admin-ped-class-open") || "").trim();
        const row = findAdminPedClassById(classId);
        if (row) openAdminPedClassModal({ mode: "edit", classRow: row });
        return;
      }

      const adminPedClassCopyLive = target.closest("[data-admin-ped-class-copy-live]");
      if (adminPedClassCopyLive instanceof HTMLButtonElement) {
        event.preventDefault();
        const url = String(adminPedClassCopyLive.getAttribute("data-admin-ped-class-copy-live") || "").trim();
        if (url) {
          navigator.clipboard?.writeText(url).catch(() => {});
          const prev = adminPedClassCopyLive.textContent;
          adminPedClassCopyLive.textContent = "Copiado";
          window.setTimeout(() => {
            adminPedClassCopyLive.textContent = prev || "Copiar link";
          }, 1400);
        }
        return;
      }

      const adminPedClassEdit = target.closest("[data-admin-ped-class-edit]");
      if (adminPedClassEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const classId = String(adminPedClassEdit.getAttribute("data-admin-ped-class-edit") || "").trim();
        const row = findAdminPedClassById(classId);
        if (row) openAdminPedClassModal({ mode: "edit", classRow: row });
        return;
      }

      const adminPedClassToggle = target.closest("[data-admin-ped-class-toggle]");
      if (adminPedClassToggle instanceof HTMLButtonElement) {
        event.preventDefault();
        const classId = String(adminPedClassToggle.getAttribute("data-admin-ped-class-toggle") || "").trim();
        toggleAdminPedClassStatus({ classId });
        return;
      }

      const adminPedClassDelete = target.closest("[data-admin-ped-class-delete]");
      if (adminPedClassDelete instanceof HTMLButtonElement) {
        event.preventDefault();
        const classId = String(adminPedClassDelete.getAttribute("data-admin-ped-class-delete") || "").trim();
        deleteAdminPedClass({ classId });
        return;
      }

      const adminStudentsFiltersTrigger = target.closest("[data-admin-students-filters-trigger]");
      if (adminStudentsFiltersTrigger instanceof HTMLButtonElement) {
        event.preventDefault();
        if (adminStudentsFiltersPopoverEl instanceof HTMLElement) {
          closeAdminStudentsFiltersPopover();
        } else {
          openAdminStudentsFiltersPopover({ triggerEl: adminStudentsFiltersTrigger });
        }
        return;
      }

      const adminStudentsFiltersClear = target.closest("[data-admin-students-filters-clear]");
      if (adminStudentsFiltersClear instanceof HTMLButtonElement) {
        event.preventDefault();
        adminStudentsState.filters = {
          status: "all",
          createdFrom: "",
          createdTo: "",
          canceledFrom: "",
          canceledTo: "",
          teacherId: "",
          plan: "",
          country: "",
        };
        closeAdminStudentsFiltersPopover();
        applyAdminStudentsFilters();
        return;
      }

      const adminStudentsFiltersApply = target.closest("[data-admin-students-filters-apply]");
      if (adminStudentsFiltersApply instanceof HTMLButtonElement) {
        event.preventDefault();
        const pop = adminStudentsFiltersPopoverEl;
        if (pop instanceof HTMLElement) {
          const next = { ...adminStudentsState.filters };
          pop.querySelectorAll("[data-admin-students-filter]").forEach((el) => {
            if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) return;
            const key = String(el.getAttribute("data-admin-students-filter") || "");
            if (!key) return;
            next[key] = String(el.value || "");
          });
          adminStudentsState.filters = next;
        }
        closeAdminStudentsFiltersPopover();
        applyAdminStudentsFilters();
        return;
      }

      const studentHistoryClose = target.closest("[data-admin-student-history-close]");
      if (studentHistoryClose instanceof HTMLElement) {
        event.preventDefault();
        closeAdminStudentHistoryDrawer();
        return;
      }

      const studentTab = target.closest("[data-admin-student-tab]");
      if (studentTab instanceof HTMLButtonElement) {
        event.preventDefault();
        const next = String(studentTab.getAttribute("data-admin-student-tab") || "").trim();
        if (next) {
          adminStudentsState.history.activeTab = next;
          syncAdminStudentSheetTabs();
          if (next === "arquivos") {
            ensureAdminStudentFilesLoaded({ force: false }).catch(() => {});
          }
          if (next === "financeiro") {
            ensureAdminStudentFinanceLoaded({ force: false }).catch(() => {});
          }
        }
        return;
      }

      const financeNew = target.closest("[data-finance-new]");
      if (financeNew instanceof HTMLButtonElement) {
        event.preventDefault();
        openFinanceChargeModal();
        return;
      }

      const financeEdit = target.closest("[data-finance-edit]");
      if (financeEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const id = String(financeEdit.getAttribute("data-finance-edit") || "").trim();
        const rows = Array.isArray(adminStudentsState.history?.financeRows) ? adminStudentsState.history.financeRows : [];
        const row = rows.find((item) => String(item?.id || "") === id) || null;
        openFinanceChargeModal({ row });
        return;
      }

      const financeConfirm = target.closest("[data-finance-confirm]");
      if (financeConfirm instanceof HTMLButtonElement) {
        event.preventDefault();
        const id = String(financeConfirm.getAttribute("data-finance-confirm") || "").trim();
        const rows = Array.isArray(adminStudentsState.history?.financeRows) ? adminStudentsState.history.financeRows : [];
        const row = rows.find((item) => String(item?.id || "") === id) || null;
        confirmManualFinancePayment({ row });
        return;
      }

      const financeChatView = target.closest("[data-finance-chat-view]");
      if (financeChatView instanceof HTMLButtonElement) {
        event.preventDefault();
        const conversationId = String(financeChatView.getAttribute("data-finance-chat-view") || "").trim();
        const source = String(financeChatView.getAttribute("data-finance-chat-source") || "").trim();
        const rowId = String(financeChatView.getAttribute("data-finance-chat-row") || "").trim();
        openFinanceChatwootModal({ conversationId, source, rowId });
        return;
      }

      const financeChatRefresh = target.closest("[data-finance-chat-refresh]");
      if (financeChatRefresh instanceof HTMLButtonElement) {
        event.preventDefault();
        loadFinanceChatMessages({ silent: false }).catch(() => {});
        return;
      }

      const financeChatSend = target.closest("[data-finance-chat-send]");
      if (financeChatSend instanceof HTMLButtonElement) {
        event.preventDefault();
        sendFinanceChatMessage({ privateNote: false }).catch(() => {});
        return;
      }

      const financeChatNote = target.closest("[data-finance-chat-note]");
      if (financeChatNote instanceof HTMLButtonElement) {
        event.preventDefault();
        sendFinanceChatMessage({ privateNote: true }).catch(() => {});
        return;
      }

      const financeRefresh = target.closest("[data-finance-refresh]");
      if (financeRefresh instanceof HTMLButtonElement) {
        event.preventDefault();
        ensureFinanceLoaded({ force: true }).catch(() => {});
        return;
      }

      const financeTab = target.closest("[data-finance-tab]");
      if (financeTab instanceof HTMLButtonElement) {
        event.preventDefault();
        const tab = String(financeTab.getAttribute("data-finance-tab") || "").trim();
        if (["overview", "alunos", "cobrancas", "pagamentos", "eventos", "chatwoot"].includes(tab)) {
          financeState.activeTab = tab;
          renderFinancePanel();
          syncFinanceSidebar("financeiro");
        }
        return;
      }

      const financeNewStudent = target.closest("[data-finance-new-student]");
      if (financeNewStudent instanceof HTMLButtonElement) {
        event.preventDefault();
        openFinanceStudentModal();
        return;
      }

      const financeNewGlobal = target.closest("[data-finance-new-global]");
      if (financeNewGlobal instanceof HTMLButtonElement) {
        event.preventDefault();
        openFinanceChargeModal({ global: true });
        return;
      }

      const financeGlobalEdit = target.closest("[data-finance-global-edit]");
      if (financeGlobalEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const id = String(financeGlobalEdit.getAttribute("data-finance-global-edit") || "").trim();
        const row = financeState.cobrancas.find((item) => String(item?.id || "") === id) || null;
        openFinanceChargeModal({ row, global: true });
        return;
      }

      const financeGlobalConfirm = target.closest("[data-finance-global-confirm]");
      if (financeGlobalConfirm instanceof HTMLButtonElement) {
        event.preventDefault();
        const id = String(financeGlobalConfirm.getAttribute("data-finance-global-confirm") || "").trim();
        const row = financeState.cobrancas.find((item) => String(item?.id || "") === id) || null;
        if (!row) return;
        const ok = window.confirm("Marcar esta cobrança como paga manualmente?");
        if (!ok) return;
        confirmManualFinancePayment({ row, global: true });
        return;
      }

      const financeCopyLink = target.closest("[data-finance-copy-link]");
      if (financeCopyLink instanceof HTMLButtonElement) {
        event.preventDefault();
        const link = String(financeCopyLink.getAttribute("data-finance-copy-link") || "").trim();
        if (!link) return;
        navigator.clipboard?.writeText(link).catch(() => {});
        setFinanceStatus("Link de pagamento copiado.", "success");
        window.setTimeout(() => setFinanceStatus(""), 1200);
        return;
      }

      const financeLinkChat = target.closest("[data-finance-link-chat]");
      if (financeLinkChat instanceof HTMLButtonElement) {
        event.preventDefault();
        const source = String(financeLinkChat.getAttribute("data-finance-link-chat") || "").trim();
        const rowId = String(financeLinkChat.getAttribute("data-finance-link-row") || "").trim();
        const row =
          source === "aluno"
            ? financeState.alunos.find((item) => String(item?.id || "") === rowId)
            : financeState.cobrancas.find((item) => String(item?.id || "") === rowId);
        if (!row) return;
        const raw = window.prompt("Informe o ID da conversa do Chatwoot:");
        const conversationId = normalizeFinanceConversationId(raw);
        if (!conversationId) return;
        (async () => {
          try {
            const res = await fetchWithAuth("/api/financeiro-dashboard", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "link_conversation",
                id_conversa_chatwoot: conversationId,
                aluno_id: source === "aluno" ? row.id : "",
                cobranca_id: source === "cobranca" ? row.id : "",
                aluno_nome: row.aluno_nome || "",
                email: row.email || "",
              }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "link_failed");
            await ensureFinanceLoaded({ force: true });
            setFinanceStatus("Conversa vinculada com sucesso.", "success");
            window.setTimeout(() => setFinanceStatus(""), 1200);
          } catch (error) {
            console.error("[finance] link chatwoot failed:", error);
            setFinanceStatus("Não foi possível vincular a conversa.", "error");
          }
        })();
        return;
      }

      const historyFilterBtn = target.closest("[data-admin-student-history-filter]");
      if (historyFilterBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const next = String(historyFilterBtn.getAttribute("data-admin-student-history-filter") || "all").trim();
        adminStudentsState.history.filter = next || "all";
        document.querySelectorAll("[data-admin-student-history-filter]").forEach((btn) => {
          if (!(btn instanceof HTMLButtonElement)) return;
          const isActive = String(btn.getAttribute("data-admin-student-history-filter") || "") === adminStudentsState.history.filter;
          btn.classList.toggle("is-active", isActive);
          btn.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        renderAdminStudentHistoryTab();
        return;
      }

      const studentEditCancel = target.closest("[data-admin-student-edit-cancel]");
      if (studentEditCancel instanceof HTMLButtonElement) {
        event.preventDefault();
        adminStudentsState.history.editMode = false;
        renderAdminStudentSheet();
        syncAdminStudentSheetTabs();
        return;
      }

      const studentEditSave = target.closest("[data-admin-student-edit-save]");
      if (studentEditSave instanceof HTMLButtonElement) {
        event.preventDefault();

        const hist = adminStudentsState.history;
        const alunoId = String(hist?.alunoId || "").trim();
        const sheetEl = document.querySelector("[data-admin-student-sheet]");
        const formEl = sheetEl instanceof HTMLElement ? sheetEl.querySelector("[data-admin-student-edit-form]") : null;
        const errorEl = sheetEl instanceof HTMLElement ? sheetEl.querySelector("[data-admin-student-edit-error]") : null;

        const setErr = (msg) => {
          if (errorEl instanceof HTMLElement) {
            errorEl.textContent = String(msg || "");
            errorEl.hidden = !msg;
          }
        };

        const getField = (key) => {
          if (!(formEl instanceof HTMLElement)) return null;
          return formEl.querySelector(`[data-admin-student-edit-field="${CSS.escape(String(key))}"]`);
        };

        const readText = (key) => {
          const el = getField(key);
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return String(el.value || "").trim();
          if (el instanceof HTMLSelectElement) return String(el.value || "").trim();
          return "";
        };

        const markError = (key, isError) => {
          const el = getField(key);
          if (el instanceof HTMLElement) el.classList.toggle("is-error", Boolean(isError));
        };

        const nome = readText("nome");
        const email = readText("email").toLowerCase();
        const endereco = readText("endereco");
        const plano = readText("plano");
        const pais = readText("pais");
	        const estadoEua = readText("estadoEua");
	        const valorMensalidadeRaw = readText("valorMensalidade");
	        const valorMensalidade = parseMoneyPtBrLoose(valorMensalidadeRaw);
	        const tempoContratoSel = readText("tempoContrato");
	        const tempoContratoCustomRaw = readText("tempoContratoCustom");
	        const tempoContratoCustom = Number.parseInt(String(tempoContratoCustomRaw || ""), 10);
	        const tempoContrato =
	          tempoContratoSel === "12"
	            ? 12
	            : tempoContratoSel === "6"
	              ? 6
	              : tempoContratoSel === "custom" && Number.isFinite(tempoContratoCustom) && tempoContratoCustom > 0
	                ? tempoContratoCustom
	                : 0;
	        const faixaIdade = readText("faixaIdade");
	        const genero = readText("genero");
        const trabalho = readText("trabalho");
        const possuiFilhos = readText("possuiFilhos");
        const casado = readText("casado");
        const pretendeVoltarBrasil = readText("pretendeVoltarBrasil");
        const objetivoPrincipal = readText("objetivoPrincipal");
        const nivelInglesAtual = readText("nivelInglesAtual");

        // Clear previous errors.
        setErr("");
	        [
	          "nome",
	          "email",
	          "endereco",
	          "plano",
	          "pais",
	          "valorMensalidade",
	          "tempoContrato",
	          "tempoContratoCustom",
	          "faixaIdade",
	          "genero",
	          "trabalho",
          "possuiFilhos",
          "casado",
          "pretendeVoltarBrasil",
          "objetivoPrincipal",
          "nivelInglesAtual",
        ].forEach((k) => markError(k, false));

        const emailOk = isValidEmail(email);
        const monthlyOk = Number.isFinite(valorMensalidade) && valorMensalidade > 0;

	        const contractOk = tempoContrato > 0;
	        const required = [
	          ["nome", Boolean(nome)],
	          ["email", emailOk],
	          ["endereco", Boolean(endereco)],
	          ["pais", Boolean(pais)],
	          ["valorMensalidade", monthlyOk],
	          ["tempoContrato", contractOk],
	          ["faixaIdade", Boolean(faixaIdade)],
	          ["genero", Boolean(genero)],
          ["trabalho", Boolean(trabalho)],
          ["possuiFilhos", Boolean(possuiFilhos)],
          ["casado", Boolean(casado)],
          ["pretendeVoltarBrasil", Boolean(pretendeVoltarBrasil)],
          ["objetivoPrincipal", Boolean(objetivoPrincipal)],
          ["nivelInglesAtual", Boolean(nivelInglesAtual)],
        ];

	        const missing = required.filter(([, ok]) => !ok).map(([k]) => k);
	        if (!alunoId) {
	          setErr("Não foi possível identificar o aluno para salvar.");
	          return;
	        }
	        if (missing.length) {
	          missing.forEach((k) => markError(k, true));
	          if (tempoContratoSel === "custom" && !contractOk) {
	            markError("tempoContratoCustom", true);
	          }
	          setErr("Preencha os campos obrigatórios para salvar.");
	          return;
	        }

        // Async save (merge) to avoid losing unknown fields.
        studentEditSave.disabled = true;
        const cancelBtn = sheetEl instanceof HTMLElement ? sheetEl.querySelector("[data-admin-student-edit-cancel]") : null;
        if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = true;
        const prevLabel = studentEditSave.textContent;
        studentEditSave.textContent = "Salvando…";

        (async () => {
          try {
            const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_student_edit_save");
            const patch = {
              nome,
              email,
              endereco,
              plano,
              pais,
              estadoEua,
              valorMensalidade,
              tempoContrato,
              faixaIdade,
              genero,
              trabalho,
              possuiFilhos,
              casado,
              pretendeVoltarBrasil,
              objetivoPrincipal,
              nivelInglesAtual,
              atualizadoEm: firebase.serverTimestamp(),
            };

            await withTimeout(firebase.setDoc(firebase.doc(firebase.primaryDb, "users", alunoId), patch, { merge: true }), 12_000, "firestore_student_edit_merge");

            adminStudentsState.loadedAt = 0;
            await ensureAdminStudentsBaseData({ force: true });

            const refreshedMeta = getAdminStudentMetaById(alunoId);
            if (refreshedMeta) {
              adminStudentsState.history.alunoMeta = refreshedMeta;
            }
            adminStudentsState.history.editMode = false;
            renderAdminStudentSheet();
            syncAdminStudentSheetTabs();
            setAdminStudentsStatus("");
          } catch (error) {
            console.error("[admin] student edit save failed:", error);
            setErr("Não foi possível salvar agora.");
            setAdminStudentsStatus("Não foi possível salvar agora.", "error");
          } finally {
            studentEditSave.disabled = false;
            studentEditSave.textContent = prevLabel || "Salvar";
            if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = false;
          }
        })();

        return;
      }

      const studentActionsTrigger = target.closest("[data-admin-student-actions-trigger]");
      if (studentActionsTrigger instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(studentActionsTrigger.getAttribute("data-admin-student-actions-trigger") || "").trim();
        openAdminStudentActionsPopover({ triggerEl: studentActionsTrigger, alunoId });
        return;
      }

      const studentAction = target.closest("[data-admin-student-action]");
      if (studentAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const action = String(studentAction.getAttribute("data-admin-student-action") || "").trim();
        const alunoId = String(studentAction.getAttribute("data-admin-student-aluno") || "").trim();
        closeAdminStudentActionsPopover();

        if (!alunoId) return;

        if (action === "edit") {
          const isSame = Boolean(adminStudentsState.history?.isOpen) && String(adminStudentsState.history?.alunoId || "") === alunoId;
          const activate = () => {
            adminStudentsState.history.editMode = true;
            adminStudentsState.history.activeTab = "overview";
            renderAdminStudentSheet();
            syncAdminStudentSheetTabs();
          };
          if (isSame) {
            activate();
          } else {
            openAdminStudentHistoryDrawer({ alunoId })
              .then(() => activate())
              .catch(() => {});
          }
          return;
        }

        if (action === "deactivate") {
          openAdminStudentDeactivateModal({ alunoId });
          return;
        }

        if (action === "delete") {
          openAdminStudentDeleteModal({ alunoId });
          return;
        }

        return;
      }

      const studentOpen = target.closest("[data-admin-student-open]");
      if (studentOpen instanceof HTMLElement) {
        const alunoId = String(studentOpen.getAttribute("data-admin-student-open") || "").trim();
        if (alunoId) {
          event.preventDefault();
          openAdminStudentHistoryDrawer({ alunoId });
          return;
        }
      }

      const fileDeleteBtn = target.closest("[data-admin-student-file-delete]");
      if (fileDeleteBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(fileDeleteBtn.getAttribute("data-admin-student-file-aluno") || "").trim();
        const fileId = String(fileDeleteBtn.getAttribute("data-admin-student-file-delete") || "").trim();
        if (alunoId && fileId) {
          deleteAdminStudentFile({ alunoId, fileId }).catch(() => {});
        }
        return;
      }

      const goalOpen = target.closest("[data-admin-growth-goal-open]");
      if (goalOpen instanceof HTMLButtonElement) {
        event.preventDefault();
        openAdminGrowthGoalModal();
        return;
      }

      const goalEdit = target.closest("[data-admin-goal-edit]");
      if (goalEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const competencia = String(goalEdit.getAttribute("data-admin-goal-edit") || "").trim();
        openAdminGrowthGoalModal(competencia);
        return;
      }

      const agendaToggle = target.closest("[data-admin-agenda-toggle]");
      if (agendaToggle instanceof HTMLButtonElement) {
        event.preventDefault();
        const id = String(agendaToggle.getAttribute("data-admin-agenda-toggle") || "").trim();
        toggleAdminTeacherAgenda(id);
        return;
      }

      const teacherFilterBtn = target.closest("[data-admin-teacher-filter]");
      if (teacherFilterBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const next = String(teacherFilterBtn.getAttribute("data-admin-teacher-filter") || "").trim().toLowerCase();
        closeAllAdminActionMenus();
        setTeacherStatusFilter(next);
        return;
      }

      const trigger = target.closest("[data-admin-actions-trigger]");
      if (trigger instanceof HTMLButtonElement) {
        event.preventDefault();
        const row = trigger.closest("[data-admin-user-row]");
        if (!(row instanceof HTMLElement)) return;
        const uid = row.getAttribute("data-admin-user-row") || "";
        const name = row.getAttribute("data-admin-user-name") || "Usuário";
        const email = row.getAttribute("data-admin-user-email") || "";
        const isActive = row.getAttribute("data-admin-user-active") === "1";
        closeAllAdminActionMenus();
        openAdminActionsPopover({ triggerEl: trigger, uid, name, email, isActive });
        return;
      }

      const toggleAction = target.closest("[data-admin-action-toggle]");
      if (toggleAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const row = toggleAction.closest("[data-admin-user-row]");
        const uid = row instanceof HTMLElement ? row.getAttribute("data-admin-user-row") || "" : toggleAction.getAttribute("data-admin-action-uid") || "";
        const name = row instanceof HTMLElement ? row.getAttribute("data-admin-user-name") || "Usuário" : toggleAction.getAttribute("data-admin-action-name") || "Usuário";
        const email = row instanceof HTMLElement ? row.getAttribute("data-admin-user-email") || "" : toggleAction.getAttribute("data-admin-action-email") || "";
        const isActive =
          row instanceof HTMLElement
            ? row.getAttribute("data-admin-user-active") === "1"
            : toggleAction.getAttribute("data-admin-action-active") === "1";
        const activePanel = String(body.dataset.activePanel || "");
        const type = activePanel === "professores" ? "teacher" : activePanel === "growth" ? "growth" : "student";

        closeAllAdminActionMenus();
        closeAdminActionsPopover();

        const applyToggle = async (nextActive) => {
          setAdminManageStatus(type, nextActive ? "Ativando…" : "Desativando…");
          try {
            const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
	            await withTimeout(
	              firebase.setDoc(firebase.doc(firebase.primaryDb, "users", uid), { ativo: nextActive }, { merge: true }),
	              12_000,
	              "firestore_toggle_active"
	            );

	            // Keep the scheduling store in sync so admin ranking/slot assignment respects active teachers.
		            await withTimeout(
		              fetchWithAuth("/api/admin-users", {
		                method: "POST",
		                headers: { "Content-Type": "application/json" },
		                body: JSON.stringify({ uid, role: type, name, active: nextActive }),
		              }).catch((error) => {
		                console.warn("[admin] toggle active sync failed:", error);
		              }),
		              8000,
		              "admin_users_toggle_sync"
		            );

		            const list = adminUsersState[type].rows;
	            const idx = list.findIndex((u) => u.id === uid);
	            if (idx >= 0) {
              list[idx] = { ...list[idx], ativo: nextActive };
              adminUsersState[type].rows = [...list].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
            }
            setAdminManageStatus(type, nextActive ? "Usuário ativado." : "Usuário desativado.", "success");
            window.setTimeout(() => setAdminManageStatus(type, ""), 1200);
            renderAdminUsersTable(type);
          } catch (error) {
            console.error("[admin] toggle active failed:", error);
            setAdminManageStatus(type, "Não foi possível atualizar o status.", "error");
          }
        };

        if (isActive) {
          openModal({
            title: "Desativar usuário",
            bodyHtml: `Tem certeza que deseja desativar ${escapeHtml(name)}? O usuário não conseguirá mais acessar a plataforma.`,
            primaryLabel: "Desativar",
            secondaryLabel: "Cancelar",
            hideSecondary: false,
            showTrash: false,
            onPrimary: () => {
              if (modalPrimary) modalPrimary.disabled = true;
              if (modalSecondary) modalSecondary.disabled = true;
              applyToggle(false).finally(() => closeModal());
              return false;
            },
          });
          return;
        }

        applyToggle(true);
        return;
      }

      const resetAction = target.closest("[data-admin-action-reset]");
      if (resetAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const row = resetAction.closest("[data-admin-user-row]");
        const email = row instanceof HTMLElement ? row.getAttribute("data-admin-user-email") || "" : resetAction.getAttribute("data-admin-action-email") || "";
        const activePanel = String(body.dataset.activePanel || "");
        const type = activePanel === "professores" ? "teacher" : activePanel === "growth" ? "growth" : "student";

        closeAllAdminActionMenus();
        closeAdminActionsPopover();

        openModal({
          title: "Redefinir senha",
          bodyHtml: `Enviar link de redefinição de senha para ${escapeHtml(email)}?`,
          primaryLabel: "Enviar link",
          secondaryLabel: "Cancelar",
          hideSecondary: false,
          showTrash: false,
          onPrimary: () => {
            (async () => {
              if (modalPrimary) modalPrimary.disabled = true;
                if (modalSecondary) modalSecondary.disabled = true;
                setAdminManageStatus(type, "Enviando link…");
                try {
                  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
                  await withTimeout(firebase.sendPasswordResetEmail(firebase.primaryAuth, email), 12_000, "auth_reset_email");
                  setAdminManageStatus(type, "Link enviado com sucesso.", "success");
                  window.setTimeout(() => setAdminManageStatus(type, ""), 1200);
                  closeModal();
                } catch (error) {
                  console.error("[admin] sendPasswordResetEmail failed:", error);
                  setAdminManageStatus(type, "Não foi possível enviar o link.", "error");
                  if (modalPrimary) modalPrimary.disabled = false;
                  if (modalSecondary) modalSecondary.disabled = false;
                }
            })();
            return false;
          },
        });
        return;
      }

      // Click outside closes any open action menu.
      if (!target.closest("[data-admin-actions]") && !target.closest("[data-admin-actions-popover]")) {
        closeAllAdminActionMenus();
        closeAdminActionsPopover();
      }
    }

    if (
      activeModalKind === "event-form" &&
      createEventDraft &&
      !createEventDraft.readOnly &&
      modalOverlay &&
      !modalOverlay.hidden
    ) {
      const pick = target.closest("[data-ce-guest-pick]");
      if (pick instanceof HTMLButtonElement) {
        const id = pick.getAttribute("data-ce-guest-pick") || "";
        const staff = getStaffUsers();
        const user = staff.find((u) => u.id === id);
        if (!user) return;
        createEventDraft.guests.push({ id: user.id, name: user.name, role: user.role });
        createEventDraft.guestQuery = "";
        const chipbox = modalBody?.querySelector("[data-ce-chipbox]");
        if (chipbox instanceof HTMLElement) {
          // Re-render minimal chipbox content.
          chipbox.innerHTML =
            (createEventDraft.guests || [])
              .map((guest) => `<span class="guest-chip">${escapeHtml(guest.name)}<button type="button" data-ce-remove-guest="${escapeHtml(guest.id)}" aria-label="Remover convidado">×</button></span>`)
              .join("") +
            `<input class="guest-search" type="text" data-ce-guest-search placeholder="Buscar pessoas..." value="" />`;
        }
        syncGuestDropdown();
        validateCreateEventDraft();
        const input = modalBody?.querySelector("[data-ce-guest-search]");
        if (input instanceof HTMLInputElement) input.focus();
        return;
      }

      const removeGuest = target.closest("[data-ce-remove-guest]");
      if (removeGuest instanceof HTMLButtonElement) {
        const id = removeGuest.getAttribute("data-ce-remove-guest") || "";
        createEventDraft.guests = (createEventDraft.guests || []).filter((g) => g.id !== id);
        const chipbox = modalBody?.querySelector("[data-ce-chipbox]");
        if (chipbox instanceof HTMLElement) {
          chipbox.innerHTML =
            (createEventDraft.guests || [])
              .map((guest) => `<span class="guest-chip">${escapeHtml(guest.name)}<button type="button" data-ce-remove-guest="${escapeHtml(guest.id)}" aria-label="Remover convidado">×</button></span>`)
              .join("") +
            `<input class="guest-search" type="text" data-ce-guest-search placeholder="Buscar pessoas..." value="${escapeHtml(createEventDraft.guestQuery || "")}" />`;
        }
        syncGuestDropdown();
        validateCreateEventDraft();
        return;
      }

      const uploadZone = target.closest("[data-ce-upload]");
      if (uploadZone instanceof HTMLElement) {
        const input = modalBody?.querySelector("[data-ce-doc-input]");
        if (input instanceof HTMLInputElement) {
          input.click();
        }
        return;
      }

      const removeDoc = target.closest("[data-ce-remove-doc]");
      if (removeDoc instanceof HTMLButtonElement) {
        const id = removeDoc.getAttribute("data-ce-remove-doc") || "";
        createEventDraft.documents = (createEventDraft.documents || []).filter((doc) => doc.id !== id);
        const list = modalBody?.querySelector("[data-ce-doc-list]");
        if (list instanceof HTMLElement) {
          list.innerHTML = (createEventDraft.documents || [])
            .map((doc) => {
              return `
                <div class="upload-file">
                  <span class="upload-file-icon" aria-hidden="true">${getFileTypeIconSvg(doc.ext)}</span>
                  <div>
                    <strong>${escapeHtml(doc.name)}</strong>
                    <span>${escapeHtml(`${formatBytes(doc.size)} · ${doc.ext.toUpperCase()}`)}</span>
                  </div>
                  <button class="upload-file-remove" type="button" data-ce-remove-doc="${escapeHtml(doc.id)}" aria-label="Remover documento">×</button>
                </div>
              `;
            })
            .join("");
        }
        validateCreateEventDraft();
        return;
      }

      // Click outside guest field closes dropdown.
      const guestField = modalBody?.querySelector(".guest-field");
      const dropdown = modalBody?.querySelector("[data-ce-guest-dropdown]");
      if (dropdown instanceof HTMLElement && guestField instanceof HTMLElement) {
        if (!target.closest(".guest-field")) {
          dropdown.hidden = true;
          dropdown.innerHTML = "";
        }
      }
    }

    const calEvent = target.closest("[data-teacher-cal-event-id]");
    if (
      calEvent instanceof HTMLElement &&
      (currentRole === "teacher" || currentRole === "admin") &&
      body.dataset.activePanel === "ao-vivo"
    ) {
      const type = calEvent.getAttribute("data-teacher-cal-event-type") || "";
      const id = calEvent.getAttribute("data-teacher-cal-event-id") || "";
      const liveUrl = String(calEvent.getAttribute("data-teacher-cal-live-url") || "").trim();
      if (type === "lesson" && liveUrl) {
        window.location.href = liveUrl;
        return;
      }
      if (type === "lesson" || type === "manual") {
        openTeacherEventModal({ type, id });
        return;
      }
    }

    const createEventButton = target.closest("[data-teacher-create-event]");
    if (createEventButton instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      openTeacherCreateEventModal();
      return;
    }

    const workHoursButton = target.closest("[data-teacher-work-hours]");
    if (workHoursButton instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      openWorkHoursModal();
      return;
    }

    const miniPrev = target.closest("[data-teacher-mini-prev]");
    if (miniPrev instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      teacherCalendarState.miniCursor = new Date(teacherCalendarState.miniCursor.getFullYear(), teacherCalendarState.miniCursor.getMonth() - 1, 1);
      renderTeacherMiniCalendar();
      return;
    }

    const miniNext = target.closest("[data-teacher-mini-next]");
    if (miniNext instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      teacherCalendarState.miniCursor = new Date(teacherCalendarState.miniCursor.getFullYear(), teacherCalendarState.miniCursor.getMonth() + 1, 1);
      renderTeacherMiniCalendar();
      return;
    }

    const miniDay = target.closest("[data-teacher-mini-day]");
    if (miniDay instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      const key = miniDay.getAttribute("data-teacher-mini-day") || "";
      const date = parseDateKey(key);
      if (!date) return;
      setTeacherFocusDate(date);
      renderTeacherCalendar();
      return;
    }

    const calToday = target.closest("[data-teacher-cal-today]");
    if (calToday instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      setTeacherFocusDate(new Date());
      renderTeacherCalendar();
      return;
    }

    const calPrev = target.closest("[data-teacher-cal-prev]");
    if (calPrev instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      const view = teacherCalendarState.view;
      const delta = view === "month" ? -1 : view === "week" ? -7 : -1;
      const next = view === "month"
        ? addMonths(teacherCalendarState.focusDate, -1)
        : addDays(teacherCalendarState.focusDate, delta);
      setTeacherFocusDate(next);
      renderTeacherCalendar();
      return;
    }

    const calNext = target.closest("[data-teacher-cal-next]");
    if (calNext instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      const view = teacherCalendarState.view;
      const delta = view === "month" ? 1 : view === "week" ? 7 : 1;
      const next = view === "month"
        ? addMonths(teacherCalendarState.focusDate, 1)
        : addDays(teacherCalendarState.focusDate, delta);
      setTeacherFocusDate(next);
      renderTeacherCalendar();
      return;
    }

    const viewBtn = target.closest("[data-teacher-cal-view]");
    if (viewBtn instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      const nextView = viewBtn.getAttribute("data-teacher-cal-view") || "day";
      if (nextView !== "day" && nextView !== "week" && nextView !== "month") return;
      teacherCalendarState.view = nextView;
      renderTeacherCalendar();
      return;
    }

    const monthMore = target.closest("[data-teacher-month-more]");
    if (monthMore instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      const key = monthMore.getAttribute("data-teacher-month-more") || "";
      const date = parseDateKey(key);
      if (!date) return;
      const start = startOfDay(date);
      const end = addDays(start, 1);
      const events = getTeacherEventsForRange(start, end);
      const bodyHtml = events.length
        ? `<div class="modal-list">${events
            .map((event) => {
              const tag = event.type === "manual" ? "Evento" : "Aula";
              const when = `${formatTimeHm(event.start)} – ${formatTimeHm(event.end)}`;
              return `<div class="modal-list-row"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(`${tag} · ${when}`)}</span></div>`;
            })
            .join("")}</div>`
        : "Sem eventos neste dia.";
      openModal({
        title: `Eventos em ${formatShortDate(date)}`,
        bodyHtml,
        primaryLabel: "Fechar",
        hideSecondary: true,
      });
      return;
    }

    const monthCell = target.closest("[data-teacher-cal-month-day]");
    if (monthCell instanceof HTMLElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      if (body.dataset.activePanel !== "ao-vivo") return;
      if (teacherCalendarState.view !== "month") return;
      const key = monthCell.getAttribute("data-teacher-cal-month-day") || "";
      // Month view does not have a time grid; open the same create modal with a clean default.
      openTeacherCreateEventModalAt({ dateKey: key, startTime: "09:00", endTime: "09:30" });
      return;
    }

    const whAdd = target.closest("[data-wh-add]");
    if (whAdd instanceof HTMLButtonElement) {
      const key = whAdd.getAttribute("data-wh-add") || "";
      const parsed = parseWorkKey(key);
      if (!parsed || !workHoursDraft) return;
      const entry = workHoursDraft[parsed.dayKey];
      if (!entry) return;
      const insertAt = Math.max(0, Math.min(parsed.index + 1, entry.windows.length));
      entry.windows.splice(insertAt, 0, { start: "", end: "" });
      const dayGroup = modalBody?.querySelector(`[data-wh-daygroup="${CSS.escape(parsed.dayKey)}"]`);
      if (dayGroup) {
        dayGroup.innerHTML = entry.windows.map((_, idx) => renderWorkHoursRow({ dayKey: parsed.dayKey, index: idx })).join("");
      }
      validateWorkHoursDraft();
      const focusEl = modalBody?.querySelector(`[data-wh-start="${CSS.escape(`${parsed.dayKey}:${insertAt}`)}"]`);
      if (focusEl instanceof HTMLElement) focusEl.focus();
      return;
    }

    const whRemove = target.closest("[data-wh-remove]");
    if (whRemove instanceof HTMLButtonElement) {
      const key = whRemove.getAttribute("data-wh-remove") || "";
      const parsed = parseWorkKey(key);
      if (!parsed || !workHoursDraft) return;
      const entry = workHoursDraft[parsed.dayKey];
      if (!entry) return;
      if (parsed.index <= 0) return;
      entry.windows.splice(parsed.index, 1);
      if (!entry.windows.length) entry.windows = [{ start: "", end: "" }];
      const dayGroup = modalBody?.querySelector(`[data-wh-daygroup="${CSS.escape(parsed.dayKey)}"]`);
      if (dayGroup) {
        dayGroup.innerHTML = entry.windows.map((_, idx) => renderWorkHoursRow({ dayKey: parsed.dayKey, index: idx })).join("");
      }
      validateWorkHoursDraft();
      return;
    }

    const noticeToggle = target.closest("[data-teacher-notice-toggle]");
    if (noticeToggle instanceof HTMLButtonElement) {
      const noticeItem = noticeToggle.closest("[data-teacher-notice-id]");
      const noticeId = noticeItem?.getAttribute("data-teacher-notice-id") || "";
      const thread = noticeItem?.querySelector("[data-teacher-notice-thread]");
      if (!noticeId || !(thread instanceof HTMLElement)) return;

      const willOpen = thread.hidden;
      thread.hidden = !willOpen;

      if (willOpen) {
        const readMap = loadTeacherNoticeReadMap();
        if (!readMap[noticeId]) {
          readMap[noticeId] = true;
          persistTeacherNoticeReadMap(readMap);
        }
        noticeItem?.classList.remove("is-unread");
      }

      return;
    }

    const studentRescheduleButton = target.closest("[data-live-reschedule]");
    if (studentRescheduleButton instanceof HTMLButtonElement) {
      if (currentRole !== "student") return;
      const lessonId = studentRescheduleButton.getAttribute("data-live-reschedule") || "";
      const lessons = Array.isArray(studentLessonsState.lessons) ? studentLessonsState.lessons : [];
      const lesson = lessons.find((l) => l && l.id === lessonId) || null;
      if (!lesson) return;
      openStudentRescheduleModal(lesson);
      return;
    }

    const teacherChangeBtn = target.closest("[data-student-v5-teacher-change]");
    if (teacherChangeBtn instanceof HTMLButtonElement) {
      if (currentRole !== "student") return;
      const alunoId = sessionUser && sessionUser.role === "student" ? sessionUser.id : "";
      const professorId = studentV5DashboardState.teacherId || "";
      const professorNome = studentV5DashboardState.teacherData?.nome || "";
      if (!alunoId || !professorId) {
        openModal({
          title: "Solicitar troca de professor",
          bodyHtml: "Nenhuma professora vinculada no momento.",
          primaryLabel: "Fechar",
          hideSecondary: true,
        });
        return;
      }
      openStudentTeacherChangeModal({ alunoId, professorId, professorNome });
      return;
    }

    const npsScoreBtn = target.closest("[data-student-v5-nps-score]");
    if (npsScoreBtn instanceof HTMLButtonElement) {
      if (currentRole !== "student") return;
      const score = Number(npsScoreBtn.getAttribute("data-student-v5-nps-score"));
      if (!Number.isFinite(score) || score < 0 || score > 10) return;
      studentV5NpsDraft.score = score;
      if (studentV5NpsFeedback instanceof HTMLElement) {
        studentV5NpsFeedback.hidden = true;
        studentV5NpsFeedback.textContent = "";
        studentV5NpsFeedback.classList.remove("is-error");
      }
      syncStudentV5NpsScaleUI();
      return;
    }

    const npsSubmitBtn = target.closest("[data-student-v5-nps-submit]");
    if (npsSubmitBtn instanceof HTMLButtonElement) {
      if (currentRole !== "student") return;
      if (npsSubmitBtn.disabled) return;
      const alunoId = sessionUser && sessionUser.role === "student" ? sessionUser.id : "";
      const score = studentV5NpsDraft.score;
      if (!alunoId || !Number.isFinite(score)) return;
      if (studentV5NpsDraft.isSubmitting) return;

      const comment = studentV5NpsComment instanceof HTMLTextAreaElement ? studentV5NpsComment.value.trim() : "";
      studentV5NpsDraft.isSubmitting = true;
      syncStudentV5NpsScaleUI();

      const prevLabel = npsSubmitBtn.textContent || "Enviar avaliação";
      npsSubmitBtn.textContent = "Enviando…";

      if (studentV5NpsFeedback instanceof HTMLElement) {
        studentV5NpsFeedback.hidden = true;
        studentV5NpsFeedback.textContent = "";
        studentV5NpsFeedback.classList.remove("is-error");
      }

      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
          const docRef = firebase.doc(firebase.collection(firebase.primaryDb, "nps"));
          await withTimeout(
            firebase.setDoc(docRef, { alunoId, nota: Math.round(score), comentario: comment, criadoEm: firebase.serverTimestamp() }),
            12_000,
            "student_nps_save"
          );

          const createdAtMs = Date.now();
          studentV5DashboardState.lastNps = { nota: Math.round(score), createdAtMs };
          studentV5DashboardState.npsCooldownUntilMs = createdAtMs + 90 * 24 * 60 * 60 * 1000;

          studentV5NpsDraft.score = null;
          if (studentV5NpsComment instanceof HTMLTextAreaElement) studentV5NpsComment.value = "";

          renderStudentDashboard();
        } catch (error) {
          console.error("[student] NPS save failed:", error);
          if (studentV5NpsFeedback instanceof HTMLElement) {
            studentV5NpsFeedback.hidden = false;
            studentV5NpsFeedback.textContent = "Não foi possível enviar agora. Tente novamente.";
            studentV5NpsFeedback.classList.add("is-error");
          }
        } finally {
          studentV5NpsDraft.isSubmitting = false;
          npsSubmitBtn.textContent = prevLabel;
          syncStudentV5NpsScaleUI();
        }
      })();

      return;
    }

    const approveReq = target.closest("[data-admin-reschedule-approve]");
    if (approveReq instanceof HTMLButtonElement) {
      if (currentRole !== "admin") return;
      const id = approveReq.getAttribute("data-admin-reschedule-approve") || "";
      if (!id) return;

      const row = approveReq.closest(".admin-requests-item");
      const rejectBtn = row?.querySelector("[data-admin-reschedule-reject]");
      const previousLabel = approveReq.textContent || "Aprovar";
      approveReq.disabled = true;
      approveReq.textContent = "Aprovando…";
      if (rejectBtn instanceof HTMLButtonElement) rejectBtn.disabled = true;

      fetchWithAuth("/api/schedule-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao: "aprovar" }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const msg =
              data?.error === "already_resolved"
                ? "Essa solicitação já foi resolvida."
                : "Não foi possível aprovar agora. Tente novamente.";
            openModal({ title: "Não foi possível aprovar", bodyHtml: escapeHtml(msg), primaryLabel: "Fechar", hideSecondary: true });
            return;
          }
          refreshAdminRescheduleRequests({ force: true });
          refreshTeacherEvents({ force: true });
        })
        .catch(() => {
          openModal({
            title: "Não foi possível aprovar",
            bodyHtml: "Não foi possível aprovar agora. Tente novamente.",
            primaryLabel: "Fechar",
            hideSecondary: true,
          });
        })
        .finally(() => {
          approveReq.disabled = false;
          approveReq.textContent = previousLabel;
          if (rejectBtn instanceof HTMLButtonElement) rejectBtn.disabled = false;
        });

      return;
    }

    const rejectReq = target.closest("[data-admin-reschedule-reject]");
    if (rejectReq instanceof HTMLButtonElement) {
      if (currentRole !== "admin") return;
      const id = rejectReq.getAttribute("data-admin-reschedule-reject") || "";
      if (!id) return;

      const row = rejectReq.closest(".admin-requests-item");
      const approveBtn = row?.querySelector("[data-admin-reschedule-approve]");
      const previousLabel = rejectReq.textContent || "Recusar";
      rejectReq.disabled = true;
      rejectReq.textContent = "Recusando…";
      if (approveBtn instanceof HTMLButtonElement) approveBtn.disabled = true;

      fetchWithAuth("/api/schedule-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao: "recusar" }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const msg =
              data?.error === "already_resolved"
                ? "Essa solicitação já foi resolvida."
                : "Não foi possível recusar agora. Tente novamente.";
            openModal({ title: "Não foi possível recusar", bodyHtml: escapeHtml(msg), primaryLabel: "Fechar", hideSecondary: true });
            return;
          }
          refreshAdminRescheduleRequests({ force: true });
          refreshTeacherEvents({ force: true });
        })
        .catch(() => {
          openModal({
            title: "Não foi possível recusar",
            bodyHtml: "Não foi possível recusar agora. Tente novamente.",
            primaryLabel: "Fechar",
            hideSecondary: true,
          });
        })
        .finally(() => {
          rejectReq.disabled = false;
          rejectReq.textContent = previousLabel;
          if (approveBtn instanceof HTMLButtonElement) approveBtn.disabled = false;
        });

      return;
    }
  }

  if (!(target instanceof Element) || !target.closest("[data-chart-dropdown]")) {
    closeAllDropdowns();
  }
});

// Admin > Alunos: student files upload (delegated, so it works after re-render).
document.addEventListener("click", (event) => {
  if (currentRole !== "admin") return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const zone = target.closest("[data-admin-student-files-upload-zone]");
  if (!(zone instanceof HTMLElement)) return;

  const sheetEl = document.querySelector("[data-admin-student-sheet]");
  if (!(sheetEl instanceof HTMLElement)) return;
  const input = sheetEl.querySelector("[data-admin-student-files-input]");
  if (!(input instanceof HTMLInputElement)) return;

  event.preventDefault();
  input.click();
});

document.addEventListener("change", (event) => {
  if (currentRole !== "admin") return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.matches("[data-admin-student-files-input]")) return;

  const alunoId = String(adminStudentsState.history?.alunoId || "").trim();
  const files = Array.from(target.files || []);
  target.value = "";
  if (!alunoId || !files.length) return;

  uploadAdminStudentFiles({ alunoId, files }).catch(() => {});
});

// Admin > Controle Pedagógico: filters update the agenda/list views.
document.addEventListener("change", (event) => {
  if (currentRole !== "admin") return;
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.matches("[data-admin-ped-filter]")) return;

  const key = String(target.getAttribute("data-admin-ped-filter") || "").trim();
  if (!key) return;
  adminPedagogicoState.filters = adminPedagogicoState.filters && typeof adminPedagogicoState.filters === "object" ? { ...adminPedagogicoState.filters } : {};
  adminPedagogicoState.filters[key] = String(target.value || "");

  renderAdminPedagogicoAgenda();
  renderAdminPedagogicoClassesList();
  renderAdminPedagogicoTeachersPanel();
  renderAdminPedagogicoConflicts();
});

// Admin > Controle Pedagógico > Onboarding: modal dynamic sections (type + question type).
document.addEventListener("change", (event) => {
  if (currentRole !== "admin") return;
  if (activeModalKind !== "admin-onboarding-content") return;
