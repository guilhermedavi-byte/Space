const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const automationsPath = require.resolve("../api/automations");
const authPath = require.resolve("../api/_lib/admin-request-auth");
const restPath = require.resolve("../api/_lib/supabase-rest");

const loadHandlerWithSupabase = (supabaseFetch) => {
  delete require.cache[automationsPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      resolveAdminRequestAuth: async () => ({ ok: true, session: { sub: "admin_uid", role: "admin" } }),
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

const invoke = (handler, { method = "GET", url = "/api/automations" } = {}) => new Promise((resolve) => {
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
  setImmediate(() => req.emit("end"));
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
