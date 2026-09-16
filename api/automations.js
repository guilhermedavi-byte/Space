const { readJsonBody, sendJson } = require("./_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { supabaseFetch } = require("./_lib/supabase-rest");
const { validateGraph } = require("./_lib/automation-engine");
const { automationCatalog } = require("./_lib/automation-registries");

const clean = (value) => String(value || "").trim();
const enc = (value) => encodeURIComponent(clean(value));

const defaultGraph = ({ pipelineId = "", stageId = "" } = {}) => ({
  nodes: [
    { id: "trigger_1", type: "trigger", triggerType: "attendance.message.created" },
    { id: "condition_1", type: "condition", conditionType: "crm.contactHasOpenOpportunity" },
    { id: "action_1", type: "action", actionType: "crm.createOpportunity", config: { pipelineId, stageId } },
    { id: "end_1", type: "end" },
  ],
  edges: [
    { from: "trigger_1", to: "condition_1" },
    { from: "condition_1", to: "end_1", branch: "true" },
    { from: "condition_1", to: "action_1", branch: "false" },
    { from: "action_1", to: "end_1" },
  ],
});

const trigger = { type: "attendance.message.created", eventType: "attendance.message.created", label: "Nova mensagem recebida" };

const requireAdmin = async (req, res) => {
  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[automations]" });
  if (!auth.ok) {
    sendJson(res, auth.status, auth.body);
    return null;
  }
  if (String(auth.session?.role || "") !== "admin") {
    sendJson(res, 403, { error: "forbidden" });
    return null;
  }
  return auth.session;
};

const request = (path, options) => supabaseFetch(path, options);

const metricsForRuns = (runs = []) => {
  const totalRuns = runs.length;
  const successRuns = runs.filter((run) => run.status === "SUCCESS").length;
  const failedRuns = runs.filter((run) => run.status === "FAILED").length;
  return {
    totalRuns,
    successRuns,
    failedRuns,
    successRate: totalRuns ? Math.round((successRuns / totalRuns) * 1000) / 10 : 0,
    lastRunAt: runs.map((run) => run.created_at || run.started_at || "").filter(Boolean).sort().pop() || null,
  };
};

const listAutomations = async () => {
  const [{ data: automations }, { data: runs }] = await Promise.all([
    request("/automations?select=*,active_version:automation_versions!automations_active_version_fk(id,version_number,status),draft_version:automation_versions!automations_draft_version_fk(id,version_number,status)&order=created_at.desc"),
    request("/automation_runs?select=id,automation_id,status,created_at,started_at&order=created_at.desc&limit=1000"),
  ]);
  return (Array.isArray(automations) ? automations : []).map((automation) => ({
    ...automation,
    metrics: metricsForRuns((Array.isArray(runs) ? runs : []).filter((run) => run.automation_id === automation.id)),
  }));
};

const getAutomation = async (id) => {
  const { data } = await request(`/automations?id=eq.${enc(id)}&select=*,active_version:automation_versions!automations_active_version_fk(*),draft_version:automation_versions!automations_draft_version_fk(*)&limit=1`);
  return Array.isArray(data) ? data[0] || null : null;
};

const createAutomation = async (session, body = {}) => {
  const name = clean(body.name) || "Nova mensagem → Criar oportunidade";
  const graph = body.graph && typeof body.graph === "object" ? body.graph : defaultGraph(body);
  const validation = validateGraph(graph);
  if (!validation.ok) return { status: 422, body: { error: "invalid_graph", details: validation.errors } };
  const created = await request("/automations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{ name, description: clean(body.description), status: "DRAFT", trigger_type: "attendance.message.created", created_by_uid: session.sub, updated_by_uid: session.sub }],
  });
  const automation = Array.isArray(created.data) ? created.data[0] : null;
  if (!automation) return { status: 500, body: { error: "automation_create_failed" } };
  const versionResult = await request("/automation_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{ automation_id: automation.id, version_number: 1, status: "DRAFT", graph, trigger, created_by_uid: session.sub }],
  });
  const version = Array.isArray(versionResult.data) ? versionResult.data[0] : null;
  await request(`/automations?id=eq.${enc(automation.id)}`, { method: "PATCH", body: { draft_version_id: version?.id || null, updated_by_uid: session.sub } });
  return { status: 201, body: { ok: true, automationId: automation.id, versionId: version?.id || null } };
};

const updateDraft = async (session, id, body = {}) => {
  const automation = await getAutomation(id);
  if (!automation) return { status: 404, body: { error: "automation_not_found" } };
  const draft = automation.draft_version;
  if (!draft || draft.status !== "DRAFT") return { status: 409, body: { error: "draft_not_found" } };
  if (body.baseUpdatedAt && automation.updated_at && clean(body.baseUpdatedAt) !== clean(automation.updated_at)) {
    return { status: 409, body: { error: "automation_draft_conflict", updatedAt: automation.updated_at } };
  }
  const graph = body.graph && typeof body.graph === "object" ? body.graph : draft.graph;
  if (body.allowInvalidDraft !== true) {
    const validation = validateGraph(graph);
    if (!validation.ok) return { status: 422, body: { error: "invalid_graph", details: validation.errors } };
  }
  await request(`/automation_versions?id=eq.${enc(draft.id)}`, { method: "PATCH", body: { graph, trigger } });
  const patch = {};
  if (body.name !== undefined) patch.name = clean(body.name);
  if (body.description !== undefined) patch.description = clean(body.description);
  const updated = await request(`/automations?id=eq.${enc(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { ...patch, updated_by_uid: session.sub },
  });
  const updatedAutomation = Array.isArray(updated.data) ? updated.data[0] : null;
  return { status: 200, body: { ok: true, updatedAt: updatedAutomation?.updated_at || null } };
};

const createNextDraft = async (session, id) => {
  const automation = await getAutomation(id);
  if (!automation) return { status: 404, body: { error: "automation_not_found" } };
  if (automation.draft_version?.status === "DRAFT") return { status: 200, body: { ok: true, versionId: automation.draft_version.id } };
  const base = automation.active_version || automation.draft_version;
  const nextNumber = Number(base?.version_number || 0) + 1;
  const result = await request("/automation_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{ automation_id: id, version_number: nextNumber, status: "DRAFT", graph: base?.graph || defaultGraph(), trigger, created_by_uid: session.sub }],
  });
  const version = Array.isArray(result.data) ? result.data[0] : null;
  await request(`/automations?id=eq.${enc(id)}`, { method: "PATCH", body: { draft_version_id: version?.id || null, status: automation.status === "ARCHIVED" ? "DRAFT" : automation.status, updated_by_uid: session.sub } });
  return { status: 201, body: { ok: true, versionId: version?.id || null } };
};

const publish = async (session, id) => {
  const automation = await getAutomation(id);
  if (!automation?.draft_version) return { status: 404, body: { error: "draft_not_found" } };
  const draft = automation.draft_version;
  const validation = validateGraph(draft.graph);
  if (!validation.ok) return { status: 422, body: { error: "invalid_graph", details: validation.errors } };
  if (automation.active_version_id) {
    await request(`/automation_versions?id=eq.${enc(automation.active_version_id)}`, { method: "PATCH", body: { status: "ARCHIVED" } });
  }
  await request(`/automation_versions?id=eq.${enc(draft.id)}`, { method: "PATCH", body: { status: "ACTIVE", published_by_uid: session.sub, published_at: new Date().toISOString() } });
  await request(`/automations?id=eq.${enc(id)}`, { method: "PATCH", body: { status: "ACTIVE", active_version_id: draft.id, draft_version_id: null, updated_by_uid: session.sub } });
  return { status: 200, body: { ok: true, activeVersionId: draft.id } };
};

const pause = async (session, id) => {
  await request(`/automations?id=eq.${enc(id)}`, { method: "PATCH", body: { status: "PAUSED", updated_by_uid: session.sub } });
  return { status: 200, body: { ok: true } };
};

module.exports = async (req, res) => {
  const session = await requireAdmin(req, res);
  if (!session) return;
  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/automations", `https://${host}`);
  const id = clean(url.searchParams.get("id"));
  const resource = clean(url.searchParams.get("resource"));
  const action = clean(url.searchParams.get("action"));

  try {
    if (req.method === "GET") {
      if (resource === "catalog") return sendJson(res, 200, { catalog: automationCatalog() });
      if (id && resource === "runs") {
        const runId = clean(url.searchParams.get("runId"));
        if (runId) {
          const [{ data: runs }, { data: steps }] = await Promise.all([
            request(`/automation_runs?id=eq.${enc(runId)}&automation_id=eq.${enc(id)}&select=*&limit=1`),
            request(`/automation_run_steps?run_id=eq.${enc(runId)}&select=*&order=created_at.asc`),
          ]);
          return sendJson(res, 200, { run: Array.isArray(runs) ? runs[0] || null : null, steps: Array.isArray(steps) ? steps : [] });
        }
        const { data } = await request(`/automation_runs?automation_id=eq.${enc(id)}&select=*&order=created_at.desc&limit=100`);
        return sendJson(res, 200, { rows: Array.isArray(data) ? data : [] });
      }
      if (id) return sendJson(res, 200, { automation: await getAutomation(id) });
      return sendJson(res, 200, { rows: await listAutomations() });
    }

    const body = await readJsonBody(req).catch(() => ({}));
    let result;
    if (req.method === "POST" && !id) result = await createAutomation(session, body);
    else if (req.method === "PATCH" && id) result = await updateDraft(session, id, body);
    else if (req.method === "POST" && id && action === "draft") result = await createNextDraft(session, id);
    else if (req.method === "POST" && id && action === "publish") result = await publish(session, id);
    else if (req.method === "POST" && id && action === "pause") result = await pause(session, id);
    else result = { status: 405, body: { error: "method_not_allowed" } };
    return sendJson(res, result.status, result.body);
  } catch (error) {
    console.error("[automations] api failed", { message: error?.message || "automation_api_failed" });
    return sendJson(res, error.status || 500, { error: error.message || "automation_api_failed" });
  }
};
