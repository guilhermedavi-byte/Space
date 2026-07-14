#!/usr/bin/env node
/*
  Wipe escopado de um único aluno — DRY-RUN por padrão.

  Uso seguro:
    GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}' node scripts/wipe-single-student.js
    GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}' STUDENT_WIPE_CONFIRM=sim node scripts/wipe-single-student.js --apply

  Alvo padrão desta rodada:
    users/43YgxBac7gPzIViJyrrWj3o9CjU2 (Aluno Teste 01)

  Segurança:
    - Sem --apply: somente relatório, nenhuma escrita.
    - Com --apply: exige STUDENT_WIPE_CONFIRM=sim.
    - Nunca apaga admin.
    - Filtra por ID canônico exato; nome/e-mail são usados apenas para confirmar identidade
      e gerar SQL Supabase de fallback exato.
*/

const fs = require("node:fs");
const path = require("node:path");
const { getGoogleAccessToken } = require("../_lib/google-service-account");
const { FIRESTORE_BASE, PROJECT_ID, requestJson } = require("../_lib/firestore-rest");
const { listCollectionAsAdmin } = require("../api/_lib/firestore-admin");
const { inferLegacyUserRole } = require("../api/admin-data")._test;

const TARGET_STUDENT_ID = "43YgxBac7gPzIViJyrrWj3o9CjU2";
const TARGET_EXPECTED_NAME = "Aluno Teste 01";

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

const USER_SUBCOLLECTIONS = ["files"];
const ROOT_COLLECTIONS_TO_SCAN = [
  "lessonLogs",
  "aulas",
  "events",
  "classes",
  "groups",
  "teacherAlerts",
  "pedagogicalFeedbacks",
  "surveys",
  "avaliacoes",
  "recomendacoes",
  "nps",
  "avisos",
  "adminAlerts",
  "trocaProfessor",
  "teacherOnboardingProgress",
  "teacherQuizSubmissions",
  "workHours",
  "activities",
  "contratos",
];

const SUPABASE_TABLES_TO_SCAN = [
  "n8n_onboarding_alunos_space",
  "n8n_onboarding_pedagogico_space",
  "n8n_aulas_pedagogicas_space",
  "n8n_registros_aula_space",
  "n8n_ocorrencias_pedagogicas_space",
  "n8n_satisfacao_alunos_space",
  "n8n_flexge_evolucao_alunos_space",
  "n8n_professores_space",
  "n8n_relatorios_pedagogicos_space",
  "n8n_preferencias_alunos_pedagogico_space",
  "n8n_logs_pedagogico_space",
  "n8n_alunos_financeiro_space",
  "n8n_cobrancas_financeiras_space",
  "n8n_logs_cobranca_space",
  "n8n_eventos_cobranca_space",
  "n8n_pagamentos_asaas_space",
  "n8n_avaliacoes_aula_space",
  "n8n_gravacoes_aula_space",
];

const ID_FIELD_NAMES = new Set([
  "firestoreDocId",
  "firestore_doc_id",
  "studentId",
  "student_id",
  "alunoId",
  "aluno_id",
  "uid",
  "userId",
  "user_id",
]);

const EVENT_ID_FIELDS = new Set(["eventId", "event_id", "aulaId", "aula_id", "lessonId", "lesson_id"]);

const nowIso = () => new Date().toISOString();
const normalize = (value) => String(value || "").trim();
const normalizeLower = (value) => normalize(value).toLowerCase();
const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const displayName = (row = {}) =>
  normalize(row.nome || row.nomeCompleto || row.fullName || row.displayName || row.name || row.alunoNome || row.nomeAluno || row.title || row.titulo || row.email);

const sampleDoc = (row = {}) => ({
  id: normalize(row.firestoreDocId || row.id || row.uid || row.localId),
  nome: displayName(row) || null,
  email: row.email || row.alunoEmail || row.emailAluno || null,
});

const safeError = (error) => ({
  code: error?.code || "",
  message: error?.message || String(error || ""),
  status: error?.status || null,
});

const getAccessToken = async (scope) => {
  const result = await getGoogleAccessToken({ scope });
  const token = normalize(result?.accessToken);
  if (!token) throw new Error("missing_google_access_token");
  return token;
};

const listCollectionSafe = async (collectionPath, options = {}) => {
  try {
    return { ok: true, rows: await listCollectionAsAdmin(collectionPath, options) };
  } catch (error) {
    return { ok: false, rows: [], error: safeError(error) };
  }
};

const deleteFirestoreDocument = async (docPath) => {
  const token = await getAccessToken(DATASTORE_SCOPE);
  const pathSafe = normalize(docPath).replace(/^\/+/, "");
  if (!pathSafe) throw new Error("missing_doc_path");
  const response = await requestJson(`${FIRESTORE_BASE}/${encodeURI(pathSafe)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    const error = new Error("firestore_delete_failed");
    error.status = response.status;
    error.details = response.data || response.text || null;
    throw error;
  }
  return response;
};

const listAuthUsers = async () => {
  if (!PROJECT_ID) throw new Error("missing_firebase_project_id");
  const token = await getAccessToken(CLOUD_PLATFORM_SCOPE);
  const users = [];
  let nextPageToken = "";
  for (let page = 0; page < 100; page += 1) {
    const params = new URLSearchParams();
    params.set("maxResults", "1000");
    if (nextPageToken) params.set("nextPageToken", nextPageToken);
    const response = await requestJson(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/accounts:batchGet?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = new Error("firebase_auth_list_failed");
      error.status = response.status;
      error.details = response.data || response.text || null;
      throw error;
    }
    (Array.isArray(response.data?.users) ? response.data.users : []).forEach((user) => users.push(user));
    nextPageToken = normalize(response.data?.nextPageToken);
    if (!nextPageToken) break;
  }
  return users;
};

const deleteAuthUser = async (localId) => {
  if (!PROJECT_ID) throw new Error("missing_firebase_project_id");
  const token = await getAccessToken(CLOUD_PLATFORM_SCOPE);
  const response = await requestJson(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/accounts:delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { localId },
  });
  if (!response.ok) {
    const error = new Error("firebase_auth_delete_failed");
    error.status = response.status;
    error.details = response.data || response.text || null;
    throw error;
  }
  return response;
};

const rowDocId = (row = {}) => normalize(row.firestoreDocId || row.id || row.docId || row.documentId);

const valueMatchesTargetId = (value, targetId) => {
  if (typeof value === "string" || typeof value === "number") return normalize(value) === targetId;
  if (Array.isArray(value)) return value.some((item) => valueMatchesTargetId(item, targetId));
  return false;
};

const collectEventIdsFromRows = (rows = []) => unique(rows.map((row) => rowDocId(row)));

const rowReferencesTarget = (row, { targetId, targetEventIds }) => {
  if (!row || typeof row !== "object") return { match: false, reasons: [] };
  const reasons = [];
  const scan = (value, pathParts = []) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, pathParts.concat(String(index))));
      return;
    }
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, entry]) => {
      const fieldPath = pathParts.concat(key).join(".");
      if (ID_FIELD_NAMES.has(key) && valueMatchesTargetId(entry, targetId)) reasons.push(`${fieldPath}=studentId`);
      if (EVENT_ID_FIELDS.has(key) && targetEventIds.has(normalize(entry))) reasons.push(`${fieldPath}=eventId`);
      if (["linkedEventIds", "eventIds", "aulaIds", "lessonIds"].includes(key) && Array.isArray(entry) && entry.some((item) => targetEventIds.has(normalize(item)))) reasons.push(`${fieldPath}=eventIds[]`);
      if (entry && typeof entry === "object") scan(entry, pathParts.concat(key));
    });
  };
  scan(row);
  return { match: reasons.length > 0, reasons: unique(reasons) };
};

const addPlanEntry = (plan, collectionPath, row, reasons = []) => {
  const id = rowDocId(row);
  if (!id) return;
  if (!plan.firestore.byCollection[collectionPath]) {
    plan.firestore.byCollection[collectionPath] = { collection: collectionPath, count: 0, samples: [], paths: [] };
  }
  const entry = plan.firestore.byCollection[collectionPath];
  const pathValue = `${collectionPath}/${id}`;
  if (entry.paths.some((item) => item.path === pathValue)) return;
  entry.count += 1;
  entry.paths.push({ path: pathValue, reasons });
  if (entry.samples.length < 5) entry.samples.push({ ...sampleDoc(row), reasons });
};

const sqlLiteral = (value) => String(value == null ? "" : value).replace(/'/g, "''");

const buildSupabaseSql = ({ targetId, email, name }) => `-- Wipe escopado do aluno ${sqlLiteral(name || "Aluno")} (${sqlLiteral(targetId)}) no Supabase.
-- DRY-RUN: rode primeiro apenas os SELECTs gerados/inspecione as contagens se desejar.
-- APPLY MANUAL: cole este arquivo no SQL Editor do Supabase somente depois de validar o dry-run Firestore/Auth.
-- Segurança: cada DELETE usa somente firestore_doc_id/id exato e fallback exato por e-mail/nome quando a coluna existir.

begin;

do $$
declare
  target_firestore_doc_id text := '${sqlLiteral(targetId)}';
  target_email text := '${sqlLiteral(email)}';
  target_name text := '${sqlLiteral(name)}';
  target_table text;
  predicate text;
  deleted_count integer;
begin
  foreach target_table in array array[
${SUPABASE_TABLES_TO_SCAN.map((table) => `    '${table}'`).join(",\n")}
  ] loop
    predicate := '';

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'firestore_doc_id') then
      predicate := predicate || format('firestore_doc_id = %L', target_firestore_doc_id);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'student_id') then
      predicate := predicate || case when predicate = '' then '' else ' or ' end || format('student_id = %L', target_firestore_doc_id);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'aluno_id') then
      predicate := predicate || case when predicate = '' then '' else ' or ' end || format('aluno_id = %L', target_firestore_doc_id);
    end if;

    if target_email <> '' then
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'email') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(email::text)) = lower(trim(%L))', target_email);
      end if;
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'aluno_email') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(aluno_email::text)) = lower(trim(%L))', target_email);
      end if;
    end if;

    if target_name <> '' then
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'nome') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(nome::text)) = lower(trim(%L))', target_name);
      end if;
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'aluno_nome') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(aluno_nome::text)) = lower(trim(%L))', target_name);
      end if;
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = target_table and column_name = 'nome_aluno') then
        predicate := predicate || case when predicate = '' then '' else ' or ' end || format('lower(trim(nome_aluno::text)) = lower(trim(%L))', target_name);
      end if;
    end if;

    if predicate <> '' then
      execute format('delete from public.%I where %s', target_table, predicate);
      get diagnostics deleted_count = row_count;
      raise notice 'deleted % from %', deleted_count, target_table;
    else
      raise notice 'skipped %, no known matching columns', target_table;
    end if;
  end loop;
end $$;

-- Revise os NOTICEs antes de confirmar.
commit;
`;

const writeSupabaseSql = (identity) => {
  const filePath = path.join(process.cwd(), "scripts", `wipe-single-student-${identity.targetId}.supabase.sql`);
  fs.writeFileSync(filePath, buildSupabaseSql(identity));
  return filePath;
};

const buildPlan = async ({ targetId }) => {
  const plan = {
    generatedAt: nowIso(),
    mode: "dry-run",
    target: { id: targetId, expectedName: TARGET_EXPECTED_NAME },
    identity: { confirmed: false, usersDoc: null, matchesByNameOrEmail: [], warnings: [] },
    firestore: { projectId: PROJECT_ID || null, byCollection: {}, readErrors: [] },
    auth: { ok: false, total: 0, toDelete: 0, samples: [], preservedAdminMatches: [], error: null },
    supabase: { sqlFile: null, tablesCovered: SUPABASE_TABLES_TO_SCAN, note: "SQL gerado para execução manual; nenhuma chamada Supabase foi executada pelo script." },
  };

  const usersResult = await listCollectionSafe("users", { pageSize: 3000 });
  if (!usersResult.ok) {
    plan.firestore.readErrors.push({ collection: "users", error: usersResult.error });
    throw new Error(`users_list_failed: ${usersResult.error?.message || "unknown"}`);
  }
  const users = usersResult.rows;
  const targetUser = users.find((row) => rowDocId(row) === targetId) || null;
  if (!targetUser) throw new Error(`target_user_not_found:${targetId}`);

  const role = inferLegacyUserRole(targetUser);
  const name = displayName(targetUser);
  const email = normalizeLower(targetUser.email || targetUser.alunoEmail || targetUser.emailAluno);
  plan.identity.usersDoc = { ...sampleDoc(targetUser), role, tipo: targetUser.tipo || targetUser.role || null, ativo: targetUser.ativo ?? null, createdAt: targetUser.createdAt || null, updatedAt: targetUser.updatedAt || null };
  plan.identity.confirmed = role === "student" && normalizeLower(name) === normalizeLower(TARGET_EXPECTED_NAME);
  if (role === "admin") throw new Error("refusing_to_wipe_admin_user");
  if (role !== "student") plan.identity.warnings.push(`target_role_is_${role || "unknown"}`);
  if (normalizeLower(name) !== normalizeLower(TARGET_EXPECTED_NAME)) plan.identity.warnings.push(`name_mismatch:${name}`);

  plan.identity.matchesByNameOrEmail = users
    .filter((row) => rowDocId(row) !== targetId)
    .filter((row) => (email && normalizeLower(row.email || row.alunoEmail || row.emailAluno) === email) || (name && normalizeLower(displayName(row)) === normalizeLower(name)))
    .map((row) => ({ ...sampleDoc(row), role: inferLegacyUserRole(row) }));

  addPlanEntry(plan, "users", targetUser, ["target_user_doc"]);

  for (const subcollection of USER_SUBCOLLECTIONS) {
    const pathValue = `users/${targetId}/${subcollection}`;
    const result = await listCollectionSafe(pathValue, { pageSize: 1000 });
    if (!result.ok) {
      plan.firestore.readErrors.push({ collection: pathValue, error: result.error });
      continue;
    }
    result.rows.forEach((row) => addPlanEntry(plan, pathValue, row, ["target_user_subcollection"]));
  }

  const scanned = {};
  for (const collection of ROOT_COLLECTIONS_TO_SCAN) {
    const result = await listCollectionSafe(collection, { pageSize: 3000 });
    if (!result.ok) {
      plan.firestore.readErrors.push({ collection, error: result.error });
      scanned[collection] = [];
      continue;
    }
    scanned[collection] = result.rows;
  }

  const targetEventRows = [];
  ["aulas", "events"].forEach((collection) => {
    (scanned[collection] || []).forEach((row) => {
      const match = rowReferencesTarget(row, { targetId, targetEventIds: new Set() });
      if (match.match) {
        targetEventRows.push(row);
        addPlanEntry(plan, collection, row, match.reasons);
      }
    });
  });
  const targetEventIds = new Set(collectEventIdsFromRows(targetEventRows));

  ROOT_COLLECTIONS_TO_SCAN.forEach((collection) => {
    if (collection === "aulas" || collection === "events") return;
    (scanned[collection] || []).forEach((row) => {
      const match = rowReferencesTarget(row, { targetId, targetEventIds });
      if (match.match) addPlanEntry(plan, collection, row, match.reasons);
    });
  });

  try {
    const authUsers = await listAuthUsers();
    const matches = authUsers.filter((user) => normalize(user.localId) === targetId || (email && normalizeLower(user.email) === email));
    const toDelete = matches.filter((user) => normalizeLower(user.email) !== "guilhermedavi@spaceschoolbr.com");
    const preserved = matches.filter((user) => normalizeLower(user.email) === "guilhermedavi@spaceschoolbr.com");
    plan.auth.ok = true;
    plan.auth.total = authUsers.length;
    plan.auth.toDelete = toDelete.length;
    plan.auth.samples = toDelete.map((user) => ({ localId: user.localId || null, email: user.email || null, displayName: user.displayName || null }));
    plan.auth.preservedAdminMatches = preserved.map((user) => ({ localId: user.localId || null, email: user.email || null, displayName: user.displayName || null }));
  } catch (error) {
    plan.auth.error = safeError(error);
  }

  plan.supabase.sqlFile = writeSupabaseSql({ targetId, email, name });
  return plan;
};

const applyPlan = async (plan) => {
  const report = { startedAt: nowIso(), firestoreDeleted: {}, authDeleted: 0, errors: [] };
  for (const entry of Object.values(plan.firestore.byCollection)) {
    for (const item of entry.paths) {
      try {
        await deleteFirestoreDocument(item.path);
        report.firestoreDeleted[entry.collection] = (report.firestoreDeleted[entry.collection] || 0) + 1;
        process.stderr.write(`[wipe-single-student] deleted ${item.path}\n`);
      } catch (error) {
        report.errors.push({ action: "delete_firestore", path: item.path, error: safeError(error) });
      }
    }
  }
  if (plan.auth.ok) {
    for (const user of plan.auth.samples) {
      if (!user.localId) continue;
      try {
        await deleteAuthUser(user.localId);
        report.authDeleted += 1;
        process.stderr.write(`[wipe-single-student] deleted auth ${user.localId}\n`);
      } catch (error) {
        report.errors.push({ action: "delete_auth", localId: user.localId, email: user.email, error: safeError(error) });
      }
    }
  }
  report.finishedAt = nowIso();
  return report;
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  const idArg = process.argv.find((arg) => arg.startsWith("--studentId="));
  const targetId = normalize(idArg ? idArg.split("=").slice(1).join("=") : TARGET_STUDENT_ID) || TARGET_STUDENT_ID;
  if (apply && normalizeLower(process.env.STUDENT_WIPE_CONFIRM) !== "sim") {
    throw new Error("apply_requires_STUDENT_WIPE_CONFIRM_sim");
  }
  const plan = await buildPlan({ targetId });
  plan.mode = apply ? "apply" : "dry-run";
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  if (apply) {
    const report = await applyPlan(plan);
    process.stdout.write(`${JSON.stringify({ mode: "apply-result", report }, null, 2)}\n`);
    if (report.errors.length) process.exitCode = 1;
  }
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error?.code || error?.message || "wipe_single_student_failed", message: error?.message || "wipe_single_student_failed" }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildPlan, buildSupabaseSql, rowReferencesTarget, TARGET_STUDENT_ID };
