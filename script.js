const body = document.body;
const openPlatformButtons = document.querySelectorAll("[data-open-platform]");
const closePlatformButton = document.querySelector("[data-close-platform]");
const authEnterShell = document.querySelector('[data-auth-page="entrar"]');
const authLoginShell = document.querySelector('[data-auth-page="login"]');
const authRoleCards = document.querySelectorAll("[data-enter-role]");
const authBackLink = document.querySelector("[data-nav-enter]");
const authLoginForm = document.querySelector("[data-login-form]");
const authLoginEmail = document.querySelector("[data-login-email]");
const authLoginPassword = document.querySelector("[data-login-password]");
const authLoginEmailError = document.querySelector("[data-login-email-error]");
const authLoginPasswordError = document.querySelector("[data-login-password-error]");
const authLoginError = document.querySelector("[data-login-error]");
const authLoginBadge = document.querySelector("[data-login-badge]");
const authLoginPhrase = document.querySelector("[data-login-phrase]");
const authLoginSpinner = document.querySelector("[data-login-spinner]");
const authLoginSubmitLabel = document.querySelector("[data-login-submit-label]");
const authLoginSubmit = document.querySelector("[data-login-submit]");
const authLoginEye = document.querySelector("[data-login-eye]");
const authLoginSub = document.querySelector("[data-login-sub]");
const openLivePanelButtons = document.querySelectorAll("[data-open-live-panel]");
const sidebarToggleButton = document.querySelector("[data-sidebar-toggle]");
const sidebarLinks = document.querySelectorAll("[data-panel-target]");
const panels = document.querySelectorAll("[data-panel]");
const greetingElement = document.querySelector("[data-greeting]");
const roleEyebrow = document.querySelector("[data-role-eyebrow]");
const roleSidebarSubtitle = document.querySelector("[data-role-sidebar-subtitle]");
const roleTopbars = document.querySelectorAll("[data-role-topbar]");
const dashboardStudent = document.querySelector("[data-dashboard-student]");
const dashboardTeacher = document.querySelector("[data-dashboard-teacher]");
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
const planWidgets = document.querySelectorAll("[data-plan-topbar]");
const liveSchedulerGrid = document.querySelector("[data-live-scheduler-grid]");
const liveSchedulerTimezone = document.querySelector("[data-live-timezone]");
const liveInstruction = document.querySelector("[data-live-instruction]");
const liveWeekRange = document.querySelector("[data-live-week-range]");
const liveScheduledList = document.querySelector("[data-live-scheduled-list]");
const liveScheduledEmpty = document.querySelector("[data-live-scheduled-empty]");
const liveCreditsDots = document.querySelector("[data-live-credits-dots]");
const liveCreditsCaption = document.querySelector("[data-live-credits-caption]");
const liveStudentRoot = document.querySelector("[data-live-student]");
const liveTeacherRoot = document.querySelector("[data-live-teacher]");
const modalOverlay = document.querySelector("[data-modal-overlay]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalBody = document.querySelector("[data-modal-body]");
const modalPrimary = document.querySelector("[data-modal-primary]");
const modalSecondary = document.querySelector("[data-modal-secondary]");
const modalClose = document.querySelector("[data-modal-close]");
const modalTrash = document.querySelector("[data-modal-trash]");

const teacherMiniTitle = document.querySelector("[data-teacher-mini-title]");
const teacherMiniGrid = document.querySelector("[data-teacher-mini-grid]");
const teacherCalViewport = document.querySelector("[data-teacher-cal-viewport]");
const teacherCalDate = document.querySelector("[data-teacher-cal-date]");
const teacherCalTimeZone = document.querySelector("[data-teacher-cal-tz]");

const teacherLessonsTodayValue = document.querySelector("[data-teacher-lessons-today]");
const teacherLessonsTodaySub = document.querySelector("[data-teacher-lessons-today-sub]");
const teacherNextClassValue = document.querySelector("[data-teacher-next-class]");
const teacherNextCountdown = document.querySelector("[data-teacher-next-countdown]");
const teacherNpsValue = document.querySelector("[data-teacher-nps]");
const teacherNpsSub = document.querySelector("[data-teacher-nps-sub]");
const teacherOccupancyPercent = document.querySelector("[data-teacher-occupancy-percent]");
const teacherOccupancySub = document.querySelector("[data-teacher-occupancy-sub]");
const teacherOccupancyRing = document.querySelector("[data-teacher-occupancy-ring]");
const teacherOccupancyRingText = document.querySelector("[data-teacher-occupancy-ring-text]");
const teacherClassesScale = document.querySelector("[data-teacher-classes-scale]");
const teacherClassesChart = document.querySelector("[data-teacher-classes-chart]");
const teacherClassesLabels = document.querySelector("[data-teacher-classes-labels]");
const teacherActiveList = document.querySelector("[data-teacher-active-list]");
const teacherActiveEmpty = document.querySelector("[data-teacher-active-empty]");
const teacherMissingList = document.querySelector("[data-teacher-missing-list]");
const teacherMissingEmpty = document.querySelector("[data-teacher-missing-empty]");
const teacherCancelList = document.querySelector("[data-teacher-cancel-list]");
const teacherCancelEmpty = document.querySelector("[data-teacher-cancel-empty]");
const teacherTodaySlots = document.querySelector("[data-teacher-today-slots]");
const teacherTodaySlotsEmpty = document.querySelector("[data-teacher-today-slots-empty]");
const teacherNoticeList = document.querySelector("[data-teacher-notice-list]");
const teacherNoticeEmpty = document.querySelector("[data-teacher-notice-empty]");

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
  "teacher-classes": "week",
};

let sidebarExpanded = false;
const scheduleState = {
  selectedSlotId: "",
  selectedSlotLabel: "",
  isConfirmed: false,
};

const STORAGE_KEY = "space-platform-state-v1";
const CANCELLATION_STORAGE_KEY = "space-platform-cancellations-v1";
const TEACHER_NOTICES_STORAGE_KEY = "space-platform-teacher-notices-v1";
const TEACHER_NOTICE_READ_KEY = "space-platform-teacher-notices-read-v1";
const TEACHER_CAL_EVENTS_STORAGE_KEY = "space-platform-teacher-calendar-events-v1";
const TEACHER_WORK_HOURS_STORAGE_KEY = "space-platform-teacher-work-hours-v1";
const STAFF_USERS_STORAGE_KEY = "space-platform-staff-users-v1";
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
const cancellationEvents = [];

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

const ROLE_DEFS = {
  student: {
    label: "Student",
    eyebrow: "Área do aluno",
    sidebarSubtitle: "Student Platform",
    topbarText: "",
    defaultName: "Camila",
  },
  teacher: {
    label: "Teacher",
    eyebrow: "Área do professor",
    sidebarSubtitle: "Teacher Portal",
    topbarText: "Área do Professor",
    defaultName: "Amanda",
  },
  admin: {
    label: "Admin",
    eyebrow: "Administração",
    sidebarSubtitle: "Admin Console",
    topbarText: "Administração",
    defaultName: "Space",
  },
};

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "student";
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "admin" || raw === "administrador") return "admin";
  return "student";
};

const AUTH_PROFILE_DEFS = {
  student: {
    label: "Aluno",
    phrase: "Seu próximo nível começa aqui.",
    sub: "Entre com suas credenciais para continuar.",
    loginPath: "/login/aluno",
  },
  teacher: {
    label: "Professor",
    phrase: "Sua turma está esperando.",
    sub: "Entre com suas credenciais para continuar.",
    loginPath: "/login/professor",
  },
  admin: {
    label: "Administrador",
    phrase: "Tudo sob controle, de um só lugar.",
    sub: "Entre com suas credenciais para continuar.",
    loginPath: "/login/admin",
  },
};

const isValidEmail = (raw) => {
  const email = String(raw || "").trim();
  // Good-enough validation for this prototype.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const sanitizeSessionUser = (value) => {
  if (!value || typeof value !== "object") return null;
  const role = normalizeRole(value.role);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : "";
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!role || !name || !email) return null;
  return { id, role, name, email };
};

const embeddedSession = sanitizeSessionUser(window.__SPACE_SESSION__);
let sessionUser = embeddedSession;
let sessionChecked = Boolean(embeddedSession);
let sessionRefreshPromise = null;

let currentRole = embeddedSession?.role || "student";

const syncRoleUI = () => {
  const def = ROLE_DEFS[currentRole] || ROLE_DEFS.student;
  const isStudent = currentRole === "student";

  if (roleEyebrow) {
    roleEyebrow.textContent = def.eyebrow;
  }

  if (roleSidebarSubtitle) {
    roleSidebarSubtitle.textContent = def.sidebarSubtitle;
  }

  if (greetingElement) {
    const sessionName = sessionUser && sessionUser.role === currentRole ? sessionUser.name : "";
    greetingElement.dataset.userName = sessionName || def.defaultName;
  }

  planWidgets.forEach((widget) => {
    widget.hidden = !isStudent;
  });

  roleTopbars.forEach((topbar) => {
    topbar.hidden = isStudent;
    const text = topbar.querySelector("[data-role-topbar-text]");
    if (text instanceof HTMLElement) {
      text.textContent = def.topbarText || "";
    }
  });

  if (dashboardTeacher) {
    dashboardTeacher.hidden = currentRole !== "teacher";
  }

  if (dashboardStudent) {
    dashboardStudent.hidden = currentRole === "teacher";
  }

  if (liveTeacherRoot) {
    liveTeacherRoot.hidden = currentRole !== "teacher";
  }

  if (liveStudentRoot) {
    liveStudentRoot.hidden = currentRole === "teacher";
  }
};

const setRole = (role) => {
  currentRole = normalizeRole(role);
  body.dataset.role = currentRole;
  syncRoleUI();
  updateGreeting();

  if (body.dataset.activePanel === "dashboard") {
    if (currentRole === "teacher") {
      renderTeacherDashboard();
    } else {
      renderPlanUI();
    }
  }

  if (body.dataset.activePanel === "ao-vivo") {
    if (currentRole === "teacher") {
      renderTeacherCalendar();
    } else {
      renderLiveScheduler();
    }
  }
};

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
    studentName: typeof lesson.studentName === "string" ? lesson.studentName : "",
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

const sanitizeCancellationEvent = (event) => {
  if (!event || typeof event !== "object") return null;
  if (!event.id || typeof event.id !== "string") return null;
  if (!event.dateKey || typeof event.dateKey !== "string") return null;
  if (!event.time || typeof event.time !== "string") return null;

  return {
    id: event.id,
    dateKey: event.dateKey,
    time: event.time,
    studentName: typeof event.studentName === "string" ? event.studentName : "",
    cancelledAt: typeof event.cancelledAt === "string" ? event.cancelledAt : new Date().toISOString(),
    isLastMinute: Boolean(event.isLastMinute),
  };
};

const persistCancellationEvents = () => {
  if (!safeStorage) return;
  try {
    safeStorage.setItem(CANCELLATION_STORAGE_KEY, JSON.stringify(cancellationEvents));
  } catch (error) {
    // ignore
  }
};

const loadCancellationEvents = () => {
  if (!safeStorage) return;
  try {
    const raw = safeStorage.getItem(CANCELLATION_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    parsed
      .map((event) => sanitizeCancellationEvent(event))
      .filter(Boolean)
      .forEach((event) => cancellationEvents.push(event));
  } catch (error) {
    // ignore
  }
};

loadCancellationEvents();

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
  if (currentRole !== "student") {
    return;
  }

  const plan = getPlanDef(appState.planKey);
  const nextRenewal = syncCreditCycle(new Date());

  planWidgets.forEach((widget) => {
    const badge = widget.querySelector("[data-plan-badge]");
    const badgeText = widget.querySelector("[data-plan-badge-text]");
    const credits = widget.querySelector("[data-plan-credits]");
    const renewal = widget.querySelector("[data-plan-renewal]");

    if (badge instanceof HTMLElement) {
      badge.classList.remove("is-gold", "is-diamond", "is-turma");
      if (plan.badgeClass) {
        badge.classList.add(plan.badgeClass);
      }
    }

    if (badgeText instanceof HTMLElement) {
      badgeText.textContent = `Plano ${plan.label} ativo`;
    }

    if (credits instanceof HTMLElement) {
      credits.textContent = formatCreditsText(appState.creditsRemaining);
    }

    if (renewal instanceof HTMLElement) {
      renewal.textContent = `Renovam automaticamente em ${formatRenewalDate(nextRenewal)}`;
    }
  });

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
let modalTrashHandler = null;
let activeModalKind = "";
let createEventDraft = null;

const closeModal = () => {
  if (!modalOverlay) return;
  modalOverlay.hidden = true;
  body.classList.remove("is-modal-open");
  modalPrimaryHandler = null;
  modalSecondaryHandler = null;
  modalTrashHandler = null;
  if (modalTrash) {
    modalTrash.hidden = true;
  }
  activeModalKind = "";
  createEventDraft = null;
};

const openModal = ({
  title,
  bodyHtml,
  primaryLabel = "Confirmar",
  secondaryLabel = "Voltar",
  hideSecondary = false,
  showTrash = false,
  onPrimary,
  onSecondary,
  onTrash,
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
  modalTrashHandler = typeof onTrash === "function" ? onTrash : null;

  if (modalTrash) {
    modalTrash.hidden = !showTrash;
  }

  window.setTimeout(() => {
    modalPrimary.focus();
  }, 0);
};

// Hard guard: if any previous CSS/state made the modal visible, reset it on load.
closeModal();

const liveSlotPresetsBase = {
  1: ["09:00", "11:30", "16:30", "19:00"],
  2: ["08:00", "10:30", "15:00", "18:30"],
  3: ["09:30", "12:00", "14:30", "19:30"],
  4: ["08:30", "11:00", "16:00", "18:00"],
  5: ["09:00", "13:30", "15:30", "18:30"],
  6: ["09:00", "10:30", "11:30", "13:00"],
};

const timeToMinutes = (time) => {
  const [hours, minutes] = String(time || "")
    .split(":")
    .map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(hours, 23)) * 60 + Math.max(0, Math.min(minutes, 59));
};

const clampTime = (value, fallback) => {
  const raw = String(value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return fallback;
  const minutes = timeToMinutes(raw);
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
};

const defaultWorkHours = () => {
  const map = {};
  Object.keys(liveSlotPresetsBase).forEach((key) => {
    map[key] = { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
  });
  return map;
};

let teacherWorkHours = (() => {
  if (!safeStorage) return defaultWorkHours();
  try {
    const raw = safeStorage.getItem(TEACHER_WORK_HOURS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const base = defaultWorkHours();
    if (!parsed || typeof parsed !== "object") return base;
    Object.keys(base).forEach((key) => {
      const entry = parsed[key];
      if (!entry || typeof entry !== "object") return;
      const enabled = entry.enabled !== false;
      const windowsRaw = Array.isArray(entry.windows) ? entry.windows : null;
      if (windowsRaw) {
        const windows = windowsRaw
          .map((window) => {
            if (!window || typeof window !== "object") return null;
            return {
              start: clampTime(window.start, "00:00"),
              end: clampTime(window.end, "23:59"),
            };
          })
          .filter(Boolean);
        base[key] = { enabled, windows: windows.length ? windows : [{ start: "00:00", end: "23:59" }] };
        return;
      }

      // Backwards compat (v1): single start/end.
      base[key] = {
        enabled,
        windows: [
          {
            start: clampTime(entry.start, "00:00"),
            end: clampTime(entry.end, "23:59"),
          },
        ],
      };
    });
    return base;
  } catch (error) {
    return defaultWorkHours();
  }
})();

const persistTeacherWorkHours = () => {
  if (!safeStorage) return;
  try {
    safeStorage.setItem(TEACHER_WORK_HOURS_STORAGE_KEY, JSON.stringify(teacherWorkHours));
  } catch (error) {
    // ignore
  }
};

const getLiveSlotPresets = () => {
  const result = {};
  Object.entries(liveSlotPresetsBase).forEach(([dayKey, times]) => {
    const config = teacherWorkHours[dayKey] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
    if (config.enabled === false) {
      result[dayKey] = [];
      return;
    }
    const windows = Array.isArray(config.windows) ? config.windows : [];
    const normalized = windows
      .map((window) => ({ start: timeToMinutes(window.start), end: timeToMinutes(window.end) }))
      .filter((window) => window.end > window.start)
      .sort((a, b) => a.start - b.start);
    result[dayKey] = (times || []).filter((time) => {
      const minutes = timeToMinutes(time);
      return normalized.some((window) => minutes >= window.start && minutes <= window.end);
    });
  });
  return result;
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

const formatShortDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
};

const formatTimeHm = (date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatCountdown = (targetDate, referenceDate = new Date()) => {
  const diffMs = targetDate.getTime() - referenceDate.getTime();
  const minutes = Math.ceil(diffMs / 60000);

  if (minutes <= 0) {
    return "agora";
  }

  if (minutes === 1) {
    return "em 1 minuto";
  }

  if (minutes < 60) {
    return `em ${minutes} minutos`;
  }

  const hours = Math.floor(minutes / 60);
  const leftoverMinutes = minutes % 60;
  const hourLabel = hours === 1 ? "hora" : "horas";

  if (leftoverMinutes === 0) {
    return `em ${hours} ${hourLabel}`;
  }

  return `em ${hours} ${hourLabel} e ${leftoverMinutes} min`;
};

const getMonday = (date) => {
  const cursor = startOfDay(date);
  const day = cursor.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // Monday => 0, Sunday => 6
  cursor.setDate(cursor.getDate() - diff);
  return cursor;
};

const getWeekDaysMonToSat = (date) => {
  const start = getMonday(date);
  return Array.from({ length: 6 }).map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

const getInitials = (name) => {
  const safe = String(name || "").trim();
  if (!safe) return "SP";
  const parts = safe.split(/\s+/).slice(0, 2);
  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
};

const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatBytes = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let size = value;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const display = idx === 0 ? String(Math.round(size)) : size.toFixed(size < 10 ? 1 : 0);
  return `${display} ${units[idx]}`;
};

const getStaffUsers = () => {
  // Prototype: read from storage when available; falls back to teacher/admin defs (never include students).
  if (safeStorage) {
    try {
      const raw = safeStorage.getItem(STAFF_USERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        return parsed
          .map((user) => {
            if (!user || typeof user !== "object") return null;
            if (!user.id || typeof user.id !== "string") return null;
            if (!user.name || typeof user.name !== "string") return null;
            const role = user.role === "admin" ? "admin" : "teacher";
            return { id: user.id, name: user.name, role };
          })
          .filter(Boolean);
      }
    } catch (error) {
      // ignore
    }
  }

  const teacherName = ROLE_DEFS.teacher.defaultName || "Professor";
  const adminName = ROLE_DEFS.admin.defaultName || "Admin";
  return [
    { id: "u_teacher_1", name: teacherName, role: "teacher" },
    { id: "u_admin_1", name: adminName, role: "admin" },
  ];
};

const roleLabelForUser = (role) => (role === "admin" ? "Administrador" : "Professor");

const getFileTypeIconSvg = (ext) => {
  const safeExt = String(ext || "").toLowerCase();
  if (safeExt === "pdf") {
    return `<svg viewBox="0 0 24 24" fill="none"><path d="M8 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V5A1.5 1.5 0 0 1 8 3.5Z"></path><path d="M14 3.5V8h4"></path></svg>`;
  }
  if (safeExt === "png" || safeExt === "jpg" || safeExt === "jpeg") {
    return `<svg viewBox="0 0 24 24" fill="none"><rect x="4.5" y="5.5" width="15" height="13" rx="2"></rect><path d="M8.5 10a1.5 1.5 0 1 0 0-.01"></path><path d="M19 16l-4.2-4.2a1.5 1.5 0 0 0-2.1 0L7 17"></path></svg>`;
  }
  if (safeExt === "mp3" || safeExt === "mp4") {
    return `<svg viewBox="0 0 24 24" fill="none"><path d="M9 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path><path d="M11 16V6l10-2v10"></path><path d="M19 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none"><path d="M8 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V5A1.5 1.5 0 0 1 8 3.5Z"></path><path d="M14 3.5V8h4"></path></svg>`;
};

const getTeacherLessons = () => scheduledLessons;

const getTeacherCancellationEvents = () => cancellationEvents;

const computeTeacherNps = () => {
  // Placeholder for backend: currently reads from localStorage if present.
  if (!safeStorage) return { average: null, count: 0 };
  try {
    const raw = safeStorage.getItem("space-platform-teacher-nps-v1");
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !Array.isArray(parsed)) return { average: null, count: 0 };
    const values = parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    if (!values.length) return { average: null, count: 0 };
    const sum = values.reduce((acc, value) => acc + value, 0);
    return { average: sum / values.length, count: values.length };
  } catch (error) {
    return { average: null, count: 0 };
  }
};

const renderTeacherClassesChart = (range = "week") => {
  if (!teacherClassesChart || !teacherClassesScale || !teacherClassesLabels) return;

  const now = new Date();
  const lessons = getTeacherLessons();
  const cancellations = getTeacherCancellationEvents();

  const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const baseDays = range === "month" ? ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] : [];

  const rows = range === "month"
    ? baseDays.map((label) => ({ label, done: 0, cancelled: 0, tooltip: "" }))
    : getWeekDaysMonToSat(now).map((date) => {
        const label = weekdayFormatter.format(date).replace(".", "").toUpperCase();
        return { label, dateKey: createDateKey(date), done: 0, cancelled: 0, tooltip: "" };
      });

  if (range === "month") {
    const month = now.getMonth();
    const year = now.getFullYear();

    lessons.forEach((lesson) => {
      const date = parseDateKey(lesson.dateKey);
      if (!date) return;
      if (date.getMonth() !== month || date.getFullYear() !== year) return;
      const dateTime = getSlotDateTime(date, lesson.time);
      if (dateTime.getTime() > now.getTime()) return;
      if (date.getDay() === 0) return;
      if (date.getDay() === 6) {
        rows[5].done += 1;
        return;
      }
      const index = Math.max(0, Math.min(date.getDay() - 1, 4));
      rows[index].done += 1;
    });

    cancellations.forEach((event) => {
      const date = parseDateKey(event.dateKey);
      if (!date) return;
      if (date.getMonth() !== month || date.getFullYear() !== year) return;
      if (date.getDay() === 0) return;
      if (date.getDay() === 6) {
        rows[5].cancelled += 1;
        return;
      }
      const index = Math.max(0, Math.min(date.getDay() - 1, 4));
      rows[index].cancelled += 1;
    });
  } else {
    rows.forEach((row) => {
      const dayLessons = lessons
        .map((lesson) => {
          if (lesson.dateKey !== row.dateKey) return null;
          const date = parseDateKey(lesson.dateKey);
          if (!date) return null;
          return getSlotDateTime(date, lesson.time);
        })
        .filter(Boolean);
      row.done = dayLessons.filter((dateTime) => dateTime.getTime() <= now.getTime()).length;
      row.cancelled = cancellations.filter((event) => event.dateKey === row.dateKey).length;
    });
  }

  const maxValue = Math.max(
    1,
    ...rows.map((row) => Math.max(row.done, row.cancelled))
  );
  const niceMax = getNiceMax(maxValue);
  const scaleValues = [niceMax, Math.round((niceMax * 2) / 3), Math.round(niceMax / 3), 0];

  teacherClassesScale.innerHTML = scaleValues.map((value) => `<span>${value}</span>`).join("");
  teacherClassesLabels.innerHTML = rows.map((row) => `<span>${row.label}</span>`).join("");

  teacherClassesChart.innerHTML = rows
    .map((row) => {
      const doneHeight = Math.max((row.done / niceMax) * 100, row.done ? 10 : 0);
      const cancelledHeight = Math.max((row.cancelled / niceMax) * 100, row.cancelled ? 10 : 0);
      const tooltip = `${row.label}: ${row.done} realizadas · ${row.cancelled} canceladas`;

      return `
        <div class="teacher-bar-day" title="${tooltip}">
          <div class="teacher-bar-pair">
            <div class="bar-column">
              <span class="bar-column-fill" style="height: ${doneHeight}%"></span>
            </div>
            <div class="bar-column is-muted">
              <span class="bar-column-fill" style="height: ${cancelledHeight}%"></span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
};

const renderTeacherStudents = () => {
  if (!teacherActiveList || !teacherMissingList) return;

  const now = new Date();
  const lessons = getTeacherLessons();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - 7);

  const studentsMap = new Map();

  lessons.forEach((lesson) => {
    const date = parseDateKey(lesson.dateKey);
    if (!date) return;
    const dateTime = getSlotDateTime(date, lesson.time);
    const name = lesson.studentName || "Aluno Space";
    const entry = studentsMap.get(name) || { name, last: dateTime };
    if (dateTime.getTime() > entry.last.getTime()) {
      entry.last = dateTime;
    }
    studentsMap.set(name, entry);
  });

  const students = Array.from(studentsMap.values()).sort((a, b) => b.last.getTime() - a.last.getTime());
  const active = students.filter((student) => student.last.getTime() >= windowStart.getTime()).slice(0, 5);
  const missing = students.filter((student) => student.last.getTime() < windowStart.getTime()).slice(0, 5);

  teacherActiveEmpty.hidden = active.length > 0;
  teacherMissingEmpty.hidden = missing.length > 0;

  teacherActiveList.innerHTML = active
    .map((student) => {
      return `
        <li class="teacher-student-row">
          <span class="ranking-avatar">${getInitials(student.name)}</span>
          <div class="teacher-student-copy">
            <strong>${escapeHtml(student.name)}</strong>
            <span>${formatShortDate(student.last)}</span>
          </div>
        </li>
      `;
    })
    .join("");

  teacherMissingList.innerHTML = missing
    .map((student) => {
      return `
        <li class="teacher-student-row teacher-student-row-missing">
          <span class="ranking-avatar">${getInitials(student.name)}</span>
          <div class="teacher-student-copy">
            <strong>${escapeHtml(student.name)}</strong>
            <span>${formatShortDate(student.last)}</span>
          </div>
          <span class="teacher-missing-badge">Sumido</span>
        </li>
      `;
    })
    .join("");
};

const renderTeacherCancellations = () => {
  if (!teacherCancelList || !teacherCancelEmpty) return;

  const items = getTeacherCancellationEvents()
    .slice()
    .sort((a, b) => new Date(b.cancelledAt).getTime() - new Date(a.cancelledAt).getTime())
    .slice(0, 6);

  teacherCancelEmpty.hidden = items.length > 0;
  teacherCancelList.innerHTML = items
    .map((item) => {
      const date = parseDateKey(item.dateKey) || new Date();
      const when = `${formatShortDate(date)} · ${item.time}`;
      const name = item.studentName || "Aluno Space";
      const type = item.isLastMinute ? "em cima da hora" : "com antecedência";

      return `
        <li class="teacher-cancel-item${item.isLastMinute ? " is-urgent" : ""}">
          <div class="teacher-cancel-main">
            <strong>${escapeHtml(name)}</strong>
            <span>${when}</span>
          </div>
          <span class="teacher-cancel-tag${item.isLastMinute ? " is-urgent" : ""}">${type}</span>
        </li>
      `;
    })
    .join("");
};

const renderTeacherTodaySlots = () => {
  if (!teacherTodaySlots || !teacherTodaySlotsEmpty) return;

  const now = new Date();
  const today = startOfDay(now);
  const slots = getAvailableSlots(today, now).slice(0, 6);

  teacherTodaySlotsEmpty.hidden = slots.length > 0;
  teacherTodaySlots.innerHTML = slots
    .map((time) => `<button class="today-slot-button" type="button" disabled>${time}</button>`)
    .join("");
};

const loadTeacherNotices = () => {
  if (!safeStorage) return [];
  try {
    const raw = safeStorage.getItem(TEACHER_NOTICES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((notice) => notice && typeof notice.id === "string");
  } catch (error) {
    return [];
  }
};

const loadTeacherNoticeReadMap = () => {
  if (!safeStorage) return {};
  try {
    const raw = safeStorage.getItem(TEACHER_NOTICE_READ_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};

const persistTeacherNoticeReadMap = (map) => {
  if (!safeStorage) return;
  try {
    safeStorage.setItem(TEACHER_NOTICE_READ_KEY, JSON.stringify(map));
  } catch (error) {
    // ignore
  }
};

const persistTeacherNotices = (notices) => {
  if (!safeStorage) return;
  try {
    safeStorage.setItem(TEACHER_NOTICES_STORAGE_KEY, JSON.stringify(notices));
  } catch (error) {
    // ignore
  }
};

const renderTeacherNotices = () => {
  if (!teacherNoticeList || !teacherNoticeEmpty) return;

  const notices = loadTeacherNotices()
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const readMap = loadTeacherNoticeReadMap();

  teacherNoticeEmpty.hidden = notices.length > 0;
  teacherNoticeList.innerHTML = notices
    .map((notice) => {
      const isRead = Boolean(readMap[notice.id]);
      const createdAt = notice.createdAt ? new Date(notice.createdAt) : null;
      const metaBits = [];
      if (createdAt) metaBits.push(`${formatShortDate(createdAt)} · ${formatTimeHm(createdAt)}`);
      if (notice.author) metaBits.push(String(notice.author));
      const meta = escapeHtml(metaBits.join(" · "));

      const comments = Array.isArray(notice.comments) ? notice.comments : [];
      const commentsMarkup = comments
        .slice()
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        .map((comment) => {
          const author = comment.author ? String(comment.author) : "Professor";
          const text = comment.text ? String(comment.text) : "";
          const when = comment.createdAt ? new Date(comment.createdAt) : null;
          return `
            <div class="teacher-comment">
              <div class="teacher-comment-meta">
                <strong>${escapeHtml(author)}</strong>
                <span>${when ? `${formatShortDate(when)} · ${formatTimeHm(when)}` : ""}</span>
              </div>
              <div class="teacher-comment-text">${escapeHtml(text)}</div>
            </div>
          `;
        })
        .join("");

      return `
        <li class="teacher-notice-item${isRead ? "" : " is-unread"}" data-teacher-notice-id="${notice.id}">
          <button class="teacher-notice-toggle" type="button" data-teacher-notice-toggle>
            <div class="teacher-notice-head">
              <span class="teacher-notice-dot" aria-hidden="true"></span>
              <strong class="teacher-notice-title">${escapeHtml(notice.title ? String(notice.title) : "Aviso")}</strong>
              <span class="teacher-notice-meta">${meta}</span>
            </div>
            <div class="teacher-notice-body">${escapeHtml(notice.text ? String(notice.text) : "")}</div>
          </button>
          <div class="teacher-notice-thread" data-teacher-notice-thread hidden>
            <div class="teacher-comments">${commentsMarkup}</div>
            <form class="teacher-comment-form" data-teacher-comment-form>
              <textarea class="teacher-comment-input" rows="2" placeholder="Escreva um comentário"></textarea>
              <button class="button button-solid teacher-comment-send" type="submit">Enviar</button>
            </form>
          </div>
        </li>
      `;
    })
    .join("");
};

const renderTeacherDashboard = () => {
  if (currentRole !== "teacher") {
    return;
  }

  const now = new Date();
  const todayKey = createDateKey(now);
  const lessons = getTeacherLessons();
  const cancellations = getTeacherCancellationEvents();

  const lessonsToday = lessons.filter((lesson) => lesson.dateKey === todayKey);
  const cancelledToday = cancellations.filter((event) => event.dateKey === todayKey);

  if (teacherLessonsTodayValue) {
    teacherLessonsTodayValue.textContent = String(lessonsToday.length);
  }

  if (teacherLessonsTodaySub) {
    teacherLessonsTodaySub.textContent = `${lessonsToday.length} confirmadas · ${cancelledToday.length} canceladas`;
  }

  const upcomingToday = lessonsToday
    .map((lesson) => {
      const date = parseDateKey(lesson.dateKey);
      if (!date) return null;
      const dateTime = getSlotDateTime(date, lesson.time);
      return { ...lesson, dateTime };
    })
    .filter(Boolean)
    .filter((lesson) => lesson.dateTime.getTime() > now.getTime())
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  const nextLesson = upcomingToday[0] || null;

  if (teacherNextClassValue && teacherNextCountdown) {
    if (!nextLesson) {
      teacherNextClassValue.textContent = "Sem mais aulas hoje";
      teacherNextCountdown.textContent = "";
    } else {
      const name = nextLesson.studentName || "Aluno Space";
      teacherNextClassValue.textContent = `${name} · ${formatTimeHm(nextLesson.dateTime)}`;
      teacherNextCountdown.textContent = formatCountdown(nextLesson.dateTime, now);
    }
  }

  const nps = computeTeacherNps();
  if (teacherNpsValue) {
    teacherNpsValue.textContent = nps.average === null ? "—" : nps.average.toFixed(1);
  }
  if (teacherNpsSub) {
    teacherNpsSub.textContent = `Baseado em ${nps.count} ${nps.count === 1 ? "avaliação" : "avaliações"}`;
  }

  const weekDays = getWeekDaysMonToSat(now);
  const weekKeys = new Set(weekDays.map((date) => createDateKey(date)));
  const presets = getLiveSlotPresets();
  const totalSlots = weekDays.reduce((acc, date) => {
    const times = presets[String(date.getDay())] || [];
    return acc + times.length;
  }, 0);
  const filledSlots = lessons.filter((lesson) => weekKeys.has(lesson.dateKey)).length;
  const percent = totalSlots ? Math.round((filledSlots / totalSlots) * 100) : 0;

  if (teacherOccupancyPercent) {
    teacherOccupancyPercent.textContent = `${percent}%`;
  }
  if (teacherOccupancySub) {
    teacherOccupancySub.textContent = `${filledSlots} de ${totalSlots} slots preenchidos`;
  }
  if (teacherOccupancyRing) {
    teacherOccupancyRing.style.setProperty("--level-progress", String(percent));
  }
  if (teacherOccupancyRingText) {
    teacherOccupancyRingText.textContent = `${percent}%`;
  }

  renderTeacherClassesChart(chartState["teacher-classes"]);
  renderTeacherNotices();
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

const teacherCalendarState = (() => {
  const today = startOfDay(new Date());
  return {
    view: "day", // day | week | month
    focusDate: new Date(today),
    selectedDate: new Date(today),
    miniCursor: new Date(today.getFullYear(), today.getMonth(), 1),
  };
})();

const loadTeacherCalendarEvents = () => {
  if (!safeStorage) return [];
  try {
    const raw = safeStorage.getItem(TEACHER_CAL_EVENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    // Keep the raw payload shape; normalization happens in `sanitizeManualEvent`.
    return parsed.filter((event) => event && typeof event === "object" && typeof event.id === "string");
  } catch (error) {
    return [];
  }
};

let teacherManualEvents = loadTeacherCalendarEvents();

const persistTeacherCalendarEvents = () => {
  if (!safeStorage) return;
  try {
    safeStorage.setItem(TEACHER_CAL_EVENTS_STORAGE_KEY, JSON.stringify(teacherManualEvents));
  } catch (error) {
    // ignore
  }
};

const sanitizeManualEvent = (event) => {
  if (!event || typeof event !== "object") return null;
  if (!event.id || typeof event.id !== "string") return null;
  const title = typeof event.title === "string" ? event.title : "";
  const startIso = typeof event.startIso === "string" ? event.startIso : "";
  const endIso = typeof event.endIso === "string" ? event.endIso : "";
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;
  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= start.getTime()) return null;
  const description = typeof event.description === "string" ? event.description : "";
  const guests = Array.isArray(event.guests) ? event.guests.filter((id) => typeof id === "string") : [];
  const documents = Array.isArray(event.documents)
    ? event.documents
        .map((doc) => {
          if (!doc || typeof doc !== "object") return null;
          if (!doc.id || typeof doc.id !== "string") return null;
          if (!doc.name || typeof doc.name !== "string") return null;
          if (!doc.ext || typeof doc.ext !== "string") return null;
          const size = Number(doc.size);
          return {
            id: doc.id,
            name: doc.name,
            ext: doc.ext,
            type: typeof doc.type === "string" ? doc.type : "",
            size: Number.isFinite(size) ? size : 0,
            dataUrl: typeof doc.dataUrl === "string" ? doc.dataUrl : "",
          };
        })
        .filter(Boolean)
    : [];

  return { id: event.id, title, startIso, endIso, description, guests, documents };
};

const rehydrateTeacherManualEvents = () => {
  teacherManualEvents = teacherManualEvents
    .map((event) => sanitizeManualEvent(event))
    .filter(Boolean);
};

rehydrateTeacherManualEvents();

const sameDateKey = (a, b) => createDateKey(a) === createDateKey(b);

const addDays = (date, deltaDays) => {
  const next = new Date(date);
  next.setDate(next.getDate() + deltaDays);
  return next;
};

const addMonths = (date, deltaMonths) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + deltaMonths);
  return next;
};

const formatTeacherTopDate = (view, focusDate) => {
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

  if (view === "month") {
    return monthFormatter.format(focusDate);
  }

  if (view === "week") {
    const days = getWeekDaysMonToSat(focusDate);
    return formatWeekRange(days);
  }

  return dateFormatter.format(focusDate);
};

const setTeacherFocusDate = (date) => {
  const normalized = startOfDay(date);
  teacherCalendarState.focusDate = normalized;
  teacherCalendarState.selectedDate = new Date(normalized);
  teacherCalendarState.miniCursor = new Date(normalized.getFullYear(), normalized.getMonth(), 1);
};

const getLessonEvents = () => {
  return scheduledLessons
    .map((lesson) => {
      const date = parseDateKey(lesson.dateKey);
      if (!date) return null;
      const start = getSlotDateTime(date, lesson.time);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + (lesson.durationMinutes || LESSON_DURATION_MINUTES));
      return {
        id: lesson.id,
        type: "lesson",
        title: lesson.studentName || "Aluno Space",
        start,
        end,
      };
    })
    .filter(Boolean);
};

const getManualEvents = () => {
  return teacherManualEvents
    .map((event) => {
      const start = new Date(event.startIso);
      const end = new Date(event.endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
      return {
        id: event.id,
        type: "manual",
        title: event.title,
        description: event.description || "",
        guests: Array.isArray(event.guests) ? event.guests : [],
        documents: Array.isArray(event.documents) ? event.documents : [],
        start,
        end,
      };
    })
    .filter(Boolean);
};

const getTeacherEventsForRange = (rangeStart, rangeEnd) => {
  const events = [...getLessonEvents(), ...getManualEvents()];
  return events
    .filter((event) => event.end.getTime() > rangeStart.getTime() && event.start.getTime() < rangeEnd.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
};

const layoutOverlappingEvents = (events) => {
  if (!events.length) return [];

  const overlaps = (a, b) => a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();

  const components = [];
  const visited = new Set();
  for (let i = 0; i < events.length; i += 1) {
    const seed = events[i];
    if (visited.has(seed.id)) continue;
    const queue = [seed];
    visited.add(seed.id);
    const component = [];

    while (queue.length) {
      const current = queue.pop();
      component.push(current);
      for (let j = 0; j < events.length; j += 1) {
        const other = events[j];
        if (visited.has(other.id)) continue;
        if (overlaps(current, other)) {
          visited.add(other.id);
          queue.push(other);
        }
      }
    }
    components.push(component);
  }

  const laidOut = [];
  components.forEach((component) => {
    const sorted = component.slice().sort((a, b) => a.start.getTime() - b.start.getTime());

    const endpoints = [];
    sorted.forEach((event) => {
      endpoints.push({ t: event.start.getTime(), d: +1 });
      endpoints.push({ t: event.end.getTime(), d: -1 });
    });
    endpoints.sort((a, b) => (a.t === b.t ? a.d - b.d : a.t - b.t));
    let activeCount = 0;
    let maxSimul = 1;
    endpoints.forEach((point) => {
      activeCount += point.d;
      maxSimul = Math.max(maxSimul, activeCount);
    });

    const colEndTimes = Array.from({ length: maxSimul }).map(() => 0);
    sorted.forEach((event) => {
      const start = event.start.getTime();
      let colIndex = colEndTimes.findIndex((endTime) => endTime <= start);
      if (colIndex < 0) colIndex = 0;
      colEndTimes[colIndex] = event.end.getTime();
      laidOut.push({ ...event, colIndex, colCount: maxSimul });
    });
  });

  return laidOut;
};

const normalizeWorkWindows = (workConfig) => {
  if (!workConfig || workConfig.enabled === false) return [];
  const windows = Array.isArray(workConfig.windows) ? workConfig.windows : [];
  const parsed = windows
    .map((window) => ({
      start: timeToMinutes(window.start),
      end: timeToMinutes(window.end),
    }))
    .filter((window) => window.end > window.start)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  parsed.forEach((window) => {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...window });
      return;
    }
    if (window.start <= last.end) {
      last.end = Math.max(last.end, window.end);
      return;
    }
    merged.push({ ...window });
  });
  return merged;
};

const computeOffHoursSegments = ({ windows, gridStartMin, gridEndMin }) => {
  if (!windows.length) {
    return [{ start: gridStartMin, end: gridEndMin }];
  }

  const segments = [];
  let cursor = gridStartMin;
  windows.forEach((window) => {
    const start = Math.max(gridStartMin, Math.min(window.start, gridEndMin));
    const end = Math.max(gridStartMin, Math.min(window.end, gridEndMin));
    if (start > cursor) {
      segments.push({ start: cursor, end: start });
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < gridEndMin) {
    segments.push({ start: cursor, end: gridEndMin });
  }
  return segments.filter((seg) => seg.end > seg.start);
};

const renderTeacherMiniCalendar = () => {
  if (!teacherMiniGrid || !teacherMiniTitle) return;

  const cursor = new Date(teacherCalendarState.miniCursor);
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
  teacherMiniTitle.textContent = monthFormatter.format(cursor);

  const today = startOfDay(new Date());
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay()); // Sunday start

  const dow = ["D", "S", "T", "Q", "Q", "S", "S"];
  const cells = [];
  dow.forEach((label) => cells.push(`<div class="teacher-mini-cal-dow">${label}</div>`));

  for (let i = 0; i < 42; i += 1) {
    const day = addDays(start, i);
    const isOutside = day.getMonth() !== cursor.getMonth();
    const isToday = sameDateKey(day, today);
    const isSelected = sameDateKey(day, teacherCalendarState.selectedDate);
    const classes = [
      "teacher-mini-cal-day",
      isOutside ? "is-outside" : "",
      isToday ? "is-today" : "",
      isSelected ? "is-selected" : "",
    ]
      .filter(Boolean)
      .join(" ");

    cells.push(
      `<button class="${classes}" type="button" data-teacher-mini-day="${createDateKey(day)}">${day.getDate()}</button>`
    );
  }

  teacherMiniGrid.innerHTML = cells.join("");
};

const renderTeacherCalendarViewportDay = (date) => {
  if (!teacherCalViewport) return;

  const startHour = 6;
  const endHour = 23;
  const hourHeight = 56;
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);
  const events = getTeacherEventsForRange(dayStart, dayEnd);
  const laidOut = layoutOverlappingEvents(events);

  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "").toUpperCase();
  const today = startOfDay(new Date());
  const isToday = sameDateKey(date, today);
  const head = `
    <div class="teacher-cal-head-cell"></div>
    <div class="teacher-cal-head-cell">
      <div class="teacher-cal-day-label">
        <span>${weekdayLabel}</span>
        <span class="teacher-cal-day-num${isToday ? " is-today" : ""}">${date.getDate()}</span>
      </div>
    </div>
  `;

  const times = [];
  for (let h = startHour; h <= endHour; h += 1) {
    const label = h === 12 ? "12 PM" : h === 0 ? "12 AM" : h < 12 ? `${h} AM` : `${h - 12} PM`;
    times.push(`<div class="teacher-cal-time">${label}</div>`);
  }

  const rows = [];
  for (let h = startHour; h <= endHour; h += 1) {
    rows.push(`<div class="teacher-cal-hour-row"></div>`);
  }

  const dayIndex = String(date.getDay());
  const gridStartMin = startHour * 60;
  const gridEndMin = (endHour + 1) * 60;
  const work = teacherWorkHours[dayIndex] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
  const windows = normalizeWorkWindows(work);
  const segments = computeOffHoursSegments({ windows, gridStartMin, gridEndMin });
  const offHours = `
    <div class="teacher-cal-offhours" aria-hidden="true">
      ${segments
        .map((seg) => {
          const top = ((seg.start - gridStartMin) / 60) * hourHeight;
          const height = ((seg.end - seg.start) / 60) * hourHeight;
          return `<div class="teacher-cal-offhours-seg" style="top:${top}px;height:${height}px"></div>`;
        })
        .join("")}
    </div>
  `;

  let nowLine = "";
  if (isToday) {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes >= gridStartMin && minutes <= gridEndMin) {
      const y = ((minutes - gridStartMin) / 60) * hourHeight;
      nowLine = `<div class="teacher-cal-now-line" style="top:${y}px"><span class="teacher-cal-now-dot" aria-hidden="true"></span></div>`;
    }
  }

  const eventsMarkup = laidOut
    .map((event) => {
      const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
      const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
      const top = ((startMinutes - gridStartMin) / 60) * hourHeight;
      const height = Math.max(18, ((endMinutes - startMinutes) / 60) * hourHeight);
      const leftPct = (event.colIndex / event.colCount) * 100;
      const widthPct = 100 / event.colCount;
      const timeLabel = `${formatTimeHm(event.start)} – ${formatTimeHm(event.end)}`;
      return `
        <button
          class="teacher-cal-event is-${event.type}"
          style="top:${top}px;height:${height}px;left:calc(${leftPct}% + 8px);width:calc(${widthPct}% - 16px);"
          type="button"
          data-teacher-cal-event-type="${event.type}"
          data-teacher-cal-event-id="${escapeHtml(event.id)}"
        >
          <span class="teacher-cal-event-title">${escapeHtml(event.title)}</span>
          <span class="teacher-cal-event-time">${escapeHtml(timeLabel)}</span>
        </button>
      `;
    })
    .join("");

  teacherCalViewport.innerHTML = `
    <div class="teacher-cal-day">
      ${head}
      <div class="teacher-cal-timecol">${times.join("")}</div>
      <div class="teacher-cal-grid">
        ${rows.join("")}
        ${offHours}
        ${nowLine}
        <div class="teacher-cal-events-layer">${eventsMarkup}</div>
      </div>
    </div>
  `;
};

const renderTeacherCalendarViewportWeek = (focusDate) => {
  if (!teacherCalViewport) return;

  const startHour = 6;
  const endHour = 23;
  const hourHeight = 56;
  const days = getWeekDaysMonToSat(focusDate);
  const weekStart = startOfDay(days[0]);
  const weekEnd = addDays(startOfDay(days[days.length - 1]), 1);
  const events = getTeacherEventsForRange(weekStart, weekEnd);
  const today = startOfDay(new Date());

  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
  const headDays = days
    .map((date) => {
      const label = weekdayLabel.format(date).replace(".", "").toUpperCase();
      const isToday = sameDateKey(date, today);
      return `
        <div class="teacher-cal-week-dayhead">
          <div class="teacher-cal-week-daylabel">
            <span>${label}</span>
            <span class="teacher-cal-week-daynum${isToday ? " is-today" : ""}">${date.getDate()}</span>
          </div>
        </div>
      `;
    })
    .join("");

  const times = [];
  for (let h = startHour; h <= endHour; h += 1) {
    const label = h === 12 ? "12 PM" : h === 0 ? "12 AM" : h < 12 ? `${h} AM` : `${h - 12} PM`;
    times.push(`<div class="teacher-cal-time">${label}</div>`);
  }

  const rows = [];
  for (let h = startHour; h <= endHour; h += 1) {
    rows.push(`<div class="teacher-cal-hour-row"></div>`);
  }

  const dayColumns = days
    .map((date) => {
      const dayStart = startOfDay(date);
      const dayEnd = addDays(dayStart, 1);
      const dayEvents = events.filter((event) => event.end.getTime() > dayStart.getTime() && event.start.getTime() < dayEnd.getTime());
      const laidOut = layoutOverlappingEvents(dayEvents);

      const dayIndex = String(date.getDay());
      const gridStartMin = startHour * 60;
      const gridEndMin = (endHour + 1) * 60;
      const work = teacherWorkHours[dayIndex] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
      const windows = normalizeWorkWindows(work);
      const segments = computeOffHoursSegments({ windows, gridStartMin, gridEndMin });
      const offHours = `
        <div class="teacher-cal-offhours" aria-hidden="true">
          ${segments
            .map((seg) => {
              const top = ((seg.start - gridStartMin) / 60) * hourHeight;
              const height = ((seg.end - seg.start) / 60) * hourHeight;
              return `<div class="teacher-cal-offhours-seg" style="top:${top}px;height:${height}px"></div>`;
            })
            .join("")}
        </div>
      `;

      let nowLine = "";
      if (sameDateKey(date, today)) {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        if (minutes >= gridStartMin && minutes <= gridEndMin) {
          const y = ((minutes - gridStartMin) / 60) * hourHeight;
          nowLine = `<div class="teacher-cal-now-line" style="top:${y}px"><span class="teacher-cal-now-dot" aria-hidden="true"></span></div>`;
        }
      }

      const eventsMarkup = laidOut
        .map((event) => {
          const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
          const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
          const top = ((startMinutes - gridStartMin) / 60) * hourHeight;
          const height = Math.max(18, ((endMinutes - startMinutes) / 60) * hourHeight);
          const leftPct = (event.colIndex / event.colCount) * 100;
          const widthPct = 100 / event.colCount;
          const timeLabel = `${formatTimeHm(event.start)} – ${formatTimeHm(event.end)}`;
          return `
            <button
              class="teacher-cal-event is-${event.type}"
              style="top:${top}px;height:${height}px;left:calc(${leftPct}% + 8px);width:calc(${widthPct}% - 16px);"
              type="button"
              data-teacher-cal-event-type="${event.type}"
              data-teacher-cal-event-id="${escapeHtml(event.id)}"
            >
              <span class="teacher-cal-event-title">${escapeHtml(event.title)}</span>
              <span class="teacher-cal-event-time">${escapeHtml(timeLabel)}</span>
            </button>
          `;
        })
        .join("");

      return `
        <div class="teacher-cal-week-col">
          <div class="teacher-cal-grid">
            ${rows.join("")}
            ${offHours}
            ${nowLine}
            <div class="teacher-cal-events-layer">${eventsMarkup}</div>
          </div>
        </div>
      `;
    })
    .join("");

  teacherCalViewport.innerHTML = `
    <div class="teacher-cal-week">
      <div class="teacher-cal-week-head">
        <div class="teacher-cal-head-cell"></div>
        <div class="teacher-cal-week-head-days">${headDays}</div>
      </div>
      <div class="teacher-cal-timecol">${times.join("")}</div>
      <div class="teacher-cal-week-cols">${dayColumns}</div>
    </div>
  `;
};

const renderTeacherCalendarViewportMonth = (focusDate) => {
  if (!teacherCalViewport) return;

  const firstOfMonth = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay()); // Sunday start
  const today = startOfDay(new Date());
  const rangeStart = startOfDay(gridStart);
  const rangeEnd = addDays(rangeStart, 42);
  const events = getTeacherEventsForRange(rangeStart, rangeEnd);

  const dow = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const head = dow.map((label) => `<div class="teacher-cal-month-dow">${label}</div>`).join("");

  const cellMarkup = Array.from({ length: 42 }).map((_, idx) => {
    const date = addDays(gridStart, idx);
    const isOutside = date.getMonth() !== focusDate.getMonth();
    const isToday = sameDateKey(date, today);
    const dayEvents = events.filter((event) => sameDateKey(event.start, date));
    const pills = dayEvents
      .slice(0, 3)
      .map((event) => {
        const time = `${formatTimeHm(event.start)} ${event.title}`;
        return `
          <button
            class="teacher-cal-month-pill${event.type === "manual" ? " is-manual" : ""}"
            type="button"
            data-teacher-cal-event-type="${event.type}"
            data-teacher-cal-event-id="${escapeHtml(event.id)}"
          >
            ${escapeHtml(time)}
          </button>
        `;
      })
      .join("");
    const moreCount = Math.max(0, dayEvents.length - 3);
    const more = moreCount
      ? `<button class="teacher-cal-month-more" type="button" data-teacher-month-more="${createDateKey(date)}">+ ${moreCount} mais</button>`
      : "";
    return `
      <div class="teacher-cal-month-cell">
        <div class="teacher-cal-month-date${isToday ? " is-today" : ""}${isOutside ? " is-outside" : ""}">${date.getDate()}</div>
        ${pills}
        ${more}
      </div>
    `;
  }).join("");

  teacherCalViewport.innerHTML = `
    <div class="teacher-cal-month">
      <div class="teacher-cal-month-head">${head}</div>
      <div class="teacher-cal-month-grid">${cellMarkup}</div>
    </div>
  `;
};

const renderTeacherCalendar = () => {
  if (currentRole !== "teacher") return;
  if (!liveTeacherRoot || liveTeacherRoot.hidden) return;
  if (!teacherCalViewport) return;

  const now = new Date();
  const timezoneName = getDisplayTimeZoneName();
  if (teacherCalTimeZone) {
    teacherCalTimeZone.textContent = `${timezoneName} · ${formatTimeZoneOffset(now)}`;
  }

  if (teacherCalDate) {
    teacherCalDate.textContent = formatTeacherTopDate(teacherCalendarState.view, teacherCalendarState.focusDate);
  }

  document.querySelectorAll("[data-teacher-cal-view]").forEach((btn) => {
    const isActive = btn.getAttribute("data-teacher-cal-view") === teacherCalendarState.view;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });

  renderTeacherMiniCalendar();

  const view = teacherCalendarState.view;
  if (view === "week") {
    renderTeacherCalendarViewportWeek(teacherCalendarState.focusDate);
    return;
  }
  if (view === "month") {
    renderTeacherCalendarViewportMonth(teacherCalendarState.focusDate);
    return;
  }
  renderTeacherCalendarViewportDay(teacherCalendarState.focusDate);
};

let workHoursDraft = null;

const createWorkHoursDraft = () => {
  const draft = {};
  Object.keys(liveSlotPresetsBase).forEach((dayKey) => {
    const source = teacherWorkHours[dayKey] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
    const windows = Array.isArray(source.windows) ? source.windows : [{ start: "00:00", end: "23:59" }];
    draft[dayKey] = {
      enabled: source.enabled !== false,
      windows: windows.map((window) => ({ start: String(window.start || ""), end: String(window.end || "") })),
    };
    if (!draft[dayKey].windows.length) {
      draft[dayKey].windows = [{ start: "", end: "" }];
    }
  });
  return draft;
};

const renderWorkHoursRow = ({ dayKey, index }) => {
  const entry = workHoursDraft?.[dayKey] || { enabled: true, windows: [{ start: "", end: "" }] };
  const window = entry.windows[index] || { start: "", end: "" };
  const labelMap = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };
  const isFirst = index === 0;
  const canRemove = index > 0;

  const dayLabel = isFirst
    ? `
      <label class="modal-work-day">
        <input type="checkbox" ${entry.enabled ? "checked" : ""} data-wh-enabled="${dayKey}" />
        <span>${labelMap[dayKey] || dayKey}</span>
      </label>
    `
    : `<span aria-hidden="true"></span>`;

  const trash = canRemove
    ? `
      <button class="modal-icon-button is-danger" type="button" data-wh-remove="${dayKey}:${index}" aria-label="Remover janela">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4.5 7.5h15"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M8.5 7.5l1-2h5l1 2"></path>
          <path d="M6.5 7.5l1 13h9l1-13"></path>
        </svg>
      </button>
    `
    : "";

  return `
    <div class="modal-work-row" data-wh-row="${dayKey}:${index}">
      ${dayLabel}
      <input class="modal-input modal-input-time" type="time" value="${escapeHtml(window.start)}" data-wh-start="${dayKey}:${index}" />
      <span class="modal-work-sep">–</span>
      <input class="modal-input modal-input-time" type="time" value="${escapeHtml(window.end)}" data-wh-end="${dayKey}:${index}" />
      <div class="modal-work-actions">
        ${trash}
        <button class="modal-icon-button" type="button" data-wh-add="${dayKey}:${index}" aria-label="Adicionar janela">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14"></path>
            <path d="M5 12h14"></path>
          </svg>
        </button>
      </div>
      <div class="modal-inline-error" data-wh-error="${dayKey}:${index}" hidden></div>
    </div>
  `;
};

const renderWorkHoursDayGroup = (dayKey) => {
  const entry = workHoursDraft?.[dayKey] || { enabled: true, windows: [{ start: "", end: "" }] };
  const windows = Array.isArray(entry.windows) ? entry.windows : [{ start: "", end: "" }];
  return `
    <div class="modal-work-daygroup" data-wh-daygroup="${dayKey}">
      ${windows.map((_, index) => renderWorkHoursRow({ dayKey, index })).join("")}
    </div>
  `;
};

const renderWorkHoursModalBody = () => {
  const keys = Object.keys(liveSlotPresetsBase);
  return `
    <div class="modal-form">
      <div class="modal-help">Defina quando você está disponível para receber agendamentos.</div>
      <div class="modal-work-grid" data-wh-grid>
        ${keys.map((dayKey) => renderWorkHoursDayGroup(dayKey)).join("")}
      </div>
    </div>
  `;
};

const setModalPrimaryDisabled = (disabled) => {
  if (!modalPrimary) return;
  modalPrimary.disabled = Boolean(disabled);
};

const parseWorkKey = (raw) => {
  const [dayKey, indexRaw] = String(raw || "").split(":");
  const index = Number(indexRaw);
  if (!dayKey || !Number.isFinite(index)) return null;
  return { dayKey, index };
};

const validateWorkHoursDraft = () => {
  if (!workHoursDraft) return true;
  if (!modalBody) return true;

  let hasError = false;

  // Reset UI
  modalBody.querySelectorAll("[data-wh-start], [data-wh-end]").forEach((input) => {
    input.classList.remove("is-error");
  });
  modalBody.querySelectorAll("[data-wh-error]").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });

  Object.entries(workHoursDraft).forEach(([dayKey, entry]) => {
    if (!entry) return;
    const isEnabled = entry.enabled !== false;

    // Disable/enable inputs and controls based on checkbox.
    modalBody.querySelectorAll(`[data-wh-start^="${dayKey}:"]`).forEach((el) => {
      if (el instanceof HTMLInputElement) el.disabled = !isEnabled;
    });
    modalBody.querySelectorAll(`[data-wh-end^="${dayKey}:"]`).forEach((el) => {
      if (el instanceof HTMLInputElement) el.disabled = !isEnabled;
    });
    modalBody.querySelectorAll(`[data-wh-add^="${dayKey}:"]`).forEach((el) => {
      if (el instanceof HTMLButtonElement) el.disabled = !isEnabled;
    });
    modalBody.querySelectorAll(`[data-wh-remove^="${dayKey}:"]`).forEach((el) => {
      if (el instanceof HTMLButtonElement) el.disabled = !isEnabled;
    });

    if (!isEnabled) return;
    const windows = Array.isArray(entry.windows) ? entry.windows : [];

    const parsed = windows.map((window, index) => {
      const startRaw = String(window.start || "");
      const endRaw = String(window.end || "");
      const startOk = /^\d{2}:\d{2}$/.test(startRaw);
      const endOk = /^\d{2}:\d{2}$/.test(endRaw);
      const startMin = startOk ? timeToMinutes(startRaw) : null;
      const endMin = endOk ? timeToMinutes(endRaw) : null;
      return { index, startRaw, endRaw, startOk, endOk, startMin, endMin };
    });

    parsed.forEach((row) => {
      const startEl = modalBody.querySelector(`[data-wh-start="${CSS.escape(`${dayKey}:${row.index}`)}"]`);
      const endEl = modalBody.querySelector(`[data-wh-end="${CSS.escape(`${dayKey}:${row.index}`)}"]`);
      const errorEl = modalBody.querySelector(`[data-wh-error="${CSS.escape(`${dayKey}:${row.index}`)}"]`);

      if (!row.startOk) {
        if (startEl) startEl.classList.add("is-error");
        hasError = true;
      }
      if (!row.endOk) {
        if (endEl) endEl.classList.add("is-error");
        hasError = true;
      }
      if (row.startOk && row.endOk && row.startMin !== null && row.endMin !== null && row.startMin >= row.endMin) {
        if (startEl) startEl.classList.add("is-error");
        if (endEl) endEl.classList.add("is-error");
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "O horário de início deve ser anterior ao de fim";
        }
        hasError = true;
      }
    });

    const okRows = parsed
      .filter((row) => row.startOk && row.endOk && row.startMin !== null && row.endMin !== null && row.startMin < row.endMin)
      .sort((a, b) => a.startMin - b.startMin);

    for (let i = 0; i < okRows.length - 1; i += 1) {
      const current = okRows[i];
      const next = okRows[i + 1];
      if (next.startMin < current.endMin) {
        const mark = (row) => {
          const startEl = modalBody.querySelector(`[data-wh-start="${CSS.escape(`${dayKey}:${row.index}`)}"]`);
          const endEl = modalBody.querySelector(`[data-wh-end="${CSS.escape(`${dayKey}:${row.index}`)}"]`);
          const errorEl = modalBody.querySelector(`[data-wh-error="${CSS.escape(`${dayKey}:${row.index}`)}"]`);
          if (startEl) startEl.classList.add("is-error");
          if (endEl) endEl.classList.add("is-error");
          if (errorEl && errorEl.hidden) {
            errorEl.hidden = false;
            errorEl.textContent = "Este horário conflita com outra janela do mesmo dia";
          }
        };
        mark(current);
        mark(next);
        hasError = true;
      }
    }
  });

  setModalPrimaryDisabled(hasError);
  if (modalPrimary) {
    modalPrimary.setAttribute("aria-disabled", String(hasError));
  }
  return !hasError;
};

const openWorkHoursModal = () => {
  workHoursDraft = createWorkHoursDraft();
  openModal({
    title: "Horário de trabalho",
    bodyHtml: renderWorkHoursModalBody(),
    primaryLabel: "Salvar",
    secondaryLabel: "Voltar",
    onPrimary: () => {
      const ok = validateWorkHoursDraft();
      if (!ok) return false;
      teacherWorkHours = workHoursDraft;
      persistTeacherWorkHours();
      renderTeacherCalendar();
      renderLiveScheduler();
    },
  });
  validateWorkHoursDraft();
};

const acceptedDocExts = ["pdf", "mp3", "mp4", "png"];
const MAX_DOC_BYTES = 2 * 1024 * 1024; // localStorage-friendly limit for prototype

const guessExt = (filename) => {
  const name = String(filename || "");
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
};

const fileToDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
};

const formatLongEventDate = (date) => {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalizedWeekday}, ${date.getDate()} de ${month} de ${date.getFullYear()}`;
};

const buildCreateEventBody = ({ readOnly = false } = {}) => {
  const draft = createEventDraft || {};
  const guests = Array.isArray(draft.guests) ? draft.guests : [];
  const docs = Array.isArray(draft.documents) ? draft.documents : [];

  const chips = guests
    .map((guest) => {
      const remove = readOnly
        ? ""
        : `<button type="button" data-ce-remove-guest="${escapeHtml(guest.id)}" aria-label="Remover convidado">×</button>`;
      return `<span class="guest-chip">${escapeHtml(guest.name)}${remove}</span>`;
    })
    .join("");

  const docRows = docs
    .map((doc) => {
      const remove = readOnly
        ? ""
        : `<button class="upload-file-remove" type="button" data-ce-remove-doc="${escapeHtml(doc.id)}" aria-label="Remover documento">×</button>`;
      return `
        <div class="upload-file">
          <span class="upload-file-icon" aria-hidden="true">${getFileTypeIconSvg(doc.ext)}</span>
          <div>
            <strong>${escapeHtml(doc.name)}</strong>
            <span>${escapeHtml(`${formatBytes(doc.size)} · ${doc.ext.toUpperCase()}`)}</span>
          </div>
          ${remove}
        </div>
      `;
    })
    .join("");

  const disabledAttr = readOnly ? "disabled" : "";
  const uploadDisabled = readOnly ? 'aria-disabled="true" tabindex="-1"' : 'role="button" tabindex="0"';
  const uploadClass = readOnly ? "upload-zone is-disabled" : "upload-zone";

  return `
    <div class="modal-form">
      <label class="modal-field">
        <span>Título</span>
        <input class="modal-input" type="text" data-ce-title value="${escapeHtml(draft.title || "")}" ${disabledAttr} />
      </label>

      <div class="modal-row" style="grid-template-columns: minmax(0, 1fr) 120px 120px;">
        <label class="modal-field">
          <span>Data</span>
          <input class="modal-input" type="date" data-ce-date value="${escapeHtml(draft.dateKey || createDateKey(new Date()))}" ${disabledAttr} />
        </label>
        <label class="modal-field">
          <span>Início</span>
          <input class="modal-input" type="time" data-ce-start value="${escapeHtml(draft.startTime || "08:00")}" ${disabledAttr} />
        </label>
        <label class="modal-field">
          <span>Fim</span>
          <input class="modal-input" type="time" data-ce-end value="${escapeHtml(draft.endTime || "09:00")}" ${disabledAttr} />
        </label>
      </div>

      <label class="modal-field">
        <span>Descrição</span>
        <textarea class="modal-textarea" data-ce-desc placeholder="Adicionar descrição..." ${disabledAttr}>${escapeHtml(draft.description || "")}</textarea>
      </label>

      <div class="guest-field">
        <div class="modal-field">
          <span>Convidados</span>
        </div>
        <div class="guest-chipbox" data-ce-chipbox>
          ${chips}
          <input class="guest-search" type="text" data-ce-guest-search placeholder="Buscar pessoas..." value="${escapeHtml(draft.guestQuery || "")}" ${disabledAttr} />
        </div>
        <div class="guest-dropdown" data-ce-guest-dropdown hidden></div>
      </div>

      <div class="modal-field">
        <span>Documentos</span>
        <div class="${uploadClass}" data-ce-upload ${uploadDisabled}>
          <strong>Clique para anexar ou arraste aqui</strong>
          <span>PDF, MP3, MP4 ou PNG</span>
        </div>
        <input
          type="file"
          data-ce-doc-input
          hidden
          multiple
          accept=".pdf,.mp3,.mp4,.png"
          ${disabledAttr}
        />
        <div class="upload-filelist" data-ce-doc-list>
          ${docRows}
        </div>
      </div>

      <div class="modal-inline-error" data-ce-error hidden></div>
    </div>
  `;
};

const computeGuestDropdownItems = () => {
  const query = String(createEventDraft?.guestQuery || "").trim().toLowerCase();
  const staff = getStaffUsers();
  const selectedIds = new Set((createEventDraft?.guests || []).map((g) => g.id));
  return staff
    .filter((user) => !selectedIds.has(user.id))
    .filter((user) => (query ? user.name.toLowerCase().includes(query) : true))
    .slice(0, 8);
};

const syncGuestDropdown = () => {
  const dropdown = modalBody?.querySelector("[data-ce-guest-dropdown]");
  if (!(dropdown instanceof HTMLElement)) return;

  const input = modalBody?.querySelector("[data-ce-guest-search]");
  if (!(input instanceof HTMLInputElement)) return;

  const isOpen = document.activeElement === input || String(input.value || "").trim().length > 0;
  const items = computeGuestDropdownItems();

  if (!isOpen) {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
    return;
  }

  if (!items.length) {
    dropdown.hidden = false;
    dropdown.innerHTML = `<div class="guest-empty">Nenhum usuário encontrado</div>`;
    return;
  }

  dropdown.hidden = false;
  dropdown.innerHTML = items
    .map((user) => {
      return `
        <button class="guest-option" type="button" data-ce-guest-pick="${escapeHtml(user.id)}">
          <span class="ranking-avatar">${escapeHtml(getInitials(user.name))}</span>
          <div>
            <strong>${escapeHtml(user.name)}</strong>
            <span>${escapeHtml(roleLabelForUser(user.role))}</span>
          </div>
        </button>
      `;
    })
    .join("");
};

const validateCreateEventDraft = () => {
  if (!createEventDraft || !modalBody) return true;
  let hasError = false;
  const errorEl = modalBody.querySelector("[data-ce-error]");

  const titleEl = modalBody.querySelector("[data-ce-title]");
  const dateEl = modalBody.querySelector("[data-ce-date]");
  const startEl = modalBody.querySelector("[data-ce-start]");
  const endEl = modalBody.querySelector("[data-ce-end]");

  [titleEl, dateEl, startEl, endEl].forEach((el) => {
    if (el instanceof HTMLElement) el.classList.remove("is-error");
  });

  const title = String(createEventDraft.title || "").trim();
  if (!title) {
    if (titleEl instanceof HTMLElement) titleEl.classList.add("is-error");
    hasError = true;
  }

  const date = parseDateKey(createEventDraft.dateKey);
  const startOk = /^\d{2}:\d{2}$/.test(String(createEventDraft.startTime || ""));
  const endOk = /^\d{2}:\d{2}$/.test(String(createEventDraft.endTime || ""));

  if (!date) {
    if (dateEl instanceof HTMLElement) dateEl.classList.add("is-error");
    hasError = true;
  }
  if (!startOk) {
    if (startEl instanceof HTMLElement) startEl.classList.add("is-error");
    hasError = true;
  }
  if (!endOk) {
    if (endEl instanceof HTMLElement) endEl.classList.add("is-error");
    hasError = true;
  }

  if (date && startOk && endOk) {
    const start = getSlotDateTime(date, clampTime(createEventDraft.startTime, "08:00"));
    const end = getSlotDateTime(date, clampTime(createEventDraft.endTime, "09:00"));
    if (end.getTime() <= start.getTime()) {
      if (startEl instanceof HTMLElement) startEl.classList.add("is-error");
      if (endEl instanceof HTMLElement) endEl.classList.add("is-error");
      hasError = true;
      if (errorEl instanceof HTMLElement) {
        errorEl.hidden = false;
        errorEl.textContent = "O horário de início deve ser anterior ao de fim";
      }
    }
  }

  const docsLoading = (createEventDraft.documents || []).some((doc) => doc && doc.loading);
  if (docsLoading) {
    hasError = true;
  }

  if (!hasError) {
    if (errorEl instanceof HTMLElement) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  } else if (errorEl instanceof HTMLElement && errorEl.hidden) {
    errorEl.hidden = false;
    errorEl.textContent = errorEl.textContent || "Preencha os campos obrigatórios para salvar.";
  }

  setModalPrimaryDisabled(hasError);
  return !hasError;
};

const buildEventTimeHm = (date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const openTeacherEventFormModalFromDraft = () => {
  if (!createEventDraft) return;

  const readOnly = Boolean(createEventDraft.readOnly);
  const mode = createEventDraft.mode === "edit" ? "edit" : createEventDraft.mode === "view" ? "view" : "create";
  const eventType = createEventDraft.eventType === "lesson" ? "lesson" : "manual";

  activeModalKind = "event-form";

  const title = eventType === "lesson" ? "Aula" : mode === "create" ? "Criar evento" : "Evento";
  const primaryLabel = readOnly ? "Fechar" : "Salvar";
  const secondaryLabel = readOnly ? "" : "Voltar";
  const hideSecondary = readOnly;
  const showTrash = !readOnly && mode === "edit" && eventType === "manual";

  const saveFromDraft = () => {
    const ok = validateCreateEventDraft();
    if (!ok) return false;
    const date = parseDateKey(createEventDraft.dateKey);
    if (!date) return false;
    const start = getSlotDateTime(date, clampTime(createEventDraft.startTime, "08:00"));
    const end = getSlotDateTime(date, clampTime(createEventDraft.endTime, "09:00"));
    if (end.getTime() <= start.getTime()) return false;

    const payload = {
      id: createEventDraft.eventId || `m_${Date.now().toString(36)}`,
      title: String(createEventDraft.title || "").trim(),
      description: String(createEventDraft.description || "").trim(),
      guests: (createEventDraft.guests || []).map((g) => g.id),
      documents: (createEventDraft.documents || []).map((doc) => ({
        id: doc.id,
        name: doc.name,
        ext: doc.ext,
        type: doc.type,
        size: doc.size,
        dataUrl: doc.dataUrl || "",
      })),
      startIso: start.toISOString(),
      endIso: end.toISOString(),
    };

    if (mode === "create") {
      teacherManualEvents.unshift(payload);
    } else {
      const idx = teacherManualEvents.findIndex((evt) => evt && evt.id === payload.id);
      if (idx >= 0) {
        teacherManualEvents[idx] = payload;
      }
    }

    persistTeacherCalendarEvents();
    renderTeacherCalendar();
  };

  openModal({
    title,
    bodyHtml: buildCreateEventBody({ readOnly }),
    primaryLabel,
    secondaryLabel,
    hideSecondary,
    showTrash,
    onTrash: showTrash
      ? () => {
          openModal({
            title: "Remover evento",
            bodyHtml: `Tem certeza que deseja remover este evento? Esta ação não pode ser desfeita.`,
            primaryLabel: "Remover evento",
            secondaryLabel: "Cancelar",
            hideSecondary: false,
            showTrash: false,
            onSecondary: () => {
              openTeacherEventFormModalFromDraft();
              return false;
            },
            onPrimary: () => {
              const id = createEventDraft?.eventId || "";
              const idx = teacherManualEvents.findIndex((evt) => evt && evt.id === id);
              if (idx >= 0) {
                teacherManualEvents.splice(idx, 1);
                persistTeacherCalendarEvents();
                renderTeacherCalendar();
              }
            },
          });
          return false;
        }
      : null,
    onPrimary: () => {
      if (readOnly) {
        activeModalKind = "";
        createEventDraft = null;
        return;
      }
      return saveFromDraft();
    },
    onSecondary: () => {
      activeModalKind = "";
      createEventDraft = null;
    },
  });

  if (!readOnly) {
    validateCreateEventDraft();
    syncGuestDropdown();
  } else {
    setModalPrimaryDisabled(false);
  }
};

const openTeacherCreateEventModal = () => {
  const focus = teacherCalendarState.focusDate;
  const startHour = Math.min(Math.max(new Date().getHours(), 6), 20);
  const startDefault = `${String(startHour).padStart(2, "0")}:00`;
  const endDefault = `${String(Math.min(startHour + 1, 23)).padStart(2, "0")}:00`;

  createEventDraft = {
    mode: "create",
    readOnly: false,
    eventType: "manual",
    eventId: "",
    title: "",
    description: "",
    guests: [],
    guestQuery: "",
    documents: [],
    dateKey: createDateKey(focus),
    startTime: startDefault,
    endTime: endDefault,
  };

  openTeacherEventFormModalFromDraft();
};

const openTeacherEventModal = ({ type, id }) => {
  const staff = getStaffUsers();
  const staffMap = new Map(staff.map((u) => [u.id, u]));

  const allEvents = [...getLessonEvents(), ...getManualEvents()];
  const target = allEvents.find((evt) => evt.id === id && evt.type === type);
  if (!target) return;

  if (type === "lesson") {
    createEventDraft = {
      mode: "view",
      readOnly: true,
      eventType: "lesson",
      eventId: target.id,
      title: target.title || "Aula ao vivo",
      description: "",
      guests: [],
      guestQuery: "",
      documents: [],
      dateKey: createDateKey(target.start),
      startTime: buildEventTimeHm(target.start),
      endTime: buildEventTimeHm(target.end),
    };
    openTeacherEventFormModalFromDraft();
    return;
  }

  const rawGuests = Array.isArray(target.guests) ? target.guests : [];
  const guests = rawGuests
    .map((guestId) => staffMap.get(guestId))
    .filter(Boolean)
    .map((user) => ({ id: user.id, name: user.name, role: user.role }));

  createEventDraft = {
    mode: "edit",
    readOnly: false,
    eventType: "manual",
    eventId: target.id,
    title: target.title || "",
    description: target.description || "",
    guests,
    guestQuery: "",
    documents: Array.isArray(target.documents) ? target.documents : [],
    dateKey: createDateKey(target.start),
    startTime: buildEventTimeHm(target.start),
    endTime: buildEventTimeHm(target.end),
  };

  openTeacherEventFormModalFromDraft();
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
  const presets = getLiveSlotPresets();
  const times = presets[String(date.getDay())] || ["09:00", "11:00", "15:00"];

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

  if (currentRole === "student" && !scheduleState.isConfirmed && appState.creditsRemaining <= 0) {
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
  const shouldGateByCredits = currentRole === "student";

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

      advanceButton.disabled = isConfirmed || (shouldGateByCredits && appState.creditsRemaining <= 0);
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
      const shouldClose = modalSecondaryHandler();
      if (shouldClose === false) return;
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

if (modalTrash) {
  modalTrash.addEventListener("click", () => {
    if (modalTrashHandler) {
      const shouldClose = modalTrashHandler();
      if (shouldClose === false) return;
    }
  });
}

const setView = (view, smooth = true) => {
  body.dataset.view = view;
  window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
};

const setPage = (page) => {
  body.dataset.page = page;
};

const showAuthPage = (page) => {
  if (authEnterShell) authEnterShell.hidden = page !== "entrar";
  if (authLoginShell) authLoginShell.hidden = page !== "login";
};

const hideAuthPages = () => {
  if (authEnterShell) authEnterShell.hidden = true;
  if (authLoginShell) authLoginShell.hidden = true;
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
    if (currentRole === "teacher") {
      renderTeacherCalendar();
    } else {
      renderLiveScheduler();
    }
    return;
  }

  if (panelName === "dashboard") {
    if (currentRole === "teacher") {
      renderTeacherDashboard();
    } else {
      renderPlanUI();
    }
  }
};

const normalizePathname = (pathname) => {
  const raw = String(pathname || "/");
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw || "/";
};

const roleBasePath = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === "teacher") return "/app/professor";
  if (normalized === "admin") return "/app/admin";
  return "/app/aluno";
};

const panelPathForRole = (role, panel) => {
  const normalized = normalizeRole(role);
  const p = String(panel || "");

  if (normalized === "teacher") {
    if (p === "ao-vivo") return "/app/professor/agenda";
    if (p === "gravadas") return "/app/professor/gravadas";
    if (p === "materiais") return "/app/professor/materiais";
    return "/app/professor";
  }

  if (normalized === "admin") {
    if (p === "gravadas") return "/app/admin/gravadas";
    if (p === "ao-vivo") return "/app/admin/ao-vivo";
    if (p === "materiais") return "/app/admin/materiais";
    return "/app/admin";
  }

  if (p === "gravadas") return "/app/aluno/gravadas";
  if (p === "ao-vivo") return "/app/aluno/ao-vivo";
  if (p === "materiais") return "/app/aluno/materiais";
  return "/app/aluno";
};

const parseAppRoute = (path) => {
  const segments = String(path || "").split("/").filter(Boolean);
  // /app/<role>/<sub>
  const roleSlug = segments[1] || "";
  const sub = segments[2] || "";
  const role =
    roleSlug === "aluno" ? "student" : roleSlug === "professor" ? "teacher" : roleSlug === "admin" ? "admin" : "";
  if (!role) return null;

  if (role === "teacher") {
    if (sub === "agenda") return { role, panel: "ao-vivo" };
    if (sub === "gravadas") return { role, panel: "gravadas" };
    if (sub === "materiais") return { role, panel: "materiais" };
    return { role, panel: "dashboard" };
  }

  if (role === "admin") {
    if (sub === "ao-vivo") return { role, panel: "ao-vivo" };
    if (sub === "gravadas") return { role, panel: "gravadas" };
    if (sub === "materiais") return { role, panel: "materiais" };
    return { role, panel: "dashboard" };
  }

  if (sub === "ao-vivo") return { role, panel: "ao-vivo" };
  if (sub === "gravadas") return { role, panel: "gravadas" };
  if (sub === "materiais") return { role, panel: "materiais" };
  return { role, panel: "dashboard" };
};

const ensureSessionOrRedirect = async () => {
  if (sessionUser) {
    sessionChecked = true;
    return sessionUser;
  }

  // Fallback: if the template didn't embed session info, verify via backend.
  if (sessionRefreshPromise) return sessionRefreshPromise;
  sessionRefreshPromise = fetch("/api/me", { credentials: "include" })
    .then(async (res) => {
      if (!res.ok) {
        sessionUser = null;
        sessionChecked = true;
        return null;
      }
      const data = await res.json().catch(() => null);
      sessionUser = sanitizeSessionUser(data?.user) || null;
      sessionChecked = true;
      return sessionUser;
    })
    .catch(() => {
      sessionUser = null;
      sessionChecked = true;
      return null;
    })
    .finally(() => {
      sessionRefreshPromise = null;
    });

  const resolved = await sessionRefreshPromise;
  if (!resolved) {
    window.location.replace("/entrar");
    return null;
  }
  return resolved;
};

const initAppShell = async () => {
  const user = await ensureSessionOrRedirect();
  if (!user) return;

  setActiveChartOption("learning", chartState.learning);
  setActiveChartOption("study", chartState.study);
  setActiveChartOption("teacher-classes", chartState["teacher-classes"]);
  setSidebarExpanded(false);

  setRole(user.role);
  const parsed = parseAppRoute(normalizePathname(window.location.pathname));
  showPanel(parsed?.panel || "dashboard");

  renderDashboardCharts();
  renderPlanUI();
};

initAppShell();

const navigateApp = (path, { replace = false } = {}) => {
  const next = normalizePathname(String(path || roleBasePath(sessionUser?.role || currentRole)));
  if (replace) {
    window.history.replaceState({}, "", next);
  } else {
    window.history.pushState({}, "", next);
  }

  const parsed = parseAppRoute(next);
  if (!parsed) return;

  // Hard safety: keep the UI on the authenticated role.
  if (sessionUser && normalizeRole(parsed.role) !== normalizeRole(sessionUser.role)) {
    navigateApp(roleBasePath(sessionUser.role), { replace: true });
    return;
  }

  showPanel(parsed.panel);
};

window.addEventListener("popstate", () => {
  const parsed = parseAppRoute(normalizePathname(window.location.pathname));
  if (parsed) {
    showPanel(parsed.panel);
  }
});

if (closePlatformButton) {
  closePlatformButton.addEventListener("click", () => {
    closeModal();
    fetch("/api/logout", { method: "POST", credentials: "include", keepalive: true }).catch(() => {});
    sessionUser = null;
    sessionChecked = true;
    setRole("student");
    window.location.replace("/entrar");
  });
}

if (sidebarToggleButton) {
  sidebarToggleButton.addEventListener("click", () => {
    setSidebarExpanded(!sidebarExpanded);
  });
}

openLivePanelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const role = sessionUser?.role || currentRole;
    navigateApp(panelPathForRole(role, "ao-vivo"));
  });
});

sidebarLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const panel = link.dataset.panelTarget || "dashboard";
    const role = sessionUser?.role || currentRole;
    navigateApp(panelPathForRole(role, panel));
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

    if (chartType === "teacher-classes") {
      renderTeacherDashboard();
    }

    closeAllDropdowns();
  });
});

document.addEventListener("click", (event) => {
  const target = event.target;

  if (target instanceof Element) {
    if (
      activeModalKind === "event-form" &&
      createEventDraft &&
      !createEventDraft.readOnly &&
      modalOverlay &&
      !modalOverlay.hidden
    ) {
      const pick = target.closest("[data-ce-guest-pick]");
      if (pick instanceof HTMLButtonElement) {
        const id = pick.getAttribute("data-ce-guest-pick") || "";
        const staff = getStaffUsers();
        const user = staff.find((u) => u.id === id);
        if (!user) return;
        createEventDraft.guests.push({ id: user.id, name: user.name, role: user.role });
        createEventDraft.guestQuery = "";
        const chipbox = modalBody?.querySelector("[data-ce-chipbox]");
        if (chipbox instanceof HTMLElement) {
          // Re-render minimal chipbox content.
          chipbox.innerHTML =
            (createEventDraft.guests || [])
              .map((guest) => `<span class="guest-chip">${escapeHtml(guest.name)}<button type="button" data-ce-remove-guest="${escapeHtml(guest.id)}" aria-label="Remover convidado">×</button></span>`)
              .join("") +
            `<input class="guest-search" type="text" data-ce-guest-search placeholder="Buscar pessoas..." value="" />`;
        }
        syncGuestDropdown();
        validateCreateEventDraft();
        const input = modalBody?.querySelector("[data-ce-guest-search]");
        if (input instanceof HTMLInputElement) input.focus();
        return;
      }

      const removeGuest = target.closest("[data-ce-remove-guest]");
      if (removeGuest instanceof HTMLButtonElement) {
        const id = removeGuest.getAttribute("data-ce-remove-guest") || "";
        createEventDraft.guests = (createEventDraft.guests || []).filter((g) => g.id !== id);
        const chipbox = modalBody?.querySelector("[data-ce-chipbox]");
        if (chipbox instanceof HTMLElement) {
          chipbox.innerHTML =
            (createEventDraft.guests || [])
              .map((guest) => `<span class="guest-chip">${escapeHtml(guest.name)}<button type="button" data-ce-remove-guest="${escapeHtml(guest.id)}" aria-label="Remover convidado">×</button></span>`)
              .join("") +
            `<input class="guest-search" type="text" data-ce-guest-search placeholder="Buscar pessoas..." value="${escapeHtml(createEventDraft.guestQuery || "")}" />`;
        }
        syncGuestDropdown();
        validateCreateEventDraft();
        return;
      }

      const uploadZone = target.closest("[data-ce-upload]");
      if (uploadZone instanceof HTMLElement) {
        const input = modalBody?.querySelector("[data-ce-doc-input]");
        if (input instanceof HTMLInputElement) {
          input.click();
        }
        return;
      }

      const removeDoc = target.closest("[data-ce-remove-doc]");
      if (removeDoc instanceof HTMLButtonElement) {
        const id = removeDoc.getAttribute("data-ce-remove-doc") || "";
        createEventDraft.documents = (createEventDraft.documents || []).filter((doc) => doc.id !== id);
        const list = modalBody?.querySelector("[data-ce-doc-list]");
        if (list instanceof HTMLElement) {
          list.innerHTML = (createEventDraft.documents || [])
            .map((doc) => {
              return `
                <div class="upload-file">
                  <span class="upload-file-icon" aria-hidden="true">${getFileTypeIconSvg(doc.ext)}</span>
                  <div>
                    <strong>${escapeHtml(doc.name)}</strong>
                    <span>${escapeHtml(`${formatBytes(doc.size)} · ${doc.ext.toUpperCase()}`)}</span>
                  </div>
                  <button class="upload-file-remove" type="button" data-ce-remove-doc="${escapeHtml(doc.id)}" aria-label="Remover documento">×</button>
                </div>
              `;
            })
            .join("");
        }
        validateCreateEventDraft();
        return;
      }

      // Click outside guest field closes dropdown.
      const guestField = modalBody?.querySelector(".guest-field");
      const dropdown = modalBody?.querySelector("[data-ce-guest-dropdown]");
      if (dropdown instanceof HTMLElement && guestField instanceof HTMLElement) {
        if (!target.closest(".guest-field")) {
          dropdown.hidden = true;
          dropdown.innerHTML = "";
        }
      }
    }

    const calEvent = target.closest("[data-teacher-cal-event-id]");
    if (calEvent instanceof HTMLElement && currentRole === "teacher" && body.dataset.activePanel === "ao-vivo") {
      const type = calEvent.getAttribute("data-teacher-cal-event-type") || "";
      const id = calEvent.getAttribute("data-teacher-cal-event-id") || "";
      if (type === "lesson" || type === "manual") {
        openTeacherEventModal({ type, id });
        return;
      }
    }

    const createEventButton = target.closest("[data-teacher-create-event]");
    if (createEventButton instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      openTeacherCreateEventModal();
      return;
    }

    const workHoursButton = target.closest("[data-teacher-work-hours]");
    if (workHoursButton instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      openWorkHoursModal();
      return;
    }

    const miniPrev = target.closest("[data-teacher-mini-prev]");
    if (miniPrev instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      teacherCalendarState.miniCursor = new Date(teacherCalendarState.miniCursor.getFullYear(), teacherCalendarState.miniCursor.getMonth() - 1, 1);
      renderTeacherMiniCalendar();
      return;
    }

    const miniNext = target.closest("[data-teacher-mini-next]");
    if (miniNext instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      teacherCalendarState.miniCursor = new Date(teacherCalendarState.miniCursor.getFullYear(), teacherCalendarState.miniCursor.getMonth() + 1, 1);
      renderTeacherMiniCalendar();
      return;
    }

    const miniDay = target.closest("[data-teacher-mini-day]");
    if (miniDay instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      const key = miniDay.getAttribute("data-teacher-mini-day") || "";
      const date = parseDateKey(key);
      if (!date) return;
      setTeacherFocusDate(date);
      renderTeacherCalendar();
      return;
    }

    const calToday = target.closest("[data-teacher-cal-today]");
    if (calToday instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      setTeacherFocusDate(new Date());
      renderTeacherCalendar();
      return;
    }

    const calPrev = target.closest("[data-teacher-cal-prev]");
    if (calPrev instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      const view = teacherCalendarState.view;
      const delta = view === "month" ? -1 : view === "week" ? -7 : -1;
      const next = view === "month"
        ? addMonths(teacherCalendarState.focusDate, -1)
        : addDays(teacherCalendarState.focusDate, delta);
      setTeacherFocusDate(next);
      renderTeacherCalendar();
      return;
    }

    const calNext = target.closest("[data-teacher-cal-next]");
    if (calNext instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      const view = teacherCalendarState.view;
      const delta = view === "month" ? 1 : view === "week" ? 7 : 1;
      const next = view === "month"
        ? addMonths(teacherCalendarState.focusDate, 1)
        : addDays(teacherCalendarState.focusDate, delta);
      setTeacherFocusDate(next);
      renderTeacherCalendar();
      return;
    }

    const viewBtn = target.closest("[data-teacher-cal-view]");
    if (viewBtn instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      const nextView = viewBtn.getAttribute("data-teacher-cal-view") || "day";
      if (nextView !== "day" && nextView !== "week" && nextView !== "month") return;
      teacherCalendarState.view = nextView;
      renderTeacherCalendar();
      return;
    }

    const monthMore = target.closest("[data-teacher-month-more]");
    if (monthMore instanceof HTMLButtonElement) {
      if (currentRole !== "teacher") return;
      const key = monthMore.getAttribute("data-teacher-month-more") || "";
      const date = parseDateKey(key);
      if (!date) return;
      const start = startOfDay(date);
      const end = addDays(start, 1);
      const events = getTeacherEventsForRange(start, end);
      const bodyHtml = events.length
        ? `<div class="modal-list">${events
            .map((event) => {
              const tag = event.type === "manual" ? "Evento" : "Aula";
              const when = `${formatTimeHm(event.start)} – ${formatTimeHm(event.end)}`;
              return `<div class="modal-list-row"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(`${tag} · ${when}`)}</span></div>`;
            })
            .join("")}</div>`
        : "Sem eventos neste dia.";
      openModal({
        title: `Eventos em ${formatShortDate(date)}`,
        bodyHtml,
        primaryLabel: "Fechar",
        hideSecondary: true,
      });
      return;
    }

    const whAdd = target.closest("[data-wh-add]");
    if (whAdd instanceof HTMLButtonElement) {
      const key = whAdd.getAttribute("data-wh-add") || "";
      const parsed = parseWorkKey(key);
      if (!parsed || !workHoursDraft) return;
      const entry = workHoursDraft[parsed.dayKey];
      if (!entry) return;
      const insertAt = Math.max(0, Math.min(parsed.index + 1, entry.windows.length));
      entry.windows.splice(insertAt, 0, { start: "", end: "" });
      const dayGroup = modalBody?.querySelector(`[data-wh-daygroup="${CSS.escape(parsed.dayKey)}"]`);
      if (dayGroup) {
        dayGroup.innerHTML = entry.windows.map((_, idx) => renderWorkHoursRow({ dayKey: parsed.dayKey, index: idx })).join("");
      }
      validateWorkHoursDraft();
      const focusEl = modalBody?.querySelector(`[data-wh-start="${CSS.escape(`${parsed.dayKey}:${insertAt}`)}"]`);
      if (focusEl instanceof HTMLElement) focusEl.focus();
      return;
    }

    const whRemove = target.closest("[data-wh-remove]");
    if (whRemove instanceof HTMLButtonElement) {
      const key = whRemove.getAttribute("data-wh-remove") || "";
      const parsed = parseWorkKey(key);
      if (!parsed || !workHoursDraft) return;
      const entry = workHoursDraft[parsed.dayKey];
      if (!entry) return;
      if (parsed.index <= 0) return;
      entry.windows.splice(parsed.index, 1);
      if (!entry.windows.length) entry.windows = [{ start: "", end: "" }];
      const dayGroup = modalBody?.querySelector(`[data-wh-daygroup="${CSS.escape(parsed.dayKey)}"]`);
      if (dayGroup) {
        dayGroup.innerHTML = entry.windows.map((_, idx) => renderWorkHoursRow({ dayKey: parsed.dayKey, index: idx })).join("");
      }
      validateWorkHoursDraft();
      return;
    }

    const noticeToggle = target.closest("[data-teacher-notice-toggle]");
    if (noticeToggle instanceof HTMLButtonElement) {
      const noticeItem = noticeToggle.closest("[data-teacher-notice-id]");
      const noticeId = noticeItem?.getAttribute("data-teacher-notice-id") || "";
      const thread = noticeItem?.querySelector("[data-teacher-notice-thread]");
      if (!noticeId || !(thread instanceof HTMLElement)) return;

      const willOpen = thread.hidden;
      thread.hidden = !willOpen;

      if (willOpen) {
        const readMap = loadTeacherNoticeReadMap();
        if (!readMap[noticeId]) {
          readMap[noticeId] = true;
          persistTeacherNoticeReadMap(readMap);
        }
        noticeItem?.classList.remove("is-unread");
      }

      return;
    }

    const cancelButton = target.closest("[data-live-cancel]");
    if (cancelButton instanceof HTMLButtonElement) {
      const lessonId = cancelButton.dataset.lessonId || "";
      const lesson = scheduledLessons.find((item) => item.id === lessonId);
      const parsed = lesson ? parseSlotId(lesson.id) : null;

      if (lesson && parsed) {
        const isStudent = currentRole === "student";
        const slotLabel = formatSelectedSlotLabel(parsed.date, parsed.time);
        const slotDateTime = getSlotDateTime(parsed.date, parsed.time);
        const now = new Date();
        const isRefundable = slotDateTime.getTime() - now.getTime() >= CREDIT_REFUND_WINDOW_MS;
        const plan = getPlanDef(appState.planKey);

        openModal({
          title: "Cancelar aula",
          bodyHtml: `
            <strong>${slotLabel}</strong><br />
            ${
              isStudent
                ? isRefundable
                  ? "Cancelamento com 24h ou mais: 1 crédito será devolvido."
                  : "Faltam menos de 24h: o crédito será perdido."
                : "Confirme para cancelar este horário."
            }
          `,
          primaryLabel: "Confirmar cancelamento",
          secondaryLabel: "Voltar",
          onPrimary: () => {
            const removed = removeScheduledLesson(lessonId);

            if (removed) {
              cancellationEvents.unshift({
                id: removed.id,
                dateKey: removed.dateKey,
                time: removed.time,
                studentName: removed.studentName || "",
                cancelledAt: new Date().toISOString(),
                isLastMinute: !isRefundable,
              });
              persistCancellationEvents();
            }

            if (isStudent && isRefundable) {
              appState.creditsRemaining = clampCredits(appState.creditsRemaining + 1, plan.creditsPerCycle);
              persistAppState();
            }

            scheduleState.selectedSlotId = "";
            scheduleState.selectedSlotLabel = "";
            scheduleState.isConfirmed = false;
            renderLiveScheduler();
            renderTeacherDashboard();
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

      const isStudent = currentRole === "student";
      const plan = getPlanDef(appState.planKey);
      const kind = plan.creditType === "GROUP" ? "GROUP" : "VIP";

      if (isStudent && appState.creditsRemaining <= 0) {
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
          ${isStudent ? "Isso consome 1 crédito." : ""}
        `,
        primaryLabel: "Confirmar agendamento",
        secondaryLabel: "Voltar",
        onPrimary: () => {
          if (isStudent && appState.creditsRemaining <= 0) {
            return false;
          }

          if (isStudent) {
            appState.creditsRemaining = clampCredits(appState.creditsRemaining - 1, plan.creditsPerCycle);
          }

          registerScheduledLesson({
            id: slotId,
            dateKey: parsed.dateKey,
            time: parsed.time,
            kind,
            title: "Aula ao vivo",
            teacher: "Professor(a) Space",
            studentName: greetingElement?.dataset.userName || "",
            durationMinutes: LESSON_DURATION_MINUTES,
            createdAt: new Date().toISOString(),
          });

          persistAppState();
          scheduleState.selectedSlotId = slotId;
          scheduleState.selectedSlotLabel = slotLabel;
          scheduleState.isConfirmed = true;
          renderLiveScheduler();
          renderTeacherDashboard();
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

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!workHoursDraft || !modalBody || modalOverlay?.hidden) return;

  if (target.matches("[data-wh-start], [data-wh-end]")) {
    const raw = target.getAttribute(target.matches("[data-wh-start]") ? "data-wh-start" : "data-wh-end") || "";
    const parsed = parseWorkKey(raw);
    if (!parsed) return;
    const entry = workHoursDraft[parsed.dayKey];
    if (!entry) return;
    if (!entry.windows[parsed.index]) return;
    if (target.matches("[data-wh-start]")) {
      entry.windows[parsed.index].start = target.value;
    } else {
      entry.windows[parsed.index].end = target.value;
    }
    validateWorkHoursDraft();
    return;
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!workHoursDraft || !modalBody || modalOverlay?.hidden) return;

  if (target.matches("[data-wh-enabled]")) {
    const dayKey = target.getAttribute("data-wh-enabled") || "";
    const entry = workHoursDraft[dayKey];
    if (!entry) return;
    entry.enabled = target.checked;
    validateWorkHoursDraft();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!createEventDraft || !modalBody || modalOverlay?.hidden) return;
  if (activeModalKind !== "event-form") return;
  if (createEventDraft.readOnly) return;

  if (target instanceof HTMLInputElement && target.matches("[data-ce-title]")) {
    createEventDraft.title = target.value;
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLInputElement && target.matches("[data-ce-date]")) {
    createEventDraft.dateKey = target.value;
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLInputElement && target.matches("[data-ce-start]")) {
    createEventDraft.startTime = target.value;
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLInputElement && target.matches("[data-ce-end]")) {
    createEventDraft.endTime = target.value;
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLTextAreaElement && target.matches("[data-ce-desc]")) {
    createEventDraft.description = target.value;
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLInputElement && target.matches("[data-ce-guest-search]")) {
    createEventDraft.guestQuery = target.value;
    syncGuestDropdown();
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!createEventDraft || !modalBody || modalOverlay?.hidden) return;
  if (activeModalKind !== "event-form") return;
  if (createEventDraft.readOnly) return;

  if (target.matches("[data-ce-doc-input]")) {
    const files = Array.from(target.files || []);
    target.value = "";
    if (!files.length) return;

    (async () => {
      for (const file of files) {
        const ext = guessExt(file.name);
        if (!acceptedDocExts.includes(ext)) continue;
        if (file.size > MAX_DOC_BYTES) continue;
        const id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const doc = { id, name: file.name, ext, type: file.type || "", size: file.size, dataUrl: "", loading: true };
        createEventDraft.documents.push(doc);
        validateCreateEventDraft();
        try {
          doc.dataUrl = await fileToDataUrl(file);
        } catch (error) {
          doc.dataUrl = "";
        } finally {
          doc.loading = false;
        }
      }

      const list = modalBody.querySelector("[data-ce-doc-list]");
      if (list instanceof HTMLElement) {
        list.innerHTML = (createEventDraft.documents || [])
          .map((doc) => {
            return `
              <div class="upload-file">
                <span class="upload-file-icon" aria-hidden="true">${getFileTypeIconSvg(doc.ext)}</span>
                <div>
                  <strong>${escapeHtml(doc.name)}</strong>
                  <span>${escapeHtml(`${formatBytes(doc.size)} · ${doc.ext.toUpperCase()}`)}</span>
                </div>
                <button class="upload-file-remove" type="button" data-ce-remove-doc="${escapeHtml(doc.id)}" aria-label="Remover documento">×</button>
              </div>
            `;
          })
          .join("");
      }

      validateCreateEventDraft();
    })();
  }
});

document.addEventListener("submit", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;

  if (!target.matches("[data-teacher-comment-form]")) return;
  event.preventDefault();

  const noticeItem = target.closest("[data-teacher-notice-id]");
  const noticeId = noticeItem?.getAttribute("data-teacher-notice-id") || "";
  if (!noticeId) return;

  const textarea = target.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) return;

  const text = textarea.value.trim();
  if (!text) return;

  const notices = loadTeacherNotices();
  const index = notices.findIndex((notice) => notice && notice.id === noticeId);
  if (index < 0) return;

  const notice = notices[index];
  const comments = Array.isArray(notice.comments) ? notice.comments : [];
  comments.push({
    id: `c_${Date.now().toString(36)}`,
    author: greetingElement?.dataset.userName || "Professor",
    text,
    createdAt: new Date().toISOString(),
  });
  notices[index] = { ...notice, comments };
  persistTeacherNotices(notices);

  textarea.value = "";
  renderTeacherNotices();

  // Keep the thread open after re-render.
  const refreshed = teacherNoticeList?.querySelector(`[data-teacher-notice-id="${CSS.escape(noticeId)}"]`);
  const refreshedThread = refreshed?.querySelector("[data-teacher-notice-thread]");
  if (refreshedThread instanceof HTMLElement) {
    refreshedThread.hidden = false;
  }
});

document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!createEventDraft || !modalBody || modalOverlay?.hidden) return;
  if (activeModalKind !== "event-form") return;
  if (createEventDraft.readOnly) return;
  if (target.matches("[data-ce-guest-search]")) {
    syncGuestDropdown();
  }
});

document.addEventListener("dragover", (event) => {
  if (!createEventDraft || !modalBody || modalOverlay?.hidden) return;
  if (activeModalKind !== "event-form") return;
  if (createEventDraft.readOnly) return;
  const zone = event.target instanceof Element ? event.target.closest("[data-ce-upload]") : null;
  if (!zone) return;
  event.preventDefault();
});

document.addEventListener("drop", (event) => {
  if (!createEventDraft || !modalBody || modalOverlay?.hidden) return;
  if (activeModalKind !== "event-form") return;
  if (createEventDraft.readOnly) return;
  const zone = event.target instanceof Element ? event.target.closest("[data-ce-upload]") : null;
  if (!zone) return;
  event.preventDefault();
  const dt = event.dataTransfer;
  if (!dt) return;
  const files = Array.from(dt.files || []);
  if (!files.length) return;
  const input = modalBody.querySelector("[data-ce-doc-input]");
  if (!(input instanceof HTMLInputElement)) return;
  // Trigger the same handler via a synthetic change: process files inline.
  (async () => {
    for (const file of files) {
      const ext = guessExt(file.name);
      if (!acceptedDocExts.includes(ext)) continue;
      if (file.size > MAX_DOC_BYTES) continue;
      const id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const doc = { id, name: file.name, ext, type: file.type || "", size: file.size, dataUrl: "", loading: true };
      createEventDraft.documents.push(doc);
      validateCreateEventDraft();
      try {
        doc.dataUrl = await fileToDataUrl(file);
      } catch (error) {
        doc.dataUrl = "";
      } finally {
        doc.loading = false;
      }
    }
    const list = modalBody.querySelector("[data-ce-doc-list]");
    if (list instanceof HTMLElement) {
      list.innerHTML = (createEventDraft.documents || [])
        .map((doc) => {
          return `
            <div class="upload-file">
              <span class="upload-file-icon" aria-hidden="true">${getFileTypeIconSvg(doc.ext)}</span>
              <div>
                <strong>${escapeHtml(doc.name)}</strong>
                <span>${escapeHtml(`${formatBytes(doc.size)} · ${doc.ext.toUpperCase()}`)}</span>
              </div>
              <button class="upload-file-remove" type="button" data-ce-remove-doc="${escapeHtml(doc.id)}" aria-label="Remover documento">×</button>
            </div>
          `;
        })
        .join("");
    }
    validateCreateEventDraft();
  })();
});

window.addEventListener("resize", syncSidebarMode);

setInterval(updateGreeting, 60000);
updateGreeting();

setInterval(() => {
  if (body.dataset.activePanel === "ao-vivo") {
    if (currentRole === "teacher") {
      renderTeacherCalendar();
    } else {
      renderLiveScheduler();
    }
    return;
  }

  if (currentRole === "teacher" && body.dataset.activePanel === "dashboard") {
    renderTeacherDashboard();
    return;
  }

  renderPlanUI();
}, 60000);
