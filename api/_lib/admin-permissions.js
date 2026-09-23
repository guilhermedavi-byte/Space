const { getDocumentAsAdmin, listCollectionAsAdmin, commitWritesAsAdmin } = require("./firestore-admin");
const { PROJECT_ID, encodeFields } = require("./firestore-rest");

const ADMIN_PERMISSION_REGISTRY = {
  dashboard: { label: "Dashboard", panel: "dashboard", routes: ["/app/admin"] },
  activities: { label: "Atividades", panel: "activities", routes: ["/app/admin/atividades"], apis: ["/api/activities"] },
  automations: { label: "Automações", panel: "automations", routes: ["/app/admin/automacoes"], apis: ["/api/automations"] },
  pedagogico: {
    label: "Pedagógico",
    children: {
      overview: { label: "Visão Geral", panel: "admin-controle-pedagogico", routes: ["/app/admin/controle-pedagogico?modulo=visao-geral"], apis: ["/api/pedagogico/dashboard"] },
      agenda: { label: "Agenda", panel: "ao-vivo", routes: ["/app/admin/ao-vivo"], apis: ["/api/schedule-events", "/api/live-lessons"] },
      lessons: { label: "Registros de Aulas", panel: "admin-controle-pedagogico-aulas", routes: ["/app/admin/controle-pedagogico?modulo=aulas"], apis: ["/api/lesson-logs"] },
      users: { label: "Usuários", panel: "admin-controle-pedagogico-pessoas", routes: ["/app/admin/controle-pedagogico?modulo=usuarios"], apis: ["/api/admin-data?collection=users", "/api/admin-users"] },
      retention: { label: "Retenção", panel: "admin-controle-pedagogico-retencao", routes: ["/app/admin/controle-pedagogico?modulo=retencao"], apis: ["/api/retention-cases"] },
      repositions: { label: "Reposições", panel: "admin-controle-pedagogico-reposicoes", routes: ["/app/admin/controle-pedagogico?modulo=reposicoes"], apis: ["/api/schedule-reschedule"] },
      quality: { label: "Qualidade", panel: "admin-controle-pedagogico-qualidade", routes: ["/app/admin/controle-pedagogico?modulo=qualidade"], apis: ["/api/live-lessons/feedbacks"] },
      onboarding: { label: "Onboarding", panel: "admin-controle-pedagogico-onboarding", routes: ["/app/admin/controle-pedagogico?modulo=onboarding"], apis: ["/api/pedagogico/onboarding"] },
      reports: { label: "Relatórios", panel: "admin-controle-pedagogico-relatorios", routes: ["/app/admin/controle-pedagogico?modulo=relatorios"] },
    },
  },
  comercial: {
    label: "Comercial",
    children: {
      overview: { label: "Visão Geral", panel: "admin-comercial-visao-geral", routes: ["/app/admin/comercial"], apis: ["/api/growth-dashboard?api=growth-metrics", "/api/sdr-metrics"] },
      crm: { label: "CRM", panel: "native-crm", routes: ["/app/admin/comercial/crm"], apis: ["/api/crm"] },
      crmLive: { label: "CRM Live", href: "/tv/crm-live", routes: ["/tv/crm-live"], apis: ["/api/crm-live-data", "/api/crm-live-events"] },
      preSales: { label: "Pré-Vendas", panel: "admin-comercial-atividade-sdr", routes: ["/app/admin/comercial/pre-vendas"], apis: ["/api/admin-commercial-sdr-activity"] },
      sdrPanel: { label: "Painel SDR", panel: "admin-sdr", routes: ["/app/admin/comercial/pre-vendas/painel-sdr"], apis: ["/api/admin-sdr", "/api/admin/sdr/calls/:id/audio"] },
      goals: { label: "Metas", panel: "admin-comercial-metas", routes: ["/app/admin/comercial/metas"], apis: ["/api/growth-dashboard?api=growth-goals"] },
      users: { label: "Usuários", panel: "admin-comercial-usuarios", routes: ["/app/admin/comercial/usuarios"], apis: ["/api/admin-create-growth-user", "/api/admin-users"] },
    },
  },
  financeiro: {
    label: "Financeiro",
    children: {
      overview: { label: "Visão Geral", panel: "financeiro", financeTab: "overview", routes: ["/app/admin/financeiro?aba=visao-geral"], apis: ["/api/finance-v1?view=overview"] },
      receivables: { label: "Recebíveis", panel: "financeiro", financeTab: "recebiveis", routes: ["/app/admin/financeiro?aba=recebiveis"], apis: ["/api/finance-v1?view=receivables"] },
      subscriptions: { label: "Assinaturas", panel: "financeiro", financeTab: "assinaturas", routes: ["/app/admin/financeiro?aba=assinaturas"], apis: ["/api/finance-v1?view=subscriptions"] },
      customers: { label: "Clientes", panel: "financeiro", financeTab: "clientes", routes: ["/app/admin/financeiro?aba=clientes"], apis: ["/api/finance-v1?view=customers"] },
      recovery: { label: "Recuperação", panel: "financeiro", financeTab: "recuperacao", routes: ["/app/admin/financeiro?aba=recuperacao"], apis: ["/api/finance-v1?view=recovery"] },
      pending: { label: "Pendências", panel: "financeiro", financeTab: "pendencias", routes: ["/app/admin/financeiro?aba=pendencias"], apis: ["/api/finance-v1?view=exceptions"] },
      closing: { label: "Fechamento mensal", panel: "financeiro", financeTab: "fechamento", routes: ["/app/admin/financeiro?aba=fechamento"], apis: ["/api/finance-v1?view=closing"] },
    },
  },
  attendance: {
    label: "Atendimento",
    children: {
      inbox: { label: "Caixa de entrada", panel: "attendance-inbox", routes: ["/app/admin/atendimento/caixa-de-entrada"], apis: ["/api/attendance-inbox"] },
      connections: { label: "Conexões", panel: "attendance-connections", routes: ["/app/admin/atendimento/conexoes"], apis: ["/api/attendance-connections"] },
    },
  },
  settings: {
    label: "Configurações",
    children: {
      profile: { label: "Meu perfil", panel: "configuracoes-admin", settingsSection: "meu-perfil", routes: ["/app/admin/configuracoes"] },
      accesses: { label: "Acessos", panel: "configuracoes-admin", settingsSection: "acessos", routes: ["/app/admin/configuracoes/acessos"], apis: ["/api/admin-permissions", "/api/admin-create-user"] },
    },
  },
  status: { label: "Status", panel: "status-plataforma", routes: ["/app/admin/status"], apis: ["/api/health"] },
  guide: { label: "Guia", panel: "guia-colaboradores", routes: ["/app/admin/guia"] },
  spaceOffice: { label: "Space Office", panel: "space-office", routes: ["/app/admin/space-office"], apis: ["/api/space-office"] },
};

const flattenRegistry = (registry = ADMIN_PERMISSION_REGISTRY) => {
  const out = [];
  Object.entries(registry).forEach(([key, value]) => {
    if (!value || typeof value !== "object") return;
    if (value.children && typeof value.children === "object") {
      Object.entries(value.children).forEach(([childKey, child]) => {
        out.push({ key: `${key}.${childKey}`, moduleKey: key, childKey, ...(child || {}) });
      });
    } else {
      out.push({ key, moduleKey: key, ...(value || {}) });
    }
  });
  return out;
};

const ALL_ADMIN_PERMISSION_KEYS = flattenRegistry().map((item) => item.key);
const VALID_ADMIN_PERMISSION_KEYS = new Set(ALL_ADMIN_PERMISSION_KEYS);

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "finance" || raw === "financeiro") return "FINANCE";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "growth") return "growth";
  if (raw === "student" || raw === "aluno") return "student";
  return raw;
};

const normalizeAdminPermissions = (value, { fallbackFullAccess = false } = {}) => {
  if (fallbackFullAccess && !Array.isArray(value)) return ALL_ADMIN_PERMISSION_KEYS.slice();
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\s]+/) : [];
  return Array.from(new Set(source.map((item) => String(item || "").trim()).filter((item) => VALID_ADMIN_PERMISSION_KEYS.has(item))));
};

const isSuperAdminUser = (user) => normalizeRole(user?.role || user?.tipo || user?.type) === "admin" && user?.isSuperAdmin === true;

const adminAccessPayloadForUser = (user) => {
  const role = normalizeRole(user?.role || user?.tipo || user?.type);
  const isSuperAdmin = role === "admin" && user?.isSuperAdmin === true;
  return {
    isSuperAdmin,
    adminPermissions: isSuperAdmin ? ALL_ADMIN_PERMISSION_KEYS.slice() : normalizeAdminPermissions(user?.adminPermissions || user?.permissions, { fallbackFullAccess: role === "admin" }),
    adminPermissionsVersion: Number(user?.adminPermissionsVersion || 0) || 0,
  };
};

const canAdminAccess = (user, permission) => {
  const key = String(permission || "").trim();
  if (!VALID_ADMIN_PERMISSION_KEYS.has(key)) return false;
  const access = adminAccessPayloadForUser(user);
  return access.isSuperAdmin || access.adminPermissions.includes(key);
};

const loadAdminAccessForUid = async (uid) => {
  const safeUid = String(uid || "").trim();
  if (!safeUid) return null;
  const row = await getDocumentAsAdmin(`users/${encodeURIComponent(safeUid)}`);
  if (normalizeRole(row?.role || row?.tipo || row?.type) !== "admin") return null;
  return { user: row, ...adminAccessPayloadForUser(row) };
};

const requireAdminPermission = async (req, permission) => {
  const session = require("../../_lib/session").getSessionFromRequest(req);
  if (!session) return { ok: false, status: 401, body: { error: "unauthorized" } };
  if (normalizeRole(session.role) !== "admin") return { ok: false, status: 403, body: { error: "forbidden" } };
  const access = await loadAdminAccessForUid(session.sub).catch(() => null);
  if (!access) return { ok: false, status: 403, body: { error: "forbidden" } };
  if (!canAdminAccess(access.user, permission)) return { ok: false, status: 403, body: { error: "forbidden", permission } };
  return { ok: true, session, access };
};

const requireResolvedAdminPermission = async (auth, permission) => {
  if (!auth?.ok) return auth;
  if (normalizeRole(auth.session?.role) !== "admin") return { ok: false, status: 403, body: { error: "forbidden" } };
  const access = await loadAdminAccessForUid(auth.session.sub).catch(() => null);
  if (!access || !canAdminAccess(access.user, permission)) return { ok: false, status: 403, body: { error: "forbidden", permission } };
  return { ...auth, access };
};

const permissionForAdminPanel = (panel, state = {}) => {
  const safePanel = String(panel || "").trim();
  const settingsSection = String(state.settingsSection || "").trim();
  const financeTab = String(state.financeTab || "").trim();
  const pedagogicoTab = String(state.pedagogicoTab || "").trim();
  if (safePanel === "dashboard") return "dashboard";
  if (safePanel === "activities") return "activities";
  if (safePanel === "automations") return "automations";
  if (safePanel === "status-plataforma") return "status";
  if (safePanel === "guia-colaboradores") return "guide";
  if (safePanel === "space-office") return "spaceOffice";
  if (safePanel === "attendance-inbox") return "attendance.inbox";
  if (safePanel === "attendance-connections") return "attendance.connections";
  if (safePanel === "configuracoes-admin") return settingsSection === "acessos" ? "settings.accesses" : "settings.profile";
  if (safePanel === "admin-comercial-visao-geral") return "comercial.overview";
  if (safePanel === "native-crm") return "comercial.crm";
  if (safePanel === "admin-comercial-atividade-sdr") return "comercial.preSales";
  if (safePanel === "admin-sdr") return "comercial.sdrPanel";
  if (safePanel === "growth") return "comercial.preSales";
  if (safePanel === "admin-comercial-metas") return "comercial.goals";
  if (safePanel === "admin-comercial-usuarios") return "comercial.users";
  if (safePanel === "financeiro") {
    const map = { overview: "overview", recebiveis: "receivables", assinaturas: "subscriptions", clientes: "customers", recuperacao: "recovery", pendencias: "pending", fechamento: "closing" };
    return `financeiro.${map[financeTab] || "overview"}`;
  }
  if (safePanel === "ao-vivo") return "pedagogico.agenda";
  if (safePanel.startsWith("admin-controle-pedagogico")) {
    const map = {
      aulas: "lessons",
      pessoas: "users",
      retencao: "retention",
      reposicoes: "repositions",
      qualidade: "quality",
      onboarding: "onboarding",
      relatorios: "reports",
    };
    return `pedagogico.${map[pedagogicoTab] || "overview"}`;
  }
  return "";
};

const firstAllowedAdminPanel = (user) => {
  const keys = adminAccessPayloadForUser(user).adminPermissions;
  const ordered = ["dashboard", "activities", "pedagogico.overview", "comercial.overview", "comercial.crm", "financeiro.overview", "settings.profile"];
  const key = ordered.find((item) => keys.includes(item)) || keys[0] || "settings.profile";
  const item = flattenRegistry().find((entry) => entry.key === key);
  return item?.panel || "configuracoes-admin";
};

const firstAllowedAdminRoute = (user) => {
  const keys = adminAccessPayloadForUser(user).adminPermissions;
  const ordered = ["dashboard", "activities", "pedagogico.overview", "comercial.overview", "comercial.crm", "financeiro.overview", "settings.profile"];
  const key = ordered.find((item) => keys.includes(item)) || keys[0] || "settings.profile";
  const item = flattenRegistry().find((entry) => entry.key === key);
  return Array.isArray(item?.routes) && item.routes[0] ? item.routes[0] : "/app/admin/configuracoes";
};

const buildUserCommitDocumentName = (uid) => {
  if (!PROJECT_ID) throw new Error("missing_firestore_project_id");
  return `projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(String(uid || "").trim())}`;
};

const buildAuditDocumentName = (id) => {
  if (!PROJECT_ID) throw new Error("missing_firestore_project_id");
  return `projects/${PROJECT_ID}/databases/(default)/documents/adminAuditEvents/${encodeURIComponent(String(id || "").trim())}`;
};

const auditWrite = ({ event, actorUserId, targetUserId, before, after, createdAt = new Date().toISOString() }) => {
  const id = `${event}_${targetUserId}_${Date.now()}`;
  return {
    update: {
      name: buildAuditDocumentName(id),
      fields: encodeFields({ id, event, actorUserId, targetUserId, before, after, createdAt }).fields,
    },
  };
};

const buildAdminPermissionPatchWrites = ({ targetUser, targetUid, permissions, actorUserId, event = "admin_permissions_updated" }) => {
  const before = normalizeAdminPermissions(targetUser?.adminPermissions || targetUser?.permissions, { fallbackFullAccess: normalizeRole(targetUser?.role || targetUser?.tipo) === "admin" });
  const after = normalizeAdminPermissions(permissions);
  const now = new Date().toISOString();
  const nextVersion = (Number(targetUser?.adminPermissionsVersion || 0) || 0) + 1;
  return {
    before,
    after,
    writes: [
      {
        update: {
          name: buildUserCommitDocumentName(targetUid),
          fields: encodeFields({
            adminPermissions: after,
            permissions: after,
            adminPermissionsVersion: nextVersion,
            permissionsUpdatedAt: now,
            permissionsUpdatedBy: String(actorUserId || ""),
            atualizadoEm: now,
            updatedAt: now,
          }).fields,
        },
        updateMask: { fieldPaths: ["adminPermissions", "permissions", "adminPermissionsVersion", "permissionsUpdatedAt", "permissionsUpdatedBy", "atualizadoEm", "updatedAt"] },
        currentDocument: { exists: true },
      },
      auditWrite({ event, actorUserId, targetUserId: targetUid, before, after, createdAt: now }),
    ],
  };
};

const saveAdminPermissions = async ({ actorUserId, targetUid, permissions }) => {
  const actor = await getDocumentAsAdmin(`users/${encodeURIComponent(String(actorUserId || "").trim())}`);
  if (!isSuperAdminUser(actor)) {
    const error = new Error("super_admin_only");
    error.status = 403;
    throw error;
  }
  const safeTargetUid = String(targetUid || "").trim();
  if (!safeTargetUid || safeTargetUid === String(actorUserId || "").trim()) {
    const error = new Error("invalid_target");
    error.status = 403;
    throw error;
  }
  const target = await getDocumentAsAdmin(`users/${encodeURIComponent(safeTargetUid)}`);
  if (normalizeRole(target?.role || target?.tipo) !== "admin" || target?.isSuperAdmin === true) {
    const error = new Error("invalid_target");
    error.status = 403;
    throw error;
  }
  const { before, after, writes } = buildAdminPermissionPatchWrites({ targetUser: target, targetUid: safeTargetUid, permissions, actorUserId });
  const response = await commitWritesAsAdmin({ writes });
  if (!response.ok) {
    const error = new Error("permissions_save_failed");
    error.status = response.status;
    throw error;
  }
  return { before, after };
};

const backfillExistingAdminPermissions = async ({ actorUserId } = {}) => {
  const rows = await listCollectionAsAdmin("users", { pageSize: 1500 });
  const adminRows = rows.filter((row) => normalizeRole(row?.role || row?.tipo || row?.type) === "admin");
  const writes = [];
  const changed = [];
  const now = new Date().toISOString();
  adminRows.forEach((row) => {
    const uid = String(row?.firestoreDocId || row?.id || row?.uid || "").trim();
    if (!uid || row?.isSuperAdmin === true || Array.isArray(row?.adminPermissions)) return;
    const perms = ALL_ADMIN_PERMISSION_KEYS.slice();
    writes.push({
      update: {
        name: buildUserCommitDocumentName(uid),
        fields: encodeFields({
          adminPermissions: perms,
          permissions: perms,
          adminPermissionsVersion: Number(row?.adminPermissionsVersion || 0) || 1,
          permissionsUpdatedAt: now,
          permissionsUpdatedBy: actorUserId || "system:admin-permissions-backfill",
          updatedAt: now,
          atualizadoEm: now,
        }).fields,
      },
      updateMask: { fieldPaths: ["adminPermissions", "permissions", "adminPermissionsVersion", "permissionsUpdatedAt", "permissionsUpdatedBy", "updatedAt", "atualizadoEm"] },
      currentDocument: { exists: true },
    });
    writes.push(auditWrite({ event: "admin_permissions_backfilled", actorUserId: actorUserId || "system:admin-permissions-backfill", targetUserId: uid, before: [], after: perms, createdAt: now }));
    changed.push(uid);
  });
  for (let index = 0; index < writes.length; index += 400) {
    const response = await commitWritesAsAdmin({ writes: writes.slice(index, index + 400) });
    if (!response.ok) {
      const error = new Error("permissions_backfill_failed");
      error.status = response.status;
      throw error;
    }
  }
  return { scanned: adminRows.length, changed: changed.length, changedIds: changed };
};

module.exports = {
  ADMIN_PERMISSION_REGISTRY,
  ALL_ADMIN_PERMISSION_KEYS,
  VALID_ADMIN_PERMISSION_KEYS,
  adminAccessPayloadForUser,
  backfillExistingAdminPermissions,
  buildAdminPermissionPatchWrites,
  canAdminAccess,
  firstAllowedAdminPanel,
  firstAllowedAdminRoute,
  flattenRegistry,
  isSuperAdminUser,
  loadAdminAccessForUid,
  normalizeAdminPermissions,
  permissionForAdminPanel,
  requireAdminPermission,
  requireResolvedAdminPermission,
  saveAdminPermissions,
};
