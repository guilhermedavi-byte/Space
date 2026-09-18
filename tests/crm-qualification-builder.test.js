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
    try {
      delete require.cache[require.resolve(path)];
    } catch {}
  });
  require.cache[require.resolve("../_lib/session")] = {
    exports: { getSessionFromRequest: () => session },
  };
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
    setHeader(key, value) { this.headers[key] = value; },
    end(payload) { this.body = payload ? JSON.parse(payload) : {}; },
  };
  await handler(req, res);
  return { status: res.statusCode, body: res.body };
};

const tpl = (patch = {}) => ({
  id: "qual_tpl_sdr",
  scopeId: "space-main",
  name: "SDR Qualification",
  type: "sdr_qualification",
  isActive: true,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
  ...patch,
});

const version = (id, patch = {}) => ({
  id,
  scopeId: "space-main",
  templateId: "qual_tpl_sdr",
  versionNumber: id.endsWith("_v2") ? 2 : 1,
  status: "published",
  totalThreshold: 10,
  minimumFitScore: 5,
  minimumIntentScore: 5,
  createdAt: "2026-09-16T10:00:00.000Z",
  publishedAt: "2026-09-16T10:00:00.000Z",
  createdBy: "admin_user",
  ...patch,
});

const question = (id, versionId, position, patch = {}) => ({
  id,
  scopeId: "space-main",
  versionId,
  title: `Pergunta ${position}`,
  dimension: position === 1 ? "need_fit" : "urgency",
  position,
  required: true,
  isHardGate: false,
  createdAt: "2026-09-16T10:00:00.000Z",
  ...patch,
});

const option = (id, questionId, position, points, patch = {}) => ({
  id,
  scopeId: "space-main",
  questionId,
  label: `Resposta ${position}`,
  points,
  position,
  hardFail: false,
  ...patch,
});

const baseStore = () => ({
  "crmQualificationTemplates/qual_tpl_sdr": tpl(),
  "crmQualificationVersions/qual_tpl_sdr_v1": version("qual_tpl_sdr_v1"),
  "crmQualificationQuestions/q1": question("q1", "qual_tpl_sdr_v1", 1),
  "crmQualificationQuestions/q2": question("q2", "qual_tpl_sdr_v1", 2),
  "crmQualificationOptions/o1": option("o1", "q1", 1, 10),
  "crmQualificationOptions/o2": option("o2", "q1", 2, 0),
  "crmQualificationOptions/o3": option("o3", "q2", 1, 10),
  "crmQualificationOptions/o4": option("o4", "q2", 2, 0),
});

test("admin creates qualification template with draft version", async () => {
  const { handler, store, commits } = loadCrmHandler({});
  const res = await invoke(handler, { action: "create_qualification_template", name: "Novo filtro", type: "sdr_qualification" });
  assert.equal(res.status, 201);
  assert.ok(Array.from(store.values()).find((row) => row.name === "Novo filtro"));
  assert.ok(Array.from(store.values()).find((row) => row.status === "draft" && row.versionNumber === 1));
  assert.ok(commits.flat().some((write) => write.update?.fields?.type === "qualification_version_created"));
});

test("non-admin cannot mutate qualification builder", async () => {
  const { handler } = loadCrmHandler(baseStore(), { sub: "growth_user", role: "growth", commercialRoles: ["sdr"] });
  const res = await invoke(handler, { action: "create_qualification_draft", templateId: "qual_tpl_sdr" });
  assert.equal(res.status, 403);
});

test("admin clones published version to editable draft", async () => {
  const { handler, store } = loadCrmHandler(baseStore());
  const res = await invoke(handler, { action: "create_qualification_draft", templateId: "qual_tpl_sdr", versionId: "qual_tpl_sdr_v1" });
  assert.equal(res.status, 201);
  const draft = store.get(`crmQualificationVersions/${res.body.versionId}`);
  assert.equal(draft.status, "draft");
  assert.equal(draft.versionNumber, 2);
  const clonedQuestions = Array.from(store.values()).filter((row) => row.versionId === draft.id);
  assert.equal(clonedQuestions.length, 2);
});

test("admin edits draft questions, options, hardFail, thresholds and reorder", async () => {
  const { handler, store } = loadCrmHandler({
    ...baseStore(),
    "crmQualificationVersions/qual_tpl_sdr_v2": version("qual_tpl_sdr_v2", { status: "draft", publishedAt: null }),
  });
  const res = await invoke(handler, {
    action: "save_qualification_filter",
    templateId: "qual_tpl_sdr",
    versionId: "qual_tpl_sdr_v2",
    name: "SDR Qualification",
    totalThreshold: 12,
    minimumFitScore: 6,
    minimumIntentScore: 6,
    questions: [
      { title: "Urgência primeiro", dimension: "urgency", required: true, options: [{ label: "Agora", points: 8 }, { label: "Depois", points: 0, hardFail: true }] },
      { title: "Fit depois", dimension: "need_fit", required: true, isHardGate: true, options: [{ label: "Fit", points: 8 }, { label: "Sem fit", points: 0, hardFail: true }] },
    ],
  });
  assert.equal(res.status, 200);
  const saved = store.get("crmQualificationVersions/qual_tpl_sdr_v2");
  assert.equal(saved.totalThreshold, 12);
  const questions = Array.from(store.values()).filter((row) => row.versionId === "qual_tpl_sdr_v2").sort((a, b) => a.position - b.position);
  assert.equal(questions[0].title, "Urgência primeiro");
  const hardFail = Array.from(store.values()).find((row) => row.label === "Depois");
  assert.equal(hardFail.hardFail, true);
});

test("publish validates invalid drafts and publishes valid draft immutably", async () => {
  const { handler, store, commits } = loadCrmHandler({
    ...baseStore(),
    "crmQualificationVersions/qual_tpl_sdr_v2": version("qual_tpl_sdr_v2", { status: "draft", publishedAt: null, totalThreshold: 999 }),
    "crmQualificationQuestions/qv2": question("qv2", "qual_tpl_sdr_v2", 1, { dimension: "need_fit" }),
    "crmQualificationOptions/ov2": option("ov2", "qv2", 1, 10),
  });
  const invalid = await invoke(handler, { action: "publish_qualification_filter", versionId: "qual_tpl_sdr_v2" });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, "qualification_version_invalid");

  await invoke(handler, {
    action: "save_qualification_filter",
    templateId: "qual_tpl_sdr",
    versionId: "qual_tpl_sdr_v2",
    name: "SDR Qualification",
    totalThreshold: 10,
    minimumFitScore: 5,
    minimumIntentScore: 5,
    questions: [
      { title: "Fit", dimension: "need_fit", required: true, options: [{ label: "Sim", points: 10 }, { label: "Não", points: 0 }] },
      { title: "Urgência", dimension: "urgency", required: true, options: [{ label: "Agora", points: 10 }, { label: "Depois", points: 0 }] },
    ],
  });
  const valid = await invoke(handler, { action: "publish_qualification_filter", versionId: "qual_tpl_sdr_v2" });
  assert.equal(valid.status, 200);
  assert.equal(store.get("crmQualificationVersions/qual_tpl_sdr_v1").status, "archived");
  assert.equal(store.get("crmQualificationVersions/qual_tpl_sdr_v2").status, "published");
  assert.ok(commits.at(-1).some((write) => write.update.fields.type === "qualification_version_published"));
});

test("old run stays on old version and new run uses newly published version", async () => {
  const store = {
    ...baseStore(),
    "users/sdr_user": { id: "sdr_user", uid: "sdr_user", role: "growth", tipo: "growth", commercialRoles: ["sdr"] },
    "crmPipelines/commercial": { id: "commercial", scopeId: "space-main", name: "Comercial", pipelineType: "sdr", isActive: true },
    "crmStages/stage_1": { id: "stage_1", scopeId: "space-main", pipelineId: "commercial", name: "Novo", position: 1 },
    "crmOpportunities/opp_1": { id: "opp_1", scopeId: "space-main", contactId: "c1", pipelineId: "commercial", stageId: "stage_1", ownerId: "sdr_user", title: "Lead", status: "open" },
    "crmQualificationRuns/run_old": { id: "run_old", scopeId: "space-main", opportunityId: "old", templateId: "qual_tpl_sdr", versionId: "qual_tpl_sdr_v1", status: "in_progress", startedAt: "2026-09-16T10:00:00.000Z" },
    "crmQualificationVersions/qual_tpl_sdr_v2": version("qual_tpl_sdr_v2", { status: "published", publishedAt: "2026-09-17T10:00:00.000Z" }),
  };
  store["crmQualificationVersions/qual_tpl_sdr_v1"] = version("qual_tpl_sdr_v1", { status: "archived" });
  store["crmQualificationQuestions/qv2_1"] = question("qv2_1", "qual_tpl_sdr_v2", 1);
  store["crmQualificationOptions/ov2_1"] = option("ov2_1", "qv2_1", 1, 10);
  store["crmQualificationOptions/ov2_2"] = option("ov2_2", "qv2_1", 2, 0);
  const { handler, store: liveStore } = loadCrmHandler(store, { sub: "sdr_user", role: "growth", commercialRoles: ["sdr"] });
  const res = await invoke(handler, { action: "start_qualification", id: "opp_1" });
  assert.equal(res.status, 201);
  assert.equal(liveStore.get("crmQualificationRuns/run_old").versionId, "qual_tpl_sdr_v1");
  const newRun = Array.from(liveStore.values()).find((row) => row.opportunityId === "opp_1" && row.status === "in_progress");
  assert.equal(newRun.versionId, "qual_tpl_sdr_v2");
});

test("admin deletes draft without runs", async () => {
  const { handler, store, commits } = loadCrmHandler({
    ...baseStore(),
    "crmQualificationVersions/qual_tpl_sdr_v2": version("qual_tpl_sdr_v2", { status: "draft", publishedAt: null }),
    "crmQualificationQuestions/qv2": question("qv2", "qual_tpl_sdr_v2", 1),
    "crmQualificationOptions/ov2": option("ov2", "qv2", 1, 10),
  });
  const res = await invoke(handler, { action: "delete_qualification_draft", versionId: "qual_tpl_sdr_v2" });
  assert.equal(res.status, 200);
  assert.equal(store.has("crmQualificationVersions/qual_tpl_sdr_v2"), false);
  assert.equal(store.has("crmQualificationQuestions/qv2"), false);
  assert.ok(commits.at(-1).some((write) => write.update?.fields?.type === "qualification_draft_deleted"));
});
