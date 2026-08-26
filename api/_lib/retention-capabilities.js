const ROLE_CAPABILITIES = {
  admin: new Set([
    "retention.view",
    "retention.manage",
    "retention.resolve",
    "retention.override",
    "finance.view",
    "finance.manage",
    "risk.flag",
  ]),
  growth: new Set(["retention.view", "retention.manage", "retention.resolve", "finance.view", "risk.flag"]),
  financeiro: new Set(["retention.view", "finance.view", "finance.manage"]),
};

const getCapabilitiesForRole = (role) => new Set(ROLE_CAPABILITIES[String(role || "").trim().toLowerCase()] || []);

const hasCapability = (role, capability) => getCapabilitiesForRole(role).has(String(capability || "").trim());

module.exports = {
  ROLE_CAPABILITIES,
  getCapabilitiesForRole,
  hasCapability,
};
