const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const { rebuildCaseProjectionFromEvents } = require("../api/_lib/retention-domain");

const shouldRun = process.env.RUN_RETENTION_SQL_INTEGRATION === "1";
const summaryPath = process.env.RETENTION_SQL_SUMMARY_PATH ? path.resolve(process.env.RETENTION_SQL_SUMMARY_PATH) : "";
const migrationPaths = [
  path.join(__dirname, "..", "supabase", "retention-lifecycle-v2.sql"),
  path.join(__dirname, "..", "supabase", "retention-lifecycle-v2-provisioning.sql"),
];
const pgImage = process.env.RETENTION_SQL_PG_IMAGE || "postgres:14-alpine";

const run = (command, args, { input, env } = {}) =>
  execFileSync(command, args, {
    input,
    encoding: "utf8",
    env: { ...process.env, ...(env || {}) },
    stdio: ["pipe", "pipe", "pipe"],
  });

const docker = (args, options) => run("docker", args, options);

const parseJson = (text) => JSON.parse(String(text || "").trim() || "null");
const expectDockerFailure = (args, pattern) => {
  try {
    docker(args);
    assert.fail(`expected docker command to fail: ${args.join(" ")}`);
  } catch (error) {
    const stderr = String(error?.stderr || error?.message || "");
    assert.match(stderr, pattern);
    return stderr;
  }
};

const createHarness = () => {
  const unique = `${Date.now()}_${process.pid}_${crypto.randomBytes(3).toString("hex")}`;
  return {
    containerName: `retention_sql_${unique}`.replace(/[^a-zA-Z0-9_]/g, "_"),
    databaseName: `retention_sql_${unique}`.replace(/[^a-zA-Z0-9_]/g, "_"),
    appUser: `retention_user_${process.pid}`.replace(/[^a-zA-Z0-9_]/g, "_"),
    hostPort: String(55432 + Math.floor(Math.random() * 500)),
  };
};

const psql = (harness, sql, { database, user = "postgres" } = {}) => {
  return docker(
    [
      "exec",
      "-i",
      harness.containerName,
      "psql",
      "-U",
      user,
      "-d",
      database || harness.databaseName,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-F",
      "\t",
    ],
    { input: sql }
  );
};

const waitForDocker = () => {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      docker(["info"]);
      return true;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
    }
  }
  return false;
};

test(
  "migration e RPCs de retenção validam em PostgreSQL descartável",
  { skip: !shouldRun, timeout: 240_000, concurrency: false },
  async () => {
    assert.ok(waitForDocker(), "docker_daemon_unavailable");
    const harness = createHarness();
    const summary = {
      environment: {
        engine: `docker ${pgImage}`,
        containerName: harness.containerName,
        databaseName: harness.databaseName,
        appUser: harness.appUser,
        hostPort: harness.hostPort,
      },
      migration: {},
      scenarios: [],
      reconciliation: {},
      cleanup: { removed: false },
    };

    const record = (name, status, extra = {}) => {
      summary.scenarios.push({ name, status, ...extra });
    };

    const cleanup = () => {
      try {
        docker(["rm", "-f", harness.containerName]);
        summary.cleanup.removed = true;
      } catch {
        summary.cleanup.removed = false;
      }
    };

    try {
      docker([
        "run",
        "--name",
        harness.containerName,
        "-e",
        "POSTGRES_PASSWORD=postgres",
        "-e",
        `POSTGRES_DB=${harness.databaseName}`,
        "-p",
        `${harness.hostPort}:5432`,
        "-d",
        pgImage,
      ]);

      for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
          docker(["exec", harness.containerName, "pg_isready", "-U", "postgres", "-d", harness.databaseName]);
          break;
        } catch (error) {
          if (attempt === 39) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      psql(
        harness,
        `
          create role anon nologin;
          create role authenticated nologin;
          create role service_role nologin bypassrls;
          create role ${harness.appUser} login password 'local-only';
        `
      );

      const migrationSql = migrationPaths.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n\n");
      psql(harness, migrationSql);
      summary.migration.firstApply = "ok";
      psql(harness, migrationSql);
      summary.migration.secondApply = "ok";

      const structure = parseJson(
        psql(
          harness,
          `
            select json_build_object(
              'tables', (select count(*) from pg_tables where schemaname = 'public' and tablename = any (array[
                'students','billing_accounts','subscriptions','service_periods','retention_cases','retention_events',
                'subscription_status_history','pause_status_history','financial_status_history','charges','payments',
                'monthly_base_snapshots','kpi_formula_versions','kpi_monthly_snapshots','data_quality_snapshots','audit_logs','outbox_events'
              ])),
              'functions', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'retention_%'),
              'triggers', (select count(*) from information_schema.triggers where trigger_schema = 'public' and event_object_table in ('retention_events','subscription_status_history','pause_status_history','financial_status_history')),
              'indexes', (select count(*) from pg_indexes where schemaname = 'public' and tablename in ('subscriptions','retention_cases','retention_events','charges','payments','audit_logs','outbox_events')),
              'rls_enabled', (
                select bool_and(rowsecurity)
                from pg_tables
                where schemaname = 'public'
                  and tablename = any (array[
                    'students','billing_accounts','subscriptions','service_periods','retention_cases','retention_events',
                    'subscription_status_history','pause_status_history','financial_status_history','charges','payments',
                    'monthly_base_snapshots','kpi_formula_versions','kpi_monthly_snapshots','data_quality_snapshots','audit_logs','outbox_events'
                  ])
              )
            )::text;
          `
        )
      );
      assert.equal(structure.tables, 17);
      assert.ok(structure.functions >= 9);
      assert.ok(structure.triggers >= 4);
      assert.ok(structure.indexes >= 10);
      assert.equal(structure.rls_enabled, true);
      summary.migration.structure = structure;

      psql(
        harness,
        `
          insert into public.billing_accounts (id, external_key, display_name, email)
          values ('30000000-0000-0000-0000-000000000001', 'payer-1', 'Pagador Um', 'payer@example.com');

          insert into public.students (id, firestore_student_id, full_name, email, phone)
          values
            ('00000000-0000-0000-0000-000000000001', 'fs-preventive', 'Aluno Preventivo', 'preventive@example.com', '5511999990001'),
            ('00000000-0000-0000-0000-000000000002', 'fs-formal', 'Aluno Formal', 'formal@example.com', '5511999990002'),
            ('00000000-0000-0000-0000-000000000003', 'fs-job', 'Aluno Job', 'job@example.com', '5511999990003'),
            ('00000000-0000-0000-0000-000000000004', 'fs-import', 'Aluno Import', 'import@example.com', '5511999990004');

          insert into public.subscriptions (
            id, student_id, billing_account_id, external_subscription_key, plan_name, billing_cycle,
            lifecycle_status, pause_status, financial_status, started_at, mrr_brl, original_mrr_value, original_currency
          ) values
            ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'sub-preventive', 'Plano A', 'monthly', 'active', 'none', 'current', '2026-08-01T12:00:00Z', 500, 500, 'BRL'),
            ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'sub-formal', 'Plano B', 'monthly', 'active', 'none', 'current', '2026-08-20T12:00:00Z', 700, 700, 'BRL'),
            ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'sub-job', 'Plano C', 'monthly', 'cancellation_scheduled', 'none', 'current', '2026-08-01T12:00:00Z', 900, 900, 'BRL'),
            ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'sub-import', 'Plano D', 'monthly', 'active', 'none', 'unknown', '2026-08-01T12:00:00Z', 400, 400, 'BRL');

          insert into public.service_periods (id, subscription_id, period_start, period_end)
          values
            ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-08-01', '2026-08-31'),
            ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-08-20', '2026-09-19');

          insert into public.retention_cases (
            id, student_id, subscription_id, case_kind, stage, lifecycle_status, pause_status, financial_status, scheduled_service_end_at
          ) values (
            '20000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000003',
            '10000000-0000-0000-0000-000000000003',
            'formal',
            'scheduled',
            'cancellation_scheduled',
            'none',
            'current',
            '2026-08-25T12:00:00Z'
          );
        `
      );
      record("seed entities", "ok");

      const provisioned = parseJson(
        psql(
          harness,
          `
            select public.retention_provision_subject(jsonb_build_object(
              'student', jsonb_build_object(
                'firestore_student_id', 'fs-provisioned',
                'full_name', 'Aluno Provisionado',
                'email', 'provisioned@example.com',
                'phone', '5511999990099',
                'lifecycle_status', 'active',
                'pause_status', 'none',
                'source_system', 'firestore_on_demand',
                'legacy_source', jsonb_build_object('firestore_doc', 'fs-provisioned'),
                'legacy_confidence', 'medium'
              ),
              'billing_account', jsonb_build_object(
                'external_key', 'firestore-student:fs-provisioned',
                'display_name', 'Aluno Provisionado',
                'email', 'provisioned@example.com',
                'phone', '5511999990099',
                'source_system', 'firestore_on_demand'
              ),
              'subscription', jsonb_build_object(
                'external_subscription_key', 'firestore:fs-provisioned',
                'plan_name', 'Plano Provisionado',
                'billing_cycle', 'monthly',
                'lifecycle_status', 'active',
                'pause_status', 'none',
                'financial_status', 'unknown',
                'started_at', '2026-08-10T12:00:00.000Z',
                'source_system', 'firestore_on_demand'
              ),
              'service_period', jsonb_build_object(
                'period_start', '2026-08-10',
                'period_end', '2026-09-09',
                'source_system', 'firestore_on_demand'
              )
            ))::text;
          `
        )
      );
      assert.equal(provisioned.ok, true);
      const provisionCounts = parseJson(
        psql(
          harness,
          `
            select json_build_object(
              'students', (select count(*) from public.students where firestore_student_id = 'fs-provisioned'),
              'billing', (select count(*) from public.billing_accounts where external_key = 'firestore-student:fs-provisioned'),
              'subscriptions', (select count(*) from public.subscriptions where external_subscription_key = 'firestore:fs-provisioned'),
              'periods', (select count(*) from public.service_periods sp join public.subscriptions s on s.id = sp.subscription_id where s.external_subscription_key = 'firestore:fs-provisioned')
            )::text;
          `
        )
      );
      assert.deepEqual(provisionCounts, { students: 1, billing: 1, subscriptions: 1, periods: 1 });

      const reprovisionCountsText = psql(
        harness,
        `
          select public.retention_provision_subject(jsonb_build_object(
            'student', jsonb_build_object('firestore_student_id', 'fs-provisioned', 'full_name', 'Aluno Provisionado', 'lifecycle_status', 'active', 'pause_status', 'none'),
            'billing_account', jsonb_build_object('external_key', 'firestore-student:fs-provisioned', 'display_name', 'Aluno Provisionado'),
            'subscription', jsonb_build_object('external_subscription_key', 'firestore:fs-provisioned', 'billing_cycle', 'monthly', 'lifecycle_status', 'active', 'pause_status', 'none', 'financial_status', 'unknown', 'started_at', '2026-08-10T12:00:00.000Z'),
            'service_period', jsonb_build_object('period_start', '2026-08-10', 'period_end', '2026-09-09')
          ));
          select json_build_object(
            'students', (select count(*) from public.students where firestore_student_id = 'fs-provisioned'),
            'billing', (select count(*) from public.billing_accounts where external_key = 'firestore-student:fs-provisioned'),
            'subscriptions', (select count(*) from public.subscriptions where external_subscription_key = 'firestore:fs-provisioned'),
            'periods', (select count(*) from public.service_periods sp join public.subscriptions s on s.id = sp.subscription_id where s.external_subscription_key = 'firestore:fs-provisioned')
          )::text;
        `
      );
      const reprovisionCounts = parseJson(reprovisionCountsText.trim().split("\n").pop());
      assert.deepEqual(reprovisionCounts, { students: 1, billing: 1, subscriptions: 1, periods: 1 });
      record("retention_provision_subject idempotente", "ok");

      const failedProvisionRollbackText = psql(
        harness,
        `
          do $$
          begin
            perform public.retention_provision_subject(jsonb_build_object(
              'student', jsonb_build_object('firestore_student_id', 'fs-provision-fail', 'full_name', 'Aluno Falho', 'lifecycle_status', 'active', 'pause_status', 'none'),
              'billing_account', jsonb_build_object('external_key', 'firestore-student:fs-provision-fail', 'display_name', 'Aluno Falho'),
              'subscription', jsonb_build_object('external_subscription_key', 'firestore:fs-provision-fail', 'billing_cycle', 'monthly', 'lifecycle_status', 'active', 'pause_status', 'none', 'financial_status', 'unknown', 'started_at', '2026-08-10T12:00:00.000Z'),
              'service_period', jsonb_build_object('period_start', '2026-09-10', 'period_end', '2026-09-09')
            ));
            raise exception 'expected_fail';
          exception when others then
            if SQLERRM <> 'invalid_service_period_bounds' then
              raise;
            end if;
          end $$;
          select json_build_object(
            'students', (select count(*) from public.students where firestore_student_id = 'fs-provision-fail'),
            'billing', (select count(*) from public.billing_accounts where external_key = 'firestore-student:fs-provision-fail'),
            'subscriptions', (select count(*) from public.subscriptions where external_subscription_key = 'firestore:fs-provision-fail'),
            'periods', (select count(*) from public.service_periods sp join public.subscriptions s on s.id = sp.subscription_id where s.external_subscription_key = 'firestore:fs-provision-fail')
          )::text;
        `
      );
      const failedProvisionRollback = parseJson(failedProvisionRollbackText.trim().split("\n").pop());
      assert.deepEqual(failedProvisionRollback, { students: 0, billing: 0, subscriptions: 0, periods: 0 });
      record("retention_provision_subject rollback transacional", "ok");

      const preventive = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','register_preventive_intent',
              'event_type','register_preventive_intent',
              'student_id','00000000-0000-0000-0000-000000000001',
              'subscription_id','10000000-0000-0000-0000-000000000001',
              'client_action_id','preventive-1',
              'idempotency_key','preventive-1',
              'command_fingerprint','preventive-1',
              'payload', jsonb_build_object('reason','Risco percebido'),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      assert.equal(preventive.ok, true);
      assert.equal(preventive.snapshot.case.case_kind, "preventive");
      assert.equal(preventive.snapshot.case.stage, "open");
      record("register_preventive_intent", "ok");

      const formal = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','register_formal_request',
              'event_type','register_formal_request',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','formal-1',
              'idempotency_key','formal-1',
              'command_fingerprint','formal-1',
              'payload', jsonb_build_object(
                'requested_at','2026-08-27T12:00:00.000Z',
                'first_lesson_at','2026-08-23T12:00:00.000Z',
                'reason','Pedido formal'
              ),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      const formalCaseId = formal.case_id;
      assert.equal(formal.ok, true);
      assert.equal(formal.snapshot.case.stage, "scheduled");
      assert.equal(formal.snapshot.case.lifecycle_status, "cancellation_scheduled");
      assert.equal(formal.snapshot.case.scheduled_service_end_at, "2026-09-23T12:00:00+00:00");
      record("register_formal_request + scheduled_service_end_at", "ok", { caseId: formalCaseId });

      const sameKey = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','register_formal_request',
              'event_type','register_formal_request',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','formal-1',
              'idempotency_key','formal-1',
              'command_fingerprint','formal-1',
              'payload', jsonb_build_object(
                'requested_at','2026-08-27T12:00:00.000Z',
                'first_lesson_at','2026-08-23T12:00:00.000Z',
                'reason','Pedido formal'
              ),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      assert.equal(sameKey.idempotent, true);
      record("retry mesma chave", "ok");

      const mismatch = psql(
        harness,
        `
          do $$
          begin
            perform public.retention_apply_command(jsonb_build_object(
              'command','register_formal_request',
              'event_type','register_formal_request',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','formal-1',
              'idempotency_key','formal-1',
              'command_fingerprint','formal-2',
              'payload', jsonb_build_object('requested_at','2026-08-27T12:00:00.000Z','reason','Mudou'),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ));
            raise exception 'expected_mismatch';
          exception when others then
            if SQLERRM <> 'idempotency_key_payload_mismatch' then
              raise;
            end if;
          end $$;
        `
      );
      assert.ok(mismatch.includes("DO"));
      record("mesma chave com payload diferente", "ok");

      const oldVersion = psql(
        harness,
        `
          do $$
          declare v_version integer;
          begin
            select version into v_version from public.retention_cases where id = '${formalCaseId}'::uuid;
            perform public.retention_apply_command(jsonb_build_object(
              'command','register_contact',
              'event_type','register_contact',
              'case_id','${formalCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','contact-conflict',
              'idempotency_key','contact-conflict',
              'command_fingerprint','contact-conflict',
              'expected_version', v_version,
              'payload', jsonb_build_object('detail','Contato 1'),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ));
            begin
              perform public.retention_apply_command(jsonb_build_object(
                'command','mark_awaiting_customer',
                'event_type','mark_awaiting_customer',
                'case_id','${formalCaseId}',
                'student_id','00000000-0000-0000-0000-000000000002',
                'subscription_id','10000000-0000-0000-0000-000000000002',
                'client_action_id','await-conflict',
                'idempotency_key','await-conflict',
                'command_fingerprint','await-conflict',
                'expected_version', v_version,
                'payload', '{}'::jsonb,
                'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
              ));
              raise exception 'expected_version_conflict';
            exception when others then
              if SQLERRM <> 'retention_version_conflict' then
                raise;
              end if;
            end;
          end $$;
        `
      );
      assert.ok(oldVersion.includes("DO"));
      record("optimistic locking com versão antiga", "ok");

      const caseAfterOps = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','mark_awaiting_customer',
              'event_type','mark_awaiting_customer',
              'case_id','${formalCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','await-1',
              'idempotency_key','await-1',
              'command_fingerprint','await-1',
              'payload', '{}'::jsonb,
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      assert.equal(caseAfterOps.snapshot.case.stage, "awaiting_customer");
      record("register_contact", "ok");
      record("mark_awaiting_customer", "ok");

      const continuity = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','confirm_cancellation_continuity',
              'event_type','confirm_cancellation_continuity',
              'case_id','${formalCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','continuity-1',
              'idempotency_key','continuity-1',
              'command_fingerprint','continuity-1',
              'payload', '{}'::jsonb,
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      assert.equal(continuity.snapshot.case.stage, "scheduled");
      record("confirmação de continuidade", "ok");

      const pausedBillable = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','pause_billable',
              'event_type','pause_billable',
              'case_id','${formalCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','pause-billable-1',
              'idempotency_key','pause-billable-1',
              'command_fingerprint','pause-billable-1',
              'payload', jsonb_build_object('reason','Pausa faturável'),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      assert.equal(pausedBillable.snapshot.case.lifecycle_status, "cancellation_scheduled");
      assert.equal(pausedBillable.snapshot.case.pause_status, "paused_billable");
      record("coexistência cancellation_scheduled + paused_billable", "ok");

      const resumeLessons = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','resume_lessons',
              'event_type','resume_lessons',
              'case_id','${formalCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','resume-1',
              'idempotency_key','resume-1',
              'command_fingerprint','resume-1',
              'payload', jsonb_build_object('reason','Retomada'),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      assert.equal(resumeLessons.snapshot.case.pause_status, "none");
      record("resume_lessons", "ok");

      const pausedNonBillable = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','pause_non_billable',
              'event_type','pause_non_billable',
              'case_id','${formalCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','pause-nonbillable-1',
              'idempotency_key','pause-nonbillable-1',
              'command_fingerprint','pause-nonbillable-1',
              'payload', jsonb_build_object('reason','Pausa não faturável'),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      assert.equal(pausedNonBillable.snapshot.case.lifecycle_status, "cancellation_scheduled");
      assert.equal(pausedNonBillable.snapshot.case.pause_status, "paused_non_billable");
      record("coexistência cancellation_scheduled + paused_non_billable", "ok");

      const retract = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','retract_cancellation',
              'event_type','retract_cancellation',
              'case_id','${formalCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','retract-1',
              'idempotency_key','retract-1',
              'command_fingerprint','retract-1',
              'payload', jsonb_build_object('detail','Continuou'),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      assert.equal(retract.snapshot.case.lifecycle_status, "active");
      assert.equal(retract.snapshot.case.pause_status, "paused_non_billable");
      record("retract_cancellation preservando pause status", "ok");

      const earlyChurnCase = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','register_formal_request',
              'event_type','register_formal_request',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','formal-2',
              'idempotency_key','formal-2',
              'command_fingerprint','formal-2',
              'payload', jsonb_build_object(
                'requested_at','2026-08-27T12:00:00.000Z',
                'reason','Novo pedido'
              ),
              'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
            ))::text;
          `
        )
      );
      const earlyCaseId = earlyChurnCase.case_id;
      const earlyChurn = psql(
        harness,
        `
          do $$
          begin
            perform public.retention_apply_command(jsonb_build_object(
              'command','effectuate_churn',
              'event_type','cancellation_effective',
              'case_id','${earlyCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','churn-early-1',
              'idempotency_key','churn-early-1',
              'command_fingerprint','churn-early-1',
              'payload', jsonb_build_object('mode','manual'),
              'actor', jsonb_build_object('uid','admin-1','name','Admin','role','admin')
            ));
            raise exception 'expected_early_churn_block';
          exception when others then
            if SQLERRM <> 'cannot_churn_before_scheduled_end' then
              raise;
            end if;
          end $$;
        `
      );
      assert.ok(earlyChurn.includes("DO"));
      record("churn antes da data é recusado", "ok");

      psql(
        harness,
        `
          update public.retention_cases
             set scheduled_service_end_at = '2026-08-26T00:00:00Z'
           where id = '${earlyCaseId}'::uuid;
          update public.subscriptions
             set scheduled_service_end_at = '2026-08-26T00:00:00Z',
                 lifecycle_status = 'cancellation_scheduled'
           where id = '10000000-0000-0000-0000-000000000002'::uuid;
        `
      );

      const churnOnDate = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','effectuate_churn',
              'event_type','cancellation_effective',
              'case_id','${earlyCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','churn-due-1',
              'idempotency_key','churn-due-1',
              'command_fingerprint','churn-due-1',
              'payload', jsonb_build_object('mode','manual'),
              'actor', jsonb_build_object('uid','admin-1','name','Admin','role','admin')
            ))::text;
          `
        )
      );
      assert.equal(churnOnDate.snapshot.case.stage, "lost");
      assert.equal(churnOnDate.snapshot.case.lifecycle_status, "churned");
      record("churn na data correta + caso lost", "ok");

      const reactivation = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','reactivate_subscription',
              'event_type','reactivate_subscription',
              'case_id','${earlyCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','reactivate-1',
              'idempotency_key','reactivate-1',
              'command_fingerprint','reactivate-1',
              'payload', jsonb_build_object('reason','Voltou'),
              'actor', jsonb_build_object('uid','admin-1','name','Admin','role','admin')
            ))::text;
          `
        )
      );
      assert.equal(reactivation.snapshot.case.lifecycle_status, "active");
      record("reativação depois do churn", "ok");

      const delinquency = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','delinquency_started',
              'event_type','delinquency_started',
              'case_id','${earlyCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','delinquency-1',
              'idempotency_key','delinquency-1',
              'command_fingerprint','delinquency-1',
              'payload', jsonb_build_object('reason','Atraso'),
              'actor', jsonb_build_object('uid','finance-1','name','Financeiro','role','financeiro')
            ))::text;
          `
        )
      );
      assert.equal(delinquency.snapshot.case.financial_status, "delinquent");
      record("delinquency_started", "ok");

      const recovery = parseJson(
        psql(
          harness,
          `
            select public.retention_apply_command(jsonb_build_object(
              'command','delinquency_recovered',
              'event_type','delinquency_recovered',
              'case_id','${earlyCaseId}',
              'student_id','00000000-0000-0000-0000-000000000002',
              'subscription_id','10000000-0000-0000-0000-000000000002',
              'client_action_id','delinquency-2',
              'idempotency_key','delinquency-2',
              'command_fingerprint','delinquency-2',
              'payload', jsonb_build_object('reason','Pagou'),
              'actor', jsonb_build_object('uid','finance-1','name','Financeiro','role','financeiro')
            ))::text;
          `
        )
      );
      assert.equal(recovery.snapshot.case.financial_status, "current");
      record("delinquency_recovered", "ok");

      const timeline = parseJson(
        psql(
          harness,
          `
            select public.retention_get_case_timeline('${earlyCaseId}'::uuid)::text;
          `
        )
      );
      const rebuilt = rebuildCaseProjectionFromEvents(timeline.events || []);
      assert.equal(rebuilt.lifecycleStatus, recovery.snapshot.case.lifecycle_status);
      assert.equal(rebuilt.financialStatus, recovery.snapshot.case.financial_status);
      record("rebuild por eventos", "ok", { timelineEvents: Array.isArray(timeline.events) ? timeline.events.length : 0 });

      const dryRunCountsBefore = parseJson(
        psql(
          harness,
          `
            select json_build_object(
              'students', (select count(*) from public.students),
              'subscriptions', (select count(*) from public.subscriptions),
              'cases', (select count(*) from public.retention_cases),
              'events', (select count(*) from public.retention_events)
            )::text;
          `
        )
      );
      const dryRun = parseJson(
        psql(
          harness,
          `
            select public.retention_import_legacy_snapshot(jsonb_build_object(
              'dry_run', true,
              'students', jsonb_build_array(jsonb_build_object('firestore_student_id','dry-student')),
              'subscriptions', '[]'::jsonb,
              'cases', '[]'::jsonb,
              'events', '[]'::jsonb
            ))::text;
          `
        )
      );
      const dryRunCountsAfter = parseJson(
        psql(
          harness,
          `
            select json_build_object(
              'students', (select count(*) from public.students),
              'subscriptions', (select count(*) from public.subscriptions),
              'cases', (select count(*) from public.retention_cases),
              'events', (select count(*) from public.retention_events)
            )::text;
          `
        )
      );
      assert.deepEqual(dryRunCountsAfter, dryRunCountsBefore);
      assert.equal(dryRun.dry_run, true);
      record("importação dry-run sem escrita", "ok");

      const importReal1 = parseJson(
        psql(
          harness,
          `
            select public.retention_import_legacy_snapshot(jsonb_build_object(
              'dry_run', false,
              'students', jsonb_build_array(jsonb_build_object('firestore_student_id','legacy-student','full_name','Aluno Legado','lifecycle_status','active','pause_status','none')),
              'subscriptions', jsonb_build_array(jsonb_build_object('firestore_student_id','legacy-student','external_subscription_key','legacy-sub','billing_cycle','monthly','lifecycle_status','active','pause_status','none','financial_status','unknown')),
              'cases', jsonb_build_array(jsonb_build_object('firestore_student_id','legacy-student','external_subscription_key','legacy-sub','case_kind','formal','stage','scheduled','lifecycle_status','cancellation_scheduled','pause_status','none','financial_status','unknown','scheduled_service_end_at','2026-10-27T12:00:00.000Z','source_system','legacy_import','legacy_source',jsonb_build_object('imported_from','users.cancelamento'))),
              'events', jsonb_build_array(jsonb_build_object('firestore_student_id','legacy-student','external_subscription_key','legacy-sub','event_type','legacy_import','occurred_at','2026-08-20T12:00:00.000Z','client_action_id','legacy-event-1','idempotency_key','legacy-event-1','payload',jsonb_build_object('acao','Pedido registrado')))
            ))::text;
          `
        )
      );
      assert.equal(importReal1.events_written, 1);
      const importReal2 = parseJson(
        psql(
          harness,
          `
            select public.retention_import_legacy_snapshot(jsonb_build_object(
              'dry_run', false,
              'students', jsonb_build_array(jsonb_build_object('firestore_student_id','legacy-student','full_name','Aluno Legado','lifecycle_status','active','pause_status','none')),
              'subscriptions', jsonb_build_array(jsonb_build_object('firestore_student_id','legacy-student','external_subscription_key','legacy-sub','billing_cycle','monthly','lifecycle_status','active','pause_status','none','financial_status','unknown')),
              'cases', jsonb_build_array(jsonb_build_object('firestore_student_id','legacy-student','external_subscription_key','legacy-sub','case_kind','formal','stage','scheduled','lifecycle_status','cancellation_scheduled','pause_status','none','financial_status','unknown','scheduled_service_end_at','2026-10-27T12:00:00.000Z','source_system','legacy_import','legacy_source',jsonb_build_object('imported_from','users.cancelamento'))),
              'events', jsonb_build_array(jsonb_build_object('firestore_student_id','legacy-student','external_subscription_key','legacy-sub','event_type','legacy_import','occurred_at','2026-08-20T12:00:00.000Z','client_action_id','legacy-event-1','idempotency_key','legacy-event-1','payload',jsonb_build_object('acao','Pedido registrado')))
            ))::text;
          `
        )
      );
      assert.equal(importReal2.events_skipped, 1);
      record("importação real controlada", "ok");
      record("repetição da importação sem duplicação", "ok");

      const churnJob1 = parseJson(
        psql(
          harness,
          `
            select public.retention_run_scheduled_churn(50, jsonb_build_object('uid','system:retention-cron','name','Sistema','role','system'))::text;
          `
        )
      );
      const churnJob2 = parseJson(
        psql(
          harness,
          `
            select public.retention_run_scheduled_churn(50, jsonb_build_object('uid','system:retention-cron','name','Sistema','role','system'))::text;
          `
        )
      );
      assert.equal(churnJob1.processed, 1);
      assert.equal(churnJob2.processed, 0);
      record("churn job em lote executado duas vezes", "ok");

      const appendOnlyUpdate = psql(
        harness,
        `
          do $$
          declare v_event_id uuid;
          begin
            select id into v_event_id from public.retention_events order by created_at asc limit 1;
            begin
              update public.retention_events set actor_name = 'Hack' where id = v_event_id;
              raise exception 'expected_append_only_update_block';
            exception when others then
              if SQLERRM <> 'append_only_relation' then
                raise;
              end if;
            end;
          end $$;
        `
      );
      assert.ok(appendOnlyUpdate.includes("DO"));
      record("tentativa de alterar evento append-only", "ok");

      const appendOnlyDelete = psql(
        harness,
        `
          do $$
          declare v_event_id uuid;
          begin
            select id into v_event_id from public.retention_events order by created_at asc limit 1;
            begin
              delete from public.retention_events where id = v_event_id;
              raise exception 'expected_append_only_delete_block';
            exception when others then
              if SQLERRM <> 'append_only_relation' then
                raise;
              end if;
            end;
          end $$;
        `
      );
      assert.ok(appendOnlyDelete.includes("DO"));
      record("tentativa de apagar evento append-only", "ok");

      expectDockerFailure([
        "exec",
        "-i",
        harness.containerName,
        "psql",
        "-U",
        "postgres",
        "-d",
        harness.databaseName,
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-F",
        "\t",
        "-c",
        `set role authenticated; select public.retention_list_cases('{}'::jsonb);`,
      ], /permission denied/i);
      record("chamada sem role autorizada", "ok");

      expectDockerFailure([
        "exec",
        "-i",
        harness.containerName,
        "psql",
        "-U",
        "postgres",
        "-d",
        harness.databaseName,
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-F",
        "\t",
        "-c",
        `set role ${harness.appUser}; select public.retention_list_cases('{}'::jsonb);`,
      ], /permission denied/i);
      record("chamada com capability/role insuficiente no banco", "ok");

      const serviceRoleOk = psql(
        harness,
        `
          set role service_role;
          select public.retention_list_cases('{}'::jsonb)::text;
          reset role;
        `
      );
      assert.ok(serviceRoleOk.includes("{"));

      psql(
        harness,
        `
          create or replace function public.retention_test_fail_outbox()
          returns trigger
          language plpgsql
          as $$
          begin
            raise exception 'forced_outbox_failure';
          end;
          $$;

          create trigger trg_retention_test_fail_outbox
          before insert on public.outbox_events
          for each row
          when (new.event_type = 'pause_billable')
          execute function public.retention_test_fail_outbox();
        `
      );
      const beforeFailureState = parseJson(
        psql(
          harness,
          `
            select json_build_object(
              'case_version', (select version from public.retention_cases where id = '${formalCaseId}'::uuid),
              'event_count', (select count(*) from public.retention_events where case_id = '${formalCaseId}'::uuid)
            )::text;
          `
        )
      );
      psql(
        harness,
        `
          do $$
          begin
            begin
              perform public.retention_apply_command(jsonb_build_object(
                'command','pause_billable',
                'event_type','pause_billable',
                'case_id','${formalCaseId}',
                'student_id','00000000-0000-0000-0000-000000000002',
                'subscription_id','10000000-0000-0000-0000-000000000002',
                'client_action_id','fail-atomicity-1',
                'idempotency_key','fail-atomicity-1',
                'command_fingerprint','fail-atomicity-1',
                'payload', jsonb_build_object('reason','Falha simulada'),
                'actor', jsonb_build_object('uid','growth-1','name','Growth','role','growth')
              ));
              raise exception 'expected_atomic_failure';
            exception when others then
              if SQLERRM <> 'forced_outbox_failure' then
                raise;
              end if;
            end;
          end $$;
        `
      );
      psql(
        harness,
        `
          drop trigger trg_retention_test_fail_outbox on public.outbox_events;
          drop function public.retention_test_fail_outbox();
        `
      );
      const afterFailureState = parseJson(
        psql(
          harness,
          `
            select json_build_object(
              'case_version', (select version from public.retention_cases where id = '${formalCaseId}'::uuid),
              'event_count', (select count(*) from public.retention_events where case_id = '${formalCaseId}'::uuid)
            )::text;
          `
        )
      );
      assert.deepEqual(afterFailureState, beforeFailureState);
      record("falha intermediária sem persistência parcial", "ok");

      const reconciliation = parseJson(
        psql(
          harness,
          `
            select json_build_object(
              'subscriptions', (select count(*) from public.subscriptions),
              'retention_cases', (select count(*) from public.retention_cases),
              'retention_events', (select count(*) from public.retention_events),
              'subscription_status_history', (select count(*) from public.subscription_status_history),
              'pause_status_history', (select count(*) from public.pause_status_history),
              'financial_status_history', (select count(*) from public.financial_status_history),
              'audit_logs', (select count(*) from public.audit_logs),
              'outbox_events', (select count(*) from public.outbox_events),
              'duplicate_events', (
                select count(*) from (
                  select idempotency_key from public.retention_events group by 1 having count(*) > 1
                ) dup
              ),
              'conflicting_formal_cases', (
                select count(*) from (
                  select subscription_id
                  from public.retention_cases
                  where case_kind = 'formal' and closed_at is null and stage in ('open','awaiting_customer','scheduled')
                  group by subscription_id
                  having count(*) > 1
                ) c
              ),
              'orphan_case_students', (
                select count(*) from public.retention_cases rc left join public.students s on s.id = rc.student_id where s.id is null
              ),
              'orphan_case_subscriptions', (
                select count(*) from public.retention_cases rc left join public.subscriptions sub on sub.id = rc.subscription_id where sub.id is null
              ),
              'case_version_mismatch', (
                select count(*) from public.retention_cases where version < 1
              )
            )::text;
          `
        )
      );
      assert.equal(reconciliation.duplicate_events, 0);
      assert.equal(reconciliation.conflicting_formal_cases, 0);
      assert.equal(reconciliation.orphan_case_students, 0);
      assert.equal(reconciliation.orphan_case_subscriptions, 0);
      assert.equal(reconciliation.case_version_mismatch, 0);
      const casesWithTimelines = parseJson(
        psql(
          harness,
          `
            select coalesce(json_agg(row_to_json(base)), '[]'::json)::text
            from (
              select
                rc.id::text as case_id,
                public.retention_case_snapshot(rc.id) as snapshot,
                public.retention_get_case_timeline(rc.id) as timeline
              from public.retention_cases rc
              order by rc.created_at asc, rc.id asc
            ) base;
          `
        )
      );
      const rebuildMismatches = [];
      reconciliation.rebuild_matches_materialized = (casesWithTimelines || []).every((row) => {
        const snapshotCase = row?.snapshot?.case || {};
        const events = Array.isArray(row?.timeline?.events) ? row.timeline.events : [];
        if (!events.length) return true;
        const rebuiltCase = rebuildCaseProjectionFromEvents(events);
        const matches = (
          String(rebuiltCase.stage || "") === String(snapshotCase.stage || "") &&
          String(rebuiltCase.lifecycleStatus || "") === String(snapshotCase.lifecycle_status || "") &&
          String(rebuiltCase.pauseStatus || "") === String(snapshotCase.pause_status || "") &&
          String(rebuiltCase.financialStatus || "") === String(snapshotCase.financial_status || "")
        );
        if (!matches) {
          rebuildMismatches.push({
            caseId: row?.case_id || "",
            rebuiltCase,
            snapshotCase: {
              stage: snapshotCase.stage,
              lifecycle_status: snapshotCase.lifecycle_status,
              pause_status: snapshotCase.pause_status,
              financial_status: snapshotCase.financial_status,
            },
            eventTypes: events.map((event) => event?.event_type || ""),
          });
        }
        return matches;
      });
      reconciliation.rebuild_mismatches = rebuildMismatches;
      summary.reconciliation = reconciliation;
      assert.equal(reconciliation.rebuild_matches_materialized, true);

      if (summaryPath) fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    } finally {
      cleanup();
      if (summaryPath) fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    }
  }
);
