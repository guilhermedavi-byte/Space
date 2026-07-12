const { listCollectionAsAdmin } = require("./firestore-admin");
const { supabaseFetch } = require("./supabase-rest");
const { FINANCE_TABLES } = require("./finance-integrations");

const ONBOARDING_TABLE = "n8n_onboarding_alunos_space";

const STUDENT_MIRROR_TABLES = [
  {
    table: FINANCE_TABLES.alunos,
    fields: {
      firestore_doc_id: "firestoreDocId",
      aluno_nome: "nome",
      telefone: "telefone",
      email: "email",
      plano: "plano",
      professor_id: "professorId",
      professor_nome: "professorNome",
      ativo: "ativo",
    },
    filters: [
      (student) => (student.firestoreDocId ? `firestore_doc_id=eq.${encodeURIComponent(student.firestoreDocId)}` : ""),
      (student) => (student.email ? `email=eq.${encodeURIComponent(student.email)}` : ""),
    ],
  },
  {
    table: ONBOARDING_TABLE,
    fields: {
      firestore_doc_id: "firestoreDocId",
      aluno_id: "firestoreDocId",
      aluno_nome: "nome",
      telefone: "telefone",
      email: "email",
      plano: "plano",
      professor_id: "professorId",
      professor_nome: "professorNome",
      ativo: "ativo",
    },
    filters: [
      (student) => (student.firestoreDocId ? `firestore_doc_id=eq.${encodeURIComponent(student.firestoreDocId)}` : ""),
      (student) => (student.email ? `email=eq.${encodeURIComponent(student.email)}` : ""),
      (student) => (student.firestoreDocId ? `aluno_id=eq.${encodeURIComponent(student.firestoreDocId)}` : ""),
    ],
  },
];

const normalizeText = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const normalizeStudentDoc = (row = {}) => {
  if (!row || typeof row !== "object") return null;
  const firestoreDocId = normalizeText(row.firestoreDocId || row.id);
  if (!firestoreDocId) return null;
  const tipo = normalizeText(row.tipo || row.role || row.type).toLowerCase();
  if (tipo && !["student", "aluno"].includes(tipo)) return null;
  return {
    firestoreDocId,
    nome:
      normalizeText(row.nome) ||
      normalizeText(row.nomeCompleto) ||
      normalizeText(row.fullName) ||
      normalizeText(row.displayName) ||
      normalizeText(row.name) ||
      normalizeEmail(row.email) ||
      "Aluno sem nome",
    email: normalizeEmail(row.email),
    telefone: normalizeText(row.telefone || row.phone || row.telefoneWhatsapp),
    plano: normalizeText(row.plano || row.plan),
    professorId: normalizeText(row.professorId || row.teacherId || row.teacher_id),
    professorNome: normalizeText(row.professorNome || row.teacherNome || row.teacherName),
    ativo: row.ativo !== false,
  };
};

const buildMirrorPatch = (student, fieldMap) =>
  Object.fromEntries(
    Object.entries(fieldMap || {})
      .map(([column, key]) => [column, student?.[key] ?? null])
      .filter(([, value]) => value !== undefined)
  );

const extractRows = (result) => (Array.isArray(result?.data) ? result.data : []);

const buildStrategyName = (filter = "") => {
  if (String(filter).startsWith("firestore_doc_id=")) return "firestore_doc_id";
  if (String(filter).startsWith("aluno_id=")) return "aluno_id";
  if (String(filter).startsWith("email=")) return "email";
  return "unknown";
};

const queryMirrorCandidates = async ({ table, filter }) => {
  const response = await supabaseFetch(`/${table}?select=id&${filter}`, { method: "GET" });
  return extractRows(response);
};

const tryPatchMirrorTable = async ({ table, fields, filters }, student) => {
  const patch = buildMirrorPatch(student, fields);
  for (const buildFilter of Array.isArray(filters) ? filters : []) {
    const filter = typeof buildFilter === "function" ? buildFilter(student) : "";
    if (!filter) continue;
    const strategy = buildStrategyName(filter);
    try {
      const candidates = await queryMirrorCandidates({ table, filter });
      if (candidates.length === 0) {
        console.warn("[ownership] mirror sync not_found", {
          firestore_doc_id: student.firestoreDocId,
          table,
          strategy,
          filter,
          rows_affected: 0,
        });
        continue;
      }
      if (candidates.length > 1) {
        console.warn("[ownership] mirror sync ambiguous", {
          firestore_doc_id: student.firestoreDocId,
          table,
          strategy,
          filter,
          candidates: candidates.length,
          rows_affected: 0,
        });
        return {
          table,
          strategy,
          status: "ambiguous",
          rowsAffected: 0,
          candidateCount: candidates.length,
          filter,
        };
      }
      const response = await supabaseFetch(`/${table}?${filter}`, {
        method: "PATCH",
        // ESPELHO DESNORMALIZADO — fonte: Firestore users/{id}
        body: patch,
      });
      const rowsAffected = extractRows(response).length;
      const status = rowsAffected > 0 ? "updated" : "not_found";
      console.warn("[ownership] mirror sync result", {
        firestore_doc_id: student.firestoreDocId,
        table,
        strategy,
        filter,
        status,
        rows_affected: rowsAffected,
      });
      return {
        table,
        strategy,
        status,
        rowsAffected,
        candidateCount: candidates.length,
        filter,
      };
    } catch (error) {
      const details = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
      const ignorable =
        String(error?.code || "") === "PGRST204" ||
        String(error?.code || "") === "42703" ||
        details.includes("column") ||
        details.includes("schema cache") ||
        details.includes("could not find");
      console.warn("[ownership] supabase mirror patch failed", {
        firestore_doc_id: student.firestoreDocId,
        table,
        strategy,
        filter,
        code: error?.code || "",
        message: error?.message || "",
        ignorable,
      });
      return {
        table,
        strategy,
        status: "error",
        rowsAffected: 0,
        candidateCount: 0,
        filter,
        code: error?.code || "",
        message: error?.message || "",
      };
    }
  }
  return {
    table,
    strategy: "",
    status: "not_found",
    rowsAffected: 0,
    candidateCount: 0,
    filter: "",
  };
};

const syncStudentMirrorToSupabase = async (firestoreDocId) => {
  const id = normalizeText(firestoreDocId);
  if (!id) return { ok: false, reason: "missing_firestore_doc_id" };
  try {
    const users = await listCollectionAsAdmin("users", { pageSize: 1500 });
    const student = normalizeStudentDoc((Array.isArray(users) ? users : []).find((row) => normalizeText(row?.firestoreDocId || row?.id) === id));
    if (!student) return { ok: false, reason: "student_not_found" };
    const results = await Promise.all(
      STUDENT_MIRROR_TABLES.map((config) => tryPatchMirrorTable(config, student))
    );
    const rowsAffected = results.reduce((sum, item) => sum + (Number(item?.rowsAffected) || 0), 0);
    return {
      ok: rowsAffected > 0,
      firestoreDocId: id,
      rowsAffected,
      updatedCount: results.filter((item) => item?.status === "updated").length,
      results,
      reason: rowsAffected > 0 ? "" : "mirror_not_found",
    };
  } catch (error) {
    console.warn("[ownership] syncStudentMirrorToSupabase unavailable", {
      firestoreDocId: id,
      code: error?.code || "",
      message: error?.message || "",
    });
    return { ok: false, reason: error?.message || "sync_failed" };
  }
};

module.exports = {
  syncStudentMirrorToSupabase,
  _test: {
    normalizeStudentDoc,
    buildMirrorPatch,
    buildStrategyName,
  },
};
