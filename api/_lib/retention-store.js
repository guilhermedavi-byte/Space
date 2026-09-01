const { supabaseFetch } = require("./supabase-rest");
const { getDocumentAsAdmin } = require("./firestore-admin");
const { addDaysToDateKey, formatDateKey, isValidDateKey } = require("./commercial-week");
const { buildQueuesFromCases, normalizeLifecycleStatus, normalizePauseStatus } = require("./retention-domain");

const PROVISION_SOURCE_SYSTEM = "firestore_on_demand";
const provisionInFlightByStudentId = new Map();

const safeText = (value) => String(value || "").trim();

const buildRetentionStoreError = (code, details = {}) => {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
};

const normalizeDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value?.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  if (typeof value === "string" && isValidDateKey(value)) {
    const parsed = new Date(`${value}T12:00:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const normalizeDateKeyFromValue = (value) => {
  if (typeof value === "string" && isValidDateKey(value)) return value;
  const parsed = normalizeDateValue(value);
  return parsed ? formatDateKey(parsed) : "";
};

const normalizeIsoTimestampFromValue = (value) => {
  const parsed = normalizeDateValue(value);
  return parsed ? parsed.toISOString() : null;
};

const parseDateKeyParts = (dateKey) => {
  if (!isValidDateKey(dateKey)) return null;
  const [year, month, day] = String(dateKey).split("-").map((chunk) => Number(chunk));
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const buildDateKeyFromParts = ({ year, month, day }) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
  const date = new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
  return formatDateKey(date);
};

const addMonthsToAnchoredDateKey = (dateKey, monthsToAdd, anchorDay) => {
  const parts = parseDateKeyParts(dateKey);
  if (!parts) return "";
  const baseMonthIndex = parts.year * 12 + (parts.month - 1);
  const targetMonthIndex = baseMonthIndex + Number(monthsToAdd || 0);
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const nextDay = Math.min(Number(anchorDay || parts.day) || parts.day, lastDay);
  return buildDateKeyFromParts({ year: targetYear, month: targetMonth + 1, day: nextDay });
};

const resolveCurrentMonthlyServicePeriod = ({ startDateKey, today = new Date() } = {}) => {
  const safeStartDateKey = safeText(startDateKey);
  if (!isValidDateKey(safeStartDateKey)) {
    throw buildRetentionStoreError("retention_student_missing_entry_date");
  }
  const startParts = parseDateKeyParts(safeStartDateKey);
  const todayKey = formatDateKey(today);
  const todayParts = parseDateKeyParts(todayKey);
  if (!startParts || !todayParts) {
    throw buildRetentionStoreError("retention_student_missing_entry_date");
  }
  const anchorDay = startParts.day;
  const monthDiff = (todayParts.year - startParts.year) * 12 + (todayParts.month - startParts.month);
  let cycleIndex = Math.max(0, monthDiff);
  let periodStart = addMonthsToAnchoredDateKey(safeStartDateKey, cycleIndex, anchorDay);
  if (periodStart && periodStart > todayKey) {
    cycleIndex = Math.max(0, cycleIndex - 1);
    periodStart = addMonthsToAnchoredDateKey(safeStartDateKey, cycleIndex, anchorDay);
  }
  const nextPeriodStart = addMonthsToAnchoredDateKey(safeStartDateKey, cycleIndex + 1, anchorDay);
  if (!periodStart || !nextPeriodStart) {
    throw buildRetentionStoreError("retention_student_missing_entry_date");
  }
  return {
    periodStart,
    periodEnd: addDaysToDateKey(nextPeriodStart, -1),
  };
};

const resolveFirestoreEntryDate = (student = {}) => {
  const candidates = [
    ["dataEntrada", student.dataEntrada],
    ["dataCadastro", student.dataCadastro],
    ["createdAt", student.createdAt],
    ["created_at", student.created_at],
    ["created", student.created],
    ["criadoEm", student.criadoEm],
    ["matriculaEm", student.matriculaEm],
    ["startDate", student.startDate],
    ["primeiraAula", student.primeiraAula],
    ["firstLessonAt", student.firstLessonAt],
  ];
  for (const [field, value] of candidates) {
    const dateKey = normalizeDateKeyFromValue(value);
    if (!dateKey) continue;
    const iso = normalizeIsoTimestampFromValue(value) || new Date(`${dateKey}T12:00:00-03:00`).toISOString();
    return { field, dateKey, iso };
  }
  throw buildRetentionStoreError("retention_student_missing_entry_date");
};

const buildProvisionPayloadFromFirestoreStudent = (student = {}) => {
  const firestoreStudentId = safeText(student.firestoreDocId || student.id);
  if (!firestoreStudentId) {
    throw buildRetentionStoreError("retention_student_not_found");
  }
  const fullName = safeText(student.nome || student.name || "Aluno") || "Aluno";
  const email = safeText(student.email) || null;
  const phone = safeText(student.telefone || student.whatsapp || student.telefoneWhatsapp) || null;
  const lifecycleStatus =
    student.ativo === false || student.canceladoEm || student.dataCancelamento
      ? "churned"
      : normalizeLifecycleStatus(student.cancelamento ? "cancellation_scheduled" : "active");
  const pauseStatus = normalizePauseStatus(student.cancelamento?.aulasSuspensas ? "paused_non_billable" : "none");
  const entryDate = resolveFirestoreEntryDate(student);
  const servicePeriod = resolveCurrentMonthlyServicePeriod({ startDateKey: entryDate.dateKey });
  const legacySource = {
    firestore_doc: firestoreStudentId,
    provisioned_from: "retention_store",
    entry_date_field: entryDate.field,
    entry_date_key: entryDate.dateKey,
  };

  return {
    student: {
      firestore_student_id: firestoreStudentId,
      full_name: fullName,
      email,
      phone,
      lifecycle_status: lifecycleStatus,
      pause_status: pauseStatus,
      source_system: PROVISION_SOURCE_SYSTEM,
      legacy_source: legacySource,
      legacy_confidence: "medium",
    },
    billing_account: {
      external_key: `firestore-student:${firestoreStudentId}`,
      display_name: fullName,
      email,
      phone,
      source_system: PROVISION_SOURCE_SYSTEM,
      legacy_source: legacySource,
      legacy_confidence: "low",
    },
    subscription: {
      external_subscription_key: `firestore:${firestoreStudentId}`,
      plan_name: safeText(student.plano || student.plan) || null,
      billing_cycle: "monthly",
      lifecycle_status: lifecycleStatus,
      pause_status: pauseStatus,
      financial_status: "unknown",
      started_at: entryDate.iso,
      scheduled_service_end_at: normalizeIsoTimestampFromValue(student.cancelamento?.dataFimAviso),
      ended_at: student.ativo === false ? normalizeIsoTimestampFromValue(student.canceladoEm || student.dataCancelamento) : null,
      source_system: PROVISION_SOURCE_SYSTEM,
      legacy_source: legacySource,
      legacy_confidence: "low",
    },
    service_period: {
      period_start: servicePeriod.periodStart,
      period_end: servicePeriod.periodEnd,
      source_system: PROVISION_SOURCE_SYSTEM,
      legacy_source: legacySource,
      legacy_confidence: "low",
    },
  };
};

const invokeRetentionRpc = async (rpcName, payload = {}) => {
  const { data } = await supabaseFetch(`/rpc/${encodeURIComponent(String(rpcName || "").trim())}`, {
    method: "POST",
    body: payload,
  });
  if (Array.isArray(data)) return data[0] || null;
  return data;
};

const listRetentionCases = async ({ filters = {} } = {}) => {
  const data = await invokeRetentionRpc("retention_list_cases", { p_filters: filters });
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return {
    rows,
    counts: data?.counts && typeof data.counts === "object" ? data.counts : {},
    queues: buildQueuesFromCases(rows),
  };
};

const resolveRetentionSubjectOnce = async ({ firestoreStudentId } = {}) => {
  const data = await invokeRetentionRpc("retention_resolve_subject_by_firestore_student_id", {
    p_firestore_student_id: firestoreStudentId,
  });
  if (!data?.student_id || !data?.subscription_id) {
    throw buildRetentionStoreError("retention_student_not_found");
  }
  return {
    studentId: String(data.student_id || ""),
    subscriptionId: String(data.subscription_id || ""),
    firestoreStudentId,
  };
};

const provisionRetentionSubjectFromFirestore = async ({ firestoreStudentId } = {}) => {
  const safeId = safeText(firestoreStudentId);
  if (!safeId) throw buildRetentionStoreError("missing_firestore_student_id");
  const inFlight = provisionInFlightByStudentId.get(safeId);
  if (inFlight) return inFlight;
  const task = (async () => {
    let firestoreStudent;
    try {
      firestoreStudent = await getDocumentAsAdmin(`users/${safeId}`);
    } catch (error) {
      if (Number(error?.status) === 404) {
        throw buildRetentionStoreError("retention_student_not_found", { cause: error });
      }
      throw error;
    }
    const payload = buildProvisionPayloadFromFirestoreStudent(firestoreStudent);
    return invokeRetentionRpc("retention_provision_subject", { p_payload: payload });
  })();
  provisionInFlightByStudentId.set(safeId, task);
  try {
    return await task;
  } finally {
    if (provisionInFlightByStudentId.get(safeId) === task) {
      provisionInFlightByStudentId.delete(safeId);
    }
  }
};

const resolveRetentionSubjectByFirestoreStudentId = async ({ firestoreStudentId } = {}) => {
  const safeId = safeText(firestoreStudentId);
  if (!safeId) {
    throw buildRetentionStoreError("missing_firestore_student_id");
  }
  try {
    return await resolveRetentionSubjectOnce({ firestoreStudentId: safeId });
  } catch (error) {
    if (error?.code !== "retention_student_not_found") throw error;
  }
  await provisionRetentionSubjectFromFirestore({ firestoreStudentId: safeId });
  return resolveRetentionSubjectOnce({ firestoreStudentId: safeId });
};

const getRetentionCaseTimeline = async ({ caseId } = {}) => {
  return invokeRetentionRpc("retention_get_case_timeline", { p_case_id: caseId });
};

const applyRetentionCommand = async ({ command } = {}) => {
  return invokeRetentionRpc("retention_apply_command", { p_command: command });
};

const runLegacyRetentionImport = async ({ payload } = {}) => {
  return invokeRetentionRpc("retention_import_legacy_snapshot", { p_payload: payload });
};

const runScheduledRetentionChurn = async ({ limit = 50, actor } = {}) => {
  return invokeRetentionRpc("retention_run_scheduled_churn", {
    p_limit: limit,
    p_actor: actor || { uid: "system:retention-cron", name: "Sistema", role: "system" },
  });
};

module.exports = {
  listRetentionCases,
  resolveRetentionSubjectByFirestoreStudentId,
  getRetentionCaseTimeline,
  applyRetentionCommand,
  runLegacyRetentionImport,
  runScheduledRetentionChurn,
  invokeRetentionRpc,
  _test: {
    buildProvisionPayloadFromFirestoreStudent,
    provisionRetentionSubjectFromFirestore,
    resolveCurrentMonthlyServicePeriod,
    resolveFirestoreEntryDate,
    addMonthsToAnchoredDateKey,
    clearProvisionInFlight() {
      provisionInFlightByStudentId.clear();
    },
  },
};
