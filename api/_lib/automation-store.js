const { randomUUID } = require("crypto");
const { supabaseFetch } = require("./supabase-rest");

const clean = (value) => String(value || "").trim();
const enc = (value) => encodeURIComponent(clean(value));
const nowIso = () => new Date().toISOString();

const sanitizeJson = (value) => {
  if (value == null) return {};
  if (Array.isArray(value)) return value.map(sanitizeJson);
  if (typeof value !== "object") return value;
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/(token|secret|password|authorization|cookie|credential|api.?key)/i.test(key)) continue;
    out[key] = sanitizeJson(entry);
  }
  return out;
};

class AutomationStore {
  constructor({ request = supabaseFetch } = {}) {
    this.request = request;
  }

  async rpc(name, body = {}) {
    const { data } = await this.request(`/rpc/${enc(name)}`, { method: "POST", body });
    return data;
  }

  async importAttendanceOutbox(limit = 100) {
    return this.rpc("automation_import_attendance_outbox", { p_limit: limit });
  }

  async claimDomainEvent({ workerId = randomUUID() } = {}) {
    return this.rpc("automation_claim_domain_event", { p_worker_id: workerId });
  }

  async completeDomainEvent(eventId, leaseId) {
    return this.rpc("automation_complete_domain_event", { p_event_id: eventId, p_lease_id: leaseId });
  }

  async failDomainEvent(eventId, leaseId, error, retryable = true) {
    return this.rpc("automation_fail_domain_event", {
      p_event_id: eventId,
      p_lease_id: leaseId,
      p_error: clean(error).slice(0, 256) || "automation_failed",
      p_retryable: retryable,
    });
  }

  async listActiveVersionsForEvent(eventType) {
    const { data } = await this.request(
      `/automation_versions?select=*,automation:automations(*)&status=eq.ACTIVE&order=created_at.asc`
    );
    return (Array.isArray(data) ? data : []).filter((version) => {
      const automation = version.automation || {};
      if (automation.status !== "ACTIVE") return false;
      if (automation.active_version_id && automation.active_version_id !== version.id) return false;
      return clean(version.trigger?.eventType || version.trigger?.event_type || version.trigger?.type || automation.trigger_type) === clean(eventType);
    });
  }

  async createRun({ automationId, automationVersionId, eventId, eventType }) {
    const body = [{
      automation_id: automationId,
      automation_version_id: automationVersionId,
      event_id: eventId,
      event_type: eventType,
      status: "RUNNING",
      started_at: nowIso(),
    }];
    const response = await this.request("/automation_runs?on_conflict=automation_id,automation_version_id,event_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body,
    });
    if (Array.isArray(response.data) && response.data[0]) return response.data[0];
    const { data } = await this.request(
      `/automation_runs?automation_id=eq.${enc(automationId)}&automation_version_id=eq.${enc(automationVersionId)}&event_id=eq.${enc(eventId)}&limit=1`
    );
    return Array.isArray(data) ? data[0] || null : null;
  }

  async finishRun(runId, patch = {}) {
    const body = {
      ...patch,
      finished_at: patch.finished_at || nowIso(),
    };
    if (!body.duration_ms && body.started_at) body.duration_ms = Math.max(0, Date.parse(body.finished_at) - Date.parse(body.started_at));
    const { data } = await this.request(`/automation_runs?id=eq.${enc(runId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: sanitizeJson(body),
    });
    return Array.isArray(data) ? data[0] || null : null;
  }

  async restartRun(runId) {
    const { data } = await this.request(`/automation_runs?id=eq.${enc(runId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: {
        status: "RUNNING",
        current_node_id: null,
        error: null,
        started_at: nowIso(),
        finished_at: null,
      },
    });
    return Array.isArray(data) ? data[0] || null : null;
  }

  async upsertStep({ runId, nodeId, nodeType, actionType = null, status, attemptCount = 1, input = {}, output = {}, error = null, startedAt = null, finishedAt = null }) {
    const body = [{
      run_id: runId,
      node_id: nodeId,
      node_type: nodeType,
      action_type: actionType,
      status,
      attempt_count: attemptCount,
      input: sanitizeJson(input),
      output: sanitizeJson(output),
      error: error ? sanitizeJson(error) : null,
      started_at: startedAt || nowIso(),
      finished_at: finishedAt || (["SUCCESS", "FAILED", "SKIPPED"].includes(status) ? nowIso() : null),
    }];
    const { data } = await this.request("/automation_run_steps?on_conflict=run_id,node_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body,
    });
    return Array.isArray(data) ? data[0] || null : null;
  }

  async beginIdempotency({ key, automationId, automationVersionId, runId, nodeId, actionType, requestFingerprint }) {
    const body = [{
      key,
      automation_id: automationId,
      automation_version_id: automationVersionId,
      run_id: runId,
      node_id: nodeId,
      action_type: actionType,
      request_fingerprint: requestFingerprint,
      status: "STARTED",
      result: {},
    }];
    const response = await this.request("/automation_idempotency?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body,
    });
    if (Array.isArray(response.data) && response.data[0]) return { inserted: true, row: response.data[0] };
    const { data } = await this.request(`/automation_idempotency?key=eq.${enc(key)}&limit=1`);
    const row = Array.isArray(data) ? data[0] || null : null;
    if (row && row.request_fingerprint !== requestFingerprint) throw Object.assign(new Error("automation_idempotency_conflict"), { status: 409 });
    return { inserted: false, row };
  }

  async finishIdempotency(key, status, result = {}) {
    const { data } = await this.request(`/automation_idempotency?key=eq.${enc(key)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: { status, result: sanitizeJson(result), updated_at: nowIso() },
    });
    return Array.isArray(data) ? data[0] || null : null;
  }

  async getAttendanceMessageContext(event) {
    const payload = event.payload || {};
    const messageId = clean(payload.message_id || event.aggregate_id);
    const conversationId = clean(payload.conversation_id);
    if (!messageId) return { attendance: {} };
    return this.rpc("automation_get_attendance_message_context", {
      p_message_id: messageId,
      p_conversation_id: conversationId || null,
    });
  }
}

module.exports = {
  AutomationStore,
  sanitizeJson,
  createAutomationStore: (options) => new AutomationStore(options),
};
