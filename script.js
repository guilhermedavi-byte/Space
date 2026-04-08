const body = document.body;
const openPlatformButtons = document.querySelectorAll("[data-open-platform]");
const closePlatformButton = document.querySelector("[data-close-platform]");
const sidebarLinks = document.querySelectorAll("[data-panel-target]");
const panels = document.querySelectorAll("[data-panel]");
const slotButtons = document.querySelectorAll("[data-slot]");
const bookingFeedback = document.querySelector("[data-booking-feedback]");
const chartFilterButtons = document.querySelectorAll("[data-chart-type]");
const learningChart = document.querySelector("[data-learning-chart]");
const lineArea = document.querySelector("[data-line-area]");
const linePath = document.querySelector("[data-line-path]");
const linePoints = document.querySelector("[data-line-points]");
const learningLabels = document.querySelector("[data-learning-labels]");
const studyChart = document.querySelector("[data-study-chart]");
const studyLabels = document.querySelector("[data-study-labels]");
const studyScale = document.querySelector(".analytics-card-bar .bar-chart-scale");

const dashboardChartData = {
  learning: {
    "30d": {
      labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Hoje"],
      values: [56, 61, 66, 71, 76],
    },
    "90d": {
      labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"],
      values: [42, 47, 53, 58, 66, 72],
    },
    "12m": {
      labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      values: [24, 28, 31, 36, 40, 46, 52, 58, 63, 67, 70, 72],
    },
  },
  study: {
    "7d": {
      labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"],
      values: [0.6, 0.9, 0.4, 1.2, 0.8, 1.4, 0.7],
    },
    "30d": {
      labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      values: [6.5, 8.2, 7.1, 9.4],
    },
    "90d": {
      labels: ["Jan", "Fev", "Mar"],
      values: [24, 31, 28],
    },
    all: {
      labels: ["2023", "2024", "2025", "2026"],
      values: [86, 112, 148, 84],
    },
  },
};

const formatHours = (value) => {
  if (value < 1) {
    return `${Math.round(value * 60)}m`;
  }

  const rounded = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded}h`;
};

const getNiceMax = (maxValue) => {
  if (maxValue <= 2) return 2;
  if (maxValue <= 10) return Math.ceil(maxValue / 2) * 2;
  if (maxValue <= 40) return Math.ceil(maxValue / 5) * 5;
  return Math.ceil(maxValue / 20) * 20;
};

const createPathFromPoints = (points) =>
  points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

const renderLearningChart = (range) => {
  if (!learningChart || !lineArea || !linePath || !linePoints || !learningLabels) {
    return;
  }

  const dataset = dashboardChartData.learning[range];
  if (!dataset) return;

  const width = 720;
  const height = 280;
  const top = 20;
  const bottom = 230;
  const left = 12;
  const right = 12;
  const safeValues = dataset.values;
  const xStep = safeValues.length > 1 ? (width - left - right) / (safeValues.length - 1) : 0;

  const points = safeValues.map((value, index) => {
    const x = left + xStep * index;
    const y = bottom - (value / 100) * (bottom - top);
    return { x, y, value };
  });

  const path = createPathFromPoints(points);
  const areaPath = `${path} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;

  linePath.setAttribute("d", path);
  lineArea.setAttribute("d", areaPath);
  linePoints.innerHTML = points
    .map(
      (point, index) =>
        `<circle class="line-chart-point${index === points.length - 1 ? " is-last" : ""}" cx="${point.x}" cy="${point.y}" r="${
          index === points.length - 1 ? 6 : 5
        }"></circle>`
    )
    .join("");

  learningLabels.innerHTML = dataset.labels.map((label) => `<span>${label}</span>`).join("");
};

const renderStudyChart = (range) => {
  if (!studyChart || !studyLabels || !studyScale) {
    return;
  }

  const dataset = dashboardChartData.study[range];
  if (!dataset) return;

  const maxValue = getNiceMax(Math.max(...dataset.values));
  const scaleValues = [maxValue, maxValue * 0.66, maxValue * 0.33, 0];

  studyScale.innerHTML = scaleValues
    .map((value) => `<span>${formatHours(value)}</span>`)
    .join("");

  studyChart.innerHTML = dataset.values
    .map((value, index) => {
      const height = Math.max((value / maxValue) * 100, 8);
      const isLast = index === dataset.values.length - 1;
      return `
        <div class="bar-column${isLast ? "" : " is-muted"}">
          <span class="bar-column-value">${formatHours(value)}</span>
          <span class="bar-column-fill" style="height:${height}%"></span>
        </div>
      `;
    })
    .join("");

  studyLabels.innerHTML = dataset.labels.map((label) => `<span>${label}</span>`).join("");
};

const renderDashboardCharts = () => {
  renderLearningChart("30d");
  renderStudyChart("7d");
};

const setView = (view) => {
  body.dataset.view = view;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const showPanel = (panelName) => {
  sidebarLinks.forEach((link) => {
    const isActive = link.dataset.panelTarget === panelName;
    link.classList.toggle("is-active", isActive);
    link.setAttribute("aria-pressed", String(isActive));
  });

  panels.forEach((panel) => {
    const isVisible = panel.dataset.panel === panelName;
    panel.classList.toggle("is-visible", isVisible);
    panel.hidden = !isVisible;
  });
};

openPlatformButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setView("interno");
    showPanel("dashboard");
  });
});

if (closePlatformButton) {
  closePlatformButton.addEventListener("click", () => {
    setView("publico");
  });
}

sidebarLinks.forEach((link) => {
  link.addEventListener("click", () => {
    showPanel(link.dataset.panelTarget);
  });
});

slotButtons.forEach((button) => {
  button.addEventListener("click", () => {
    slotButtons.forEach((slot) => slot.classList.remove("is-selected"));
    button.classList.add("is-selected");

    if (bookingFeedback) {
      bookingFeedback.textContent = `Aula reservada para ${button.dataset.slot}.`;
    }
  });
});

chartFilterButtons.forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
  button.addEventListener("click", () => {
    const chartType = button.dataset.chartType;
    const range = button.dataset.chartRange;
    const groupButtons = document.querySelectorAll(`[data-chart-type="${chartType}"]`);

    groupButtons.forEach((groupButton) => {
      const isActive = groupButton === button;
      groupButton.classList.toggle("is-active", isActive);
      groupButton.setAttribute("aria-pressed", String(isActive));
    });

    if (chartType === "learning") {
      renderLearningChart(range);
    }

    if (chartType === "study") {
      renderStudyChart(range);
    }
  });
});

showPanel("dashboard");
renderDashboardCharts();
setView("publico");
