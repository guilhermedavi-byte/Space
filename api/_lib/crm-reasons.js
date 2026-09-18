const SDR_DISCARD_REASONS = [
  ["no_fit", "Sem fit"],
  ["financial", "Sem condição financeira"],
  ["low_pain", "Dor insuficiente"],
  ["low_urgency", "Baixa urgência"],
  ["timing", "Momento inadequado"],
  ["decision_authority", "Sem autonomia para decisão"],
  ["no_response", "Sem resposta"],
  ["not_interested", "Sem interesse"],
  ["duplicate", "Lead duplicado"],
  ["invalid_contact", "Contato inválido"],
  ["other", "Outro"],
];

const CLOSER_LOST_REASONS = [
  ["price", "Preço"],
  ["financial", "Sem condição financeira"],
  ["timing", "Momento inadequado"],
  ["no_response", "Sem resposta"],
  ["competitor", "Concorrente"],
  ["decision_authority", "Sem autonomia para decisão"],
  ["no_need", "Sem necessidade percebida"],
  ["expectation_mismatch", "Expectativa desalinhada"],
  ["lost_to_other_solution", "Escolheu outra solução"],
  ["other", "Outro"],
];

const CLOSER_LOST_LEGACY_LABELS = {
  not_qualified: "Não qualificado",
  payment: "Pagamento",
};

const clean = (value) => String(value || "").trim();

const asMap = (rows) => new Map(rows.map(([value, label]) => [value, label]));
const sdrReasonMap = asMap(SDR_DISCARD_REASONS);
const closerReasonMap = asMap(CLOSER_LOST_REASONS);

const sdrDiscardReasonLabel = (reason) => sdrReasonMap.get(clean(reason)) || clean(reason);
const closerLostReasonLabel = (reason) => closerReasonMap.get(clean(reason)) || CLOSER_LOST_LEGACY_LABELS[clean(reason)] || clean(reason);

const isValidSdrDiscardReason = (reason) => sdrReasonMap.has(clean(reason));
const isValidCloserLostReason = (reason) => closerReasonMap.has(clean(reason)) || Object.prototype.hasOwnProperty.call(CLOSER_LOST_LEGACY_LABELS, clean(reason));

const rankedReasonDistribution = (rows = [], { getReason, labelForReason, limit = 5 } = {}) => {
  const counts = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const reason = clean(typeof getReason === "function" ? getReason(row) : row?.reason);
    if (!reason) return;
    counts.set(reason, (counts.get(reason) || 0) + 1);
  });
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const items = Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason,
      label: typeof labelForReason === "function" ? labelForReason(reason) : reason,
      count,
      percentage: total ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "pt-BR"))
    .slice(0, Math.max(1, Number(limit) || 5));
  return { total, items };
};

const eventTimestamp = (event, ...payloadKeys) => {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const raw = payloadKeys.map((key) => payload[key]).find((value) => clean(value)) || event?.createdAt || event?.stamp || "";
  const date = raw instanceof Date ? raw : new Date(String(raw || ""));
  return Number.isNaN(date.getTime()) ? null : date;
};

const isEventInPeriod = (event, period, ...payloadKeys) => {
  const date = eventTimestamp(event, ...payloadKeys);
  if (!date || !period?.startDateKey || !period?.endDateKey) return false;
  const key = date.toISOString().slice(0, 10);
  return key >= period.startDateKey && key <= period.endDateKey;
};

const buildStructuredReasonRankingsFromEvents = (events = [], { period } = {}) => {
  const rows = Array.isArray(events) ? events : [];
  const discarded = rows.filter((event) => {
    if (clean(event?.type) !== "crm.opportunity.discarded") return false;
    return isEventInPeriod(event, period, "discardedAt");
  });
  const lost = rows.filter((event) => {
    if (clean(event?.type) !== "crm.opportunity.lost") return false;
    return isEventInPeriod(event, period, "closedAt");
  });
  return {
    sdr: rankedReasonDistribution(discarded, {
      getReason: (event) => event?.payload?.discardReason || event?.payload?.discardedReason,
      labelForReason: sdrDiscardReasonLabel,
      limit: 5,
    }),
    closer: rankedReasonDistribution(lost, {
      getReason: (event) => event?.payload?.lostReason,
      labelForReason: closerLostReasonLabel,
      limit: 5,
    }),
  };
};

module.exports = {
  buildStructuredReasonRankingsFromEvents,
  CLOSER_LOST_LEGACY_LABELS,
  CLOSER_LOST_REASONS,
  SDR_DISCARD_REASONS,
  closerLostReasonLabel,
  isValidCloserLostReason,
  isValidSdrDiscardReason,
  rankedReasonDistribution,
  sdrDiscardReasonLabel,
};
