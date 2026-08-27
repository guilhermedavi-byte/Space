const { supabaseFetch } = require("./supabase-rest");
const { buildQueuesFromCases } = require("./retention-domain");

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

const resolveRetentionSubjectByFirestoreStudentId = async ({ firestoreStudentId } = {}) => {
  const safeId = String(firestoreStudentId || "").trim();
  if (!safeId) {
    const error = new Error("missing_firestore_student_id");
    error.code = "missing_firestore_student_id";
    throw error;
  }
  const data = await invokeRetentionRpc("retention_resolve_subject_by_firestore_student_id", {
    p_firestore_student_id: safeId,
  });
  if (!data?.student_id || !data?.subscription_id) {
    const error = new Error("retention_student_not_found");
    error.code = "retention_student_not_found";
    throw error;
  }
  return {
    studentId: String(data.student_id || ""),
    subscriptionId: String(data.subscription_id || ""),
    firestoreStudentId: safeId,
  };
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
};
