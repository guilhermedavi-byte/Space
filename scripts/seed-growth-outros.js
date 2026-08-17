const { commitWritesAsAdmin, getDocumentAsAdmin } = require("../api/_lib/firestore-admin");
const { FIRESTORE_BASE, encodeFields } = require("../_lib/firestore-rest");
const { resolveCommercialWeek } = require("../api/_lib/commercial-week");

const AGGREGATE_PERSON_ID = "outros";
const AGGREGATE_PERSON = {
  personId: AGGREGATE_PERSON_ID,
  displayName: "Outros",
  active: true,
  isAggregate: true,
  sortOrder: 999,
  roles: ["closer"],
  crmAttendantIds: [],
  crmAttendantAliases: [],
  userUid: "",
  sdrUid: "",
  sdrEmails: [],
};

const safeString = (value) => (value == null ? "" : String(value).trim());

const monthKeyFromDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date instanceof Date ? date : new Date(date));
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}`;
};

const docName = (collection, id) => `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(id)}`;

const parseArgs = (argv = process.argv.slice(2)) => {
  const args = new Set(argv);
  return {
    apply: args.has("--apply"),
    now: new Date(),
  };
};

const buildPlan = async ({ now = new Date() } = {}) => {
  const commercialWeek = resolveCommercialWeek({ now });
  const competencia = monthKeyFromDate(now);
  const goalDocId = competencia;
  let existingGoal = null;
  let readWarning = "";

  try {
    existingGoal = await getDocumentAsAdmin(`growthGoals/${encodeURIComponent(goalDocId)}`);
  } catch (error) {
    if (Number(error?.status) === 404) {
      existingGoal = null;
    } else {
      readWarning = safeString(error?.message) || "goal_read_failed";
      existingGoal = null;
    }
  }

  const nowIso = new Date().toISOString();
  const existingWeeklyGoals = existingGoal?.weeklyGoals && typeof existingGoal.weeklyGoals === "object" ? existingGoal.weeklyGoals : {};
  const existingWeek = existingWeeklyGoals?.[commercialWeek.weekKey] && typeof existingWeeklyGoals[commercialWeek.weekKey] === "object" ? existingWeeklyGoals[commercialWeek.weekKey] : {};
  const existingIndividuals =
    existingWeek?.individualMonthlyGoals && typeof existingWeek.individualMonthlyGoals === "object"
      ? existingWeek.individualMonthlyGoals
      : existingWeek?.people && typeof existingWeek.people === "object"
        ? existingWeek.people
        : {};

  const mergedWeek = {
    ...existingWeek,
    startDateKey: commercialWeek.startDateKey,
    endDateKey: commercialWeek.endDateKey,
    teamTarget: 20000,
    individualMonthlyGoals: {
      ...existingIndividuals,
      [AGGREGATE_PERSON_ID]: {
        role: "closer",
        targetValue: 4000,
      },
    },
  };

  const goalPatch = {
    competencia,
    weeklyGoals: {
      ...existingWeeklyGoals,
      [commercialWeek.weekKey]: mergedWeek,
    },
    updatedAt: nowIso,
    updatedBy: "seed-growth-outros",
    updatedByName: "seed-growth-outros",
  };

  return {
    commercialWeek,
    competencia,
    readWarning,
    aggregatePerson: {
      ...AGGREGATE_PERSON,
      createdAt: safeString(existingGoal?.createdAt) || nowIso,
      updatedAt: nowIso,
    },
    goalPatch,
  };
};

const buildWrites = ({ aggregatePerson, goalPatch }) => [
  {
    update: {
      name: docName("growthPeople", AGGREGATE_PERSON_ID),
      fields: encodeFields(aggregatePerson).fields,
    },
  },
  {
    update: {
      name: docName("growthGoals", goalPatch.competencia),
      fields: encodeFields(goalPatch).fields,
    },
  },
];

const run = async () => {
  const { apply, now } = parseArgs();
  const plan = await buildPlan({ now });
  const writes = buildWrites(plan);

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          note: "Nenhuma escrita foi executada. Use --apply somente se o acesso admin ao Firestore estiver funcionando.",
          readWarning: plan.readWarning || null,
          commercialWeek: plan.commercialWeek,
          writesPreview: {
            growthPeople: plan.aggregatePerson,
            growthGoals: {
              competencia: plan.competencia,
              weeklyGoal: plan.goalPatch.weeklyGoals[plan.commercialWeek.weekKey],
            },
          },
        },
        null,
        2
      )
    );
    return;
  }

  await commitWritesAsAdmin({ writes });
  console.log(
    JSON.stringify(
      {
        mode: "applied",
        commercialWeek: plan.commercialWeek,
        competencia: plan.competencia,
        writes: writes.length,
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: safeString(error?.message) || "seed_failed",
        status: Number(error?.status) || null,
      },
      null,
      2
    )
  );
  process.exit(1);
});
