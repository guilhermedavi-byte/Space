const { createHash } = require("crypto");

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const LIFECYCLE_STATUSES = ["active", "cancellation_scheduled", "churned"];
const PAUSE_STATUSES = ["none", "paused_billable", "paused_non_billable"];
const FINANCIAL_STATUSES = ["unknown", "current", "delinquent", "paused", "cancelled"];

const COMMAND_CAPABILITY = {
  flag_risk: "risk.flag",
  register_preventive_intent: "retention.manage",
  register_formal_request: "retention.manage",
  register_contact: "retention.manage",
  mark_awaiting_customer: "retention.manage",
  retract_cancellation: "retention.resolve",
  pause_billable: "retention.manage",
  pause_non_billable: "retention.manage",
  resume_lessons: "retention.manage",
  confirm_cancellation_continuity: "retention.resolve",
  schedule_program_end: "retention.resolve",
  effectuate_churn: "retention.resolve",
  reactivate_subscription: "retention.resolve",
  delinquency_started: "finance.manage",
  delinquency_recovered: "finance.manage",
};

const OVERRIDE_REQUIRED_COMMANDS = new Set(["effectuate_churn", "reactivate_subscription"]);

const normalizeText = (value) => String(value || "").trim();
const sanitizeText = (value, max = 240) => normalizeText(value).slice(0, max);
const sanitizeTimestamp = (value) => {
  const raw = normalizeText(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const sanitizeEnum = (value, allowed = [], fallback = "") => {
  const raw = normalizeText(value);
  return allowed.includes(raw) ? raw : fallback;
};

const normalizeLifecycleStatus = (value, fallback = "active") => {
  const raw = normalizeText(value);
  return LIFECYCLE_STATUSES.includes(raw) ? raw : fallback;
};

const normalizePauseStatus = (value, fallback = "none") => {
  const raw = normalizeText(value);
  return PAUSE_STATUSES.includes(raw) ? raw : fallback;
};

const normalizeFinancialStatus = (value, fallback = "unknown") => {
  const raw = normalizeText(value);
  return FINANCIAL_STATUSES.includes(raw) ? raw : fallback;
};

const addMonthsPreservingUtcDay = (date, months) => {
  const base = date instanceof Date && !Number.isNaN(date.getTime()) ? new Date(date.getTime()) : new Date();
  const originalDay = base.getUTCDate();
  const copy = new Date(base.getTime());
  copy.setUTCDate(1);
  copy.setUTCMonth(copy.getUTCMonth() + Number(months || 0));
  const lastDay = new Date(Date.UTC(copy.getUTCFullYear(), copy.getUTCMonth() + 1, 0)).getUTCDate();
  copy.setUTCDate(Math.min(originalDay, lastDay));
  return copy;
};

const computeScheduledServiceEndAt = ({ requestedAt, firstLessonAt } = {}) => {
  const requested = requestedAt instanceof Date ? requestedAt : new Date(requestedAt || Date.now());
  const firstLesson = firstLessonAt ? (firstLessonAt instanceof Date ? firstLessonAt : new Date(firstLessonAt)) : null;
  if (firstLesson instanceof Date && !Number.isNaN(firstLesson.getTime())) {
    const diffMs = requested.getTime() - firstLesson.getTime();
    if (diffMs >= 0 && diffMs <= 7 * 86_400_000) return addMonthsPreservingUtcDay(firstLesson, 1);
  }
  return addMonthsPreservingUtcDay(requested, 2);
};

const formatMrrDisplay = (value) => {
  if (value == null || value === "") return "Dados financeiros incompletos";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Dados financeiros incompletos";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
};

const buildIdempotencyKey = ({ command, caseId = "", subscriptionId = "", clientActionId = "" } = {}) =>
  [normalizeText(command), normalizeText(caseId), normalizeText(subscriptionId), normalizeText(clientActionId)].join(":");

const sanitizePayloadByCommand = ({ command, payload = {} } = {}) => {
  const input = payload && typeof payload === "object" ? payload : {};
  if (command === "flag_risk") {
    return {
      risk_level: sanitizeEnum(input.risk_level || input.riskLevel, ["low", "medium", "high", "critical"], "medium"),
      reason: sanitizeText(input.reason, 240),
    };
  }
  if (command === "register_preventive_intent") {
    return {
      reason: sanitizeText(input.reason, 240),
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "register_formal_request") {
    return {
      requested_at: sanitizeTimestamp(input.requested_at || input.requestedAt),
      first_lesson_at: sanitizeTimestamp(input.first_lesson_at || input.firstLessonAt),
      reason: sanitizeText(input.reason, 240),
      detail: sanitizeText(input.detail, 500),
      origin: sanitizeEnum(input.origin, ["pedido", "abandono_confirmado"], ""),
    };
  }
  if (command === "register_contact") {
    return {
      reason: sanitizeText(input.reason, 240),
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "mark_awaiting_customer") {
    return {
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "retract_cancellation") {
    return {
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "pause_billable" || command === "pause_non_billable" || command === "resume_lessons") {
    return {
      reason: sanitizeText(input.reason, 240),
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "confirm_cancellation_continuity") {
    return {
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "schedule_program_end") {
    return {
      scheduled_service_end_at: sanitizeTimestamp(input.scheduled_service_end_at || input.scheduledServiceEndAt),
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "effectuate_churn") {
    return {
      mode: sanitizeEnum(input.mode, ["manual", "automatic"], "manual"),
      outcome: sanitizeText(input.outcome, 120),
      notes: sanitizeText(input.notes, 500),
      occurred_at: sanitizeTimestamp(input.occurred_at || input.occurredAt),
    };
  }
  if (command === "reactivate_subscription") {
    return {
      reason: sanitizeText(input.reason, 240),
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "delinquency_started") {
    return {
      reason: sanitizeText(input.reason, 240),
      detail: sanitizeText(input.detail, 500),
    };
  }
  if (command === "delinquency_recovered") {
    return {
      reason: sanitizeText(input.reason, 240),
      detail: sanitizeText(input.detail, 500),
    };
  }
  return {};
};

const buildCommandFingerprint = (command) =>
  createHash("sha256").update(JSON.stringify(command || {})).digest("hex");

const buildCommandPayload = ({ command, actor, body = {} } = {}) => {
  const safeCommand = normalizeText(command);
  if (!safeCommand) {
    const error = new Error("missing_retention_command");
    error.code = "missing_retention_command";
    throw error;
  }
  const clientActionId = normalizeText(body.clientActionId || body.client_action_id);
  if (!clientActionId) {
    const error = new Error("missing_client_action_id");
    error.code = "missing_client_action_id";
    throw error;
  }
  const idempotencyKey = normalizeText(body.idempotencyKey || body.idempotency_key) || buildIdempotencyKey({
    command: safeCommand,
    caseId: body.caseId || body.case_id,
    subscriptionId: body.subscriptionId || body.subscription_id,
    clientActionId,
  });
  const sanitizedPayload = sanitizePayloadByCommand({ command: safeCommand, payload: body.payload });
  const output = {
    command: safeCommand,
    event_type: safeCommand === "effectuate_churn" ? "cancellation_effective" : safeCommand,
    case_id: normalizeText(body.caseId || body.case_id) || null,
    student_id: normalizeText(body.studentId || body.student_id) || null,
    subscription_id: normalizeText(body.subscriptionId || body.subscription_id) || null,
    firestore_student_id: normalizeText(body.firestoreStudentId || body.firestore_student_id) || null,
    expected_version: Number(body.expectedVersion ?? body.expected_version) || 0,
    justification: sanitizeText(body.justification, 500),
    client_action_id: clientActionId,
    idempotency_key: idempotencyKey,
    actor: {
      uid: normalizeText(actor?.sub),
      name: sanitizeText(actor?.name, 120),
      role: normalizeText(actor?.role),
    },
    payload: sanitizedPayload,
    source_system: normalizeText(body.sourceSystem || body.source_system) || "api",
    source_confidence: normalizeText(body.sourceConfidence || body.source_confidence) || "high",
  };
  output.command_fingerprint = buildCommandFingerprint(output);
  return output;
};

const needsOverrideJustification = ({ command, role, forceOverride = false } = {}) =>
  forceOverride || (String(role || "").trim().toLowerCase() === "admin" && OVERRIDE_REQUIRED_COMMANDS.has(String(command || "").trim()));

const normalizeRetentionRow = (row = {}) => ({
  id: normalizeText(row.id),
  caseKind: normalizeText(row.case_kind),
  stage: normalizeText(row.stage),
  riskLevel: normalizeText(row.risk_level),
  lifecycleStatus: normalizeLifecycleStatus(row.lifecycle_status),
  pauseStatus: normalizePauseStatus(row.pause_status),
  financialStatus: normalizeFinancialStatus(row.financial_status),
  ownerUid: normalizeText(row.owner_uid),
  ownerName: normalizeText(row.owner_name),
  scheduledServiceEndAt: row.scheduled_service_end_at || null,
  firstContactAt: row.first_contact_at || null,
  lastContactAt: row.last_contact_at || null,
  awaitingCustomerSince: row.awaiting_customer_since || null,
  savedAt: row.saved_at || null,
  churnedAt: row.churned_at || null,
  closedAt: row.closed_at || null,
  closeReason: normalizeText(row.close_reason),
  version: Number(row.version) || 0,
  updatedAt: row.updated_at || null,
  firestoreStudentId: normalizeText(row.firestore_student_id),
  studentId: normalizeText(row.student_id),
  subscriptionId: normalizeText(row.subscription_id),
  fullName: normalizeText(row.full_name) || "Aluno",
  planName: normalizeText(row.plan_name),
  mrrValue: row.mrr_brl == null || row.mrr_brl === "" ? null : Number.isFinite(Number(row.mrr_brl)) ? Number(row.mrr_brl) : null,
  mrrDisplay: row.mrr_display || formatMrrDisplay(row.mrr_brl),
});

const describeCaseReason = (row) => {
  if (row.stage === "awaiting_customer") return "Aguardando retorno do aluno";
  if (row.stage === "scheduled" && row.scheduledServiceEndAt) return `Encerramento previsto em ${new Date(row.scheduledServiceEndAt).toLocaleDateString("pt-BR", { timeZone: SAO_PAULO_TIME_ZONE })}`;
  if (row.stage === "lost") return "Encerramento efetivado";
  if (row.stage === "saved") return "Caso revertido";
  if (row.riskLevel) return `Risco ${row.riskLevel}`;
  return "Ação em andamento";
};

const buildQueuesFromCases = (rows = []) => {
  const normalized = (Array.isArray(rows) ? rows : []).map(normalizeRetentionRow);
  const avisos = [];
  const decisoes = [];
  const efetivados = [];
  normalized.forEach((row) => {
    const base = {
      alunoId: row.firestoreStudentId,
      alunoNome: row.fullName,
      origem: row.caseKind === "formal" ? "Pedido" : row.caseKind === "legacy_import" ? "Legado" : "Risco",
      activeCancellation: {
        dataFimAviso: row.scheduledServiceEndAt,
        origem: row.caseKind === "formal" ? "pedido" : "abandono_confirmado",
        aulasSuspensas: row.pauseStatus !== "none",
      },
      paymentSensor: { estado: row.mrrValue == null ? "sem_vinculo" : "em_dia", detalhe: row.mrrDisplay },
      attendanceSensor: { estado: row.stage === "awaiting_customer" ? "ausente" : "frequentando", detalhe: describeCaseReason(row) },
      caseId: row.id,
      version: row.version,
      pauseStatus: row.pauseStatus,
      lifecycleStatus: row.lifecycleStatus,
      mrrDisplay: row.mrrDisplay,
      financialUnavailable: row.mrrValue == null,
    };
    if (row.stage === "scheduled" || row.stage === "awaiting_customer" || (row.stage === "open" && row.caseKind === "formal")) {
      avisos.push({
        ...base,
        type: "aviso",
        timeline: row.scheduledServiceEndAt ? `Previsto para ${new Date(row.scheduledServiceEndAt).toLocaleDateString("pt-BR", { timeZone: SAO_PAULO_TIME_ZONE })}` : "Sem data prevista",
        daysRemaining: "",
        paymentTone: row.mrrValue == null ? "gray" : "green",
        attendanceTone: row.stage === "awaiting_customer" ? "amber" : "green",
        aulasSuspensas: row.pauseStatus !== "none",
        score: row.stage === "awaiting_customer" ? 12 : 10,
      });
    }
    if (row.stage === "open" || row.stage === "awaiting_customer" || row.stage === "scheduled") {
      decisoes.push({
        ...base,
        kind: row.caseKind === "risk" ? "candidato_abandono_silencioso" : row.stage === "awaiting_customer" ? "aparenta_abandono_no_aviso" : "aviso_vencido",
        evidence: describeCaseReason(row),
        actionLabel: row.caseKind === "risk" ? "Abrir ficha" : row.stage === "scheduled" ? "Efetivar" : "Acompanhar",
        secondaryActionLabel: "Abrir ficha",
      });
    }
    if (row.stage === "saved" || row.stage === "lost") {
      const finalStage = row.stage;
      efetivados.push({
        ...base,
        type: finalStage,
        desfecho: row.stage === "saved" ? "revertido" : "lost",
        dataEfetivacao: row.closedAt || row.updatedAt,
      });
    }
  });
  return { avisos, decisoes, efetivados };
};

const getRetentionTimelineEventLabel = (eventType) => {
  const raw = normalizeText(eventType);
  if (raw === "flag_risk") return "Risco sinalizado";
  if (raw === "register_preventive_intent") return "Intenção preventiva";
  if (raw === "register_formal_request") return "Pedido formal";
  if (raw === "register_contact") return "Contato registrado";
  if (raw === "mark_awaiting_customer") return "Aguardando aluno";
  if (raw === "retract_cancellation") return "Cancelamento revertido";
  if (raw === "pause_billable") return "Pausa faturável";
  if (raw === "pause_non_billable") return "Pausa não faturável";
  if (raw === "resume_lessons") return "Retomada das aulas";
  if (raw === "confirm_cancellation_continuity") return "Continuidade confirmada";
  if (raw === "schedule_program_end") return "Encerramento programado";
  if (raw === "cancellation_effective") return "Churn efetivado";
  if (raw === "reactivate_subscription") return "Assinatura reativada";
  if (raw === "delinquency_started") return "Inadimplência iniciada";
  if (raw === "delinquency_recovered") return "Inadimplência recuperada";
  if (raw === "legacy_import") return "Importação legada";
  return "Evento";
};

const applyCommandToProjection = (projection = {}, event = {}) => {
  const current = {
    stage: "open",
    lifecycleStatus: "active",
    pauseStatus: "none",
    financialStatus: "unknown",
    savedAt: null,
    churnedAt: null,
    scheduledServiceEndAt: null,
    ...(projection && typeof projection === "object" ? projection : {}),
  };
  const type = String(event?.event_type || event?.eventType || "").trim();
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const occurredAt = event?.occurred_at || event?.occurredAt || null;
  const stateAfter = event?.state_after && typeof event.state_after === "object" ? event.state_after : event?.stateAfter && typeof event.stateAfter === "object" ? event.stateAfter : null;
  if (type === "register_formal_request") {
    current.stage = "scheduled";
    current.lifecycleStatus = "cancellation_scheduled";
    current.scheduledServiceEndAt = payload.scheduled_service_end_at || current.scheduledServiceEndAt;
  } else if (type === "confirm_cancellation_continuity" || type === "schedule_program_end") {
    current.stage = "scheduled";
    current.lifecycleStatus = "cancellation_scheduled";
    current.scheduledServiceEndAt = payload.scheduled_service_end_at || current.scheduledServiceEndAt;
  } else if (type === "mark_awaiting_customer") {
    current.stage = "awaiting_customer";
  } else if (type === "pause_billable") {
    current.pauseStatus = "paused_billable";
  } else if (type === "pause_non_billable") {
    current.pauseStatus = "paused_non_billable";
  } else if (type === "resume_lessons") {
    current.pauseStatus = "none";
  } else if (type === "retract_cancellation") {
    current.stage = "saved";
    current.lifecycleStatus = "active";
    current.savedAt = occurredAt;
  } else if (type === "effectuate_churn" || type === "cancellation_effective") {
    current.stage = "lost";
    current.lifecycleStatus = "churned";
    current.churnedAt = occurredAt;
  } else if (type === "reactivate_subscription") {
    current.stage = "saved";
    current.lifecycleStatus = "active";
    current.pauseStatus = "none";
    current.savedAt = occurredAt;
  } else if (type === "delinquency_started") {
    current.financialStatus = "delinquent";
  } else if (type === "delinquency_recovered") {
    current.financialStatus = "current";
  }
  if (stateAfter) {
    current.stage = String(stateAfter.stage || current.stage || "").trim() || current.stage;
    current.lifecycleStatus = String(stateAfter.lifecycle_status || stateAfter.lifecycleStatus || current.lifecycleStatus || "").trim() || current.lifecycleStatus;
    current.pauseStatus = String(stateAfter.pause_status || stateAfter.pauseStatus || current.pauseStatus || "").trim() || current.pauseStatus;
    current.financialStatus = String(stateAfter.financial_status || stateAfter.financialStatus || current.financialStatus || "").trim() || current.financialStatus;
    current.scheduledServiceEndAt = stateAfter.scheduled_service_end_at || stateAfter.scheduledServiceEndAt || current.scheduledServiceEndAt;
  }
  return current;
};

const rebuildCaseProjectionFromEvents = (events = [], seed = {}) =>
  (Array.isArray(events) ? events : []).reduce((projection, event) => applyCommandToProjection(projection, event), {
    stage: "open",
    lifecycleStatus: "active",
    pauseStatus: "none",
    financialStatus: "unknown",
    savedAt: null,
    churnedAt: null,
    scheduledServiceEndAt: null,
    ...(seed && typeof seed === "object" ? seed : {}),
  });

module.exports = {
  SAO_PAULO_TIME_ZONE,
  LIFECYCLE_STATUSES,
  PAUSE_STATUSES,
  FINANCIAL_STATUSES,
  COMMAND_CAPABILITY,
  OVERRIDE_REQUIRED_COMMANDS,
  normalizeLifecycleStatus,
  normalizePauseStatus,
  normalizeFinancialStatus,
  computeScheduledServiceEndAt,
  formatMrrDisplay,
  buildIdempotencyKey,
  buildCommandPayload,
  needsOverrideJustification,
  sanitizePayloadByCommand,
  buildCommandFingerprint,
  normalizeRetentionRow,
  buildQueuesFromCases,
  getRetentionTimelineEventLabel,
  applyCommandToProjection,
  rebuildCaseProjectionFromEvents,
};
