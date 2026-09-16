const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const automationsPath = require.resolve("../api/automations");
const authPath = require.resolve("../api/_lib/admin-request-auth");
const restPath = require.resolve("../api/_lib/supabase-rest");

const loadHandlerWithSupabase = (supabaseFetch, { role = "admin" } = {}) => {
  delete require.cache[automationsPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      resolveAdminRequestAuth: async () => ({ ok: true, session: { sub: "admin_uid", role } }),
    },
  };
  require.cache[restPath] = {
    id: restPath,
    filename: restPath,
    loaded: true,
    exports: { supabaseFetch },
  };
  return require("../api/automations");
};

const invoke = (handler, { method = "GET", url = "/api/automations", body = null } = {}) => new Promise((resolve) => {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost" };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      resolve({ statusCode: this.statusCode, body: body ? JSON.parse(body) : null });
    },
  };
  handler(req, res);
  setImmediate(() => {
    if (body !== null) req.emit("data", JSON.stringify(body));
    req.emit("end");
  });
});

test("automations API creates draft with exactly one neutral trigger", async () => {
  const calls = [];
  const handler = loadHandlerWithSupabase(async (path, options = {}) => {
    calls.push({ path, options });
    if (path === "/automations" && options.method === "POST") {
      assert.equal(options.body[0].name, "Automação sem título");
      assert.equal(options.body[0].trigger_type, "draft.unconfigured");
      return { data: [{ id: "automation_new", updated_at: "2026-09-16T10:00:00.000Z" }] };
    }
    if (path === "/automation_versions" && options.method === "POST") {
      const graph = options.body[0].graph;
      assert.equal(graph.nodes.length, 1);
      assert.equal(graph.nodes[0].type, "trigger");
      assert.equal(graph.nodes[0].triggerType, "");
      assert.equal(graph.edges.length, 0);
      assert.deepEqual(options.body[0].trigger, {});
      return { data: [{ id: "version_new" }] };
    }
    if (path.startsWith("/automations?id=eq.automation_new") && options.method === "PATCH") return { data: [] };
    throw new Error(`unexpected_path:${path}`);
  });

  const res = await invoke(handler, { method: "POST" });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.automationId, "automation_new");
  assert.equal(calls.length, 3);
});

test("automations API allows incomplete draft save but publish rejects neutral trigger", async () => {
  const neutral = {
    schemaVersion: 1,
    nodes: [{ id: "trigger_1", type: "trigger", triggerType: "", config: {}, position: { x: 360, y: 180 } }],
    edges: [],
  };
  const handler = loadHandlerWithSupabase(async (path, options = {}) => {
    if (path.startsWith("/automations?id=eq.automation_1") && !options.method) {
      return {
        data: [{
          id: "automation_1",
          updated_at: "2026-09-16T10:00:00.000Z",
          draft_version: { id: "version_1", status: "DRAFT", graph: neutral },
        }],
      };
    }
    if (path.startsWith("/automation_versions?id=eq.version_1") && options.method === "PATCH") {
      assert.deepEqual(options.body.graph, neutral);
      assert.deepEqual(options.body.trigger, {});
      return { data: [] };
    }
    if (path.startsWith("/automations?id=eq.automation_1") && options.method === "PATCH") {
      assert.equal(options.body.trigger_type, "draft.unconfigured");
      return { data: [{ updated_at: "2026-09-16T10:00:01.000Z" }] };
    }
    throw new Error(`unexpected_path:${path}`);
  });

  const draftRes = await invoke(handler, { method: "PATCH", url: "/api/automations?id=automation_1", body: { graph: neutral, allowInvalidDraft: true } });
  assert.equal(draftRes.statusCode, 200);
  const publishRes = await invoke(handler, { method: "POST", url: "/api/automations?id=automation_1&action=publish" });
  assert.equal(publishRes.statusCode, 422);
  assert.equal(publishRes.body.issues.some((issue) => issue.code === "trigger_not_configured" && issue.nodeId === "trigger_1"), true);
});

test("automations API publish returns structured graph validation issues", async () => {
  const handler = loadHandlerWithSupabase(async (path) => {
    if (path.startsWith("/automations?id=eq.automation_1")) {
      return {
        data: [{
          id: "automation_1",
          status: "DRAFT",
          trigger_type: "attendance.message.created",
          draft_version: {
            id: "version_1",
            status: "DRAFT",
            graph: {
              schemaVersion: 1,
              nodes: [
                { id: "trigger_1", type: "trigger", triggerType: "attendance.message.created" },
                { id: "condition_1", type: "condition", conditionType: "crm.contactHasOpenOpportunity" },
                { id: "end_1", type: "end" },
              ],
              edges: [
                { id: "e1", from: "trigger_1", to: "condition_1" },
                { id: "e2", from: "condition_1", to: "end_1", branch: "true" },
              ],
            },
          },
        }],
      };
    }
    throw new Error(`unexpected_path:${path}`);
  });

  const res = await invoke(handler, { method: "POST", url: "/api/automations?id=automation_1&action=publish" });
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.error, "automation_graph_invalid");
  assert.equal(Array.isArray(res.body.issues), true);
  assert.equal(res.body.issues.some((issue) => issue.code === "missing_condition_false_edge" && issue.nodeId === "condition_1"), true);
});

test("automations API exposes registry catalog without executor internals", async () => {
  const handler = loadHandlerWithSupabase(async () => {
    throw new Error("catalog_should_not_query_supabase");
  });
  const res = await invoke(handler, { method: "GET", url: "/api/automations?action=catalog" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.triggers.some((item) => item.type === "attendance.message.created"), true);
  assert.equal(res.body.actions.some((item) => item.type === "crm.createOpportunity" && item.execute === undefined), true);
  assert.equal(res.body.actions.some((item) => item.configSchema?.pipelineId?.required === true), true);
});

test("automations API run detail returns historical version graph, ordered steps and sanitized event", async () => {
  const calls = [];
  const handler = loadHandlerWithSupabase(async (path) => {
    calls.push(path);
    if (path.startsWith("/automation_runs?id=eq.run_v1")) {
      return { data: [{ id: "run_v1", automation_id: "automation_1", automation_version_id: "version_v1", event_id: "event_1", status: "SUCCESS", event_type: "attendance.message.created" }] };
    }
    if (path.startsWith("/automation_versions?id=eq.version_v1")) {
      return { data: [{ id: "version_v1", version_number: 1, status: "ACTIVE", graph: { nodes: [{ id: "trigger_1", type: "trigger" }, { id: "end_1", type: "end" }], edges: [{ id: "edge_v1", from: "trigger_1", to: "end_1" }] }, trigger: {} }] };
    }
    if (path.startsWith("/automation_run_steps?run_id=eq.run_v1")) {
      return { data: [
        { id: "step_2", run_id: "run_v1", node_id: "end_1", status: "SUCCESS", input: { sequence: 2 }, output: {} },
        { id: "step_1", run_id: "run_v1", node_id: "trigger_1", status: "SUCCESS", input: { sequence: 1, Authorization: "Bearer secret", Cookie: "sid=secret" }, output: { access_token: "hidden", ok: true } },
      ] };
    }
    if (path.startsWith("/domain_events?id=eq.event_1")) {
      return { data: [{ id: "event_1", event_type: "attendance.message.created", source: "attendance", aggregate_type: "message", aggregate_id: "msg_1", payload: { text: "oi", refresh_token: "secret" }, occurred_at: "2026-09-16T10:00:00.000Z" }] };
    }
    throw new Error(`unexpected_path:${path}`);
  });

  const res = await invoke(handler, { method: "GET", url: "/api/automations?id=automation_1&resource=runs&runId=run_v1" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.version.versionNumber, 1);
  assert.equal(res.body.version.graph.edges[0].id, "edge_v1");
  assert.deepEqual(res.body.steps.map((step) => step.node_id), ["trigger_1", "end_1"]);
  assert.equal(res.body.steps[0].input.Authorization, undefined);
  assert.equal(res.body.steps[0].input.Cookie, undefined);
  assert.equal(res.body.steps[0].output.access_token, undefined);
  assert.equal(res.body.event.payload.refresh_token, undefined);
  assert.equal(calls.some((path) => path.includes("version_v1")), true);
});

test("automations API rejects non-admin access", async () => {
  const handler = loadHandlerWithSupabase(async () => ({ data: [] }), { role: "growth" });
  const res = await invoke(handler, { method: "GET", url: "/api/automations?id=automation_1&resource=runs" });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, "forbidden");
});
