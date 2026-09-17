const { normalizeCommercialRoles } = require("./commercial-permissions");

const commercialRoleBucket = (roles) => {
  const normalized = normalizeCommercialRoles(roles);
  const hasSdr = normalized.includes("sdr");
  const hasCloser = normalized.includes("closer");
  if (hasSdr && hasCloser) return "both";
  if (hasSdr) return "sdr";
  if (hasCloser) return "closer";
  return "missing";
};

const summarizeCommercialRoles = (rows = []) => {
  const summary = { total: 0, sdr: 0, closer: 0, both: 0, missing: 0 };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    summary.total += 1;
    summary[commercialRoleBucket(row?.commercialRoles)] += 1;
  });
  return summary;
};

const matchesCommercialRoleFilter = (row = {}, filter = "all") => {
  const safeFilter = String(filter || "all").trim().toLowerCase();
  if (!safeFilter || safeFilter === "all") return true;
  return commercialRoleBucket(row.commercialRoles) === safeFilter;
};

module.exports = {
  commercialRoleBucket,
  matchesCommercialRoleFilter,
  summarizeCommercialRoles,
};
