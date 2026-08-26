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
  const { data: students } = await supabaseFetch(
    `/students?select=id,firestore_student_id&firestore_student_id=eq.${encodeURIComponent(safeId)}&limit=1`
  );
  const student = Array.isArray(students) ? students[0] || null : null;
  if (!student?.id) {
    const error = new Error("retention_student_not_found");
    error.code = "retention_student_not_found";
    throw error;
  }
  const { data: subscriptions } = await supabaseFetch(
    `/subscriptions?select=id,lifecycle_status,created_at&student_id=eq.${encodeURIComponent(student.id)}&order=created_at.desc&limit=1`
  );
  const subscription = Array.isArray(subscriptions) ? subscriptions[0] || null : null;
  if (!subscription?.id) {
    const error = new Error("retention_subscription_not_found");
    error.code = "retention_subscription_not_found";
    throw error;
  }
  return {
    studentId: String(student.id || ""),
    subscriptionId: String(subscription.id || ""),
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

module.exports = {
  invokeRetentionRpc,
  listRetentionCases,
  resolveRetentionSubjectByFirestoreStudentId,
  getRetentionCaseTimeline,
  applyRetentionCommand,
  runLegacyRetentionImport,
};
