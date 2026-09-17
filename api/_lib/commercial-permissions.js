const COMMERCIAL_ROLES = new Set(["sdr", "closer"]);
const WORKSPACES = new Set(["sdr", "closer"]);

const clean = (value) => String(value || "").trim().toLowerCase();

const normalizePlatformRole = (value) => {
  const raw = clean(value);
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return raw;
};

const normalizeCommercialRoles = (value) => {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\s]+/) : [];
  return Array.from(new Set(source.map(clean).filter((role) => COMMERCIAL_ROLES.has(role))));
};

const normalizeWorkspace = (value) => {
  const workspace = clean(value);
  return WORKSPACES.has(workspace) ? workspace : "";
};

const getCommercialPermissions = (user = {}) => {
  const platformRole = normalizePlatformRole(user.role || user.tipo || user.type);
  const commercialRoles = normalizeCommercialRoles(user.commercialRoles);
  return {
    platformRole,
    commercialRoles,
    isAdmin: platformRole === "admin",
    isGrowth: platformRole === "growth",
    canUseSdrWorkspace: platformRole === "admin" || commercialRoles.includes("sdr"),
    canUseCloserWorkspace: platformRole === "admin" || commercialRoles.includes("closer"),
    hasCommercialAccess: platformRole === "admin" || commercialRoles.length > 0,
  };
};

const canAccessCommercialWorkspace = (user = {}, workspace) => {
  const normalized = normalizeWorkspace(workspace);
  if (!normalized) return false;
  const permissions = getCommercialPermissions(user);
  if (permissions.isAdmin) return true;
  if (normalized === "sdr") return permissions.canUseSdrWorkspace;
  if (normalized === "closer") return permissions.canUseCloserWorkspace;
  return false;
};

const workspaceForPipelineType = (pipelineType) => {
  const type = clean(pipelineType);
  if (type === "sdr") return "sdr";
  if (type === "closer") return "closer";
  return "";
};

const visiblePipelineTypesForUser = (user = {}, workspace = "") => {
  const permissions = getCommercialPermissions(user);
  const requested = normalizeWorkspace(workspace);
  if (requested) return canAccessCommercialWorkspace(user, requested) ? [requested] : [];
  if (permissions.isAdmin) return ["sdr", "closer"];
  return permissions.commercialRoles.filter((role) => WORKSPACES.has(role));
};

const canAccessPipelineType = (user = {}, pipelineType) => {
  const workspace = workspaceForPipelineType(pipelineType);
  return Boolean(workspace && canAccessCommercialWorkspace(user, workspace));
};

const canPerformCrmAction = ({ user = {}, action = "", pipelineType = "" } = {}) => {
  const permissions = getCommercialPermissions(user);
  if (permissions.isAdmin) return true;
  const key = clean(action);
  const workspace = workspaceForPipelineType(pipelineType);
  if (["start_qualification", "complete_qualification", "handoff_opportunity"].includes(key)) return permissions.canUseSdrWorkspace && workspace === "sdr";
  if (["set_meeting_outcome", "complete_closer_review", "mark_opportunity_won", "mark_opportunity_lost", "reopen_opportunity"].includes(key)) return permissions.canUseCloserWorkspace && workspace === "closer";
  if (["create_activity", "update_activity", "complete_activity", "cancel_activity", "move_opportunity", "update_opportunity"].includes(key)) {
    return workspace ? canAccessCommercialWorkspace(user, workspace) : false;
  }
  if (key === "create_opportunity") return permissions.canUseSdrWorkspace && workspace === "sdr";
  return false;
};

module.exports = {
  COMMERCIAL_ROLES,
  WORKSPACES,
  canAccessCommercialWorkspace,
  canAccessPipelineType,
  canPerformCrmAction,
  getCommercialPermissions,
  normalizeCommercialRoles,
  normalizePlatformRole,
  normalizeWorkspace,
  visiblePipelineTypesForUser,
  workspaceForPipelineType,
};
