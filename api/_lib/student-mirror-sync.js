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

const tryPatchMirrorTable = async ({ table, fields, filters }, student) => {
  const patch = buildMirrorPatch(student, fields);
  for (const buildFilter of Array.isArray(filters) ? filters : []) {
    const filter = typeof buildFilter === "function" ? buildFilter(student) : "";
    if (!filter) continue;
    try {
      await supabaseFetch(`/${table}?${filter}`, {
        method: "PATCH",
        // ESPELHO DESNORMALIZADO — fonte: Firestore users/{id}
        body: patch,
      });
      return true;
    } catch (error) {
      const details = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
      const ignorable =
        String(error?.code || "") === "PGRST204" ||
        String(error?.code || "") === "42703" ||
        details.includes("column") ||
        details.includes("schema cache") ||
        details.includes("could not find");
      if (!ignorable) {
        console.warn("[ownership] supabase mirror patch failed", {
          table,
          filter,
          code: error?.code || "",
          message: error?.message || "",
        });
      }
    }
  }
  return false;
};

const syncStudentMirrorToSupabase = async (firestoreDocId) => {
  const id = normalizeText(firestoreDocId);
  if (!id) return { ok: false, reason: "missing_firestore_doc_id" };
  try {
    const users = await listCollectionAsAdmin("users", { pageSize: 1500 });
    const student = normalizeStudentDoc((Array.isArray(users) ? users : []).find((row) => normalizeText(row?.firestoreDocId || row?.id) === id));
    if (!student) return { ok: false, reason: "student_not_found" };
    const results = await Promise.all(
      STUDENT_MIRROR_TABLES.map((config) =>
        tryPatchMirrorTable(config, student).then((updated) => ({ table: config.table, updated }))
      )
    );
    return { ok: true, firestoreDocId: id, results };
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
};
