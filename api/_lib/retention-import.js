const { createHash } = require("crypto");
const { computeScheduledServiceEndAt, normalizeLifecycleStatus, normalizePauseStatus } = require("./retention-domain");

const normalizeLegacyRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "student" || raw === "aluno") return "student";
  return "";
};

const isLegacyStudent = (row = {}) => {
  if (normalizeLegacyRole(row.tipo || row.role || row.type || row.perfil) === "student") return true;
  return Boolean(row.professorId || row.teacherId || row.cancelamento || Array.isArray(row.cancelamentosAnteriores));
};

const normalizeLegacyCancellationRecord = (value) => {
  if (!value || typeof value !== "object") return null;
  const history = Array.isArray(value.eventos) ? value.eventos : Array.isArray(value.historico) ? value.historico : [];
  return {
    dataPedido: value.dataPedido || value.data_pedido || value.createdAt || null,
    dataFimAviso: value.dataFimAviso || value.dataFimPrevista || value.data_fim_aviso || null,
    origem: String(value.origem || value.tipo || "").trim() === "abandono_confirmado" ? "abandono_confirmado" : "pedido",
    motivo: String(value.motivo || "").trim(),
    motivoDetalhe: String(value.motivoDetalhe || value.detalhe || "").trim(),
    aulasSuspensas: value.aulasSuspensas === true,
    dataSuspensao: value.dataSuspensao || null,
    desfecho: value.desfecho ?? null,
    dataEfetivacao: value.dataEfetivacao || null,
    eventos: history
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        data: item.data || item.createdAt || null,
        acao: String(item.acao || "").trim(),
        detalhe: String(item.detalhe || "").trim(),
      })),
  };
};

const buildLegacyStudentRecord = (row = {}, { importedAt } = {}) => ({
  firestore_student_id: String(row.firestoreDocId || row.id || "").trim(),
  full_name: String(row.nome || row.name || "Aluno").trim() || "Aluno",
  email: String(row.email || "").trim() || null,
  phone: String(row.telefone || row.whatsapp || "").trim() || null,
  lifecycle_status:
    row.ativo === false || row.canceladoEm || row.dataCancelamento
      ? "churned"
      : normalizeLifecycleStatus(row.cancelamento ? "cancellation_scheduled" : "active"),
  pause_status: normalizePauseStatus(row.cancelamento?.aulasSuspensas ? "paused_non_billable" : "none"),
  source_system: "firestore",
  legacy_source: {
    imported_at: importedAt || new Date().toISOString(),
    legacy_doc: String(row.firestoreDocId || row.id || "").trim(),
  },
  legacy_confidence: "medium",
});

const buildLegacySubscriptionRecord = (student, row = {}) => ({
  firestore_student_id: student.firestore_student_id,
  external_subscription_key: `firestore:${student.firestore_student_id}`,
  plan_name: String(row.plano || row.plan || "").trim() || null,
  billing_cycle: "monthly",
  lifecycle_status: student.lifecycle_status,
  pause_status: student.pause_status,
  financial_status: "unknown",
  started_at: row.createdAt || row.dataCadastro || null,
  scheduled_service_end_at: row.cancelamento?.dataFimAviso || null,
  ended_at: row.ativo === false ? row.canceladoEm || row.dataCancelamento || null : null,
  source_system: "legacy_import",
  legacy_source: {
    has_financial_data: false,
  },
  legacy_confidence: "low",
});

const buildLegacyCaseRecord = ({ student, cancellation, isClosed = false, row = {} } = {}) => {
  const requestedAt = cancellation?.dataPedido || row.updatedAt || row.createdAt || new Date().toISOString();
  return {
    firestore_student_id: student.firestore_student_id,
    external_subscription_key: `firestore:${student.firestore_student_id}`,
    case_kind: cancellation?.origem === "abandono_confirmado" ? "legacy_import" : "formal",
    stage: isClosed ? (cancellation?.desfecho ? "churned" : "saved") : "scheduled",
    risk_level: null,
    lifecycle_status: isClosed ? "churned" : "cancellation_scheduled",
    pause_status: cancellation?.aulasSuspensas ? "paused_non_billable" : "none",
    financial_status: "unknown",
    owner_uid: null,
    owner_name: null,
    scheduled_service_end_at:
      cancellation?.dataFimAviso ||
      computeScheduledServiceEndAt({
        requestedAt,
        firstLessonAt: row.primeiraAula || row.firstLessonAt || null,
      }).toISOString(),
    closed_at: isClosed ? cancellation?.dataEfetivacao || requestedAt : null,
    close_reason: isClosed ? String(cancellation?.desfecho?.tipo || cancellation?.desfecho || "legacy_closed").trim() : null,
    source_system: "legacy_import",
    legacy_source: {
      origem: cancellation?.origem || "pedido",
      motivo: cancellation?.motivo || "",
      imported_from: "users.cancelamento",
    },
    legacy_confidence: "medium",
  };
};

const stableAnonId = (value) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 10);

const buildLegacyRetentionImportSnapshot = ({ users = [], dryRun = true, importedAt = new Date().toISOString() } = {}) => {
  const students = [];
  const subscriptions = [];
  const cases = [];
  const events = [];
  const report = {
    dryRun: Boolean(dryRun),
    scannedUsers: 0,
    importedStudents: 0,
    openCases: 0,
    closedCases: 0,
    importedEvents: 0,
    anonymizedStudents: [],
  };

  (Array.isArray(users) ? users : []).forEach((row) => {
    report.scannedUsers += 1;
    if (!isLegacyStudent(row)) return;
    const student = buildLegacyStudentRecord(row, { importedAt });
    if (!student.firestore_student_id) return;
    students.push(student);
    subscriptions.push(buildLegacySubscriptionRecord(student, row));
    report.importedStudents += 1;
    report.anonymizedStudents.push({
      studentRef: stableAnonId(student.firestore_student_id),
      lifecycleStatus: student.lifecycle_status,
      pauseStatus: student.pause_status,
    });
    const currentCancellation = normalizeLegacyCancellationRecord(row.cancelamento);
    const legacyCancellations = Array.isArray(row.cancelamentosAnteriores) ? row.cancelamentosAnteriores.map(normalizeLegacyCancellationRecord).filter(Boolean) : [];
    if (currentCancellation) {
      const open = !currentCancellation.desfecho && !currentCancellation.dataEfetivacao;
      cases.push(buildLegacyCaseRecord({ student, cancellation: currentCancellation, isClosed: !open, row }));
      if (open) report.openCases += 1;
      else report.closedCases += 1;
      currentCancellation.eventos.forEach((event) => {
        events.push({
          firestore_student_id: student.firestore_student_id,
          external_subscription_key: `firestore:${student.firestore_student_id}`,
          event_type: "legacy_import",
          occurred_at: event.data || currentCancellation.dataPedido || null,
          client_action_id: `legacy:${student.firestore_student_id}:${stableAnonId(JSON.stringify(event) || currentCancellation.dataPedido || "")}`,
          idempotency_key: `legacy:${student.firestore_student_id}:${stableAnonId(JSON.stringify(event))}`,
          payload: event,
          source_system: "legacy_import",
          source_confidence: "medium",
        });
      });
    }
    legacyCancellations.forEach((cancellation, index) => {
      cases.push(buildLegacyCaseRecord({ student, cancellation, isClosed: true, row }));
      report.closedCases += 1;
      cancellation.eventos.forEach((event, eventIndex) => {
        events.push({
          firestore_student_id: student.firestore_student_id,
          external_subscription_key: `firestore:${student.firestore_student_id}`,
          event_type: "legacy_import",
          occurred_at: event.data || cancellation.dataPedido || null,
          client_action_id: `legacy:${student.firestore_student_id}:${index}:${eventIndex}`,
          idempotency_key: `legacy:${student.firestore_student_id}:${stableAnonId(JSON.stringify({ index, eventIndex, event }))}`,
          payload: event,
          source_system: "legacy_import",
          source_confidence: "medium",
        });
      });
    });
  });

  report.importedEvents = events.length;
  return {
    payload: {
      dry_run: Boolean(dryRun),
      students,
      subscriptions,
      cases,
      events,
    },
    report,
  };
};

module.exports = {
  isLegacyStudent,
  normalizeLegacyCancellationRecord,
  buildLegacyRetentionImportSnapshot,
};
