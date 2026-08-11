#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "api", "growth-dashboard.js");
const OUTPUT_PATH = path.join(__dirname, "tmp-ranking-dump.csv");

const requiredEnv = ["CRM_API_BASE_URL", "CRM_API_KEY"];
const missingEnv = requiredEnv.filter((key) => !String(process.env[key] || "").trim());
if (missingEnv.length) {
  console.error(`[tmp-ranking-dump] missing required env: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const source = fs.readFileSync(SOURCE_PATH, "utf8");
const instrumentedSource = `${source}

module.exports.__tmpRankingDump = {
  fetchAllCrmBusinesses,
  CONVERSION_MEETING_OR_AFTER_STAGE_KEYS,
  getBusinessWonLostDate,
  getMonthKeySaoPaulo,
  normalizeKey,
};
`;

const growthModule = new Module(SOURCE_PATH, module.parent || module);
growthModule.filename = SOURCE_PATH;
growthModule.paths = Module._nodeModulePaths(path.dirname(SOURCE_PATH));
growthModule._compile(instrumentedSource, SOURCE_PATH);

const helpers = growthModule.exports.__tmpRankingDump;
if (!helpers) {
  console.error("[tmp-ranking-dump] could not load helpers from api/growth-dashboard.js");
  process.exit(1);
}

const {
  fetchAllCrmBusinesses,
  CONVERSION_MEETING_OR_AFTER_STAGE_KEYS,
  getBusinessWonLostDate,
  getMonthKeySaoPaulo,
  normalizeKey,
} = helpers;

const CURRENT_MONTH = getMonthKeySaoPaulo(new Date());
const CONVERSION_PIPELINE_KEY = normalizeKey("Conversão");
const CLOSED_STAGE_KEY = normalizeKey("Fechado");

const safeString = (value) => (value == null ? "" : String(value).trim());

const getBusinessId = (business) => {
  const raw =
    business?.id ??
    business?._id ??
    business?.uuid ??
    business?.businessId ??
    "";
  return safeString(raw);
};

const getLeadName = (business) =>
  safeString(business?.lead?.name || business?.leadName || business?.name || "");

const csvEscape = (value) => {
  const raw = value == null ? "" : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, "\"\"")}"` : raw;
};

const buildForcedLastMovedDate = (business) => {
  const raw = safeString(business?.lastMovedAt);
  if (!raw) return { date: null, field: "" };
  const date = new Date(raw);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return { date: null, field: "" };
  return { date, field: "lastMovedAt" };
};

const evaluateRankingLogic = (business, dateInfo) => {
  const reasons = [];
  const pipelineKey = normalizeKey(business?.stage?.pipeline?.name);
  const rawStage = safeString(business?.stage?.name);
  const stageKey = normalizeKey(rawStage);
  const resultMonth = dateInfo?.date ? getMonthKeySaoPaulo(dateInfo.date) : "";

  if (pipelineKey !== CONVERSION_PIPELINE_KEY) reasons.push("pipeline_nao_conversao");
  if (!CONVERSION_MEETING_OR_AFTER_STAGE_KEYS.has(stageKey)) reasons.push("etapa_fora_de_reuniao_ou_posterior");
  if (!dateInfo?.date) reasons.push("sem_data_escolhida");
  else if (resultMonth !== CURRENT_MONTH) reasons.push("fora_do_mes_corrente");

  const countedMeeting = reasons.length === 0;
  const countedSale = countedMeeting && stageKey === CLOSED_STAGE_KEY;

  return {
    countedMeeting,
    countedSale,
    resultMonth,
    discardReason: reasons.join(";"),
  };
};

const summarize = (rows, { excludeLost = false, forceLastMovedAt = false } = {}) => {
  let meetings = 0;
  let sales = 0;

  rows.forEach((row) => {
    if (excludeLost && normalizeKey(row.status) === "lost") return;
    const evalResult = forceLastMovedAt
      ? evaluateRankingLogic(row.business, buildForcedLastMovedDate(row.business))
      : row.currentLogic;
    if (evalResult.countedMeeting) meetings += 1;
    if (evalResult.countedSale) sales += 1;
  });

  return { meetings, sales };
};

(async () => {
  const payload = await fetchAllCrmBusinesses();
  if (!payload?.ok) {
    console.error("[tmp-ranking-dump] CRM fetch failed");
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  const allBusinesses = Array.isArray(payload.businesses) ? payload.businesses : [];
  const matheusBusinesses = allBusinesses.filter((business) => {
    const attendantName = safeString(business?.attendant?.name);
    return attendantName && normalizeKey(attendantName).includes("matheus");
  });

  const rows = matheusBusinesses.map((business) => {
    const chosenDate = getBusinessWonLostDate(business);
    const currentLogic = evaluateRankingLogic(business, chosenDate);
    const stageName = safeString(business?.stage?.name);
    const status = safeString(business?.status);
    return {
      business,
      stageName,
      status,
      currentLogic,
      csv: {
        id: getBusinessId(business),
        code: safeString(business?.code),
        cliente: getLeadName(business),
        stageId: safeString(business?.stage?.id),
        nome_da_etapa: stageName,
        status,
        statusChangedAt: safeString(business?.statusChangedAt),
        lastMovedAt: safeString(business?.lastMovedAt),
        campo_de_data_escolhido: safeString(chosenDate?.field),
        mes_resultante: safeString(currentLogic.resultMonth),
        CONTOU_COMO_REUNIAO: currentLogic.countedMeeting ? "true" : "false",
        CONTOU_COMO_VENDA: currentLogic.countedSale ? "true" : "false",
        motivo_do_descarte: safeString(currentLogic.discardReason),
      },
    };
  });

  const headers = [
    "id",
    "code",
    "cliente",
    "stageId",
    "nome_da_etapa",
    "status",
    "statusChangedAt",
    "lastMovedAt",
    "campo_de_data_escolhido",
    "mes_resultante",
    "CONTOU_COMO_REUNIAO",
    "CONTOU_COMO_VENDA",
    "motivo_do_descarte",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => csvEscape(row.csv[key])).join(",")),
  ].join("\n");

  fs.writeFileSync(OUTPUT_PATH, csv);

  const currentTotals = summarize(rows);
  const noLostTotals = summarize(rows, { excludeLost: true });
  const lastMovedTotals = summarize(rows, { forceLastMovedAt: true });

  console.log(`CSV: ${OUTPUT_PATH}`);
  console.log(`TOTAL atual: reunioes=${currentTotals.meetings} vendas=${currentTotals.sales}`);
  console.log(`TOTAL sem status=lost: reunioes=${noLostTotals.meetings} vendas=${noLostTotals.sales}`);
  console.log(`TOTAL usando lastMovedAt: reunioes=${lastMovedTotals.meetings} vendas=${lastMovedTotals.sales}`);

  const attendantExpanded = rows.some((row) => safeString(row.business?.attendant?.name));
  console.log(`attendant_expandido=${attendantExpanded ? "true" : "false"}`);
  console.log("stageId_para_nome=business.stage.id -> business.stage.name");
})().catch((error) => {
  console.error("[tmp-ranking-dump] failed");
  console.error(error?.stack || String(error));
  process.exit(1);
});
