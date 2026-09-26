const { requirePhone } = require('../src/international-phone/core');
const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { getBearerTokenFromRequest, PROJECT_ID, encodeFields } = require("./_lib/firestore-rest");
const { commitWritesAsAdmin, getDocumentAsAdmin } = require("./_lib/firestore-admin");
const { syncStudentMirrorToSupabase } = require("./_lib/student-mirror-sync");
const { normalizeCommercialRoles } = require("./_lib/commercial-permissions");
const { createPerformanceTimer } = require("./_lib/performance-observer");
const { isSuperAdminUser, requireAdminPermission } = require("./_lib/admin-permissions");
const { isUserActive, normalizeUserStatus } = require("../_lib/user-status");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "growth") return "growth";
  if (raw === "finance" || raw === "financeiro") return "financeiro";
  return "";
};

const isPlainPatchObject = (value) => {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const sanitizePatchValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePatchValue(item)).filter((item) => item !== undefined);
  }
  if (!isPlainPatchObject(value)) {
    return value === undefined ? undefined : value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [key, sanitizePatchValue(entryValue)])
      .filter(([, entryValue]) => entryValue !== undefined)
  );
};

const sanitizeUserPatch = (patch = {}) => {
  const cleanPatch = sanitizePatchValue(patch);
  for (const field of ["telefone", "phone", "telefoneWhatsapp"]) if (Object.hasOwn(cleanPatch, field)) cleanPatch[field] = requirePhone(cleanPatch[field], { defaultCountry: "BR", preferCountry: true });
  ["adminPermissions", "permissions", "adminPermissionsVersion", "permissionsUpdatedAt", "permissionsUpdatedBy", "isSuperAdmin"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(cleanPatch, key)) {
      const error = new Error("sensitive_admin_field_forbidden");
      error.code = "sensitive_admin_field_forbidden";
      throw error;
    }
  });
  if (Object.prototype.hasOwnProperty.call(cleanPatch, "commercialRoles")) {
    cleanPatch.commercialRoles = normalizeCommercialRoles(cleanPatch.commercialRoles);
  }
  return cleanPatch;
};

const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const normalizePhone = (value) => requirePhone(value, { defaultCountry: "BR", preferCountry: true });

const buildUserCommitDocumentName = (uid) => {
  const safeUid = String(uid || "").trim();
  if (!PROJECT_ID) {
    const error = new Error("missing_firestore_project_id");
    error.code = "missing_firestore_project_id";
    throw error;
  }
  if (!safeUid) {
    const error = new Error("missing_user_uid");
    error.code = "missing_user_uid";
    throw error;
  }
  return `projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(safeUid)}`;
};

const buildAdminAuditCommitDocumentName = (id) => {
  const safeId = String(id || "").trim();
  if (!PROJECT_ID) {
    const error = new Error("missing_firestore_project_id");
    error.code = "missing_firestore_project_id";
    throw error;
  }
  if (!safeId) {
    const error = new Error("missing_audit_id");
    error.code = "missing_audit_id";
    throw error;
  }
  return `projects/${PROJECT_ID}/databases/(default)/documents/adminAuditEvents/${encodeURIComponent(safeId)}`;
};

const commercialRolesAuditWrite = ({ uid, from = [], to = [], changedBy = "", timestamp = "" }) => {
  const safeUid = String(uid || "").trim();
  const stamp = String(timestamp || new Date().toISOString());
  const id = `commercial_roles_${safeUid}_${Date.now()}`;
  return {
    update: {
      name: buildAdminAuditCommitDocumentName(id),
      fields: encodeFields({
        id,
        type: "commercialRoles.changed",
        userId: safeUid,
        from: normalizeCommercialRoles(from),
        to: normalizeCommercialRoles(to),
        changedBy: String(changedBy || "").trim(),
        timestamp: stamp,
        createdAt: stamp,
      }).fields,
    },
  };
};

const adminUserAuditWrite = ({ event, actorUserId = "", targetUserId = "", before = {}, after = {}, createdAt = "" }) => {
  const safeTarget = String(targetUserId || "").trim();
  const stamp = String(createdAt || new Date().toISOString());
  const id = `${event}_${safeTarget}_${Date.now()}`;
  return {
    update: {
      name: buildAdminAuditCommitDocumentName(id),
      fields: encodeFields({
        id,
        event,
        actorUserId: String(actorUserId || "").trim(),
        targetUserId: safeTarget,
        before,
        after,
        createdAt: stamp,
      }).fields,
    },
  };
};

const patchUserAsAdmin = async ({ uid, data, actorId = "" }) => {
  const cleanData = data && typeof data === "object" ? data : {};
  const updateMask = Object.keys(cleanData);
  if (!updateMask.length) {
    const error = new Error("empty_patch");
    error.code = "empty_patch";
    throw error;
  }
  const writes = [
    {
      update: {
        name: buildUserCommitDocumentName(uid),
        fields: encodeFields(cleanData).fields,
      },
      updateMask: {
        fieldPaths: updateMask,
      },
      currentDocument: {
        exists: true,
      },
    },
  ];
  if (Object.prototype.hasOwnProperty.call(cleanData, "commercialRoles")) {
    let previousRoles = [];
    try {
      const previous = await getDocumentAsAdmin(`users/${encodeURIComponent(String(uid || "").trim())}`);
      previousRoles = normalizeCommercialRoles(previous?.commercialRoles);
    } catch {
      previousRoles = [];
    }
    writes.push(commercialRolesAuditWrite({
      uid,
      from: previousRoles,
      to: cleanData.commercialRoles,
      changedBy: actorId,
      timestamp: cleanData.updatedAt || cleanData.atualizadoEm || new Date().toISOString(),
    }));
  }
  return commitWritesAsAdmin({ writes });
};

const buildAdminProfileUpdatePatch = ({ target = {}, body = {}, actorId = "" }) => {
  const nome = normalizeName(body?.nome || body?.name);
  const telefone = normalizePhone(body?.telefone || body?.phone);
  const now = new Date().toISOString();
  const patch = { atualizadoEm: now, updatedAt: now, updatedBy: String(actorId || "") };
  const before = {};
  const after = {};
  if (nome && nome !== String(target?.nome || target?.name || "").trim()) {
    before.nome = String(target?.nome || target?.name || "").trim();
    after.nome = nome;
    patch.nome = nome;
    patch.name = nome;
    patch.displayName = nome;
  }
  if (telefone !== String(target?.telefone || target?.phone || "").trim()) {
    before.telefone = String(target?.telefone || target?.phone || "").trim();
    after.telefone = telefone;
    patch.telefone = telefone;
    patch.phone = telefone;
  }
  if (!Object.keys(after).length) return null;
  return { patch, before, after, event: "admin_user_updated", now };
};

const buildAdminStatusPatch = ({ target = {}, status = "", actorId = "" }) => {
  const rawStatus = String(status || "").trim().toLowerCase();
  if (rawStatus !== "active" && rawStatus !== "inactive") {
    const error = new Error("invalid_status");
    error.status = 400;
    throw error;
  }
  const nextStatus = rawStatus;
  const currentStatus = normalizeUserStatus(target);
  if (nextStatus === currentStatus) return null;
  const now = new Date().toISOString();
  const patch = {
    ativo: nextStatus === "active",
    active: nextStatus === "active",
    disabled: nextStatus !== "active",
    status: nextStatus,
    atualizadoEm: now,
    updatedAt: now,
    updatedBy: String(actorId || ""),
  };
  if (nextStatus === "active") {
    patch.reactivatedAt = now;
    patch.reactivatedBy = String(actorId || "");
  } else {
    patch.deactivatedAt = now;
    patch.deactivatedBy = String(actorId || "");
  }
  return {
    patch,
    before: { status: currentStatus, ativo: target?.ativo !== false, active: target?.active !== false },
    after: { status: nextStatus, ativo: patch.ativo, active: patch.active },
    event: nextStatus === "active" ? "admin_user_reactivated" : "admin_user_deactivated",
    now,
  };
};


const ensureCommercialRoleAsAdmin = async ({ uid, commercialRole = '', actorId = '' }) => {
  const safeUid = String(uid || '').trim();
  const roleToEnsure = String(commercialRole || '').trim().toLowerCase();
  if (!safeUid) {
    const error = new Error('missing_target');
    error.status = 400;
    throw error;
  }
  if (!['sdr', 'closer'].includes(roleToEnsure)) {
    const error = new Error('invalid_commercial_role');
    error.status = 400;
    throw error;
  }
  let target;
  try {
    target = await getDocumentAsAdmin(`users/${encodeURIComponent(safeUid)}`);
  } catch (error) {
    if (Number(error?.status) === 404) {
      const notFound = new Error('user_not_found');
      notFound.status = 404;
      throw notFound;
    }
    throw error;
  }
  const targetRole = normalizeRole(target?.tipo || target?.role || target?.type);
  if (targetRole !== 'growth') {
    const error = new Error('target_must_be_growth');
    error.status = 403;
    throw error;
  }
  const before = normalizeCommercialRoles(target?.commercialRoles);
  if (before.includes(roleToEnsure)) {
    return { ok: true, unchanged: true, role: targetRole, commercialRoles: before, before, after: before };
  }
  const after = normalizeCommercialRoles([...before, roleToEnsure]);
  const now = new Date().toISOString();
  const patch = {
    commercialRoles: after,
    atualizadoEm: now,
    updatedAt: now,
    updatedBy: String(actorId || '').trim(),
  };
  const writes = [
    {
      update: {
        name: buildUserCommitDocumentName(safeUid),
        fields: encodeFields(patch).fields,
      },
      updateMask: { fieldPaths: Object.keys(patch) },
      currentDocument: { exists: true },
    },
    commercialRolesAuditWrite({ uid: safeUid, from: before, to: after, changedBy: actorId, timestamp: now }),
  ];
  const response = await commitWritesAsAdmin({ writes });
  if (!response.ok) {
    const error = new Error('firestore_patch_failed');
    error.status = response.status || 500;
    error.details = response.data || response.text || null;
    throw error;
  }
  const verified = await getDocumentAsAdmin(`users/${encodeURIComponent(safeUid)}`);
  const verifiedRole = normalizeRole(verified?.tipo || verified?.role || verified?.type);
  const verifiedRoles = normalizeCommercialRoles(verified?.commercialRoles);
  return { ok: true, unchanged: false, role: verifiedRole, commercialRoles: verifiedRoles, before, after: verifiedRoles };
};

const updateAdminUserAsSuperAdmin = async ({ action, uid, body, actorId = "" }) => {
  const target = await getDocumentAsAdmin(`users/${encodeURIComponent(String(uid || "").trim())}`);
  const targetRole = normalizeRole(target?.tipo || target?.role);
  if (targetRole !== "admin") {
    const error = new Error("invalid_target");
    error.status = 403;
    throw error;
  }
  if (action === "set_admin_status") {
    if (String(uid || "").trim() === String(actorId || "").trim()) {
      const error = new Error("self_deactivation_forbidden");
      error.status = 403;
      throw error;
    }
    if (isSuperAdminUser(target)) {
      const error = new Error("super_admin_deactivation_forbidden");
      error.status = 403;
      throw error;
    }
  }
  const change = action === "set_admin_status"
    ? buildAdminStatusPatch({ target, status: body?.status, actorId })
    : buildAdminProfileUpdatePatch({ target, body, actorId });
  if (!change) return { ok: true, unchanged: true, user: target };
  const updateMask = Object.keys(change.patch);
  const writes = [
    {
      update: {
        name: buildUserCommitDocumentName(uid),
        fields: encodeFields(change.patch).fields,
      },
      updateMask: { fieldPaths: updateMask },
      currentDocument: { exists: true },
    },
    adminUserAuditWrite({
      event: change.event,
      actorUserId: actorId,
      targetUserId: uid,
      before: change.before,
      after: change.after,
      createdAt: change.now,
    }),
  ];
  const response = await commitWritesAsAdmin({ writes });
  if (!response.ok) {
    const error = new Error("admin_user_update_failed");
    error.status = response.status;
    error.details = response.data || response.text || null;
    throw error;
  }
  return { ok: true, unchanged: false, before: change.before, after: change.after, event: change.event };
};

module.exports = async (req, res) => {
  const perf = createPerformanceTimer({ req, route: "/api/admin-users", operation: req.method === "PATCH" ? "admin_users_save" : "admin_users_sync" });
  const send = (status, body) => {
    perf.finish(res, body);
    return sendJson(res, status, body);
  };
  const session = await perf.measure("auth", () => Promise.resolve(getSessionFromRequest(req)));
  if (!session) {
    send(401, { error: "unauthorized" });
    return;
  }

  if (String(session.role || "") !== "admin") {
    send(403, { error: "forbidden" });
    return;
  }

  const adminId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!adminId || !idToken) {
    send(401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await perf.measure("firebaseAuth", () => verifyFirebaseIdToken(idToken));
    if (decoded.uid !== adminId) {
      send(401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    send(401, { error: "invalid_credentials" });
    return;
  }

  const actor = await perf.measure("loadActor", () => getDocumentAsAdmin(`users/${encodeURIComponent(adminId)}`), { firestore: true }).catch(() => null);
  if (!actor || !isUserActive(actor)) {
    send(403, { error: actor ? "user_disabled" : "forbidden" });
    return;
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await perf.measure("requestBody", () => readJsonBody(req));
    } catch (error) {
      send(400, { error: "invalid_json" });
      return;
    }

    const uid = String(body?.uid || "").trim();
    const name = String(body?.name || "").trim();
    const role = normalizeRole(body?.role);
    const action = String(body?.action || "").trim().toLowerCase();

    if (action === "sync_mirror") {
      if (!uid) {
        send(400, { error: "invalid_request" });
        return;
      }
      const sync = await perf.measure("syncMirror", () => syncStudentMirrorToSupabase(uid));
      send(sync.ok ? 200 : 409, { ok: sync.ok, sync });
      return;
    }

    if (!uid || !name || !role || role === "admin") {
      send(400, { error: "invalid_request" });
      return;
    }
    const postPermission = role === "growth" ? "comercial.users.create" : "pedagogico.users.create";
    const postPermissionGuard = await requireAdminPermission(req, postPermission);
    if (!postPermissionGuard.ok) {
      send(postPermissionGuard.status, postPermissionGuard.body);
      return;
    }

    if(role==='student' && body.asaas_customer_id){
      try { await perf.measure("financeLink", () => require('./_lib/finance-customer-link').registerCanonicalPair({customerId:body.asaas_customer_id,studentId:uid,actor:adminId,source:'student_creation'})); }
      catch { return send(409,{error:'canonical_finance_link_required'}); }
    }
    // OWNERSHIP: cadastro=Firestore, operação=Supabase (contrato 2026-07-12)
    // Mantemos compatibilidade com chamadas legadas e sincronizamos o espelho
    // desnormalizado no Supabase a partir de users/{uid}.
    const sync = await perf.measure("syncMirror", () => syncStudentMirrorToSupabase(uid));
    send(200, { ok: true, sync });
    return;
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "POST, PATCH");
    send(405, { error: "method_not_allowed" });
    return;
  }

  let body;
  try {
    body = await perf.measure("requestBody", () => readJsonBody(req));
  } catch (error) {
    send(400, { error: "invalid_json" });
    return;
  }

  const uid = String(body?.uid || "").trim();
  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "ensure_commercial_role") {
    if (!uid) {
      send(400, { error: "missing_target" });
      return;
    }
    const permissionGuard = await requireAdminPermission(req, "comercial.users.update");
    if (!permissionGuard.ok) {
      send(permissionGuard.status, permissionGuard.body);
      return;
    }
    try {
      const result = await perf.measure("ensureCommercialRole", () => ensureCommercialRoleAsAdmin({ uid, commercialRole: body?.commercialRole, actorId: adminId }), { firestore: true });
      send(200, result);
    } catch (error) {
      console.warn("[api] admin-users ensure commercial role failed", { uid, status: error?.status, message: error?.message });
      send(error?.status || 500, { error: error?.message || "ensure_commercial_role_failed" });
    }
    return;
  }

  if (action === "update_admin_profile" || action === "set_admin_status") {
    if (!uid) {
      send(400, { error: "missing_target" });
      return;
    }
    const permissionGuard = await requireAdminPermission(req, "settings.accesses.manage_permissions");
    if (!permissionGuard.ok) {
      send(permissionGuard.status, permissionGuard.body);
      return;
    }
    if (!isSuperAdminUser(actor)) {
      send(403, { error: "super_admin_only" });
      return;
    }
    try {
      const result = await perf.measure("saveAdminAccessUser", () => updateAdminUserAsSuperAdmin({ action, uid, body, actorId: adminId }), { firestore: true });
      send(200, { ok: true, ...result });
    } catch (error) {
      console.error("[api] admin-users access action failed", { action, uid, status: error?.status, message: error?.message });
      send(error?.status || 500, { error: error?.message || "admin_user_update_failed" });
    }
    return;
  }

  const patch = body?.patch && typeof body.patch === "object" ? body.patch : null;
  const requestedRole = normalizeRole(body?.role || patch?.tipo || patch?.role);
  if (!uid || !patch) {
    send(400, { error: "invalid_request" });
    return;
  }

  let cleanPatch;
  try {
    cleanPatch = sanitizeUserPatch(patch);
  } catch (error) {
    if (error?.code === "invalid_phone_number") return send(400, { error: error.message });
    if (error?.code === "sensitive_admin_field_forbidden") {
      send(403, { error: "sensitive_admin_field_forbidden" });
      return;
    }
    throw error;
  }
  if (!cleanPatch || typeof cleanPatch !== "object" || !Object.keys(cleanPatch).length) {
    send(400, { error: "empty_patch" });
    return;
  }
  const targetAdminRole = normalizeRole(cleanPatch.tipo || cleanPatch.role);
  if (targetAdminRole === "admin") {
    send(403, { error: "admin_role_escalation_forbidden" });
    return;
  }
  const permission = Object.prototype.hasOwnProperty.call(cleanPatch, "commercialRoles") || requestedRole === "growth" ? "comercial.users.update" : "pedagogico.users.update";
  const permissionGuard = await requireAdminPermission(req, permission);
  if (!permissionGuard.ok) {
    send(permissionGuard.status, permissionGuard.body);
    return;
  }
  cleanPatch.atualizadoEm = new Date().toISOString();
  cleanPatch.updatedAt = cleanPatch.atualizadoEm;

  try {
    const result = await perf.measure("saveUser", () => patchUserAsAdmin({ uid, data: cleanPatch, actorId: adminId }), { firestore: true });
    if (!result.ok) {
      const errorDetail = result.data?.error?.message || result.text || "firestore_patch_failed";
      console.warn("[api] admin-users Firestore patch failed", {
        uid,
        status: result.status,
        errorDetail,
      });
      send(result.status || 500, {
        error: "firestore_patch_failed",
        errorDetail,
        firestoreStatus: result.status || 0,
      });
      return;
    }
    // OWNERSHIP: cadastro=Firestore, operação=Supabase (contrato 2026-07-12)
    const shouldSyncStudentMirror = requestedRole ? requestedRole === "student" : !Object.prototype.hasOwnProperty.call(cleanPatch, "commercialRoles");
    const sync = shouldSyncStudentMirror ? await perf.measure("syncMirror", () => syncStudentMirrorToSupabase(uid)) : { ok: true, skipped: true, reason: "not_student_profile_patch" };
    send(200, { ok: true, sync });
  } catch (error) {
    console.error("[api] admin-users patch failed", error);
    send(500, {
      error: "admin_users_patch_failed",
      errorDetail: error?.message || String(error || ""),
      code: error?.code || "",
    });
  }
};

module.exports._test = {
  buildAdminProfileUpdatePatch,
  buildAdminStatusPatch,
  commercialRolesAuditWrite,
  ensureCommercialRoleAsAdmin,
  normalizeRole,
  sanitizeUserPatch,
  updateAdminUserAsSuperAdmin,
};
