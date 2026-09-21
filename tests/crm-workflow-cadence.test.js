const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const loadCrmHandler = (initialStore = {}, session = { sub: "admin_user", role: "admin", name: "Admin" }) => {
  const store = new Map(Object.entries(initialStore));
  const commits = [];
  [
    "../api/crm",
    "../api/_lib/firestore-admin",
    "../api/_lib/firestore-rest",
    "../api/_lib/crm-service",
    "../_lib/session",
  ].forEach((path) => {
    try { delete require.cache[require.resolve(path)]; } catch {}
  });
  require.cache[require.resolve("../_lib/session")] = { exports: { getSessionFromRequest: () => session } };
  require.cache[require.resolve("../api/_lib/firestore-rest")] = {
    exports: { PROJECT_ID: "space-test", encodeFields: (data) => ({ fields: data }) },
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
        if (!row) throw Object.assign(new Error("not_found"), { status: 404 });
        return row;
      },
      listCollectionAsAdmin: async (collection) =>
        Array.from(store.entries())
          .filter(([key]) => key.startsWith(`${collection}/`))
          .map(([key, value]) => ({ firestoreDocId: key.split("/")[1], ...value })),
      queryCollectionByFieldAsAdmin: async (collection, { field, value }) =>
        Array.from(store.entries())
          .filter(([key]) => key.startsWith(`${collection}/`))
          .map(([key, row]) => ({ firestoreDocId: key.split("/")[1], ...row }))
          .filter((row) => row[field] === value),
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

const invoke = async (handler, body, method = "POST", url = "/api/crm") => {
  const req = method === "POST" ? Readable.from([Buffer.from(JSON.stringify(body))]) : Readable.from([]);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost" };
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    end(payload) { this.body = payload ? JSON.parse(payload) : {}; },
  };
  await handler(req, res);
  return { status: res.statusCode, body: res.body };
};

const baseStore = () => ({
  "users/user_sdr": { id: "user_sdr", uid: "user_sdr", role: "growth", tipo: "growth", commercialRoles: ["sdr"], nome: "SDR" },
  "crmPipelines/pipe_sdr": { id: "pipe_sdr", scopeId: "space-main", name: "Pipeline SDR", pipelineType: "sdr", isActive: true },
  "crmStages/stage_new": { id: "stage_new", scopeId: "space-main", pipelineId: "pipe_sdr", name: "Novo lead", position: 1 },
  "crmStages/stage_meeting": { id: "stage_meeting", scopeId: "space-main", pipelineId: "pipe_sdr", name: "Reunião", position: 2 },
  "crmOpportunities/opp_1": {
    id: "opp_1",
    scopeId: "space-main",
    contactId: "contact_1",
    pipelineId: "pipe_sdr",
    stageId: "stage_meeting",
    title: "Lead",
    ownerId: "user_sdr",
    status: "open",
    createdAt: "2026-09-21T12:00:00.000Z",
    updatedAt: "2026-09-21T12:00:00.000Z",
  },
});

const workflowPayload = (patch = {}) => ({
  action: "save_crm_workflow",
  name: "Cadência Novo Lead SDR",
  workspaceType: "sdr",
  pipelineId: "pipe_sdr",
  triggerStageId: "stage_new",
  steps: [
    { activityType: "call", title: "Ligação 01", delayUnit: "immediate", delayAmount: 0 },
    { activityType: "call", title: "Ligação 02", delayUnit: "days", delayAmount: 1 },
    { activityType: "call", title: "Ligação 03", delayUnit: "days", delayAmount: 3 },
  ],
  ...patch,
});

const seedPublishedWorkflow = () => ({
  "crmWorkflows/workflow_1": {
    id: "workflow_1",
    scopeId: "space-main",
    name: "Cadência Novo Lead SDR",
    pipelineId: "pipe_sdr",
    triggerStageId: "stage_new",
    workspaceType: "sdr",
    isActive: true,
    activeVersionId: "wfver_1",
    version: 1,
    createdAt: "2026-09-21T12:00:00.000Z",
    updatedAt: "2026-09-21T12:00:00.000Z",
  },
  "crmWorkflowVersions/wfver_1": {
    id: "wfver_1",
    scopeId: "space-main",
    workflowId: "workflow_1",
    versionNumber: 1,
    status: "published",
    publishedAt: "2026-09-21T12:00:00.000Z",
    createdAt: "2026-09-21T12:00:00.000Z",
    updatedAt: "2026-09-21T12:00:00.000Z",
  },
  "crmWorkflowSteps/wfstep_1": { id: "wfstep_1", scopeId: "space-main", workflowId: "workflow_1", versionId: "wfver_1", position: 1, activityType: "call", title: "Ligação 01", delayUnit: "immediate", delayAmount: 0, assignedRole: "owner" },
  "crmWorkflowSteps/wfstep_2": { id: "wfstep_2", scopeId: "space-main", workflowId: "workflow_1", versionId: "wfver_1", position: 2, activityType: "call", title: "Ligação 02", delayUnit: "days", delayAmount: 1, assignedRole: "owner" },
  "crmWorkflowSteps/wfstep_3": { id: "wfstep_3", scopeId: "space-main", workflowId: "workflow_1", versionId: "wfver_1", position: 3, activityType: "follow_up", title: "Follow-up", delayUnit: "days", delayAmount: 3, assignedRole: "owner" },
});

test("admin saves and publishes workflow versions; non-admin config is blocked", async () => {
  const { handler, store } = loadCrmHandler(baseStore());
  const saved = await invoke(handler, workflowPayload());
  assert.equal(saved.status, 200);
  const workflowId = saved.body.workflowId;
  const versionId = saved.body.versionId;
  assert.equal(store.get(`crmWorkflows/${workflowId}`).isActive, false);
  assert.equal(store.get(`crmWorkflowVersions/${versionId}`).status, "draft");

  const published = await invoke(handler, { action: "publish_crm_workflow", versionId });
  assert.equal(published.status, 200);
  assert.equal(store.get(`crmWorkflows/${workflowId}`).isActive, true);
  assert.equal(store.get(`crmWorkflowVersions/${versionId}`).status, "published");

  const nonAdmin = loadCrmHandler(baseStore(), { sub: "user_sdr", role: "growth", name: "SDR" });
  const blocked = await invoke(nonAdmin.handler, workflowPayload());
  assert.equal(blocked.status, 403);
});

test("editing a published workflow creates a new draft version without mutating published steps", async () => {
  const { handler, store } = loadCrmHandler({ ...baseStore(), ...seedPublishedWorkflow() });
  const res = await invoke(handler, workflowPayload({
    id: "workflow_1",
    steps: [
      { activityType: "call", title: "Ligação nova", delayUnit: "hours", delayAmount: 2 },
    ],
  }));
  assert.equal(res.status, 200);
  assert.equal(res.body.versionId !== "wfver_1", true);
  assert.equal(store.get("crmWorkflowVersions/wfver_1").status, "published");
  assert.equal(store.get("crmWorkflowSteps/wfstep_1").title, "Ligação 01");
  assert.equal(store.get(`crmWorkflowVersions/${res.body.versionId}`).versionNumber, 2);
});

test("stage enter starts workflow, creates activities with offsets and owner assignment", async () => {
  const { handler, store } = loadCrmHandler({ ...baseStore(), ...seedPublishedWorkflow() }, { sub: "user_sdr", role: "growth", name: "SDR" });
  const res = await invoke(handler, { action: "move_opportunity", id: "opp_1", stageId: "stage_new" });
  assert.equal(res.status, 200);

  const runs = Array.from(store.entries()).filter(([key]) => key.startsWith("crmWorkflowRuns/")).map(([, row]) => row);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].idempotencyKey, "opp_1:workflow_1:1:stage_new");
  const activities = Array.from(store.entries()).filter(([key]) => key.startsWith("crmActivities/")).map(([, row]) => row).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  assert.equal(activities.length, 3);
  assert.deepEqual(activities.map((row) => row.ownerId), ["user_sdr", "user_sdr", "user_sdr"]);
  assert.deepEqual(activities.map((row) => row.workflowRunId), [runs[0].id, runs[0].id, runs[0].id]);
  assert.equal(Date.parse(activities[1].dueAt) - Date.parse(activities[0].dueAt), 24 * 60 * 60 * 1000);
  assert.equal(Date.parse(activities[2].dueAt) - Date.parse(activities[0].dueAt), 3 * 24 * 60 * 60 * 1000);
  assert.equal(store.get("crmOpportunities/opp_1").nextActivityTitle, "Ligação 01");
});

test("workflow stage enter is idempotent and inactive workflows do not trigger", async () => {
  const seeded = { ...baseStore(), ...seedPublishedWorkflow() };
  const { handler, store } = loadCrmHandler(seeded, { sub: "user_sdr", role: "growth", name: "SDR" });
  assert.equal((await invoke(handler, { action: "move_opportunity", id: "opp_1", stageId: "stage_new" })).status, 200);
  store.set("crmOpportunities/opp_1", { ...store.get("crmOpportunities/opp_1"), stageId: "stage_meeting" });
  assert.equal((await invoke(handler, { action: "move_opportunity", id: "opp_1", stageId: "stage_new" })).status, 200);
  assert.equal(Array.from(store.keys()).filter((key) => key.startsWith("crmWorkflowRuns/")).length, 1);

  const inactive = { ...baseStore(), ...seedPublishedWorkflow(), "crmWorkflows/workflow_1": { ...seedPublishedWorkflow()["crmWorkflows/workflow_1"], isActive: false } };
  const inactiveCtx = loadCrmHandler(inactive, { sub: "user_sdr", role: "growth", name: "SDR" });
  assert.equal((await invoke(inactiveCtx.handler, { action: "move_opportunity", id: "opp_1", stageId: "stage_new" })).status, 200);
  assert.equal(Array.from(inactiveCtx.store.keys()).filter((key) => key.startsWith("crmWorkflowRuns/")).length, 0);
});

test("leaving trigger stage cancels future workflow activities but preserves completed and manual activities", async () => {
  const seeded = { ...baseStore(), ...seedPublishedWorkflow() };
  seeded["crmOpportunities/opp_1"].stageId = "stage_new";
  seeded["crmWorkflowRuns/wfrun_1"] = { id: "wfrun_1", scopeId: "space-main", workflowId: "workflow_1", workflowVersionId: "wfver_1", workflowVersion: 1, opportunityId: "opp_1", triggerStageId: "stage_new", status: "active", idempotencyKey: "opp_1:workflow_1:1:stage_new", startedAt: "2026-09-21T12:00:00.000Z" };
  seeded["crmActivities/act_done"] = { id: "act_done", scopeId: "space-main", opportunityId: "opp_1", type: "call", title: "Ligação 01", dueAt: "2026-09-21T12:00:00.000Z", status: "completed", workflowRunId: "wfrun_1", workflowId: "workflow_1", workflowStepId: "wfstep_1" };
  seeded["crmActivities/act_future"] = { id: "act_future", scopeId: "space-main", opportunityId: "opp_1", type: "call", title: "Ligação 02", dueAt: "2099-09-22T12:00:00.000Z", status: "open", workflowRunId: "wfrun_1", workflowId: "workflow_1", workflowStepId: "wfstep_2" };
  seeded["crmActivities/act_manual"] = { id: "act_manual", scopeId: "space-main", opportunityId: "opp_1", type: "task", title: "Manual", dueAt: "2099-09-22T13:00:00.000Z", status: "open" };
  const { handler, store } = loadCrmHandler(seeded, { sub: "user_sdr", role: "growth", name: "SDR" });
  const res = await invoke(handler, { action: "move_opportunity", id: "opp_1", stageId: "stage_meeting" });
  assert.equal(res.status, 200);
  assert.equal(store.get("crmActivities/act_done").status, "completed");
  assert.equal(store.get("crmActivities/act_future").status, "cancelled");
  assert.equal(store.get("crmActivities/act_manual").status, "open");
  assert.equal(store.get("crmWorkflowRuns/wfrun_1").status, "cancelled");
  assert.equal(store.get("crmOpportunities/opp_1").nextActivityTitle, "Manual");
});

test("workflow run completes when every cadence activity is completed or cancelled", async () => {
  const seeded = { ...baseStore(), ...seedPublishedWorkflow() };
  seeded["crmWorkflowRuns/wfrun_1"] = { id: "wfrun_1", scopeId: "space-main", workflowId: "workflow_1", workflowVersionId: "wfver_1", workflowVersion: 1, opportunityId: "opp_1", triggerStageId: "stage_new", status: "active", idempotencyKey: "opp_1:workflow_1:1:stage_new", startedAt: "2026-09-21T12:00:00.000Z" };
  seeded["crmActivities/act_1"] = { id: "act_1", scopeId: "space-main", opportunityId: "opp_1", type: "call", title: "Ligação 01", dueAt: "2026-09-21T12:00:00.000Z", status: "open", workflowRunId: "wfrun_1", workflowId: "workflow_1", workflowStepId: "wfstep_1" };
  const { handler, store } = loadCrmHandler(seeded, { sub: "user_sdr", role: "growth", name: "SDR" });
  const res = await invoke(handler, { action: "complete_activity", id: "act_1" });
  assert.equal(res.status, 200);
  assert.equal(store.get("crmWorkflowRuns/wfrun_1").status, "completed");
});
