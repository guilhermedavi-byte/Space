const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const shouldRun = process.env.RUN_RETENTION_BACKEND_LOCAL === "1";
const migrationPaths = [
  path.join(__dirname, "..", "supabase", "retention-lifecycle-v2.sql"),
  path.join(__dirname, "..", "supabase", "retention-lifecycle-v2-provisioning.sql"),
];
const pgImage = process.env.RETENTION_SQL_PG_IMAGE || "postgres:14-alpine";
const postgrestImage = process.env.RETENTION_POSTGREST_IMAGE || "postgrest/postgrest:v12.2.8";

const run = (command, args, { input, env } = {}) =>
  execFileSync(command, args, {
    input,
    encoding: "utf8",
    env: { ...process.env, ...(env || {}) },
    stdio: ["pipe", "pipe", "pipe"],
  });

const docker = (args, options) => run("docker", args, options);

const makeRes = () => ({
  statusCode: 0,
  headers: {},
  body: null,
  setHeader(name, value) {
    this.headers[name] = value;
  },
  end(value) {
    this.body = JSON.parse(String(value || "{}"));
  },
});

const makeReq = ({ method = "GET", url = "/", body = {}, headers = {} } = {}) => ({
  method,
  url,
  headers: { host: "localhost", ...headers },
  on(event, callback) {
    if (event === "data" && method !== "GET" && method !== "HEAD") callback(Buffer.from(JSON.stringify(body)));
    if (event === "end") callback();
  },
});

const installHandler = ({ handlerRelPath, role = "admin", firestoreGuard = null, supabaseTransport = null } = {}) => {
  const handlerPath = require.resolve(handlerRelPath);
  const authPath = require.resolve("../api/_lib/admin-request-auth");
  const firestoreAdminPath = require.resolve("../api/_lib/firestore-admin");
  const supabaseRestPath = require.resolve("../api/_lib/supabase-rest");
  delete require.cache[handlerPath];
  delete require.cache[authPath];
  delete require.cache[firestoreAdminPath];
  delete require.cache[require.resolve("../api/_lib/retention-flags")];
  delete require.cache[require.resolve("../api/_lib/retention-store")];
  delete require.cache[supabaseRestPath];
  require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
      resolveAdminRequestAuth: async () => ({
        ok: true,
        status: 200,
        session: { sub: `${role}-1`, role, name: role.toUpperCase() },
      }),
    },
  };
  require.cache[firestoreAdminPath] = {
    id: firestoreAdminPath,
    filename: firestoreAdminPath,
    loaded: true,
    exports: firestoreGuard || {
      listCollectionAsAdmin: async () => {
        throw new Error("firestore_should_not_be_called");
      },
    },
  };
  if (supabaseTransport) {
    require.cache[supabaseRestPath] = {
      id: supabaseRestPath,
      filename: supabaseRestPath,
      loaded: true,
      exports: {
        supabaseFetch: supabaseTransport,
      },
    };
  }
  return require(handlerRelPath);
};

test(
  "backend local conversa com PostgREST descartável e respeita gates/segurança",
  { skip: !shouldRun, timeout: 240_000, concurrency: false },
  async () => {
    const unique = `${Date.now()}_${process.pid}_${crypto.randomBytes(3).toString("hex")}`;
    const containerDb = `ret_backend_pg_${unique}`.replace(/[^a-zA-Z0-9_]/g, "_");
    const containerApi = `ret_backend_pgrst_${unique}`.replace(/[^a-zA-Z0-9_]/g, "_");
    const network = `ret_backend_net_${unique}`.replace(/[^a-zA-Z0-9_]/g, "_");
    const dbName = `ret_backend_${unique}`.replace(/[^a-zA-Z0-9_]/g, "_");
    const apiPort = String(56000 + Math.floor(Math.random() * 400));
    const migrationSql = migrationPaths.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n\n");
    const postgrestBaseUrl = `http://127.0.0.1:${apiPort}`;

    const cleanup = () => {
      try { docker(["rm", "-f", containerApi]); } catch {}
      try { docker(["rm", "-f", containerDb]); } catch {}
      try { docker(["network", "rm", network]); } catch {}
    };

    try {
      docker(["network", "create", network]);
      docker([
        "run", "--name", containerDb, "--network", network, "--network-alias", "db",
        "-e", "POSTGRES_PASSWORD=postgres", "-e", `POSTGRES_DB=${dbName}`, "-d", pgImage,
      ]);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          docker(["exec", containerDb, "pg_isready", "-U", "postgres", "-d", dbName]);
          break;
        } catch (error) {
          if (attempt === 39) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      docker(["exec", "-i", containerDb, "psql", "-U", "postgres", "-d", dbName, "-v", "ON_ERROR_STOP=1"], {
        input: `
          create role anon nologin;
          create role authenticated nologin;
          create role service_role nologin bypassrls;
          create role authenticator login password 'local-only';
          grant anon to authenticator;
          grant authenticated to authenticator;
          grant service_role to authenticator;
        `,
      });
      docker(["exec", "-i", containerDb, "psql", "-U", "postgres", "-d", dbName, "-v", "ON_ERROR_STOP=1"], { input: migrationSql });
      docker(["exec", "-i", containerDb, "psql", "-U", "postgres", "-d", dbName, "-v", "ON_ERROR_STOP=1"], {
        input: `
          insert into public.students (id, firestore_student_id, full_name, lifecycle_status, pause_status)
          values ('00000000-0000-0000-0000-000000000010', 'fs-backend', 'Aluno Backend', 'active', 'none');
          insert into public.subscriptions (
            id, student_id, external_subscription_key, billing_cycle, lifecycle_status, pause_status, financial_status, started_at
          ) values (
            '10000000-0000-0000-0000-000000000010',
            '00000000-0000-0000-0000-000000000010',
            'sub-backend',
            'monthly',
            'active',
            'none',
            'unknown',
            '2026-08-20T12:00:00Z'
          );
        `,
      });
      docker([
        "run", "--name", containerApi, "--network", network, "-p", `${apiPort}:3000`, "-d",
        "-e", `PGRST_DB_URI=postgres://authenticator:local-only@db:5432/${dbName}`,
        "-e", "PGRST_DB_SCHEMAS=public",
        "-e", "PGRST_DB_ANON_ROLE=service_role",
        postgrestImage,
      ]);
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const envSnapshot = { ...process.env };
      process.env.SUPABASE_URL = postgrestBaseUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "local-disposable-service-role";
      process.env.APP_ENV = "production";
      process.env.RETENTION_V2_ENABLED = "0";
      process.env.RETENTION_LEGACY_IMPORT_ENABLED = "0";
      process.env.RETENTION_INVOLUNTARY_CHURN_ENABLED = "0";
      process.env.RETENTION_FINANCIAL_KPIS_ENABLED = "0";
      delete process.env.RETENTION_CHURN_JOB_SECRET;

      let firestoreCalls = 0;
      const firestoreGuard = {
        listCollectionAsAdmin: async () => {
          firestoreCalls += 1;
          throw new Error("firestore_should_not_be_called");
        },
      };
      const supabaseTransport = async (requestPath, { method = "GET", headers = {}, body } = {}) => {
        const response = await fetch(`${postgrestBaseUrl}${requestPath}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
            ...headers,
          },
          body: body == null ? undefined : JSON.stringify(body),
        });
        const text = await response.text().catch(() => "");
        let data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        if (!response.ok) {
          const error = new Error("supabase_request_failed");
          error.status = response.status;
          error.data = data;
          error.code = data && typeof data === "object" ? data.code || data.error || "supabase_request_failed" : "supabase_request_failed";
          error.message = data && typeof data === "object" ? data.message || data.msg || error.message : error.message;
          throw error;
        }
        return { status: response.status, data };
      };

      let retentionHandler = installHandler({ handlerRelPath: "../api/retention-cases", role: "admin", firestoreGuard, supabaseTransport });
      let res = makeRes();
      await retentionHandler(makeReq({ method: "GET", url: "/api/retention-cases?view=queues" }), res);
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.error, "retention_v2_disabled");

      res = makeRes();
      await retentionHandler(
        makeReq({ method: "POST", url: "/api/retention-cases", body: { command: "register_formal_request", clientActionId: "off-1", firestoreStudentId: "fs-backend" } }),
        res
      );
      assert.equal(res.statusCode, 409);

      let importHandler = installHandler({ handlerRelPath: "../api/retention-import", role: "admin", firestoreGuard, supabaseTransport });
      res = makeRes();
      await importHandler(makeReq({ method: "POST", url: "/api/retention-import", body: { dryRun: true } }), res);
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.error, "retention_legacy_import_disabled");
      assert.equal(firestoreCalls, 0);

      let churnHandler = installHandler({ handlerRelPath: "../api/retention-churn-job", role: "admin", firestoreGuard, supabaseTransport });
      res = makeRes();
      await churnHandler(makeReq({ method: "POST", url: "/api/retention-churn-job", body: {} }), res);
      assert.equal(res.statusCode, 503);

      process.env.RETENTION_V2_ENABLED = "1";
      retentionHandler = installHandler({ handlerRelPath: "../api/retention-cases", role: "growth", firestoreGuard, supabaseTransport });

      res = makeRes();
      await retentionHandler(makeReq({ method: "GET", url: "/api/retention-cases?view=queues" }), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.ok, true);
      assert.ok(Array.isArray(res.body.rows));

      res = makeRes();
      await retentionHandler(
        makeReq({
          method: "POST",
          url: "/api/retention-cases",
          body: {
            command: "register_formal_request",
            clientActionId: "local-1",
            firestoreStudentId: "fs-backend",
            payload: {
              requested_at: "2026-08-27T12:00:00.000Z",
              first_lesson_at: "2026-08-23T12:00:00.000Z",
              reason: "Pedido local",
              injected: "nope",
            },
          },
        }),
        res
      );
      assert.equal(res.statusCode, 200);
      const caseId = res.body.result.case_id;
      assert.equal(res.body.result.snapshot.case.stage, "scheduled");
      assert.equal(res.body.result.snapshot.student.email, undefined);

      res = makeRes();
      await retentionHandler(
        makeReq({
          method: "POST",
          url: "/api/retention-cases",
          body: {
            command: "register_formal_request",
            caseId,
            idempotencyKey: "explicit-idem-1",
            clientActionId: "explicit-idem-1",
            firestoreStudentId: "fs-backend",
            payload: { requested_at: "2026-08-27T12:00:00.000Z", reason: "Pedido local" },
          },
        }),
        res
      );
      assert.equal(res.statusCode, 200);

      res = makeRes();
      await retentionHandler(
        makeReq({
          method: "POST",
          url: "/api/retention-cases",
          body: {
            command: "register_formal_request",
            caseId,
            idempotencyKey: "explicit-idem-1",
            clientActionId: "explicit-idem-1",
            firestoreStudentId: "fs-backend",
            payload: { requested_at: "2026-08-27T12:00:00.000Z", reason: "Pedido local alterado" },
          },
        }),
        res
      );
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.error, "idempotency_key_payload_mismatch");

      res = makeRes();
      await retentionHandler(makeReq({ method: "GET", url: `/api/retention-cases?view=timeline&caseId=${caseId}` }), res);
      assert.equal(res.statusCode, 200);
      assert.ok(Array.isArray(res.body.timeline.events));

      const payloadRow = docker(
        ["exec", "-i", containerDb, "psql", "-U", "postgres", "-d", dbName, "-At", "-F", "\t", "-c",
          "select payload::text from public.retention_events order by created_at desc limit 1"],
      );
      assert.ok(!payloadRow.includes("injected"));

      retentionHandler = installHandler({ handlerRelPath: "../api/retention-cases", role: "growth", firestoreGuard, supabaseTransport });
      res = makeRes();
      await retentionHandler(
        makeReq({
          method: "POST",
          url: "/api/retention-cases",
          body: {
            command: "effectuate_churn",
            clientActionId: "critical-growth",
            caseId,
            firestoreStudentId: "fs-backend",
            payload: { mode: "manual" },
          },
        }),
        res
      );
      assert.equal(res.statusCode, 403);

      retentionHandler = installHandler({ handlerRelPath: "../api/retention-cases", role: "financeiro", firestoreGuard, supabaseTransport });
      res = makeRes();
      await retentionHandler(
        makeReq({
          method: "POST",
          url: "/api/retention-cases",
          body: {
            command: "register_formal_request",
            clientActionId: "finance-blocked",
            firestoreStudentId: "fs-backend",
            payload: { requested_at: "2026-08-27T12:00:00.000Z", reason: "x" },
          },
        }),
        res
      );
      assert.equal(res.statusCode, 403);

      retentionHandler = installHandler({ handlerRelPath: "../api/retention-cases", role: "admin", firestoreGuard, supabaseTransport });
      res = makeRes();
      await retentionHandler(
        makeReq({
          method: "POST",
          url: "/api/retention-cases",
          body: {
            command: "effectuate_churn",
            clientActionId: "churn-auto-blocked",
            caseId,
            firestoreStudentId: "fs-backend",
            justification: "auto",
            override: true,
            payload: { mode: "automatic" },
          },
        }),
        res
      );
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.error, "involuntary_churn_disabled");

      importHandler = installHandler({ handlerRelPath: "../api/retention-import", role: "admin", firestoreGuard, supabaseTransport });
      res = makeRes();
      await importHandler(makeReq({ method: "POST", url: "/api/retention-import", body: { dryRun: true } }), res);
      assert.equal(res.statusCode, 409);

      Object.keys(process.env).forEach((key) => {
        if (!(key in envSnapshot)) delete process.env[key];
      });
      Object.assign(process.env, envSnapshot);
    } finally {
      cleanup();
    }
  }
);
