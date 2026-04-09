const body = document.body;
const openPlatformButtons = document.querySelectorAll("[data-open-platform]");
const closePlatformButton = document.querySelector("[data-close-platform]");
const openLivePanelButtons = document.querySelectorAll("[data-open-live-panel]");
const sidebarToggleButton = document.querySelector("[data-sidebar-toggle]");
const sidebarLinks = document.querySelectorAll("[data-panel-target]");
const panels = document.querySelectorAll("[data-panel]");
const greetingElement = document.querySelector("[data-greeting]");
const platformHeader = document.querySelector(".platform-header");
const chartDropdowns = document.querySelectorAll("[data-chart-dropdown]");
const chartTriggers = document.querySelectorAll("[data-chart-trigger]");
const chartOptions = document.querySelectorAll("[data-chart-option]");
const learningJourneySvg = document.querySelector("[data-learning-journey-svg]");
const journeyBase = document.querySelector("[data-journey-base]");
const journeyProgress = document.querySelector("[data-journey-progress]");
const journeyNodes = document.querySelector("[data-journey-nodes]");
const journeyLevels = document.querySelector("[data-learning-levels]");
const journeyStartLabel = document.querySelector("[data-journey-start-label]");
const journeyCurrentLabel = document.querySelector("[data-journey-current-label]");
const journeyStartConnector = document.querySelector("[data-journey-start-connector]");
const journeyCurrentConnector = document.querySelector("[data-journey-current-connector]");
const studyChart = document.querySelector("[data-study-chart]");
const studyScale = document.querySelector(".analytics-card-bar .bar-chart-scale");
const liveSchedulerGrid = document.querySelector("[data-live-scheduler-grid]");
const liveSchedulerTimezone = document.querySelector("[data-live-timezone]");
const liveInstruction = document.querySelector("[data-live-instruction]");
const liveWeekRange = document.querySelector("[data-live-week-range]");
const liveConfirmBar = document.querySelector("[data-live-confirm]");
const liveConfirmSummary = document.querySelector("[data-live-confirm-summary]");
const liveConfirmButton = document.querySelector("[data-live-confirm-button]");

const learningLevelNames = ["Pré A1", "A1", "A1+", "A2", "A2+", "B1", "B1+", "B2", "B2+", "C1", "C2"];
const learningJourneyPoints = [
  { x: 42, y: 194 },
  { x: 128, y: 178 },
  { x: 214, y: 188 },
  { x: 300, y: 156 },
  { x: 392, y: 166 },
  { x: 480, y: 126 },
  { x: 572, y: 136 },
  { x: 664, y: 102 },
  { x: 756, y: 114 },
  { x: 850, y: 82 },
  { x: 922, y: 62 },
];

const dashboardChartData = {
  learning: {
    all: {
      focusStart: 0,
      currentIndex: 5,
    },
    "90d": {
      focusStart: 3,
      currentIndex: 5,
    },
    "30d": {
      focusStart: 4,
      currentIndex: 5,
    },
  },
  study: {
    "7d": {
      values: [0.7, 1.1, 0.8, 1.4, 1.2, 1.8, 1.3],
    },
    "30d": {
      values: [6.4, 7.2, 8.1, 9.3],
    },
    "90d": {
      values: [21, 24, 29],
    },
    all: {
      values: [42, 58, 73, 84],
    },
  },
};

const chartState = {
  learning: "all",
  study: "7d",
};

let sidebarExpanded = false;
const scheduleState = {
  selectedSlotId: "",
  selectedSlotLabel: "",
  isConfirmed: false,
};

const liveSlotPresets = {
  1: ["09:00", "11:30", "16:30", "19:00"],
  2: ["08:00", "10:30", "15:00", "18:30"],
  3: ["09:30", "12:00", "14:30", "19:30"],
  4: ["08:30", "11:00", "16:00", "18:00"],
  5: ["09:00", "13:30", "15:30", "18:30"],
  6: ["09:00", "10:30", "11:30", "13:00"],
};

const formatHours = (value) => {
  if (value < 1) {
    return `${Math.round(value * 60)} min`;
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

const buildSmoothPath = (points) => {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const nextPoint = points[index + 1];
    const midpointX = (point.x + nextPoint.x) / 2;
    const midpointY = (point.y + nextPoint.y) / 2;
    path += ` Q ${point.x} ${point.y} ${midpointX} ${midpointY}`;
  }

  const lastPoint = points[points.length - 1];
  path += ` T ${lastPoint.x} ${lastPoint.y}`;

  return path;
};

const setActiveChartOption = (chartType, range) => {
  chartOptions.forEach((option) => {
    if (option.dataset.chartType !== chartType) return;

    const isActive = option.dataset.chartRange === range;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-pressed", String(isActive));
  });
};

const closeDropdown = (dropdown) => {
  if (!dropdown) return;

  const trigger = dropdown.querySelector("[data-chart-trigger]");
  const menu = dropdown.querySelector("[data-chart-menu]");
  dropdown.classList.remove("is-open");

  if (trigger) {
    trigger.setAttribute("aria-expanded", "false");
  }

  if (menu) {
    menu.hidden = true;
  }
};

const closeAllDropdowns = () => {
  chartDropdowns.forEach((dropdown) => {
    closeDropdown(dropdown);
  });
};

const setSidebarExpanded = (isExpanded) => {
  const desktopSidebarQuery = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1101px)");
  sidebarExpanded = isExpanded;
  const shouldShowExpandedSidebar = desktopSidebarQuery.matches ? isExpanded : true;
  body.dataset.sidebarExpanded = String(shouldShowExpandedSidebar);

  if (sidebarToggleButton) {
    sidebarToggleButton.setAttribute("aria-expanded", String(shouldShowExpandedSidebar));
    sidebarToggleButton.setAttribute(
      "aria-label",
      shouldShowExpandedSidebar ? "Fechar barra lateral" : "Abrir barra lateral"
    );
  }
};

const syncSidebarMode = () => {
  setSidebarExpanded(sidebarExpanded);
};

const updateGreeting = () => {
  if (!greetingElement) return;

  const userName = greetingElement.dataset.userName || "Camila";
  const hour = new Date().getHours();
  let greeting = "Boa noite";

  if (hour >= 5 && hour < 12) {
    greeting = "Bom dia";
  } else if (hour >= 12 && hour < 18) {
    greeting = "Boa tarde";
  }

  greetingElement.textContent = `${greeting}, ${userName}.`;
};

const renderLearningJourney = (range) => {
  if (!learningJourneySvg || !journeyBase || !journeyProgress || !journeyNodes || !journeyLevels) {
    return;
  }

  const dataset = dashboardChartData.learning[range];
  if (!dataset) return;

  const viewBoxWidth = 960;
  const fullPath = buildSmoothPath(learningJourneyPoints);
  const focusPoints = learningJourneyPoints.slice(dataset.focusStart, dataset.currentIndex + 1);

  journeyBase.setAttribute("d", fullPath);
  journeyProgress.setAttribute("d", buildSmoothPath(focusPoints));

  journeyNodes.innerHTML = learningJourneyPoints
    .map((point, index) => {
      let nodeClassName = "journey-node";

      if (index < dataset.focusStart && range !== "all") {
        nodeClassName += " is-dimmed";
      } else if (index < dataset.currentIndex) {
        nodeClassName += " is-past";
      } else if (index === dataset.currentIndex) {
        nodeClassName += " is-current";
      }

      const radius = index === dataset.currentIndex ? 12 : 10;
      return `<circle class="${nodeClassName}" cx="${point.x}" cy="${point.y}" r="${radius}"></circle>`;
    })
    .join("");

  journeyLevels.innerHTML = learningLevelNames
    .map((label, index) => {
      let className = "";

      if (index < dataset.focusStart && range !== "all") {
        className = "is-dimmed";
      } else if (index < dataset.currentIndex) {
        className = "is-past";
      } else if (index === dataset.currentIndex) {
        className = "is-current";
      }

      return `<span class="${className}">${label}</span>`;
    })
    .join("");

  const startPoint = learningJourneyPoints[0];
  const currentPoint = learningJourneyPoints[dataset.currentIndex];
  const startX = (startPoint.x / viewBoxWidth) * 100;
  const currentX = (currentPoint.x / viewBoxWidth) * 100;

  if (journeyStartLabel) {
    const startTop = Math.min(startPoint.y + 34, 212);
    const startHeight = journeyStartLabel.offsetHeight || 34;
    journeyStartLabel.style.left = `${startX}%`;
    journeyStartLabel.style.top = `${startTop}px`;
    journeyStartLabel.style.setProperty("--tag-shift", "0%");

    if (journeyStartConnector) {
      const connectorTop = startPoint.y + 12;
      journeyStartConnector.style.left = `${startX}%`;
      journeyStartConnector.style.top = `${connectorTop}px`;
      journeyStartConnector.style.height = `${Math.max(startTop - connectorTop, startHeight * 0.5)}px`;
    }
  }

  if (journeyCurrentLabel) {
    const currentTop = Math.max(currentPoint.y - 86, 18);
    const currentHeight = journeyCurrentLabel.offsetHeight || 34;
    journeyCurrentLabel.style.left = `${currentX}%`;
    journeyCurrentLabel.style.top = `${currentTop}px`;
    journeyCurrentLabel.style.setProperty("--tag-shift", "-100%");

    if (journeyCurrentConnector) {
      const connectorTop = currentTop + currentHeight;
      journeyCurrentConnector.style.left = `${currentX}%`;
      journeyCurrentConnector.style.top = `${connectorTop}px`;
      journeyCurrentConnector.style.height = `${Math.max(currentPoint.y - 12 - connectorTop, 16)}px`;
    }
  }
};

const renderStudyChart = (range) => {
  if (!studyChart || !studyScale) {
    return;
  }

  const dataset = dashboardChartData.study[range];
  if (!dataset) return;

  const maxValue = getNiceMax(Math.max(...dataset.values));
  const scaleValues = [maxValue, (maxValue * 2) / 3, maxValue / 3, 0];

  studyScale.innerHTML = scaleValues
    .map((value) => `<span>${formatHours(value)}</span>`)
    .join("");

  studyChart.innerHTML = dataset.values
    .map((value, index) => {
      const height = Math.max((value / maxValue) * 100, 10);
      const isHighlight = index === dataset.values.length - 1;

      return `
        <div class="bar-column${isHighlight ? "" : " is-muted"}">
          <span class="bar-column-value">${formatHours(value)}</span>
          <span class="bar-column-fill" style="height: ${height}%"></span>
        </div>
      `;
    })
    .join("");
};

const renderDashboardCharts = () => {
  renderLearningJourney(chartState.learning);
  renderStudyChart(chartState.study);
};

const formatTimeZoneOffset = (date) => {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `GMT${sign}${hours}:${minutes}`;
};

const getDisplayTimeZoneName = () => {
  const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  const knownTimeZones = {
    "America/Sao_Paulo": "America/São Paulo",
  };

  if (knownTimeZones[resolvedTimeZone]) {
    return knownTimeZones[resolvedTimeZone];
  }

  const [region, city] = resolvedTimeZone.split("/");
  if (!city) {
    return resolvedTimeZone.replace(/_/g, " ");
  }

  return `${region}/${city.replace(/_/g, " ")}`;
};

const createSlotId = (date, time) => {
  const dateKey = date.toISOString().slice(0, 10);
  return `${dateKey}-${time}`;
};

const formatWeekRange = (days) => {
  if (!days.length) return "";

  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const sameMonth = firstDay.getMonth() === lastDay.getMonth();
  const sameYear = firstDay.getFullYear() === lastDay.getFullYear();
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" });

  if (sameMonth && sameYear) {
    return `${firstDay.getDate()} – ${lastDay.getDate()} de ${monthFormatter.format(firstDay)} de ${firstDay.getFullYear()}`;
  }

  if (sameYear) {
    return `${firstDay.getDate()} de ${monthFormatter.format(firstDay)} – ${lastDay.getDate()} de ${monthFormatter.format(lastDay)} de ${firstDay.getFullYear()}`;
  }

  return `${firstDay.getDate()} de ${monthFormatter.format(firstDay)} de ${firstDay.getFullYear()} – ${lastDay.getDate()} de ${monthFormatter.format(lastDay)} de ${lastDay.getFullYear()}`;
};

const formatSelectedSlotLabel = (date, time) => {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalizedWeekday}, ${date.getDate()} de ${month} · ${time}`;
};

const getSlotDateTime = (date, time) => {
  const [hours, minutes] = time.split(":").map(Number);
  const slotDate = new Date(date);
  slotDate.setHours(hours, minutes, 0, 0);
  return slotDate;
};

const getAvailableSlots = (date, referenceDate = new Date()) => {
  const times = liveSlotPresets[date.getDay()] || ["09:00", "11:00", "15:00"];

  return times.filter((time) => {
    const slotDate = getSlotDateTime(date, time);
    return slotDate.getTime() > referenceDate.getTime();
  });
};

const getUpcomingBookableDays = (count) => {
  const days = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let safety = 0;

  while (days.length < count && safety < 21) {
    if (cursor.getDay() !== 0) {
      days.push(new Date(cursor));
    }

    cursor.setDate(cursor.getDate() + 1);
    safety += 1;
  }

  return days;
};

const updateLiveConfirmBar = () => {
  if (!liveConfirmBar || !liveConfirmSummary || !liveConfirmButton) return;

  const hasSelection = Boolean(scheduleState.selectedSlotLabel);
  liveConfirmBar.hidden = !hasSelection;

  if (!hasSelection) {
    liveConfirmSummary.textContent = "";
    liveConfirmButton.textContent = "Confirmar agendamento";
    return;
  }

  liveConfirmSummary.textContent = scheduleState.selectedSlotLabel;
  liveConfirmButton.textContent = scheduleState.isConfirmed ? "Agendado" : "Confirmar agendamento";
};

const updateLiveInstruction = () => {
  if (!liveInstruction) return;

  if (scheduleState.isConfirmed && scheduleState.selectedSlotLabel) {
    liveInstruction.textContent = `Agendamento confirmado para ${scheduleState.selectedSlotLabel}`;
    return;
  }

  if (scheduleState.selectedSlotLabel) {
    liveInstruction.textContent = "Horário selecionado. Confirme abaixo para finalizar.";
    return;
  }

  liveInstruction.textContent = "Selecione um dia e horário para continuar";
};

const renderLiveScheduler = () => {
  if (!liveSchedulerGrid) return;

  const days = getUpcomingBookableDays(4);
  const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const now = new Date();
  const timezoneName = getDisplayTimeZoneName();
  const visibleSlotIds = new Set();

  if (liveSchedulerTimezone) {
    liveSchedulerTimezone.textContent = `${timezoneName} · ${formatTimeZoneOffset(now)}`;
  }

  if (liveWeekRange) {
    liveWeekRange.textContent = formatWeekRange(days);
  }

  const schedulerMarkup = days
    .map((date) => {
      const weekday = weekdayFormatter.format(date).replace(".", "").toUpperCase();
      const times = getAvailableSlots(date, now);
      const dateNumber = String(date.getDate());
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      return `
        <div class="live-day-column${isToday ? " is-today" : ""}">
          <div class="live-day-head">
            <span class="live-day-weekday">${weekday}</span>
            <span class="live-day-date">${dateNumber}</span>
          </div>
          <div class="live-day-slots">
            ${
              times.length
                ? times
                    .map((time) => {
                      const slotId = createSlotId(date, time);
                      const slotLabel = formatSelectedSlotLabel(date, time);
                      const isSelected = scheduleState.selectedSlotId === slotId;
                      visibleSlotIds.add(slotId);

                      return `
                        <button
                          class="scheduler-slot${isSelected ? " is-selected" : ""}"
                          type="button"
                          data-slot="${slotLabel}"
                          data-slot-id="${slotId}"
                          data-slot-label="${slotLabel}"
                          aria-pressed="${isSelected ? "true" : "false"}"
                        >
                          <span>${time}</span>
                          ${
                            isSelected
                              ? '<span class="scheduler-slot-check" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="m3.5 8.5 2.5 2.5 6-6"></path></svg></span>'
                              : ""
                          }
                        </button>
                      `;
                    })
                    .join("")
                : '<div class="live-day-empty" role="note">Horários esgotados</div>'
            }
          </div>
        </div>
      `;
    })
    .join("");

  if (scheduleState.selectedSlotId && !visibleSlotIds.has(scheduleState.selectedSlotId)) {
    scheduleState.selectedSlotId = "";
    scheduleState.selectedSlotLabel = "";
    scheduleState.isConfirmed = false;
  }

  liveSchedulerGrid.innerHTML = schedulerMarkup;

  updateLiveConfirmBar();
  updateLiveInstruction();
};

const setView = (view, smooth = true) => {
  body.dataset.view = view;
  window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
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

  const activePanel = document.querySelector(`[data-panel="${panelName}"]`);
  const shouldHidePlatformHeader = activePanel?.dataset.hidePlatformHeader === "true";
  body.dataset.activePanel = panelName;

  if (platformHeader) {
    platformHeader.hidden = shouldHidePlatformHeader;
  }

  if (panelName === "ao-vivo") {
    renderLiveScheduler();
  }
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

if (sidebarToggleButton) {
  sidebarToggleButton.addEventListener("click", () => {
    setSidebarExpanded(!sidebarExpanded);
  });
}

openLivePanelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showPanel("ao-vivo");
  });
});

sidebarLinks.forEach((link) => {
  link.addEventListener("click", () => {
    showPanel(link.dataset.panelTarget);
  });
});

chartTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();

    const dropdown = trigger.closest("[data-chart-dropdown]");
    if (!dropdown) return;

    const menu = dropdown.querySelector("[data-chart-menu]");
    const isOpen = dropdown.classList.contains("is-open");
    closeAllDropdowns();

    if (!menu || isOpen) return;

    dropdown.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
  });
});

chartOptions.forEach((option) => {
  option.setAttribute("aria-pressed", String(option.classList.contains("is-active")));
  option.addEventListener("click", () => {
    const chartType = option.dataset.chartType;
    const range = option.dataset.chartRange;

    if (!chartType || !range) return;

    chartState[chartType] = range;
    setActiveChartOption(chartType, range);

    if (chartType === "learning") {
      renderLearningJourney(range);
    }

    if (chartType === "study") {
      renderStudyChart(range);
    }

    closeAllDropdowns();
  });
});

document.addEventListener("click", (event) => {
  const target = event.target;

  if (target instanceof Element) {
    const slotButton = target.closest("[data-slot]");

    if (slotButton instanceof HTMLButtonElement) {
      if (slotButton.disabled) {
        return;
      }

      scheduleState.selectedSlotId = slotButton.dataset.slotId || "";
      scheduleState.selectedSlotLabel = slotButton.dataset.slotLabel || slotButton.dataset.slot || "";
      scheduleState.isConfirmed = false;
      renderLiveScheduler();
      return;
    }

    const confirmButton = target.closest("[data-live-confirm-button]");

    if (confirmButton instanceof HTMLButtonElement && scheduleState.selectedSlotLabel) {
      scheduleState.isConfirmed = true;
      updateLiveConfirmBar();
      updateLiveInstruction();
      return;
    }
  }

  if (!(target instanceof Element) || !target.closest("[data-chart-dropdown]")) {
    closeAllDropdowns();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllDropdowns();
  }
});

window.addEventListener("resize", syncSidebarMode);

updateGreeting();
setInterval(updateGreeting, 60000);
setActiveChartOption("learning", chartState.learning);
setActiveChartOption("study", chartState.study);
setSidebarExpanded(false);
showPanel("dashboard");
renderDashboardCharts();
renderLiveScheduler();
setView("publico", false);
