#!/usr/bin/env node
/*
  Wipe controlado de dados operacionais de PRODUÇÃO da Space — DRY-RUN por padrão.

  OBJETIVO
    Zerar alunos e operação pedagógica antes da abertura oficial para coordenação,
    preservando contas administrativas/coordenação, professores, configurações e conteúdos.

  USO SEGURO
    # Dry-run + backup JSON local, sem deletes:
    APP_ENV=production GOOGLE_SERVICE_ACCOUNT_JSON='{"project_id":"plataforma-space",...}' \
      SUPABASE_URL='https://...supabase.co' SUPABASE_SERVICE_ROLE_KEY='...' \
      node scripts/wipe-production-data.js

    # Execução real, após revisar o backup e o relatório:
    APP_ENV=production PROD_WIPE_CONFIRM='CONFIRMO PRODUCAO' \
      GOOGLE_SERVICE_ACCOUNT_JSON='{"project_id":"plataforma-space",...}' \
      SUPABASE_URL='https://...supabase.co' SUPABASE_SERVICE_ROLE_KEY='...' \
      node scripts/wipe-production-data.js --apply

  TRAVAS
    - Sem --apply: nunca apaga nada.
    - Com --apply: exige PROD_WIPE_CONFIRM exatamente igual a CONFIRMO PRODUCAO.
    - Aborta se o projeto Firestore não for plataforma-space.
    - Aborta se APP_ENV/SPACE_APP_ENV/VERCEL_ENV indicar staging/preview.
    - Antes de qualquer delete, grava backup JSON de tudo que será apagado.

  ESCOPO APAGA
    Firestore:
      - users classificados como student/aluno.
      - users/{id}/files desses alunos.
      - aulas, events, lessonLogs, classes, groups.
      - dados operacionais derivados listados em ROOT_COLLECTIONS_TO_DELETE.
    Firebase Auth:
      - contas Auth vinculadas aos alunos apagados, desde que não sejam admin/coord/professor.
    Supabase:
      - tabelas operacionais/pedagógicas/financeiras listadas em SUPABASE_TABLES_TO_WIPE.

  PRESERVA SEMPRE
    - users com papel admin, coordenação/coordinator/coord, teacher/professor.
    - contas Auth desses perfis preservados.
    - plans, onboardingContents, onboardingQuizzes, config/*.
    - Growth/Outbound/SDR/metas/copilot e qualquer tabela fora de SUPABASE_TABLES_TO_WIPE.

  IMPORTANTE — CORTES POR DATA EM AULAS/AGENDA
    Quando a limpeza for por período (ex.: "apagar tudo antes de 23/07/2026"),
    a coleção Firestore `aulas` deve usar `dateKey` local (America/Sao_Paulo)
    como fonte canônica de data de agenda.

    NÃO usar `data`/timestamp UTC como critério primário para decidir se uma aula
    é "antes" ou "depois" do corte, porque aulas noturnas de 22:00/23:00 locais
    podem cair em 00:00+/UTC do dia seguinte e escapar indevidamente do wipe.

    Em resumo:
    - Agenda/recorrência: comparar por `dateKey` local.
    - Tabelas operacionais em timestamp puro (ex.: Supabase `inicio`): comparar por
      timestamp, mas sempre revisando o timezone de referência do processo.
*/

const fs = require("node:fs");
const path = require("node:path");
const { getGoogleAccessToken } = require("../_lib/google-service-account");
const { FIRESTORE_BASE, PROJECT_ID, requestJson } = require("../_lib/firestore-rest");
const { listCollectionAsAdmin } = require("../api/_lib/firestore-admin");
const { inferLegacyUserRole } = require("../api/admin-data")._test;

const EXPECTED_PROD_PROJECT_ID = "plataforma-space";
const REQUIRED_CONFIRMATION = "CONFIRMO PRODUCAO";
const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

const USER_SUBCOLLECTIONS_TO_DELETE = ["files"];

const ROOT_COLLECTIONS_TO_DELETE = [
  "aulas",
  "events",
  "lessonLogs",
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

const FIRESTORE_COLLECTIONS_PRESERVED = [
  "users/admin|coord|teacher|professor",
  "plans",
  "onboardingContents",
  "onboardingQuizzes",
  "config/*",
];

const SUPABASE_TABLES_TO_WIPE = [
  "n8n_avaliacoes_aula_space",
  "n8n_gravacoes_aula_space",
  "n8n_registros_aula_space",
  "n8n_ocorrencias_pedagogicas_space",
  "n8n_satisfacao_alunos_space",
  "n8n_flexge_evolucao_alunos_space",
  "n8n_preferencias_alunos_pedagogico_space",
  "n8n_relatorios_pedagogicos_space",
  "n8n_logs_pedagogico_space",
  "n8n_logs_cobranca_space",
  "n8n_eventos_cobranca_space",
  "n8n_pagamentos_asaas_space",
  "n8n_cobrancas_financeiras_space",
  "n8n_aulas_pedagogicas_space",
  "n8n_onboarding_pedagogico_space",
  "n8n_onboarding_alunos_space",
  "n8n_alunos_financeiro_space",
];

const SUPABASE_TABLES_PRESERVED = [
  "n8n_professores_space",
  "growth_sales_*",
  "growth_copilot_*",
  "outbound_*",
  "sales_goals",
  "sdr_*",
  "seller_goals",
  "space_financeiro_cpf_sources",
];

const SUPABASE_DELETE_KEY_CANDIDATES = [
  "id",
  "uuid",
  "firestore_doc_id",
  "aluno_id",
  "student_id",
  "aula_id",
  "lesson_id",
  "event_id",
  "asaas_id",
  "payment_id",
  "created_at",
  "updated_at",
];

const nowIso = () => new Date().toISOString();
const normalize = (value) => String(value || "").trim();
const normalizeLower = (value) => normalize(value).toLowerCase();
const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const safeError = (error) => ({
  code: error?.code || "",
  message: error?.message || String(error || ""),
  status: error?.status || null,
});

const displayName = (row = {}) =>
  normalize(row.nome || row.nomeCompleto || row.fullName || row.displayName || row.name || row.alunoNome || row.nomeAluno || row.email || row.title || row.titulo);

const sampleRow = (row = {}) => ({
  id: normalize(row.firestoreDocId || row.id || row.docId || row.uid || row.localId),
  nome: displayName(row) || null,
  email: row.email || row.alunoEmail || row.emailAluno || null,
});

const getAppEnvRaw = () => normalizeLower(process.env.APP_ENV || process.env.SPACE_APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV);

const parseServiceAccountProjectId = () => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!raw) return "";
  try {
    return normalize(JSON.parse(raw)?.project_id);
  } catch {
    return "";
  }
};

const assertProductionTarget = () => {
  const appEnv = getAppEnvRaw();
  const serviceAccountProjectId = parseServiceAccountProjectId();
  const effectiveProjectId = normalize(PROJECT_ID || serviceAccountProjectId);

  if (/staging|preview|homolog/.test(appEnv)) {
    throw new Error(`refusing_to_run_outside_production_env:${appEnv}`);
  }
  if (effectiveProjectId !== EXPECTED_PROD_PROJECT_ID) {
    throw new Error(`refusing_wrong_firestore_project:${effectiveProjectId || "missing"}`);
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_STAGING || process.env.FIREBASE_SERVICE_ACCOUNT_JSON_STAGING) {
    throw new Error("refusing_staging_service_account_env_present");
  }
  return { appEnv: appEnv || "not_set", firestoreProjectId: effectiveProjectId };
};

const assertApplyConfirmation = () => {
  if (process.env.PROD_WIPE_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`missing_confirmation_set_PROD_WIPE_CONFIRM_to_${REQUIRED_CONFIRMATION.replace(/ /g, "_")}`);
  }
};

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
  const response = await requestJson(`${FIRESTORE_BASE}/${encodeURI(docPath.replace(/^\/+/, ""))}`, {
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

const supabaseConfig = () => ({
  url: normalize(process.env.SUPABASE_URL).replace(/\/+$/, ""),
  key: normalize(process.env.SUPABASE_SERVICE_ROLE_KEY),
});

const supabaseRequest = async (table, { method = "GET", query = "", body } = {}) => {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error("missing_supabase_url_or_service_role_key");
  const endpoint = `${url}/rest/v1/${encodeURIComponent(table)}${query ? `?${query}` : ""}`;
  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: method === "DELETE" ? "return=representation" : "count=exact",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(`supabase_${method.toLowerCase()}_${table}_failed`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return { ok: true, status: response.status, data, count: response.headers.get("content-range") || "" };
};

const listSupabaseTable = async (table) => {
  const rows = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const query = new URLSearchParams();
    query.set("select", "*");
    query.set("limit", "1000");
    query.set("offset", String(offset));
    const result = await supabaseRequest(table, { query: query.toString() });
    const page = Array.isArray(result.data) ? result.data : [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
};

const chooseSupabaseDeleteKey = (rows = []) => {
  for (const key of SUPABASE_DELETE_KEY_CANDIDATES) {
    if (rows.some((row) => Object.prototype.hasOwnProperty.call(row, key) && row[key] != null && String(row[key]) !== "")) return key;
  }
  return "";
};

const deleteSupabaseRows = async (table, rows = [], key) => {
  if (!rows.length) return 0;
  if (!key) throw new Error(`supabase_delete_key_missing:${table}`);
  const values = rows.map((row) => row[key]).filter((value) => value != null && String(value) !== "");
  if (values.length !== rows.length) throw new Error(`supabase_delete_key_has_nulls:${table}.${key}`);
  let deleted = 0;
  for (const batch of chunk(values, 100)) {
    const encoded = batch.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(",");
    const query = `${encodeURIComponent(key)}=in.(${encoded})`;
    const result = await supabaseRequest(table, { method: "DELETE", query });
    deleted += Array.isArray(result.data) ? result.data.length : 0;
  }
  return deleted;
};

const roleOfUser = (row = {}) => normalizeLower(inferLegacyUserRole(row) || row.role || row.tipo || row.type || row.perfil);
const isStudentUser = (row = {}) => ["student", "aluno"].includes(roleOfUser(row));
const isPreservedUser = (row = {}) => ["admin", "coord", "coordinator", "teacher", "professor"].includes(roleOfUser(row));

const addFirestorePlanEntry = (plan, collection, row, reason = "delete") => {
  const id = normalize(row.firestoreDocId || row.id || row.docId || row.documentId);
  if (!id) return;
  if (!plan.firestore.byCollection[collection]) {
    plan.firestore.byCollection[collection] = { collection, count: 0, samples: [], paths: [] };
  }
  const entry = plan.firestore.byCollection[collection];
  const pathValue = `${collection}/${id}`;
  if (entry.paths.includes(pathValue)) return;
  entry.count += 1;
  entry.paths.push(pathValue);
  if (entry.samples.length < 5) entry.samples.push({ ...sampleRow(row), reason });
};

const buildPlan = async () => {
  const target = assertProductionTarget();
  const plan = {
    generatedAt: nowIso(),
    mode: "dry-run",
    target,
    preserved: {
      firestoreCollections: FIRESTORE_COLLECTIONS_PRESERVED,
      supabaseTables: SUPABASE_TABLES_PRESERVED,
      userDocs: [],
      authUsers: [],
    },
    firestore: { byCollection: {}, errors: [] },
    auth: { total: 0, toDelete: 0, usersToDelete: [], samples: [], errors: [] },
    supabase: { byTable: {}, errors: [] },
  };

  const usersResult = await listCollectionSafe("users", { pageSize: 2000 });
  const users = usersResult.rows;
  if (!usersResult.ok) plan.firestore.errors.push({ collection: "users", error: usersResult.error });

  const students = users.filter(isStudentUser);
  const preservedUsers = users.filter(isPreservedUser);
  const preservedEmails = new Set(preservedUsers.map((row) => normalizeLower(row.email)).filter(Boolean));
  const studentIds = new Set(students.map((row) => normalize(row.firestoreDocId || row.id)).filter(Boolean));
  const studentEmails = new Set(students.map((row) => normalizeLower(row.email)).filter(Boolean));

  preservedUsers.forEach((row) => plan.preserved.userDocs.push(sampleRow(row)));
  students.forEach((row) => addFirestorePlanEntry(plan, "users", row, "student_user"));

  for (const studentId of studentIds) {
    for (const sub of USER_SUBCOLLECTIONS_TO_DELETE) {
      const result = await listCollectionSafe(`users/${studentId}/${sub}`, { pageSize: 1000 });
      if (!result.ok) {
        plan.firestore.errors.push({ collection: `users/${studentId}/${sub}`, error: result.error });
        continue;
      }
      result.rows.forEach((row) => addFirestorePlanEntry(plan, `users/${studentId}/${sub}`, row, "student_subcollection"));
    }
  }

  for (const collection of ROOT_COLLECTIONS_TO_DELETE) {
    const result = await listCollectionSafe(collection, { pageSize: 2000 });
    if (!result.ok) {
      plan.firestore.errors.push({ collection, error: result.error });
      continue;
    }
    result.rows.forEach((row) => addFirestorePlanEntry(plan, collection, row, "operational_collection"));
  }

  try {
    const authUsers = await listAuthUsers();
    plan.auth.total = authUsers.length;
    authUsers.forEach((user) => {
      const email = normalizeLower(user.email);
      const localId = normalize(user.localId);
      const shouldDelete = localId && (studentIds.has(localId) || (email && studentEmails.has(email))) && !preservedEmails.has(email);
      if (shouldDelete) {
        plan.auth.toDelete += 1;
        plan.auth.usersToDelete.push({ localId, email });
        if (plan.auth.samples.length < 5) plan.auth.samples.push({ localId, email });
      } else if (preservedEmails.has(email)) {
        plan.preserved.authUsers.push({ localId, email });
      }
    });
  } catch (error) {
    plan.auth.errors.push(safeError(error));
  }

  for (const table of SUPABASE_TABLES_TO_WIPE) {
    try {
      const rows = await listSupabaseTable(table);
      const deleteKey = chooseSupabaseDeleteKey(rows);
      plan.supabase.byTable[table] = {
        table,
        count: rows.length,
        deleteKey: deleteKey || null,
        samples: rows.slice(0, 5).map(sampleRow),
        canDeleteViaRest: rows.length === 0 || Boolean(deleteKey),
      };
    } catch (error) {
      plan.supabase.errors.push({ table, error: safeError(error) });
    }
  }

  return plan;
};

const backupForPlan = async (plan) => {
  const backup = {
    generatedAt: nowIso(),
    target: plan.target,
    firestore: {},
    auth: { usersToDelete: [] },
    supabase: {},
  };

  for (const [collection, entry] of Object.entries(plan.firestore.byCollection)) {
    backup.firestore[collection] = [];
    for (const docPath of entry.paths) {
      const id = docPath.split("/").pop();
      const rows = await listCollectionSafe(collection, { pageSize: 2000 });
      const found = rows.rows.find((row) => normalize(row.firestoreDocId || row.id) === id);
      if (found) backup.firestore[collection].push(found);
    }
  }

  try {
    const authUsers = await listAuthUsers();
    const deleteEmails = new Set(plan.auth.usersToDelete.map((user) => normalizeLower(user.email)).filter(Boolean));
    const deleteIds = new Set(plan.auth.usersToDelete.map((user) => normalize(user.localId)).filter(Boolean));
    backup.auth.usersToDelete = authUsers
      .filter((user) => deleteIds.has(normalize(user.localId)) || deleteEmails.has(normalizeLower(user.email)))
      .map((user) => ({ localId: user.localId, email: user.email, disabled: user.disabled || false, createdAt: user.createdAt || null, lastLoginAt: user.lastLoginAt || null }));
  } catch (error) {
    backup.auth.error = safeError(error);
  }

  for (const table of Object.keys(plan.supabase.byTable)) {
    backup.supabase[table] = await listSupabaseTable(table).catch((error) => ({ error: safeError(error) }));
  }

  return backup;
};

const writeBackup = (backup) => {
  const dir = path.join(process.cwd(), "backups", "production-wipe");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `production-wipe-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  return file;
};

const collectPlanErrors = (plan) => [
  ...(Array.isArray(plan.firestore?.errors) ? plan.firestore.errors.map((entry) => ({ scope: "firestore", ...entry })) : []),
  ...(Array.isArray(plan.auth?.errors) ? plan.auth.errors.map((entry) => ({ scope: "auth", error: entry })) : []),
  ...(Array.isArray(plan.supabase?.errors) ? plan.supabase.errors.map((entry) => ({ scope: "supabase", ...entry })) : []),
];

const applyPlan = async (plan) => {
  const result = { firestoreDeleted: {}, authDeleted: 0, supabaseDeleted: {}, errors: [] };

  for (const [collection, entry] of Object.entries(plan.firestore.byCollection)) {
    result.firestoreDeleted[collection] = 0;
    for (const docPath of entry.paths) {
      try {
        await deleteFirestoreDocument(docPath);
        result.firestoreDeleted[collection] += 1;
      } catch (error) {
        result.errors.push({ scope: "firestore", path: docPath, error: safeError(error) });
      }
    }
  }

  const authUsers = await listAuthUsers().catch(() => []);
  const plannedAuth = new Set(plan.auth.usersToDelete.map((user) => normalize(user.localId)).filter(Boolean));
  for (const user of authUsers) {
    const localId = normalize(user.localId);
    if (!plannedAuth.has(localId)) continue;
    try {
      await deleteAuthUser(localId);
      result.authDeleted += 1;
    } catch (error) {
      result.errors.push({ scope: "auth", localId, error: safeError(error) });
    }
  }

  for (const [table, entry] of Object.entries(plan.supabase.byTable)) {
    result.supabaseDeleted[table] = 0;
    if (!entry.count) continue;
    if (!entry.canDeleteViaRest || !entry.deleteKey) {
      result.errors.push({ scope: "supabase", table, error: { message: "delete_key_missing_or_unverifiable" } });
      continue;
    }
    try {
      const rows = await listSupabaseTable(table);
      result.supabaseDeleted[table] = await deleteSupabaseRows(table, rows, entry.deleteKey);
    } catch (error) {
      result.errors.push({ scope: "supabase", table, error: safeError(error) });
    }
  }

  return result;
};

const run = async () => {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const plan = await buildPlan();
  const planErrors = collectPlanErrors(plan);
  if (apply && planErrors.length) {
    const error = new Error("production_wipe_plan_has_errors_aborting_before_delete");
    error.details = planErrors;
    throw error;
  }
  const backup = await backupForPlan(plan);
  const backupFile = writeBackup(backup);

  const report = {
    ...plan,
    mode: apply ? "apply" : "dry-run",
    backupFile,
    confirmationRequired: REQUIRED_CONFIRMATION,
  };

  if (!apply) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  assertApplyConfirmation();
  const undeletableSupabaseTables = Object.values(plan.supabase.byTable).filter((entry) => entry.count > 0 && !entry.canDeleteViaRest);
  if (undeletableSupabaseTables.length) {
    throw new Error(`supabase_tables_without_safe_delete_key:${undeletableSupabaseTables.map((entry) => entry.table).join(",")}`);
  }
  const applyResult = await applyPlan(plan);
  process.stdout.write(`${JSON.stringify({ ...report, applyResult }, null, 2)}\n`);
};

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error?.message || String(error), details: error?.details || null }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_PROD_PROJECT_ID,
  REQUIRED_CONFIRMATION,
  ROOT_COLLECTIONS_TO_DELETE,
  SUPABASE_TABLES_TO_WIPE,
  SUPABASE_TABLES_PRESERVED,
  FIRESTORE_COLLECTIONS_PRESERVED,
  buildPlan,
};
