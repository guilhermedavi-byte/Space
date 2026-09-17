const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const loadCrmHandler = (initialStore = {}, session = { sub: "user_closer", role: "growth", name: "Closer" }) => {
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
      getSessionFromRequest: () => session,
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
        const row = store.get(path);
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
          .map(([, value]) => value),
      commitWritesAsAdmin: async ({ writes }) => {
        commits.push(writes);
        writes.forEach((write) => {
          const parts = String(write.update.name || "").split("/documents/")[1].split("/");
          const key = `${parts[0]}/${decodeURIComponent(parts[1])}`;
          store.set(key, write.update.fields);
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

const opportunity = (patch = {}) => ({
  id: "opp_1",
  scopeId: "space-main",
  contactId: "contact_1",
  pipelineId: "closer_pipeline",
  stageId: "closer_stage_1",
  title: "Matheus Afonso",
  value: 10000,
  currency: "BRL",
  ownerId: "user_closer",
  source: "Instagram",
  status: "open",
  lostReason: null,
  lostReasonNote: null,
  closedAt: null,
  closedBy: null,
  closedValue: null,
  createdAt: "2026-09-16T10:00:00.000Z",
  updatedAt: "2026-09-16T10:00:00.000Z",
  ...patch,
});

const closerUser = () => ({
  id: "user_closer",
  uid: "user_closer",
  nome: "Closer",
  email: "closer@space.test",
  tipo: "growth",
  commercialRoles: ["closer"],
});

const sdrUser = () => ({
  id: "user_sdr",
  uid: "user_sdr",
  nome: "SDR",
  email: "sdr@space.test",
  tipo: "growth",
  commercialRoles: ["sdr"],
});

const closerPipeline = () => ({
  id: "closer_pipeline",
  scopeId: "space-main",
  name: "Closer",
  pipelineType: "closer",
  isActive: true,
});

test("SDR-only users cannot close or reopen closer opportunities by forcing API actions", async () => {
  const { handler, store, commits } = loadCrmHandler({
    "users/user_sdr": sdrUser(),
    "crmPipelines/closer_pipeline": closerPipeline(),
    "crmOpportunities/opp_1": opportunity({ ownerId: "user_sdr", status: "lost" }),
  }, { sub: "user_sdr", role: "growth", name: "SDR" });

  const won = await invoke(handler, { action: "mark_opportunity_won", id: "opp_1", closedValue: 10000 });
  const lost = await invoke(handler, { action: "mark_opportunity_lost", id: "opp_1", lostReason: "price" });
  const reopened = await invoke(handler, { action: "reopen_opportunity", id: "opp_1" });

  assert.equal(won.status, 403);
  assert.equal(lost.status, 403);
  assert.equal(reopened.status, 403);
  assert.equal(store.get("crmOpportunities/opp_1").status, "lost");
  assert.equal(commits.length, 0);
});

test("mark_opportunity_won snapshots closedValue, closedAt, closedBy and event atomically", async () => {
  const { handler, store, commits } = loadCrmHandler({
    "users/user_closer": closerUser(),
    "crmPipelines/closer_pipeline": closerPipeline(),
    "crmOpportunities/opp_1": opportunity({ lostReason: "price", lostReasonNote: "old" }),
  });
  const res = await invoke(handler, {
    action: "mark_opportunity_won",
    id: "opp_1",
    closedValue: 12345,
    closedAt: "2026-09-16T15:30:00-03:00",
  });

  assert.equal(res.status, 200);
  const updated = store.get("crmOpportunities/opp_1");
  assert.equal(updated.status, "won");
  assert.equal(updated.closedValue, 12345);
  assert.equal(updated.closedAt, "2026-09-16T18:30:00.000Z");
  assert.equal(updated.closedBy, "user_closer");
  assert.equal(updated.lostReason, null);
  assert.equal(updated.lostReasonNote, null);
  assert.equal(commits.at(-1).length, 2);
  const event = commits.at(-1).find((write) => write.update.fields.type === "crm.opportunity.won").update.fields;
  assert.equal(event.payload.previousStatus, "open");
  assert.equal(event.payload.closedValue, 12345);
  assert.equal(event.payload.actor, "user_closer");
});

test("mark_opportunity_lost requires reason and persists lost payload", async () => {
  const { handler, store, commits } = loadCrmHandler({
    "users/user_closer": closerUser(),
    "crmPipelines/closer_pipeline": closerPipeline(),
    "crmOpportunities/opp_1": opportunity(),
  });
  const invalid = await invoke(handler, { action: "mark_opportunity_lost", id: "opp_1" });
  assert.equal(invalid.status, 400);

  const res = await invoke(handler, {
    action: "mark_opportunity_lost",
    id: "opp_1",
    lostReason: "competitor",
    lostReasonNote: "Fechou com outro fornecedor",
    closedAt: "2026-09-16T16:00:00-03:00",
  });

  assert.equal(res.status, 200);
  const updated = store.get("crmOpportunities/opp_1");
  assert.equal(updated.status, "lost");
  assert.equal(updated.closedValue, null);
  assert.equal(updated.lostReason, "competitor");
  assert.equal(updated.lostReasonNote, "Fechou com outro fornecedor");
  assert.equal(updated.closedBy, "user_closer");
  const event = commits.at(-1).find((write) => write.update.fields.type === "crm.opportunity.lost").update.fields;
  assert.equal(event.payload.lostReason, "competitor");
  assert.equal(event.payload.previousStatus, "open");
});

test("reopen_opportunity clears closing fields and keeps historical events", async () => {
  const { handler, store, commits } = loadCrmHandler({
    "users/user_closer": closerUser(),
    "crmPipelines/closer_pipeline": closerPipeline(),
    "crmOpportunities/opp_1": opportunity({
      status: "lost",
      closedAt: "2026-09-16T19:00:00.000Z",
      closedBy: "user_closer",
      closedValue: null,
      lostReason: "price",
      lostReasonNote: "Caro",
    }),
  });

  const res = await invoke(handler, { action: "reopen_opportunity", id: "opp_1" });

  assert.equal(res.status, 200);
  const updated = store.get("crmOpportunities/opp_1");
  assert.equal(updated.status, "open");
  assert.equal(updated.closedAt, null);
  assert.equal(updated.closedBy, null);
  assert.equal(updated.closedValue, null);
  assert.equal(updated.lostReason, null);
  assert.equal(updated.lostReasonNote, null);
  const event = commits.at(-1).find((write) => write.update.fields.type === "crm.opportunity.reopened").update.fields;
  assert.equal(event.payload.previousStatus, "lost");
});

test("closing actions reject incoherent duplicate transitions", async () => {
  const { handler } = loadCrmHandler({
    "users/user_closer": closerUser(),
    "crmPipelines/closer_pipeline": closerPipeline(),
    "crmOpportunities/opp_1": opportunity({ status: "won", closedValue: 10000 }),
  });
  const won = await invoke(handler, { action: "mark_opportunity_won", id: "opp_1", closedValue: 10000 });
  assert.equal(won.status, 409);
  const lost = await invoke(handler, { action: "mark_opportunity_lost", id: "opp_1", lostReason: "price" });
  assert.equal(lost.status, 409);
});
