const { readJsonBody, sendJson } = require("./_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { requireResolvedAdminPermission } = require("./_lib/admin-permissions");
const { supabaseFetch } = require("./_lib/supabase-rest");
const { validateGraph } = require("./_lib/automation-engine");
const { automationCatalog } = require("./_lib/automation-registries");
const { sanitizeJson } = require("./_lib/automation-store");
const {
  DRAFT_UNCONFIGURED_TRIGGER_TYPE,
  neutralTriggerGraph,
  triggerMetadataForGraph,
} = require("../src/automation-editor/graph-adapter.cjs");

const clean = (value) => String(value || "").trim();
const enc = (value) => encodeURIComponent(clean(value));

const defaultGraph = () => neutralTriggerGraph();

const invalidGraphBody = (validation) => ({
  error: "automation_graph_invalid",
  issues: validation.issues || [],
  details: validation.errors || [],
});

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
  const url = new URL(req.url || "/api/automations", `https://${String(req.headers.host || "localhost")}`);
  const action = clean(url.searchParams.get("action"));
  const permissionAction = req.method === "GET" ? "view" : req.method === "POST" && !clean(url.searchParams.get("id")) ? "create" : action === "publish" || action === "pause" ? "run" : "update";
  const perm = await requireResolvedAdminPermission(auth, `automations.flows.${permissionAction}`);
  if (!perm.ok) {
    sendJson(res, perm.status, perm.body);
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

const sequenceOfStep = (step = {}, index = 0) => {
  const seq = Number(step.input?.sequence || step.sequence_number || step.sequence);
  return Number.isFinite(seq) && seq > 0 ? seq : index + 1;
};

const sortedSteps = (steps = []) => (Array.isArray(steps) ? steps : [])
  .map((step, index) => ({ ...step, __sequence: sequenceOfStep(step, index), __index: index }))
  .sort((left, right) => left.__sequence - right.__sequence || String(left.created_at || "").localeCompare(String(right.created_at || "")) || left.__index - right.__index)
  .map(({ __sequence, __index, ...step }) => sanitizeJson(step));

const summarizeEvent = (event = null) => {
  if (!event) return null;
  return sanitizeJson({
    id: event.id,
    eventId: event.id,
    eventType: event.event_type,
    occurredAt: event.occurred_at || event.created_at,
    source: event.source,
    aggregateType: event.aggregate_type,
    aggregateId: event.aggregate_id,
    payload: event.payload || {},
  });
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

const getRunDetail = async (automationId, runId) => {
  const { data: runs } = await request(`/automation_runs?id=eq.${enc(runId)}&automation_id=eq.${enc(automationId)}&select=*&limit=1`);
  const run = Array.isArray(runs) ? runs[0] || null : null;
  if (!run) return null;
  const [{ data: versions }, { data: steps }, { data: events }] = await Promise.all([
    request(`/automation_versions?id=eq.${enc(run.automation_version_id)}&select=id,version_number,status,graph,trigger,published_at&limit=1`),
    request(`/automation_run_steps?run_id=eq.${enc(run.id)}&select=*&order=created_at.asc`),
    run.event_id ? request(`/domain_events?id=eq.${enc(run.event_id)}&select=id,event_type,source,aggregate_type,aggregate_id,payload,occurred_at,created_at&limit=1`).catch((error) => {
      console.error("[automations] run event load failed", { runId: run.id, message: error?.message || "event_load_failed" });
      return { data: [] };
    }) : Promise.resolve({ data: [] }),
  ]);
  const version = Array.isArray(versions) ? versions[0] || null : null;
  if (!version) console.error("[automations] run version missing", { runId: run.id, versionId: run.automation_version_id });
  return {
    run: sanitizeJson(run),
    version: version ? {
      id: version.id,
      versionNumber: version.version_number,
      status: version.status,
      graph: version.graph,
      trigger: version.trigger,
      publishedAt: version.published_at,
    } : null,
    steps: sortedSteps(steps),
    event: summarizeEvent(Array.isArray(events) ? events[0] || null : null),
  };
};

const createAutomation = async (session, body = {}) => {
  const name = clean(body.name) || "Automação sem título";
  const graph = body.graph && typeof body.graph === "object" ? body.graph : defaultGraph(body);
  const nextGraph = body.graph && typeof body.graph === "object"
    ? (await validateGraph(graph, { validateCrm: false })).graph
    : defaultGraph();
  const trigger = triggerMetadataForGraph(nextGraph);
  const created = await request("/automations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{
      name,
      description: clean(body.description),
      status: "DRAFT",
      trigger_type: trigger.type || DRAFT_UNCONFIGURED_TRIGGER_TYPE,
      created_by_uid: session.sub,
      updated_by_uid: session.sub,
    }],
  });
  const automation = Array.isArray(created.data) ? created.data[0] : null;
  if (!automation) return { status: 500, body: { error: "automation_create_failed" } };
  const versionResult = await request("/automation_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: [{ automation_id: automation.id, version_number: 1, status: "DRAFT", graph: nextGraph, trigger, created_by_uid: session.sub }],
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
  let nextGraph = graph;
  let trigger = triggerMetadataForGraph(nextGraph);
  if (body.allowInvalidDraft !== true) {
    const validation = await validateGraph(graph, { validateCrm: false });
    if (!validation.ok) return { status: 422, body: invalidGraphBody(validation) };
    nextGraph = validation.graph;
    trigger = triggerMetadataForGraph(nextGraph);
  }
  await request(`/automation_versions?id=eq.${enc(draft.id)}`, { method: "PATCH", body: { graph: nextGraph, trigger } });
  const patch = {};
  if (body.name !== undefined) patch.name = clean(body.name);
  if (body.description !== undefined) patch.description = clean(body.description);
  const updated = await request(`/automations?id=eq.${enc(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { ...patch, trigger_type: trigger.type || DRAFT_UNCONFIGURED_TRIGGER_TYPE, updated_by_uid: session.sub },
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
    body: [{
      automation_id: id,
      version_number: nextNumber,
      status: "DRAFT",
      graph: base?.graph || defaultGraph(),
      trigger: triggerMetadataForGraph(base?.graph || defaultGraph()),
      created_by_uid: session.sub,
    }],
  });
  const version = Array.isArray(result.data) ? result.data[0] : null;
  await request(`/automations?id=eq.${enc(id)}`, { method: "PATCH", body: { draft_version_id: version?.id || null, status: automation.status === "ARCHIVED" ? "DRAFT" : automation.status, updated_by_uid: session.sub } });
  return { status: 201, body: { ok: true, versionId: version?.id || null } };
};

const publish = async (session, id) => {
  const automation = await getAutomation(id);
  if (!automation?.draft_version) return { status: 404, body: { error: "draft_not_found" } };
  const draft = automation.draft_version;
  const validation = await validateGraph(draft.graph);
  if (!validation.ok) return { status: 422, body: invalidGraphBody(validation) };
  if (automation.active_version_id) {
    await request(`/automation_versions?id=eq.${enc(automation.active_version_id)}`, { method: "PATCH", body: { status: "ARCHIVED" } });
  }
  await request(`/automation_versions?id=eq.${enc(draft.id)}`, { method: "PATCH", body: { graph: validation.graph, status: "ACTIVE", published_by_uid: session.sub, published_at: new Date().toISOString() } });
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
      if (resource === "catalog" || action === "catalog") {
        const catalog = automationCatalog();
        return sendJson(res, 200, {
          catalog,
          triggers: catalog.filter((item) => item.kind === "trigger"),
          conditions: catalog.filter((item) => item.kind === "condition"),
          actions: catalog.filter((item) => item.kind === "action"),
        });
      }
      if (id && resource === "runs") {
        const runId = clean(url.searchParams.get("runId"));
        if (runId) {
          const detail = await getRunDetail(id, runId);
          if (!detail) return sendJson(res, 404, { error: "automation_run_not_found" });
          return sendJson(res, 200, detail);
        }
        const status = clean(url.searchParams.get("status")).toUpperCase();
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 50);
        const statusFilter = ["SUCCESS", "FAILED", "RUNNING", "PENDING", "CANCELLED"].includes(status) ? `&status=eq.${enc(status)}` : "";
        const { data } = await request(`/automation_runs?automation_id=eq.${enc(id)}${statusFilter}&select=*&order=created_at.desc&limit=${limit}`);
        const rows = Array.isArray(data) ? data : [];
        const versionIds = Array.from(new Set(rows.map((run) => clean(run.automation_version_id)).filter(Boolean)));
        let versionById = new Map();
        if (versionIds.length) {
          const { data: versions } = await request(`/automation_versions?id=in.(${versionIds.map(enc).join(",")})&select=id,version_number`);
          versionById = new Map((Array.isArray(versions) ? versions : []).map((version) => [version.id, version.version_number]));
        }
        return sendJson(res, 200, { rows: rows.map((run) => ({ ...run, version_number: versionById.get(run.automation_version_id) || null })) });
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
