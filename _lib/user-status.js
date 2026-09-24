const INACTIVE_STATUSES = new Set(["inactive", "inativo", "disabled", "desativado", "deactivated", "suspended", "bloqueado"]);

const normalizeUserStatus = (user = {}) => {
  const row = user && typeof user === "object" ? user : {};
  const rawStatus = String(row.status || row.accountStatus || row.accessStatus || "").trim().toLowerCase();
  if (row.ativo === false || row.active === false || row.disabled === true || INACTIVE_STATUSES.has(rawStatus)) return "inactive";
  return "active";
};

const isUserActive = (user = {}) => normalizeUserStatus(user) === "active";

module.exports = {
  isUserActive,
  normalizeUserStatus,
};
