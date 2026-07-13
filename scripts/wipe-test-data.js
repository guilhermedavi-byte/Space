#!/usr/bin/env node
/*
  Wipe de dados de teste da Space — DRY-RUN por padrão.

  Como executar:
    GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}' node scripts/wipe-test-data.js
    GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}' WIPE_CONFIRM=sim node scripts/wipe-test-data.js --apply

  Variáveis aceitas para a service account:
    - GOOGLE_SERVICE_ACCOUNT_JSON ou FIREBASE_SERVICE_ACCOUNT_JSON
    - GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY
    - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY

  Segurança:
    - Sem --apply: somente relatório, nenhuma escrita.
    - Com --apply: exige WIPE_CONFIRM=sim.
    - Preserva sempre users classificados como admin e contas Auth ligadas a esses admins.
    - Apaga documentos, nunca a estrutura das coleções.
*/

const { getGoogleAccessToken } = require("../_lib/google-service-account");
const {
  FIRESTORE_BASE,
  PROJECT_ID,
  requestJson,
} = require("../_lib/firestore-rest");
const { listCollectionAsAdmin } = require("../api/_lib/firestore-admin");
const { inferLegacyUserRole } = require("../api/admin-data")._test;

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

const PRESERVED_COLLECTIONS = ["plans", "onboardingContents", "onboardingQuizzes"];

const CONFIG_DOCS_TO_RESET = ["teacherRanking"];

const REFERENCE_FIELD_PATTERNS = [
  /^(aluno|student|teacher|professor|user|responsavel|createdBy|criadoPor|autor|owner)(Id|Uid|UID|_id)?$/i,
  /(aluno|student|teacher|professor|user|responsavel).*(Id|Uid|UID|_id)$/i,
  /^(studentIds|teacherIds|professorIds|alunoIds|userIds|responsavelIds)$/i,
];

const nowIso = () => new Date().toISOString();

const normalize = (value) => String(value || "").trim();

const normalizeEmail = (value) => normalize(value).toLowerCase();

const displayName = (row = {}) =>
  normalize(row.nome || row.nomeCompleto || row.fullName || row.displayName || row.name || row.email || row.title || row.titulo || row.nomeAluno || row.alunoNome || row.professorNome);

const sampleDoc = (row = {}) => ({
  id: normalize(row.firestoreDocId || row.id || row.uid || row.localId),
  nome: displayName(row) || null,
  email: row.email || null,
});

const safeError = (error) => ({
  code: error?.code || "",
  message: error?.message || String(error || ""),
  status: error?.status || null,
});

const getAccessToken = async (scope = DATASTORE_SCOPE) => {
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
  const path = normalize(docPath).replace(/^\/+/, "");
  if (!path) throw new Error("missing_doc_path");
  const response = await requestJson(`${FIRESTORE_BASE}/${encodeURI(path)}`, {
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

const patchFirestoreDocument = async (docPath, fields) => {
  const token = await getAccessToken(DATASTORE_SCOPE);
  const path = normalize(docPath).replace(/^\/+/, "");
  const params = new URLSearchParams();
  Object.keys(fields || {}).forEach((fieldPath) => params.append("updateMask.fieldPaths", fieldPath));
  const response = await requestJson(`${FIRESTORE_BASE}/${encodeURI(path)}?${params.toString()}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: { fields: Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, value])) },
  });
  if (!response.ok) {
    const error = new Error("firestore_patch_failed");
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
    const url = `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/accounts:batchGet?${params.toString()}`;
    const response = await requestJson(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = new Error("firebase_auth_list_failed");
      error.status = response.status;
      error.details = response.data || response.text || null;
      throw error;
    }
    const pageUsers = Array.isArray(response.data?.users) ? response.data.users : [];
    pageUsers.forEach((user) => users.push(user));
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

const isAdminUser = (row = {}) => inferLegacyUserRole(row) === "admin";
const isTestUserRole = (row = {}) => {
  const role = inferLegacyUserRole(row);
  return role === "student" || role === "teacher";
};

const collectReferenceValues = (value, pathParts = [], out = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectReferenceValues(item, pathParts.concat(String(index)), out));
    return out;
  }
  if (!value || typeof value !== "object") return out;
  Object.entries(value).forEach(([key, entry]) => {
    const nextPath = pathParts.concat(key);
    const keyLooksLikeReference = REFERENCE_FIELD_PATTERNS.some((pattern) => pattern.test(key));
    if (keyLooksLikeReference) {
      if (typeof entry === "string" || typeof entry === "number") {
        const id = normalize(entry);
        if (id) out.push({ id, fieldPath: nextPath.join(".") });
      } else if (Array.isArray(entry)) {
        entry.forEach((item, index) => {
          if (typeof item === "string" || typeof item === "number") {
            const id = normalize(item);
            if (id) out.push({ id, fieldPath: nextPath.concat(String(index)).join(".") });
          }
        });
      }
    }
    if (entry && typeof entry === "object") collectReferenceValues(entry, nextPath, out);
  });
  return out;
};

const addPlanEntry = (plan, collectionPath, row, action = "delete") => {
  const path = `${collectionPath}/${normalize(row.firestoreDocId || row.id)}`;
  if (!plan.byCollection[collectionPath]) {
    plan.byCollection[collectionPath] = {
      collection: collectionPath,
      action,
      count: 0,
      samples: [],
      paths: [],
    };
  }
  const entry = plan.byCollection[collectionPath];
  entry.count += 1;
  entry.paths.push(path);
  if (entry.samples.length < 5) entry.samples.push(sampleDoc(row));
};

const buildPlan = async () => {
  const plan = {
    generatedAt: nowIso(),
    mode: "dry-run",
    firestoreProjectId: PROJECT_ID || null,
    firestoreBase: FIRESTORE_BASE || null,
    byCollection: {},
    preserved: {
      adminUserDocs: [],
      adminAuthEmails: [],
      adminAuthLocalIds: [],
      collections: PRESERVED_COLLECTIONS,
      configDocs: ["config/*", "config/teacherRanking resetado para vazio em --apply"],
    },
    auth: {
      ok: false,
      total: 0,
      toDelete: 0,
      samples: [],
      preserved: [],
      error: null,
    },
    integrity: {
      orphanReferences: [],
      containsUsers54: false,
      summary: {},
    },
    readErrors: [],
  };

  const usersResult = await listCollectionSafe("users", { pageSize: 2000 });
  if (!usersResult.ok) {
    plan.readErrors.push({ collection: "users", error: usersResult.error });
    throw new Error(`users_list_failed: ${usersResult.error?.message || "unknown"}`);
  }

  const users = usersResult.rows;
  const userIds = new Set(users.map((row) => normalize(row.firestoreDocId || row.id)).filter(Boolean));
  const adminUsers = users.filter(isAdminUser);
  const usersToDelete = users.filter(isTestUserRole);

  adminUsers.forEach((row) => {
    const id = normalize(row.firestoreDocId || row.id);
    const email = normalizeEmail(row.email);
    plan.preserved.adminUserDocs.push(sampleDoc(row));
    if (email) plan.preserved.adminAuthEmails.push(email);
    if (id) plan.preserved.adminAuthLocalIds.push(id);
  });
  plan.preserved.adminAuthEmails = Array.from(new Set(plan.preserved.adminAuthEmails)).sort();
  plan.preserved.adminAuthLocalIds = Array.from(new Set(plan.preserved.adminAuthLocalIds)).sort();

  usersToDelete.forEach((row) => addPlanEntry(plan, "users", row));

  for (const row of usersToDelete) {
    const id = normalize(row.firestoreDocId || row.id);
    if (!id) continue;
    for (const subcollection of USER_SUBCOLLECTIONS_TO_DELETE) {
      const path = `users/${id}/${subcollection}`;
      const result = await listCollectionSafe(path, { pageSize: 1000 });
      if (!result.ok) {
        plan.readErrors.push({ collection: path, error: result.error });
        continue;
      }
      result.rows.forEach((subRow) => addPlanEntry(plan, path, subRow));
    }
  }

  const scannedRows = [{ collection: "users", rows: users }];
  for (const collection of ROOT_COLLECTIONS_TO_DELETE) {
    const result = await listCollectionSafe(collection, { pageSize: 2000 });
    if (!result.ok) {
      plan.readErrors.push({ collection, error: result.error });
      scannedRows.push({ collection, rows: [] });
      continue;
    }
    scannedRows.push({ collection, rows: result.rows });
    result.rows.forEach((row) => addPlanEntry(plan, collection, row));
  }

  const configResult = await listCollectionSafe("config", { pageSize: 1000 });
  if (!configResult.ok) {
    plan.readErrors.push({ collection: "config", error: configResult.error });
  } else {
    const resetRows = configResult.rows.filter((row) => CONFIG_DOCS_TO_RESET.includes(normalize(row.firestoreDocId || row.id)));
    resetRows.forEach((row) => addPlanEntry(plan, "config", row, "reset"));
  }

  for (const collection of PRESERVED_COLLECTIONS) {
    const result = await listCollectionSafe(collection, { pageSize: 1000 });
    if (!result.ok) {
      plan.readErrors.push({ collection, error: result.error });
    }
  }

  const orphanMap = new Map();
  scannedRows.forEach(({ collection, rows }) => {
    rows.forEach((row) => {
      const docId = normalize(row.firestoreDocId || row.id);
      const docPath = `${collection}/${docId}`;
      collectReferenceValues(row).forEach((ref) => {
        if (!ref.id || userIds.has(ref.id)) return;
        const key = `${ref.id}::${collection}::${ref.fieldPath}`;
        if (!orphanMap.has(key)) {
          orphanMap.set(key, {
            missingUserId: ref.id,
            references: [],
          });
        }
        const item = orphanMap.get(key);
        if (item.references.length < 10) item.references.push({ collection, docPath, fieldPath: ref.fieldPath });
      });
    });
  });
  plan.integrity.orphanReferences = Array.from(orphanMap.values()).sort((a, b) => a.missingUserId.localeCompare(b.missingUserId));
  plan.integrity.containsUsers54 = plan.integrity.orphanReferences.some((item) => item.missingUserId === "54");
  plan.integrity.summary = plan.integrity.orphanReferences.reduce((acc, item) => {
    acc[item.missingUserId] = item.references.length;
    return acc;
  }, {});

  try {
    const authUsers = await listAuthUsers();
    const adminEmails = new Set(plan.preserved.adminAuthEmails);
    const adminLocalIds = new Set(plan.preserved.adminAuthLocalIds);
    const authToDelete = authUsers.filter((user) => !adminEmails.has(normalizeEmail(user.email)) && !adminLocalIds.has(normalize(user.localId)));
    const authPreserved = authUsers.filter((user) => adminEmails.has(normalizeEmail(user.email)) || adminLocalIds.has(normalize(user.localId)));
    plan.auth.ok = true;
    plan.auth.total = authUsers.length;
    plan.auth.toDelete = authToDelete.length;
    plan.auth.samples = authToDelete.slice(0, 5).map((user) => ({
      localId: user.localId || null,
      email: user.email || null,
      displayName: user.displayName || null,
    }));
    plan.auth.preserved = authPreserved.map((user) => ({
      localId: user.localId || null,
      email: user.email || null,
      displayName: user.displayName || null,
    }));
  } catch (error) {
    plan.auth.error = safeError(error);
  }

  return plan;
};

const runInChunks = async (items, size, worker, onProgress) => {
  let done = 0;
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    await Promise.all(chunk.map(worker));
    done += chunk.length;
    if (typeof onProgress === "function") onProgress({ done, total: items.length });
  }
};

const applyPlan = async (plan) => {
  const report = {
    startedAt: nowIso(),
    firestoreDeleted: {},
    firestoreReset: {},
    authDeleted: 0,
    errors: [],
  };

  for (const entry of Object.values(plan.byCollection)) {
    if (entry.action === "reset") {
      for (const path of entry.paths) {
        try {
          await patchFirestoreDocument(path, {
            rankings: { arrayValue: {} },
            updatedAt: { timestampValue: new Date().toISOString() },
            resetBy: { stringValue: "scripts/wipe-test-data.js" },
          });
          report.firestoreReset[entry.collection] = (report.firestoreReset[entry.collection] || 0) + 1;
        } catch (error) {
          report.errors.push({ action: "reset", path, error: safeError(error) });
        }
      }
      continue;
    }
    const paths = entry.paths.slice();
    await runInChunks(
      paths,
      500,
      async (path) => {
        try {
          await deleteFirestoreDocument(path);
          report.firestoreDeleted[entry.collection] = (report.firestoreDeleted[entry.collection] || 0) + 1;
        } catch (error) {
          report.errors.push({ action: "delete", path, error: safeError(error) });
        }
      },
      ({ done, total }) => {
        process.stderr.write(`[wipe] ${entry.collection}: ${done}/${total}\n`);
      }
    );
  }

  if (plan.auth.ok) {
    const adminEmails = new Set(plan.preserved.adminAuthEmails);
    const adminLocalIds = new Set(plan.preserved.adminAuthLocalIds);
    const authUsers = await listAuthUsers();
    const authToDelete = authUsers.filter((user) => !adminEmails.has(normalizeEmail(user.email)) && !adminLocalIds.has(normalize(user.localId)));
    await runInChunks(
      authToDelete,
      100,
      async (user) => {
        try {
          await deleteAuthUser(user.localId);
          report.authDeleted += 1;
        } catch (error) {
          report.errors.push({ action: "auth_delete", localId: user.localId || null, email: user.email || null, error: safeError(error) });
        }
      },
      ({ done, total }) => {
        process.stderr.write(`[wipe] auth: ${done}/${total}\n`);
      }
    );
  }

  report.finishedAt = nowIso();
  return report;
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  if (apply && normalize(process.env.WIPE_CONFIRM).toLowerCase() !== "sim") {
    const error = new Error("apply_requires_WIPE_CONFIRM_sim");
    error.code = "apply_requires_WIPE_CONFIRM_sim";
    throw error;
  }

  const plan = await buildPlan();
  plan.mode = apply ? "apply" : "dry-run";
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);

  if (apply) {
    const applyReport = await applyPlan(plan);
    process.stdout.write(`${JSON.stringify({ mode: "apply-result", report: applyReport }, null, 2)}\n`);
    if (applyReport.errors.length) process.exitCode = 1;
  }
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error?.code || error?.message || "wipe_failed", message: error?.message || "wipe_failed" }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  ROOT_COLLECTIONS_TO_DELETE,
  USER_SUBCOLLECTIONS_TO_DELETE,
  PRESERVED_COLLECTIONS,
  buildPlan,
  collectReferenceValues,
};
