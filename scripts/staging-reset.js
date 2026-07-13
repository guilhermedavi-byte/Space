const { assertEnvironmentIsolation, getAppEnv } = require("../_lib/runtime-env");

const PRESERVED_COLLECTIONS = ["accounts", "account_profile_links"];
const PRESERVED_TABLES = ["reconciliation_audit_logs"];

const parseList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const validateResetEnvironment = (env = process.env) => {
  const appEnv = getAppEnv(env);
  if (appEnv !== "staging") {
    const error = new Error("reset_requires_staging");
    error.code = "reset_requires_staging";
    throw error;
  }
  const validation = assertEnvironmentIsolation(env);
  if (String(env.STAGING_RESET_WRITE_ENABLED || "").trim().toLowerCase() !== "true") {
    const error = new Error("reset_write_disabled");
    error.code = "reset_write_disabled";
    error.details = validation;
    throw error;
  }
  return validation;
};

const buildResetPlan = (env = process.env) => ({
  appEnv: getAppEnv(env),
  dryRunOnlyByDefault: true,
  preserveAdminEmails: parseList(env.STAGING_ADMIN_EMAIL_ALLOWLIST),
  preserveCollections: PRESERVED_COLLECTIONS,
  preserveTables: PRESERVED_TABLES,
  deleteOnlySyntheticData: true,
  syntheticEmailDomains: ["example.com", "example.net", "example.org", "space.test", "space.invalid"],
  report: {
    before: {
      firestoreCollections: ["students", "teachers", "enrollments", "integration_outbox"],
      supabaseTables: ["payers", "financial_contracts", "contract_items", "charges", "charge_allocations", "reconciliation_items"],
    },
    after: {
      preservedAdminAccounts: true,
      syntheticRowsRemoved: true,
    },
  },
});

const runCli = () => {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run") || !args.has("--execute");
  const confirm = args.has("--confirm");
  const plan = buildResetPlan(process.env);

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ mode: "dry-run", plan }, null, 2)}\n`);
    return;
  }

  if (!confirm) {
    const error = new Error("reset_confirmation_required");
    error.code = "reset_confirmation_required";
    throw error;
  }

  validateResetEnvironment(process.env);
  throw new Error("reset_execution_not_enabled_in_pr3");
};

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          error: error?.code || error?.message || "staging_reset_failed",
          message: error?.message || "staging_reset_failed",
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  }
}

module.exports = {
  PRESERVED_COLLECTIONS,
  PRESERVED_TABLES,
  buildResetPlan,
  validateResetEnvironment,
};
