const truthy = (value) => ["1", "true", "yes", "on", "enabled"].includes(String(value || "").trim().toLowerCase());

const isRetentionV2Enabled = (env = process.env) => truthy(env.RETENTION_V2_ENABLED);
const isRetentionInvoluntaryChurnEnabled = (env = process.env) => truthy(env.RETENTION_INVOLUNTARY_CHURN_ENABLED);
const isRetentionFinancialKpisEnabled = (env = process.env) => truthy(env.RETENTION_FINANCIAL_KPIS_ENABLED);

module.exports = {
  truthy,
  isRetentionV2Enabled,
  isRetentionInvoluntaryChurnEnabled,
  isRetentionFinancialKpisEnabled,
};
