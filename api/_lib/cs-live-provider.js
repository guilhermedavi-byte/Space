const safePercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
};

const METRIC_DIRECTIONS = {
  LOWER_IS_BETTER: "lower_is_better",
  HIGHER_IS_BETTER: "higher_is_better",
};

const normalizeMetric = (metric = {}) => ({
  key: String(metric.key || "").trim(),
  label: String(metric.label || "").trim(),
  shortLabel: String(metric.shortLabel || metric.label || "").trim(),
  actualValue: safePercent(metric.actualValue),
  targetValue: safePercent(metric.targetValue),
  direction: metric.direction === METRIC_DIRECTIONS.HIGHER_IS_BETTER
    ? METRIC_DIRECTIONS.HIGHER_IS_BETTER
    : METRIC_DIRECTIONS.LOWER_IS_BETTER,
  context: String(metric.context || "").trim(),
});

const createMockCsLiveProvider = () => ({
  async getSnapshot() {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 5);
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 2);
    const formatDateKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    return {
      generatedAt: now.toISOString(),
      weekly: {
        commercialWeek: {
          startDateKey: formatDateKey(startDate),
          endDateKey: formatDateKey(endDate),
        },
      },
      metrics: [
        normalizeMetric({
          key: "cancelamento",
          label: "Taxa de Pedidos de Cancelamento",
          shortLabel: "Pedidos de cancelamento",
          actualValue: 4.2,
          targetValue: 3.5,
          direction: METRIC_DIRECTIONS.LOWER_IS_BETTER,
          context: "Percentual dos alunos ativos que pediram cancelamento no ciclo atual.",
        }),
        normalizeMetric({
          key: "inadimplencia",
          label: "Inadimplência",
          shortLabel: "Inadimplência",
          actualValue: 6.8,
          targetValue: 5,
          direction: METRIC_DIRECTIONS.LOWER_IS_BETTER,
          context: "Percentual da base com cobrança em atraso na janela pedagógica acompanhada.",
        }),
        normalizeMetric({
          key: "presenca",
          label: "Taxa de Presença",
          shortLabel: "Presença",
          actualValue: 91.4,
          targetValue: 88,
          direction: METRIC_DIRECTIONS.HIGHER_IS_BETTER,
          context: "Percentual de presença nas aulas realizadas na janela atual.",
        }),
      ],
      dataSource: {
        kind: "mock",
        label: "Dados de exemplo",
      },
    };
  },
});

const getCsLiveProvider = () => createMockCsLiveProvider();

module.exports = {
  METRIC_DIRECTIONS,
  createMockCsLiveProvider,
  getCsLiveProvider,
};
