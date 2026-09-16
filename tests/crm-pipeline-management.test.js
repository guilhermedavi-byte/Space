const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const loadCrmHandler = (initialStore = {}, { role = "admin" } = {}) => {
  const store = new Map(Object.entries(initialStore));
  const commits = [];
  const paths = [
    "../api/crm",
    "../api/_lib/firestore-admin",
    "../api/_lib/firestore-rest",
    "../api/_lib/crm-service",
    "../_lib/session",
  ];
  paths.forEach((path) => {
    try {
      delete require.cache[require.resolve(path)];
    } catch {}
  });
  require.cache[require.resolve("../_lib/session")] = {
    exports: {
      getSessionFromRequest: () => ({ sub: `${role}_user`, role, name: role === "admin" ? "Admin" : "Growth" }),
    },
  };
  require.cache[require.resolve("../api/_lib/firestore-rest")] = {
    exports: {
      PROJECT_ID: "space-test",
      encodeFields: (data) => ({ fields: data }),
    },
  };
  require.cache[require.resolve("../api/_lib/crm-service")] = {
    exports: {
      createOpportunity: async () => ({ opportunityId: "unused" }),
      loadCrmListModel: async () => ({ rows: [] }),
      loadCrmReadModel: async () => ({ pipelines: [], stages: [], contacts: [], opportunities: [], owners: [] }),
    },
  };
  require.cache[require.resolve("../api/_lib/firestore-admin")] = {
    exports: {
      getDocumentAsAdmin: async (path) => {
        const row = store.get(decodeURIComponent(path));
        if (!row) {
          const error = new Error("not_found");
          error.status = 404;
          throw error;
        }
        return row;
      },
      listCollectionAsAdmin: async (collection) =>
        Array.from(store.entries())
          .filter(([key]) => key.startsWith(`${collection}/`))
          .map(([key, value]) => ({ firestoreDocId: key.split("/")[1], ...value })),
      commitWritesAsAdmin: async ({ writes }) => {
        commits.push(writes);
        writes.forEach((write) => {
          const rawName = String(write.update?.name || write.delete || "");
          const parts = rawName.split("/documents/")[1].split("/");
          const key = `${parts[0]}/${decodeURIComponent(parts[1])}`;
          if (write.delete) store.delete(key);
          else store.set(key, write.update.fields);
        });
        return { ok: true, status: 200 };
      },
    },
  };
  return { handler: require("../api/crm"), store, commits };
};

const invoke = async (handler, body) => {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.url = "/api/crm";
  req.headers = { host: "localhost" };
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(payload) {
      this.body = payload ? JSON.parse(payload) : {};
    },
  };
  await handler(req, res);
  return { status: res.statusCode, body: res.body };
};

const pipeline = (id, patch = {}) => ({
  id,
  scopeId: "space-main",
  name: id === "commercial" ? "Comercial" : id,
  isActive: true,
  isDefault: false,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
  ...patch,
});

const stage = (id, pipelineId, position, patch = {}) => ({
  id,
  scopeId: "space-main",
  pipelineId,
  name: `Etapa ${position}`,
  position,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
  ...patch,
});

const opportunity = (id, pipelineId, stageId, patch = {}) => ({
  id,
  scopeId: "space-main",
  contactId: `contact_${id}`,
  pipelineId,
  stageId,
  title: "Lead",
  value: 1000,
  currency: "BRL",
  ownerId: "admin_user",
  source: "Instagram",
  status: "open",
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
  ...patch,
});

test("admin creates pipeline with stages and can make it the only default", async () => {
  const { handler, store, commits } = loadCrmHandler({
    "crmPipelines/commercial": pipeline("commercial", { isDefault: true }),
    "crmStages/stage_1": stage("stage_1", "commercial", 1),
  });

  const res = await invoke(handler, {
    action: "create_pipeline",
    name: "Enterprise",
    isDefault: true,
    stages: ["Prospecção", "Diagnóstico"],
  });

  assert.equal(res.status, 201);
  const newPipeline = Array.from(store.values()).find((row) => row.name === "Enterprise");
  assert.equal(newPipeline.isDefault, true);
  assert.equal(store.get("crmPipelines/commercial").isDefault, false);
  assert.equal(Array.from(store.values()).filter((row) => row.pipelineId === res.body.pipelineId).length, 2);
  assert.ok(commits.at(-1).some((write) => write.update.fields.type === "crm.pipeline.created"));
});

test("stage reorder requires the exact current stage set and persists positions", async () => {
  const { handler, store } = loadCrmHandler({
    "crmPipelines/commercial": pipeline("commercial", { isDefault: true }),
    "crmStages/stage_1": stage("stage_1", "commercial", 1),
    "crmStages/stage_2": stage("stage_2", "commercial", 2),
    "crmStages/stage_3": stage("stage_3", "commercial", 3),
  });

  const invalid = await invoke(handler, { action: "reorder_stages", pipelineId: "commercial", stageIds: ["stage_2", "stage_1"] });
  assert.equal(invalid.status, 400);

  const res = await invoke(handler, { action: "reorder_stages", pipelineId: "commercial", stageIds: ["stage_3", "stage_1", "stage_2"] });
  assert.equal(res.status, 200);
  assert.equal(store.get("crmStages/stage_3").position, 1);
  assert.equal(store.get("crmStages/stage_1").position, 2);
  assert.equal(store.get("crmStages/stage_2").position, 3);
});

test("stage delete is blocked when opportunities exist in the stage", async () => {
  const { handler } = loadCrmHandler({
    "crmPipelines/commercial": pipeline("commercial", { isDefault: true }),
    "crmStages/stage_1": stage("stage_1", "commercial", 1),
    "crmStages/stage_2": stage("stage_2", "commercial", 2),
    "crmOpportunities/opp_1": opportunity("opp_1", "commercial", "stage_2"),
  });

  const res = await invoke(handler, { action: "delete_stage", id: "stage_2" });

  assert.equal(res.status, 409);
  assert.equal(res.body.error, "stage_has_opportunities");
  assert.equal(res.body.opportunityCount, 1);
});

test("pipeline deactivation is blocked for default and pipelines with open opportunities", async () => {
  const { handler } = loadCrmHandler({
    "crmPipelines/commercial": pipeline("commercial", { isDefault: true }),
    "crmPipelines/outbound": pipeline("outbound", { name: "Outbound" }),
    "crmStages/stage_1": stage("stage_1", "commercial", 1),
    "crmStages/stage_2": stage("stage_2", "outbound", 1),
    "crmOpportunities/opp_1": opportunity("opp_1", "outbound", "stage_2"),
  });

  const defaultBlocked = await invoke(handler, { action: "deactivate_pipeline", id: "commercial" });
  assert.equal(defaultBlocked.status, 409);
  assert.equal(defaultBlocked.body.error, "default_pipeline_cannot_deactivate");

  const openBlocked = await invoke(handler, { action: "deactivate_pipeline", id: "outbound" });
  assert.equal(openBlocked.status, 409);
  assert.equal(openBlocked.body.error, "pipeline_has_open_opportunities");
  assert.equal(openBlocked.body.openCount, 1);
});

test("set_default_pipeline makes only an active pipeline default", async () => {
  const { handler, store } = loadCrmHandler({
    "crmPipelines/commercial": pipeline("commercial", { isDefault: true }),
    "crmPipelines/outbound": pipeline("outbound", { name: "Outbound" }),
  });

  const res = await invoke(handler, { action: "set_default_pipeline", id: "outbound" });

  assert.equal(res.status, 200);
  assert.equal(store.get("crmPipelines/outbound").isDefault, true);
  assert.equal(store.get("crmPipelines/commercial").isDefault, false);
});

test("growth role can access CRM but cannot manage pipeline structure", async () => {
  const { handler } = loadCrmHandler({
    "crmPipelines/commercial": pipeline("commercial", { isDefault: true }),
  }, { role: "growth" });

  const res = await invoke(handler, { action: "create_pipeline", name: "Growth forged" });

  assert.equal(res.status, 403);
  assert.equal(res.body.error, "admin_required");
});
