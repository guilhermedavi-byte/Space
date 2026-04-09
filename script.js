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
const planBadge = document.querySelector("[data-plan-badge]");
const planBadgeText = document.querySelector("[data-plan-badge-text]");
const planCredits = document.querySelector("[data-plan-credits]");
const planRenewal = document.querySelector("[data-plan-renewal]");
const liveSchedulerGrid = document.querySelector("[data-live-scheduler-grid]");
const liveSchedulerTimezone = document.querySelector("[data-live-timezone]");
const liveInstruction = document.querySelector("[data-live-instruction]");
const liveWeekRange = document.querySelector("[data-live-week-range]");
const liveScheduledList = document.querySelector("[data-live-scheduled-list]");
const liveScheduledEmpty = document.querySelector("[data-live-scheduled-empty]");
const liveCreditsDots = document.querySelector("[data-live-credits-dots]");
const liveCreditsCaption = document.querySelector("[data-live-credits-caption]");
const modalOverlay = document.querySelector("[data-modal-overlay]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalBody = document.querySelector("[data-modal-body]");
const modalPrimary = document.querySelector("[data-modal-primary]");
const modalSecondary = document.querySelector("[data-modal-secondary]");
const modalClose = document.querySelector("[data-modal-close]");

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

const STORAGE_KEY = "space-platform-state-v1";
const CREDIT_CYCLE_BUSINESS_DAYS = 6;
const LESSON_DURATION_MINUTES = 30;
const CREDIT_REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

const PLAN_DEFS = {
  gold: { label: "Gold", creditsPerCycle: 3, creditType: "VIP", badgeClass: "is-gold", badgeDot: "ambar" },
  diamond: { label: "Diamond", creditsPerCycle: 5, creditType: "VIP", badgeClass: "is-diamond", badgeDot: "azul" },
  turma: { label: "Turma", creditsPerCycle: 4, creditType: "GROUP", badgeClass: "is-turma", badgeDot: "verde" },
};

const scheduledLessons = [];
const scheduledSlotIds = new Set();

const createDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey) => {
  if (!dateKey || dateKey.length !== 10) return null;
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const startOfDay = (date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const addBusinessDaysSkippingSunday = (date, businessDays) => {
  let cursor = startOfDay(date);
  let added = 0;

  while (added < businessDays) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 0) continue;
    added += 1;
  }

  return cursor;
};

const safeStorage = (() => {
  try {
    const testKey = "__space_platform_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (error) {
    return null;
  }
})();

const getPlanDef = (planKey) => PLAN_DEFS[planKey] || PLAN_DEFS.gold;

const clampCredits = (value, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(Math.floor(parsed), max));
};

const sanitizeLesson = (lesson) => {
  if (!lesson || typeof lesson !== "object") return null;
  if (!lesson.id || typeof lesson.id !== "string") return null;
  if (!lesson.dateKey || typeof lesson.dateKey !== "string") return null;
  if (!lesson.time || typeof lesson.time !== "string") return null;
  return {
    id: lesson.id,
    dateKey: lesson.dateKey,
    time: lesson.time,
    kind: lesson.kind === "GROUP" ? "GROUP" : "VIP",
    title: typeof lesson.title === "string" ? lesson.title : "Aula ao vivo",
    teacher: typeof lesson.teacher === "string" ? lesson.teacher : "Professor(a) Space",
    durationMinutes: typeof lesson.durationMinutes === "number" ? lesson.durationMinutes : LESSON_DURATION_MINUTES,
    createdAt: typeof lesson.createdAt === "string" ? lesson.createdAt : new Date().toISOString(),
  };
};

const appState = (() => {
  const todayKey = createDateKey(new Date());
  const defaultPlanKey = "gold";
  const defaultPlan = getPlanDef(defaultPlanKey);
  const baseState = {
    planKey: defaultPlanKey,
    activatedAtKey: todayKey,
    cycleStartedAtKey: todayKey,
    creditsRemaining: defaultPlan.creditsPerCycle,
  };

  if (!safeStorage) return { ...baseState };

  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...baseState };
    const parsed = JSON.parse(raw);
    const planKey = typeof parsed.planKey === "string" ? parsed.planKey : defaultPlanKey;
    const plan = getPlanDef(planKey);
    const activatedAtKey = typeof parsed.activatedAtKey === "string" ? parsed.activatedAtKey : todayKey;
    const cycleStartedAtKey = typeof parsed.cycleStartedAtKey === "string" ? parsed.cycleStartedAtKey : activatedAtKey;
    const creditsRemaining = clampCredits(parsed.creditsRemaining, plan.creditsPerCycle);

    if (Array.isArray(parsed.scheduledLessons)) {
      parsed.scheduledLessons
        .map((lesson) => sanitizeLesson(lesson))
        .filter(Boolean)
        .forEach((lesson) => {
          scheduledLessons.push(lesson);
          scheduledSlotIds.add(lesson.id);
        });
    }

    return {
      planKey,
      activatedAtKey,
      cycleStartedAtKey,
      creditsRemaining,
    };
  } catch (error) {
    return { ...baseState };
  }
})();

const persistAppState = () => {
  if (!safeStorage) return;
  const payload = {
    ...appState,
    scheduledLessons,
  };

  try {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // ignore write failures (private mode, quota, etc.)
  }
};

const syncCreditCycle = (referenceDate = new Date()) => {
  const plan = getPlanDef(appState.planKey);
  const cycleStart = parseDateKey(appState.cycleStartedAtKey) || parseDateKey(appState.activatedAtKey) || startOfDay(referenceDate);
  let nextRenewal = addBusinessDaysSkippingSunday(cycleStart, CREDIT_CYCLE_BUSINESS_DAYS);
  let didRenew = false;

  while (referenceDate.getTime() >= nextRenewal.getTime()) {
    didRenew = true;
    appState.cycleStartedAtKey = createDateKey(nextRenewal);
    appState.creditsRemaining = plan.creditsPerCycle;
    nextRenewal = addBusinessDaysSkippingSunday(nextRenewal, CREDIT_CYCLE_BUSINESS_DAYS);
  }

  if (didRenew) {
    persistAppState();
  }

  return nextRenewal;
};

const formatCreditsText = (value) => {
  const amount = Number(value) || 0;
  return `${amount} ${amount === 1 ? "crédito disponível" : "créditos disponíveis"}`;
};

const formatRenewalDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
};

const renderPlanUI = () => {
  const plan = getPlanDef(appState.planKey);
  const nextRenewal = syncCreditCycle(new Date());

  if (planBadge) {
    planBadge.classList.remove("is-gold", "is-diamond", "is-turma");
    if (plan.badgeClass) {
      planBadge.classList.add(plan.badgeClass);
    }
  }

  if (planBadgeText) {
    planBadgeText.textContent = `Plano ${plan.label} ativo`;
  }

  if (planCredits) {
    planCredits.textContent = formatCreditsText(appState.creditsRemaining);
  }

  if (planRenewal) {
    planRenewal.textContent = `Renovam automaticamente em ${formatRenewalDate(nextRenewal)}`;
  }

  if (liveCreditsDots) {
    const total = plan.creditsPerCycle;
    const filled = clampCredits(appState.creditsRemaining, total);

    liveCreditsDots.innerHTML = Array.from({ length: total })
      .map((_, index) => `<span class="live-credit-dot${index < filled ? " is-filled" : ""}" aria-hidden="true"></span>`)
      .join("");
    liveCreditsDots.setAttribute("aria-label", formatCreditsText(appState.creditsRemaining));
  }

  if (liveCreditsCaption) {
    liveCreditsCaption.textContent = formatCreditsText(appState.creditsRemaining);
  }
};

let modalPrimaryHandler = null;
let modalSecondaryHandler = null;

const closeModal = () => {
  if (!modalOverlay) return;
  modalOverlay.hidden = true;
  body.classList.remove("is-modal-open");
  modalPrimaryHandler = null;
  modalSecondaryHandler = null;
};

const openModal = ({
  title,
  bodyHtml,
  primaryLabel = "Confirmar",
  secondaryLabel = "Voltar",
  hideSecondary = false,
  onPrimary,
  onSecondary,
} = {}) => {
  if (!modalOverlay || !modalTitle || !modalBody || !modalPrimary || !modalSecondary) return;

  modalTitle.textContent = title || "";
  modalBody.innerHTML = bodyHtml || "";
  modalPrimary.textContent = primaryLabel;
  modalSecondary.textContent = secondaryLabel;
  modalSecondary.hidden = hideSecondary;
  modalOverlay.hidden = false;
  body.classList.add("is-modal-open");

  modalPrimaryHandler = typeof onPrimary === "function" ? onPrimary : null;
  modalSecondaryHandler = typeof onSecondary === "function" ? onSecondary : null;

  window.setTimeout(() => {
    modalPrimary.focus();
  }, 0);
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
  return `${createDateKey(date)}-${time}`;
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

const formatScheduledWhen = (date, time) => {
  const weekdayRaw = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
  const monthRaw = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  return `${weekday}, ${date.getDate()} ${monthRaw} · ${time}`;
};

const parseSlotId = (slotId) => {
  if (!slotId || slotId.length < 12) return null;

  const dateKey = slotId.slice(0, 10);
  const time = slotId.slice(11);

  const date = parseDateKey(dateKey);
  if (!date || !time) return null;

  return { dateKey, date, time };
};

const registerScheduledLesson = (lesson) => {
  if (!lesson?.id) return;
  if (scheduledSlotIds.has(lesson.id)) return;

  scheduledLessons.push(lesson);
  scheduledSlotIds.add(lesson.id);
  persistAppState();
};

const removeScheduledLesson = (lessonId) => {
  if (!lessonId) return null;
  const index = scheduledLessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return null;
  const [removed] = scheduledLessons.splice(index, 1);
  scheduledSlotIds.delete(lessonId);
  persistAppState();
  return removed;
};

const renderLiveScheduledLessons = () => {
  if (!liveScheduledList) return;

  const now = new Date();
  const upcoming = scheduledLessons
    .map((lesson) => ({
      ...lesson,
      dateTime: getSlotDateTime(parseDateKey(lesson.dateKey) || new Date(), lesson.time),
    }))
    .filter((lesson) => lesson.dateTime.getTime() > now.getTime())
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
    .slice(0, 8);

  if (liveScheduledEmpty) {
    liveScheduledEmpty.hidden = upcoming.length > 0;
  }

  liveScheduledList.innerHTML = upcoming
    .map((lesson, index) => {
      const date = parseDateKey(lesson.dateKey) || new Date();
      const when = formatScheduledWhen(date, lesson.time);
      const kindLabel = lesson.kind === "GROUP" ? "Grupo" : "VIP";
      const metaBits = [`${kindLabel}`, `${lesson.durationMinutes || LESSON_DURATION_MINUTES} min`];
      const teacher = lesson.teacher ? ` · ${lesson.teacher}` : "";

      return `
        <li class="live-scheduled-item${index === 0 ? " is-next" : ""}">
          <div class="live-scheduled-content">
            <div class="live-scheduled-when">${when}</div>
            <div class="live-scheduled-meta">${metaBits.join(" · ")}${teacher}</div>
          </div>
          <button class="live-scheduled-cancel" type="button" data-live-cancel data-lesson-id="${lesson.id}">
            Cancelar
          </button>
        </li>
      `;
    })
    .join("");
};

const getAvailableSlots = (date, referenceDate = new Date()) => {
  const times = liveSlotPresets[date.getDay()] || ["09:00", "11:00", "15:00"];

  return times.filter((time) => {
    const slotDate = getSlotDateTime(date, time);
    const slotId = createSlotId(date, time);
    return slotDate.getTime() > referenceDate.getTime() && !scheduledSlotIds.has(slotId);
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

const updateLiveInstruction = () => {
  if (!liveInstruction) return;

  if (!scheduleState.isConfirmed && appState.creditsRemaining <= 0) {
    liveInstruction.textContent = scheduleState.selectedSlotLabel
      ? "Sem créditos disponíveis para confirmar este horário."
      : "Sem créditos disponíveis para agendar agora.";
    return;
  }

  if (scheduleState.isConfirmed && scheduleState.selectedSlotLabel) {
    liveInstruction.textContent = `Agendamento confirmado para ${scheduleState.selectedSlotLabel}`;
    return;
  }

  if (scheduleState.selectedSlotLabel) {
    liveInstruction.textContent = "Horário selecionado. Clique em Avançar para continuar.";
    return;
  }

  liveInstruction.textContent = "Selecione um dia e horário para continuar";
};

const syncLiveSchedulerSelection = () => {
  if (!liveSchedulerGrid) return;

  liveSchedulerGrid.querySelectorAll("[data-slot-row-id]").forEach((row) => {
    const slotId = row.getAttribute("data-slot-row-id") || "";
    const isSelected = Boolean(slotId) && slotId === scheduleState.selectedSlotId;
    const isConfirmed = isSelected && scheduleState.isConfirmed;

    row.classList.toggle("is-selected", isSelected);
    row.classList.toggle("is-confirmed", isConfirmed);

    const timeButton = row.querySelector("[data-slot]");
    if (timeButton instanceof HTMLButtonElement) {
      timeButton.setAttribute("aria-pressed", String(isSelected));
    }

    const advanceButton = row.querySelector("[data-slot-advance]");
    if (advanceButton instanceof HTMLButtonElement) {
      const label = advanceButton.querySelector(".scheduler-slot-advance-label");
      if (label) {
        label.textContent = isConfirmed ? "Agendado" : "Avançar";
      }

      advanceButton.disabled = isConfirmed || appState.creditsRemaining <= 0;
    }
  });
};

const renderLiveScheduler = () => {
  if (!liveSchedulerGrid) return;

  renderPlanUI();
  renderLiveScheduledLessons();

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
                      visibleSlotIds.add(slotId);

                      return `
                        <div class="scheduler-slot-row" data-slot-row-id="${slotId}">
                          <button
                            class="scheduler-slot-time"
                            type="button"
                            data-slot="${slotLabel}"
                            data-slot-id="${slotId}"
                            data-slot-label="${slotLabel}"
                            aria-pressed="false"
                          >
                            <span>${time}</span>
                          </button>
                          <button
                            class="scheduler-slot-advance"
                            type="button"
                            data-slot-advance
                            data-slot-id="${slotId}"
                            data-slot-label="${slotLabel}"
                            aria-label="Avançar"
                          >
                            <span class="scheduler-slot-advance-label">Avançar</span>
                          </button>
                        </div>
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

  if (scheduleState.selectedSlotId && !visibleSlotIds.has(scheduleState.selectedSlotId) && !scheduleState.isConfirmed) {
    scheduleState.selectedSlotId = "";
    scheduleState.selectedSlotLabel = "";
    scheduleState.isConfirmed = false;
  }

  liveSchedulerGrid.innerHTML = schedulerMarkup;

  updateLiveInstruction();
  syncLiveSchedulerSelection();
};

if (modalOverlay) {
  modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });
}

if (modalClose) {
  modalClose.addEventListener("click", () => {
    closeModal();
  });
}

if (modalSecondary) {
  modalSecondary.addEventListener("click", () => {
    if (modalSecondaryHandler) {
      modalSecondaryHandler();
    }
    closeModal();
  });
}

if (modalPrimary) {
  modalPrimary.addEventListener("click", () => {
    if (modalPrimaryHandler) {
      const shouldClose = modalPrimaryHandler();
      if (shouldClose === false) return;
    }
    closeModal();
  });
}

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const cancelButton = target.closest("[data-live-cancel]");
    if (cancelButton instanceof HTMLButtonElement) {
      const lessonId = cancelButton.dataset.lessonId || "";
      const lesson = scheduledLessons.find((item) => item.id === lessonId);
      const parsed = lesson ? parseSlotId(lesson.id) : null;

      if (lesson && parsed) {
        const slotLabel = formatSelectedSlotLabel(parsed.date, parsed.time);
        const slotDateTime = getSlotDateTime(parsed.date, parsed.time);
        const now = new Date();
        const isRefundable = slotDateTime.getTime() - now.getTime() >= CREDIT_REFUND_WINDOW_MS;
        const plan = getPlanDef(appState.planKey);

        openModal({
          title: "Cancelar aula",
          bodyHtml: `
            <strong>${slotLabel}</strong><br />
            ${isRefundable ? "Cancelamento com 24h ou mais: 1 crédito será devolvido." : "Faltam menos de 24h: o crédito será perdido."}
          `,
          primaryLabel: "Confirmar cancelamento",
          secondaryLabel: "Voltar",
          onPrimary: () => {
            removeScheduledLesson(lessonId);

            if (isRefundable) {
              appState.creditsRemaining = clampCredits(appState.creditsRemaining + 1, plan.creditsPerCycle);
              persistAppState();
            }

            scheduleState.selectedSlotId = "";
            scheduleState.selectedSlotLabel = "";
            scheduleState.isConfirmed = false;
            renderLiveScheduler();
          },
        });
      }

      return;
    }

    const advanceButton = target.closest("[data-slot-advance]");

    if (advanceButton instanceof HTMLButtonElement) {
      const slotId = advanceButton.dataset.slotId || scheduleState.selectedSlotId;
      const slotLabel = advanceButton.dataset.slotLabel || scheduleState.selectedSlotLabel;
      const parsed = parseSlotId(slotId);

      if (!parsed) return;

      const plan = getPlanDef(appState.planKey);
      const kind = plan.creditType === "GROUP" ? "GROUP" : "VIP";

      if (appState.creditsRemaining <= 0) {
        openModal({
          title: "Sem créditos disponíveis",
          bodyHtml: "Você não tem créditos suficientes para agendar uma aula agora.",
          primaryLabel: "Entendi",
          hideSecondary: true,
        });
        return;
      }

      openModal({
        title: "Confirmar agendamento",
        bodyHtml: `
          <strong>${slotLabel}</strong><br />
          ${kind === "GROUP" ? "Aula em grupo" : "Aula VIP"} · ${LESSON_DURATION_MINUTES} min<br />
          Isso consome 1 crédito.
        `,
        primaryLabel: "Confirmar agendamento",
        secondaryLabel: "Voltar",
        onPrimary: () => {
          if (appState.creditsRemaining <= 0) {
            return false;
          }

          appState.creditsRemaining = clampCredits(appState.creditsRemaining - 1, plan.creditsPerCycle);

          registerScheduledLesson({
            id: slotId,
            dateKey: parsed.dateKey,
            time: parsed.time,
            kind,
            title: "Aula ao vivo",
            teacher: "Professor(a) Space",
            durationMinutes: LESSON_DURATION_MINUTES,
            createdAt: new Date().toISOString(),
          });

          persistAppState();
          scheduleState.selectedSlotId = slotId;
          scheduleState.selectedSlotLabel = slotLabel;
          scheduleState.isConfirmed = true;
          renderLiveScheduler();
        },
      });
      return;
    }

    const slotButton = target.closest("[data-slot]");

    if (slotButton instanceof HTMLButtonElement) {
      if (slotButton.disabled) {
        return;
      }

      scheduleState.selectedSlotId = slotButton.dataset.slotId || "";
      scheduleState.selectedSlotLabel = slotButton.dataset.slotLabel || slotButton.dataset.slot || "";
      scheduleState.isConfirmed = false;
      syncLiveSchedulerSelection();
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
    if (modalOverlay && !modalOverlay.hidden) {
      closeModal();
      return;
    }

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
renderPlanUI();
setView("publico", false);

setInterval(() => {
  if (body.dataset.activePanel === "ao-vivo") {
    renderLiveScheduler();
    return;
  }

  renderPlanUI();
}, 60000);
