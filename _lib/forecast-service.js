/*
  Growth forecast (3-part model)

  forecast_total = parte1_fechado + parte2_pipeline + parte3_novos_leads

  This module is pure (no network, no Firestore). The API route is responsible for:
  - fetching DataCrazy deals
  - computing month keys and rates
*/

const normalizeKey = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const clamp01 = (n) => Math.max(0, Math.min(1, safeNumber(n)));

const getDealValue = (deal) => {
  // 1) Real value
  const raw = safeNumber(deal?.total ?? deal?.value);
  if (raw > 0) return raw;

  // 2) Product ticket fallback
  const productName =
    deal?.products?.[0]?.product?.name != null
      ? String(deal.products[0].product.name).trim()
      : deal?.product != null
        ? String(deal.product).trim()
        : "";

  if (productName === "Programa Diamond") return 1190;
  if (productName === "Programa Gold") return 897;
  if (productName === "Programa Turma") return 350;

  // 3) General ticket
  return 1057;
};

const PIPELINE_STAGE_KEYS = new Set([
  normalizeKey("Reunião feita (Follow-up)"),
  normalizeKey("Hot Lead"),
  normalizeKey("Em fechamento"),
]);

const PIPELINE_WEIGHT = 0.35;

const calculateGrowthForecast3Parts = ({
  deals = [],
  nowMonthKey = "",
  getMonthKey,
  getClosedDate, // (deal) => Date|null
  daysPassed = 0,
  daysRemaining = 0,
  rates = null, // { taxaAgendamento, taxaNoShow, taxaConversao, ticketMedio }
} = {}) => {
  const items = Array.isArray(deals) ? deals : [];
  const monthKey = String(nowMonthKey || "").trim();
  const monthKeyFn = typeof getMonthKey === "function" ? getMonthKey : () => "";
  const closedDateFn = typeof getClosedDate === "function" ? getClosedDate : () => null;

  const createdThisMonth = items.filter((d) => {
    const createdAt = d?.createdAt || d?.created_at || null;
    if (!createdAt) return false;
    return monthKeyFn(createdAt) === monthKey;
  });

  // Parte 1: fechado no mês (garantido)
  const closedThisMonth = items.filter((d) => {
    const stageKey = normalizeKey(d?.stage?.name ?? d?.stage);
    if (stageKey !== normalizeKey("Fechado")) return false;
    const closedAt = closedDateFn(d) || d?.closedAt || d?.closed_at || null;
    if (!closedAt) return false;
    return monthKeyFn(closedAt) === monthKey;
  });
  const parte1 = closedThisMonth.reduce((sum, d) => sum + getDealValue(d), 0);

  // Parte 2: pipeline ativo (3 etapas) ponderado
  const pipelineDeals = createdThisMonth.filter((d) => {
    const stageKey = normalizeKey(d?.stage?.name ?? d?.stage);
    return PIPELINE_STAGE_KEYS.has(stageKey);
  });
  const parte2 = pipelineDeals.reduce((sum, d) => sum + getDealValue(d) * PIPELINE_WEIGHT, 0);

  // Parte 3: projeção de novos leads (dias restantes)
  const passed = Math.max(0, Number(daysPassed) || 0);
  const remaining = Math.max(0, Number(daysRemaining) || 0);
  const leadsDoMes = createdThisMonth.length;
  const mediaDiariaLeads = passed > 0 ? leadsDoMes / passed : 0;
  const novosLeadsEsperados = mediaDiariaLeads * remaining;

  const taxaAgendamento = clamp01(rates?.taxaAgendamento ?? 0.447);
  const taxaNoShow = clamp01(rates?.taxaNoShow ?? 0.297);
  const taxaConversao = clamp01(rates?.taxaConversao ?? 0.362);
  const ticketMedio = safeNumber(rates?.ticketMedio ?? 1057) || 1057;

  const agendados = novosLeadsEsperados * taxaAgendamento;
  const shows = agendados * (1 - taxaNoShow);
  const vendasNovas = shows * taxaConversao;
  const parte3 = vendasNovas * ticketMedio;

  const total = parte1 + parte2 + parte3;

  return {
    total,
    parte1_fechado: parte1,
    parte2_pipeline: parte2,
    parte3_novosLeads: parte3,
    debug: {
      deals_parte2: pipelineDeals.length,
      leadsDoMes,
      mediaDiariaLeads,
      diasPassados: passed,
      diasRestantes: remaining,
      novosLeadsEsperados,
      taxas: { taxaAgendamento, taxaNoShow, taxaConversao, ticketMedio },
    },
  };
};

module.exports = { calculateGrowthForecast3Parts, getDealValue, normalizeKey };

