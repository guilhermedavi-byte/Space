const { createHash } = require("crypto");
const crmService = require("./crm-service");
const { normalizeEmail, normalizePhone } = require("./crm-identity");

const MAX_AUTOMATION_DEPTH = 4;

const triggers = new Map();
const conditions = new Map();
const actions = new Map();

const clean = (value) => String(value || "").trim();

const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value || {}), "utf8").digest("hex");

const registerTrigger = (entry) => {
  if (!entry?.type || !entry?.eventType || typeof entry.matches !== "function") throw new Error("invalid_trigger_registration");
  triggers.set(entry.type, entry);
};

const registerCondition = (entry) => {
  if (!entry?.type || typeof entry.execute !== "function") throw new Error("invalid_condition_registration");
  conditions.set(entry.type, entry);
};

const registerAction = (entry) => {
  if (!entry?.type || typeof entry.execute !== "function") throw new Error("invalid_action_registration");
  actions.set(entry.type, entry);
};

const getTrigger = (type) => triggers.get(clean(type));
const getCondition = (type) => conditions.get(clean(type));
const getAction = (type) => actions.get(clean(type));

const catalogEntry = (entry = {}, kind = "") => ({
  category: entry.category || (kind === "trigger" ? "Gatilhos" : kind === "condition" ? "Condições" : "Ações"),
  kind,
  type: clean(entry.type),
  label: clean(entry.label) || clean(entry.type),
  description: clean(entry.description || entry.eventType || entry.category || entry.type),
  configSchema: entry.configSchema || {},
});

const automationCatalog = () => [
  ...Array.from(triggers.values()).map((entry) => catalogEntry(entry, "trigger")),
  ...Array.from(conditions.values()).map((entry) => catalogEntry(entry, "condition")),
  ...Array.from(actions.values()).map((entry) => catalogEntry(entry, "action")),
  { category: "Fluxo", kind: "end", type: "end", label: "Fim", description: "Encerrar fluxo" },
];

const attendanceIdentityFromContext = (context = {}) => {
  const identity = context.attendance?.identity || {};
  const contact = context.attendance?.contact || {};
  return {
    phone: normalizePhone(identity.normalized_phone || identity.phone_raw || contact.phone || ""),
    email: normalizeEmail(identity.email || contact.email || ""),
    name: clean(contact.display_name || identity.display_name || "Lead WhatsApp") || "Lead WhatsApp",
  };
};

registerTrigger({
  type: "attendance.message.created",
  label: "Nova mensagem recebida",
  eventType: "attendance.message.created",
  validateConfig: () => true,
  matches: ({ event }) => clean(event?.event_type || event?.eventType) === "attendance.message.created",
});

registerCondition({
  type: "crm.contactHasOpenOpportunity",
  label: "Contato possui oportunidade aberta no CRM?",
  async execute({ context }) {
    const identity = attendanceIdentityFromContext(context);
    const result = await crmService.hasOpenOpportunityForContact(identity);
    return {
      matched: Boolean(result.matched),
      opportunityIds: (result.opportunities || []).map((row) => row.id).filter(Boolean),
      identity,
    };
  },
});

registerAction({
  type: "crm.createOpportunity",
  label: "Criar oportunidade",
  category: "CRM",
  configSchema: {
    pipelineId: { type: "crm.pipeline", required: true, label: "Pipeline" },
    stageId: { type: "crm.stage", required: true, dependsOn: "pipelineId", label: "Stage" },
  },
  validateInput(input = {}) {
    if (!clean(input.pipelineId)) throw Object.assign(new Error("automation_missing_pipeline"), { status: 422 });
    if (!clean(input.stageId)) throw Object.assign(new Error("automation_missing_stage"), { status: 422 });
    return true;
  },
  async execute({ context, config = {}, idempotencyKey }) {
    const identity = attendanceIdentityFromContext(context);
    const input = {
      name: identity.name,
      phone: identity.phone,
      email: identity.email,
      title: identity.name,
      source: "automation:attendance.message.created",
      pipelineId: config.pipelineId,
      stageId: config.stageId,
    };
    const requestFingerprint = fingerprint({ type: "crm.createOpportunity", input });
    const result = await crmService.createOpportunity({
      actorUid: "system:automation",
      input,
      idempotencyKey,
    });
    return { ...result, requestFingerprint, input };
  },
});

module.exports = {
  MAX_AUTOMATION_DEPTH,
  actions,
  conditions,
  fingerprint,
  getAction,
  getCondition,
  getTrigger,
  automationCatalog,
  registerAction,
  registerCondition,
  registerTrigger,
  triggers,
};
