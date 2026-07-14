const { assertEnvironmentIsolation, getAppEnv, getFirebaseServerConfig } = require("../_lib/runtime-env");
const { commitWritesAsAdmin } = require("../api/_lib/firestore-admin");
const { FIRESTORE_BASE, encodeFields } = require("../_lib/firestore-rest");

const RESERVED_EMAIL_DOMAINS = ["example.com", "example.net", "example.org", "space.test", "space.invalid"];

const email = (local, domain = "example.com") => `${local}@${domain}`;

const buildStagingSeedDataset = () => ({
  generatedAt: "2026-07-12T00:00:00.000Z",
  students: [
    { student_id: "stg-student-001", full_name: "Alice Teste Notice", email: email("alice.notice"), phone: "+5511911111111" },
    { student_id: "stg-student-002", full_name: "Bruno Teste Active", email: email("bruno.active"), phone: "+5511922222222" },
    { student_id: "stg-student-003", full_name: "Clara Teste Paused", email: email("clara.paused"), phone: "+5511933333333" },
    { student_id: "stg-student-004", full_name: "Diego Teste Ended", email: email("diego.ended"), phone: "+5511944444444" },
    { student_id: "stg-student-005", full_name: "Eva Ambígua", email: email("eva.ambigua"), phone: "+5511955555555" },
  ],
  teachers: [
    { teacher_id: "stg-teacher-001", full_name: "Prof. Amanda Fictícia", email: email("amanda.teacher") },
    { teacher_id: "stg-teacher-002", full_name: "Prof. Rafael Fictício", email: email("rafael.teacher") },
  ],
  enrollments: [
    { enrollment_id: "stg-enr-001", student_id: "stg-student-001", teacher_id: "stg-teacher-001", enrollment_status: "notice" },
    { enrollment_id: "stg-enr-002", student_id: "stg-student-002", teacher_id: "stg-teacher-001", enrollment_status: "active" },
    { enrollment_id: "stg-enr-003", student_id: "stg-student-003", teacher_id: "stg-teacher-002", enrollment_status: "paused" },
    { enrollment_id: "stg-enr-004", student_id: "stg-student-004", teacher_id: "stg-teacher-002", enrollment_status: "ended" },
  ],
  payers: [
    { payer_id: "stg-payer-001", display_name: "Pagador Familiar Teste", email: email("familia.pagadora") },
    { payer_id: "stg-payer-002", display_name: "Pagador Empresa Teste", email: email("empresa.pagadora", "example.org") },
  ],
  financialContracts: [
    { contract_id: "stg-contract-001", payer_id: "stg-payer-001", contract_status: "active" },
    { contract_id: "stg-contract-002", payer_id: "stg-payer-002", contract_status: "past_due" },
  ],
  contractItems: [
    {
      contract_item_id: "stg-item-001",
      contract_id: "stg-contract-001",
      student_id: "stg-student-001",
      description: "Plano Familiar A",
      quantity: 1,
      unit_amount: 450,
      discount_amount: 50,
      final_amount: 400,
      item_status: "active",
    },
    {
      contract_item_id: "stg-item-002",
      contract_id: "stg-contract-001",
      student_id: "stg-student-002",
      description: "Plano Familiar B",
      quantity: 1,
      unit_amount: 450,
      discount_amount: 50,
      final_amount: 400,
      item_status: "active",
    },
    {
      contract_item_id: "stg-item-003",
      contract_id: "stg-contract-002",
      student_id: "stg-student-004",
      description: "Ex-aluno inadimplente",
      quantity: 1,
      unit_amount: 320,
      discount_amount: 0,
      final_amount: 320,
      item_status: "ended",
    },
  ],
  charges: [
    { charge_id: "stg-charge-001", contract_id: "stg-contract-001", charge_status: "pending", amount: 800, due_date: "2026-07-20" },
    { charge_id: "stg-charge-002", contract_id: "stg-contract-002", charge_status: "overdue", amount: 320, due_date: "2026-06-10" },
  ],
  chargeAllocations: [
    { charge_allocation_id: "stg-alloc-001", charge_id: "stg-charge-001", contract_item_id: "stg-item-001", student_id: "stg-student-001", allocated_amount: 400 },
    { charge_allocation_id: "stg-alloc-002", charge_id: "stg-charge-001", contract_item_id: "stg-item-002", student_id: "stg-student-002", allocated_amount: 400 },
    { charge_allocation_id: "stg-alloc-003", charge_id: "stg-charge-002", contract_item_id: "stg-item-003", student_id: "stg-student-004", allocated_amount: 320 },
  ],
  reconciliationItems: [
    { reconciliation_item_id: "stg-rec-001", item_status: "ambiguous", suggestion_confidence: 72, source_kind: "combined" },
    { reconciliation_item_id: "stg-rec-002", item_status: "financial_only", suggestion_confidence: 98, source_kind: "finance_legacy" },
  ],
  reservedEmailDomains: RESERVED_EMAIL_DOMAINS,
});

const documentName = (collection, id) => `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(id)}`;

const makeTimestamp = () => new Date().toISOString();

const buildLegacyUserDocs = (dataset, now = makeTimestamp()) => {
  const teachersById = new Map(dataset.teachers.map((teacher) => [teacher.teacher_id, teacher]));
  const enrollmentsByStudentId = new Map(dataset.enrollments.map((enrollment) => [enrollment.student_id, enrollment]));

  const teacherDocs = dataset.teachers.map((teacher) => ({
    collection: "users",
    id: teacher.teacher_id,
    data: {
      id: teacher.teacher_id,
      firestoreDocId: teacher.teacher_id,
      tipo: "teacher",
      role: "teacher",
      nome: teacher.full_name,
      nomeCompleto: teacher.full_name,
      name: teacher.full_name,
      email: teacher.email,
      ativo: true,
      isSyntheticStagingData: true,
      source: "staging_seed",
      createdAt: now,
      updatedAt: now,
    },
  }));

  const studentDocs = dataset.students.map((student) => {
    const enrollment = enrollmentsByStudentId.get(student.student_id) || {};
    const teacher = teachersById.get(enrollment.teacher_id) || {};
    const status = String(enrollment.enrollment_status || "active");
    const cancelamento =
      status === "notice"
        ? {
            dataPedido: "2026-07-01",
            dataFimAviso: "2026-07-31",
            motivo: "Seed sintético de aviso prévio",
            desfecho: null,
            aulasSuspensas: false,
            eventos: [{ tipo: "aviso_previo_seed", criadoEm: now, autor: "staging_seed" }],
          }
        : null;
    return {
      collection: "users",
      id: student.student_id,
      data: {
        id: student.student_id,
        firestoreDocId: student.student_id,
        tipo: "student",
        role: "student",
        nome: student.full_name,
        nomeCompleto: student.full_name,
        name: student.full_name,
        email: student.email,
        telefone: student.phone,
        ativo: status !== "ended",
        plano: status === "ended" ? "Legacy" : "Fictício",
        professorId: enrollment.teacher_id || "",
        professorNome: teacher.full_name || "",
        enrollmentStatus: status,
        ...(cancelamento ? { cancelamento } : {}),
        isSyntheticStagingData: true,
        source: "staging_seed",
        createdAt: now,
        updatedAt: now,
      },
    };
  });

  return [...teacherDocs, ...studentDocs];
};

const buildCanonicalDocs = (dataset, now = makeTimestamp()) => [
  ...dataset.students.map((student) => ({
    collection: "students",
    id: student.student_id,
    data: { ...student, isSyntheticStagingData: true, source: "staging_seed", created_at: now, updated_at: now },
  })),
  ...dataset.teachers.map((teacher) => ({
    collection: "teachers",
    id: teacher.teacher_id,
    data: { ...teacher, isSyntheticStagingData: true, source: "staging_seed", created_at: now, updated_at: now },
  })),
  ...dataset.enrollments.map((enrollment) => ({
    collection: "enrollments",
    id: enrollment.enrollment_id,
    data: { ...enrollment, isSyntheticStagingData: true, source: "staging_seed", created_at: now, updated_at: now },
  })),
];

const buildFirestoreSeedDocs = (dataset = buildStagingSeedDataset()) => {
  const now = makeTimestamp();
  return [...buildLegacyUserDocs(dataset, now), ...buildCanonicalDocs(dataset, now)];
};

const buildFirestoreSeedWrites = (docs) =>
  docs.map((doc) => ({
    update: {
      name: documentName(doc.collection, doc.id),
      fields: encodeFields(doc.data).fields,
    },
  }));

const buildSeedReport = ({ mode, env = process.env, dataset = buildStagingSeedDataset(), docs = buildFirestoreSeedDocs(dataset) }) => {
  const counts = docs.reduce((acc, doc) => {
    acc[doc.collection] = (acc[doc.collection] || 0) + 1;
    return acc;
  }, {});
  return {
    mode,
    appEnv: getAppEnv(env),
    firebaseProjectId: getFirebaseServerConfig(env).projectId || "",
    collections: counts,
    samples: docs.slice(0, 8).map((doc) => ({
      collection: doc.collection,
      id: doc.id,
      nome: doc.data.nome || doc.data.full_name || doc.data.name || "",
      email: doc.data.email || "",
    })),
    reservedEmailDomains: dataset.reservedEmailDomains,
  };
};

const runCli = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply") || args.has("--execute");
  const dataset = buildStagingSeedDataset();
  const docs = buildFirestoreSeedDocs(dataset);
  const validation = assertEnvironmentIsolation(process.env);
  if (validation.appEnv !== "staging") {
    const error = new Error("seed_requires_staging");
    error.code = "seed_requires_staging";
    throw error;
  }

  if (!apply) {
    process.stdout.write(`${JSON.stringify(buildSeedReport({ mode: "dry-run", dataset, docs }), null, 2)}\n`);
    return;
  }

  const response = await commitWritesAsAdmin({ writes: buildFirestoreSeedWrites(docs) });
  if (!response.ok) {
    const error = new Error("staging_seed_commit_failed");
    error.code = "staging_seed_commit_failed";
    error.status = response.status;
    error.details = response.data || response.text || null;
    throw error;
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ...buildSeedReport({ mode: "apply", dataset, docs }),
        writeResults: Array.isArray(response.data?.writeResults) ? response.data.writeResults.length : 0,
      },
      null,
      2
    )}\n`
  );
};

if (require.main === module) {
  runCli().catch((error) => {
    process.stderr.write(
      `${JSON.stringify(
        {
          error: error?.code || error?.message || "staging_seed_failed",
          message: error?.message || "staging_seed_failed",
          status: error?.status || null,
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = {
  RESERVED_EMAIL_DOMAINS,
  buildStagingSeedDataset,
  buildFirestoreSeedDocs,
  buildSeedReport,
};
