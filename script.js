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
const dashboardAdmin = document.querySelector("[data-dashboard-admin]");
const adminDashboardGreeting = document.querySelector("[data-admin-dashboard-greeting]");
const adminDashboardMonth = document.querySelector("[data-admin-dashboard-month]");
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
const liveStudentRoot = document.querySelector("[data-live-student]");
const liveTeacherRoot = document.querySelector("[data-live-teacher]");
const liveSchedulerTimezone = document.querySelector("[data-live-timezone]");
const liveStudentLessonsList = document.querySelector("[data-live-student-lessons]");
const liveStudentEmpty = document.querySelector("[data-live-student-empty]");
const adminRescheduleList = document.querySelector("[data-admin-reschedule-list]");
const adminRescheduleEmpty = document.querySelector("[data-admin-reschedule-empty]");
const adminUserForm = document.querySelector("[data-admin-user-form]");
const adminUserName = document.querySelector("[data-admin-user-name]");
const adminUserEmail = document.querySelector("[data-admin-user-email]");
const adminUserPassword = document.querySelector("[data-admin-user-password]");
const adminUserRole = document.querySelector("[data-admin-user-role]");
const adminUserNameError = document.querySelector("[data-admin-user-name-error]");
const adminUserEmailError = document.querySelector("[data-admin-user-email-error]");
const adminUserPasswordError = document.querySelector("[data-admin-user-password-error]");
const adminUserSubmit = document.querySelector("[data-admin-user-submit]");
const adminUserSubmitLabel = document.querySelector("[data-admin-user-submit-label]");
const adminUserSpinner = document.querySelector("[data-admin-user-spinner]");
const adminUserStatus = document.querySelector("[data-admin-user-status]");
const adminNewUserButtons = document.querySelectorAll("[data-admin-new-user]");
const adminSearchInputs = document.querySelectorAll("[data-admin-search]");
const adminManageStatusTeacher = document.querySelector('[data-admin-manage-status="teacher"]');
const adminManageStatusStudent = document.querySelector('[data-admin-manage-status="student"]');
const adminManageStatusGrowth = document.querySelector('[data-admin-manage-status="growth"]');
const adminUsersTableTeacher = document.querySelector('[data-admin-users-table="teacher"]');
const adminUsersTableStudent = document.querySelector('[data-admin-users-table="student"]');
const adminUsersTableGrowth = document.querySelector('[data-admin-users-table="growth"]');
const adminUsersEmptyTeacher = document.querySelector('[data-admin-users-empty="teacher"]');
const adminUsersEmptyStudent = document.querySelector('[data-admin-users-empty="student"]');
const adminUsersEmptyGrowth = document.querySelector('[data-admin-users-empty="growth"]');
const adminUsersErrorTeacher = document.querySelector('[data-admin-users-error="teacher"]');
const adminUsersErrorStudent = document.querySelector('[data-admin-users-error="student"]');
const adminUsersErrorGrowth = document.querySelector('[data-admin-users-error="growth"]');
const adminGrowthGoalOpen = document.querySelector("[data-admin-growth-goal-open]");
const adminGoalsTable = document.querySelector("[data-admin-goals-table]");
const adminGoalsEmpty = document.querySelector("[data-admin-goals-empty]");
const adminGoalsError = document.querySelector("[data-admin-goals-error]");
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

// Student dashboard v5 (new home screen for students).
const studentV5Greeting = document.querySelector("[data-student-v5-greeting]");
const studentV5Date = document.querySelector("[data-student-v5-date]");
const studentV5Plan = document.querySelector("[data-student-v5-plan]");
const studentV5Avatar = document.querySelector("[data-student-v5-avatar]");
const studentV5LessonsList = document.querySelector("[data-student-v5-lessons]");
const studentV5LessonsEmpty = document.querySelector("[data-student-v5-lessons-empty]");
const studentV5Level = document.querySelector("[data-student-v5-level]");
const studentV5LevelBar = document.querySelector("[data-student-v5-level-bar]");
const studentV5LevelSub = document.querySelector("[data-student-v5-level-sub]");
const studentV5Streak = document.querySelector("[data-student-v5-streak]");
const studentV5StreakRecord = document.querySelector("[data-student-v5-streak-record]");
const studentV5Hours = document.querySelector("[data-student-v5-hours]");
const studentV5HoursDelta = document.querySelector("[data-student-v5-hours-delta]");
const studentV5LessonsDone = document.querySelector("[data-student-v5-lessons-done]");
const studentV5TeacherAvatar = document.querySelector("[data-student-v5-teacher-avatar]");
const studentV5TeacherName = document.querySelector("[data-student-v5-teacher-name]");
const studentV5TeacherSpec = document.querySelector("[data-student-v5-teacher-spec]");
const studentV5TeacherClasses = document.querySelector("[data-student-v5-teacher-classes]");
const studentV5TeacherMonths = document.querySelector("[data-student-v5-teacher-months]");
const studentV5TeacherRating = document.querySelector("[data-student-v5-teacher-rating]");
const studentV5Path = document.querySelector("[data-student-v5-path]");
const studentV5Recs = document.querySelector("[data-student-v5-recs]");
const studentV5RecsEmpty = document.querySelector("[data-student-v5-recs-empty]");
const studentV5NpsCard = document.querySelector("[data-student-v5-nps-card]");
const studentV5NpsSurvey = document.querySelector("[data-student-v5-nps-survey]");
const studentV5NpsScale = document.querySelector("[data-student-v5-nps-scale]");
const studentV5NpsTone = document.querySelector("[data-student-v5-nps-tone]");
const studentV5NpsComment = document.querySelector("[data-student-v5-nps-comment]");
const studentV5NpsSubmit = document.querySelector("[data-student-v5-nps-submit]");
const studentV5NpsFeedback = document.querySelector("[data-student-v5-nps-feedback]");
const studentV5NpsThanks = document.querySelector("[data-student-v5-nps-thanks]");
const studentV5NpsLastScore = document.querySelector("[data-student-v5-nps-last-score]");

// Teacher dashboard v4 (new home screen for teachers).
const teacherV4Greeting = document.querySelector("[data-teacher-v4-greeting]");
const teacherV4Date = document.querySelector("[data-teacher-v4-date]");
const teacherV4Rating = document.querySelector("[data-teacher-v4-rating]");
const teacherV4Avatar = document.querySelector("[data-teacher-v4-avatar]");
const teacherV4NextTop = document.querySelector("[data-teacher-v4-next-top]");
const teacherV4NextGrid = document.querySelector("[data-teacher-v4-next-grid]");
const teacherV4NextEmpty = document.querySelector("[data-teacher-v4-next-empty]");
const teacherV4NextMinutes = document.querySelector("[data-teacher-v4-next-minutes]");
const teacherV4NextTime = document.querySelector("[data-teacher-v4-next-time]");
const teacherV4StudentAvatar = document.querySelector("[data-teacher-v4-student-avatar]");
const teacherV4StudentName = document.querySelector("[data-teacher-v4-student-name]");
const teacherV4StudentMeta = document.querySelector("[data-teacher-v4-student-meta]");
const teacherV4StudentProfile = document.querySelector("[data-teacher-v4-student-profile]");
const teacherV4StudentGoal = document.querySelector("[data-teacher-v4-student-goal]");
const teacherV4PlanTheme = document.querySelector("[data-teacher-v4-plan-theme]");
const teacherV4PlanTopics = document.querySelector("[data-teacher-v4-plan-topics]");
const teacherV4PlanMaterial = document.querySelector("[data-teacher-v4-plan-material]");
const teacherV4PlanMaterialTitle = document.querySelector("[data-teacher-v4-plan-material-title]");
const teacherV4LastMeta = document.querySelector("[data-teacher-v4-last-meta]");
const teacherV4LastTheme = document.querySelector("[data-teacher-v4-last-theme]");
const teacherV4LastNotes = document.querySelector("[data-teacher-v4-last-notes]");
const teacherV4LastTags = document.querySelector("[data-teacher-v4-last-tags]");
const teacherV4TodayCount = document.querySelector("[data-teacher-v4-today-count]");
const teacherV4TodaySub = document.querySelector("[data-teacher-v4-today-sub]");
const teacherV4MonthHours = document.querySelector("[data-teacher-v4-month-hours]");
const teacherV4MonthDelta = document.querySelector("[data-teacher-v4-month-delta]");
const teacherV4StudentsCount = document.querySelector("[data-teacher-v4-students-count]");
const teacherV4Timeline = document.querySelector("[data-teacher-v4-timeline]");
const teacherV4TimelineEmpty = document.querySelector("[data-teacher-v4-timeline-empty]");
const teacherV4WeekGrid = document.querySelector("[data-teacher-v4-weekgrid]");
const teacherV4WeekTotal = document.querySelector("[data-teacher-v4-week-total]");
const teacherV4PendingCount = document.querySelector("[data-teacher-v4-pending-count]");
const teacherV4PendingList = document.querySelector("[data-teacher-v4-pending-list]");
const teacherV4PendingEmpty = document.querySelector("[data-teacher-v4-pending-empty]");
const teacherV4PresenceValue = document.querySelector("[data-teacher-v4-presence]");
const teacherV4PresencePill = document.querySelector("[data-teacher-v4-presence-pill]");
const teacherV4PresenceBar = document.querySelector("[data-teacher-v4-presence-bar]");
const teacherV4ReviewsCount = document.querySelector("[data-teacher-v4-reviews-count]");
const teacherV4ReviewsStars = document.querySelector("[data-teacher-v4-reviews-stars]");
const teacherV4ReviewsAverage = document.querySelector("[data-teacher-v4-reviews-average]");
const teacherV4OccupancyValue = document.querySelector("[data-teacher-v4-occupancy]");
const teacherV4OccupancyPill = document.querySelector("[data-teacher-v4-occupancy-pill]");
const teacherV4OccupancyBar = document.querySelector("[data-teacher-v4-occupancy-bar]");
const teacherV4NoticesList = document.querySelector("[data-teacher-v4-notices]");
const teacherV4NoticesEmpty = document.querySelector("[data-teacher-v4-notices-empty]");

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
let studentLessonsState = {
  isLoading: false,
  lastLoadedAt: 0,
  lessons: [],
};

let studentV5DashboardState = {
  isLoading: false,
  loadedAt: 0,
  alunoId: "",
  userData: null,
  aulas: [],
  avaliacoes: [],
  recomendacoes: [],
  teacherId: "",
  teacherData: null,
  lastNps: null,
  npsCooldownUntilMs: 0,
};

let studentV5NpsDraft = {
  score: null,
  isSubmitting: false,
};

let teacherV4DashboardState = {
  isLoading: false,
  loadedAt: 0,
  teacherId: "",
  aulas: [],
  avaliacoes: [],
  avisos: [],
  reagendamentos: [],
  workHours: null,
  nextLessonId: "",
  nextLessonStartMs: 0,
  refreshTimer: 0,
};

const STORAGE_KEY = "space-platform-state-v1";
const TEACHER_NOTICES_STORAGE_KEY = "space-platform-teacher-notices-v1";
const TEACHER_NOTICE_READ_KEY = "space-platform-teacher-notices-read-v1";
const TEACHER_CAL_EVENTS_STORAGE_KEY = "space-platform-teacher-calendar-events-v1";
const TEACHER_WORK_HOURS_STORAGE_KEY = "space-platform-teacher-work-hours-v1";
const STAFF_USERS_STORAGE_KEY = "space-platform-staff-users-v1";
const CREDIT_CYCLE_BUSINESS_DAYS = 6;
const LESSON_DURATION_MINUTES = 30;

const PLAN_DEFS = {
  gold: { label: "Gold", creditsPerCycle: 3, creditType: "VIP", badgeClass: "is-gold", badgeDot: "ambar" },
  diamond: { label: "Diamond", creditsPerCycle: 5, creditType: "VIP", badgeClass: "is-diamond", badgeDot: "azul" },
  turma: { label: "Turma", creditsPerCycle: 4, creditType: "GROUP", badgeClass: "is-turma", badgeDot: "verde" },
};

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

const clearPlatformStorage = () => {
  if (!safeStorage) return;
  const keys = [
    STORAGE_KEY,
    TEACHER_NOTICES_STORAGE_KEY,
    TEACHER_NOTICE_READ_KEY,
    TEACHER_CAL_EVENTS_STORAGE_KEY,
    TEACHER_WORK_HOURS_STORAGE_KEY,
    STAFF_USERS_STORAGE_KEY,
  ];

  keys.forEach((key) => {
    try {
      safeStorage.removeItem(key);
    } catch (error) {
      // ignore
    }
  });
};

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
    dashboardStudent.hidden = currentRole !== "student";
  }

  if (dashboardAdmin) {
    dashboardAdmin.hidden = currentRole !== "admin";
  }

  if (liveTeacherRoot) {
    liveTeacherRoot.hidden = currentRole !== "teacher" && currentRole !== "admin";
  }

  if (liveStudentRoot) {
    liveStudentRoot.hidden = currentRole !== "student";
  }

  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    if (el instanceof HTMLElement) {
      el.hidden = currentRole !== "admin";
    }
  });

  const teacherWorkHoursBtn = document.querySelector("[data-teacher-work-hours]");
  if (teacherWorkHoursBtn instanceof HTMLElement) {
    teacherWorkHoursBtn.hidden = currentRole === "admin";
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
    } else if (currentRole === "admin") {
      renderAdminDashboard();
    } else {
      renderStudentDashboard();
    }
  }

  if (body.dataset.activePanel === "ao-vivo") {
    if (currentRole === "teacher" || currentRole === "admin") {
      renderTeacherCalendar();
    } else {
      renderStudentLiveLessons();
    }
  }
};

const getPlanDef = (planKey) => PLAN_DEFS[planKey] || PLAN_DEFS.gold;

const clampCredits = (value, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(Math.floor(parsed), max));
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
  const payload = { ...appState };

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

let modalPrimaryHandler = null;
let modalSecondaryHandler = null;
let modalTrashHandler = null;
let activeModalKind = "";
let createEventDraft = null;
let teacherCalSelection = null;
let teacherCalDrag = null;
let teacherEventsState = {
  events: [],
  isLoading: false,
  rangeKey: "",
  lastLoadedAt: 0,
};

let adminRescheduleState = {
  requests: [],
  isLoading: false,
  lastLoadedAt: 0,
};

let teacherWorkHoursApiState = {
  isLoading: false,
  lastLoadedAt: 0,
};

const clearTeacherCalendarSelection = () => {
  if (teacherCalSelection?.el instanceof HTMLElement) {
    teacherCalSelection.el.remove();
  }
  teacherCalSelection = null;
  teacherCalDrag = null;
  body.classList.remove("is-cal-dragging");
};

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
  clearTeacherCalendarSelection();
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

const renderAdminDashboard = () => {
  if (currentRole !== "admin") return;

  const now = new Date();
  const hour = now.getHours();
  let greeting = "Boa noite";

  if (hour >= 5 && hour < 12) {
    greeting = "Bom dia";
  } else if (hour >= 12 && hour < 18) {
    greeting = "Boa tarde";
  }

  const name =
    sessionUser && sessionUser.role === "admin"
      ? sessionUser.name
      : ROLE_DEFS.admin.defaultName || "Admin";

  if (adminDashboardGreeting) {
    adminDashboardGreeting.textContent = `${greeting}, ${name}.`;
  }

  if (adminDashboardMonth) {
    const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" });
    const monthRaw = monthFormatter.format(now);
    const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
    adminDashboardMonth.textContent = `${month} ${now.getFullYear()}`;
  }
};

const STUDENT_V5_LEVELS = ["Pré A1", "A1", "A1+", "A2", "A2+", "B1", "B1+", "B2", "B2+", "C1", "C2"];
const STUDENT_V5_WEEKDAY_ABBR = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const normalizeStudentLevelKey = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace("pré", "pre");
};

const levelIndexFromValue = (raw) => {
  const key = normalizeStudentLevelKey(raw);
  if (!key) return -1;
  return STUDENT_V5_LEVELS.findIndex((lvl) => normalizeStudentLevelKey(lvl) === key);
};

const formatStudentLongDate = (date) => {
  try {
    const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    const raw = fmt.format(date);
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
  } catch (error) {
    return "";
  }
};

const parseFirestoreDateToMs = (value) => {
  if (!value) return 0;
  try {
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toDate === "function") {
      const d = value.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    }
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  } catch (error) {
    return 0;
  }
};

const isCancelledStatus = (status) => {
  const s = String(status || "").trim().toLowerCase();
  return s === "cancelada" || s === "cancelado" || s === "cancelled" || s === "canceled";
};

const isDoneStatus = (status) => {
  const s = String(status || "").trim().toLowerCase();
  return s === "realizada" || s === "concluida" || s === "concluído" || s === "concluída" || s === "concluido";
};

const calcStreakFromDateKeys = (dateKeys, referenceDate = new Date()) => {
  const set = new Set((Array.isArray(dateKeys) ? dateKeys : []).filter(Boolean));
  if (!set.size) return { current: 0, record: 0 };

  const toKey = (d) => createDateKey(d);

  const ref = startOfDay(referenceDate);
  let current = 0;
  for (let i = 0; i < 365; i += 1) {
    const cursor = new Date(ref);
    cursor.setDate(ref.getDate() - i);
    const key = toKey(cursor);
    if (!set.has(key)) break;
    current += 1;
  }

  let record = 0;
  const sorted = [...set].sort();
  let streak = 0;
  let prev = null;
  sorted.forEach((key) => {
    const date = parseDateKey(key);
    if (!date) return;
    if (!prev) {
      streak = 1;
      record = Math.max(record, streak);
      prev = date;
      return;
    }
    const next = new Date(prev);
    next.setDate(prev.getDate() + 1);
    if (createDateKey(next) === key) {
      streak += 1;
    } else {
      streak = 1;
    }
    record = Math.max(record, streak);
    prev = date;
  });

  return { current, record };
};

const ensureStudentV5NpsScale = () => {
  if (!(studentV5NpsScale instanceof HTMLElement)) return;
  if (studentV5NpsScale.childElementCount) return;

  studentV5NpsScale.innerHTML = Array.from({ length: 11 })
    .map((_, idx) => `<button class="student-v5-nps-btn" type="button" data-student-v5-nps-score="${idx}">${idx}</button>`)
    .join("");
};

const syncStudentV5NpsScaleUI = () => {
  if (!(studentV5NpsScale instanceof HTMLElement)) return;
  const score = studentV5NpsDraft.score;
  const buttons = [...studentV5NpsScale.querySelectorAll("[data-student-v5-nps-score]")];
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const value = Number(btn.getAttribute("data-student-v5-nps-score"));
    btn.classList.remove("is-bad", "is-mid", "is-good");
    if (!Number.isFinite(score) || !Number.isFinite(value)) return;
    if (value > score) return;
    if (score <= 6) btn.classList.add("is-bad");
    else if (score <= 8) btn.classList.add("is-mid");
    else btn.classList.add("is-good");
  });

  if (studentV5NpsSubmit instanceof HTMLButtonElement) {
    studentV5NpsSubmit.disabled = !Number.isFinite(score) || studentV5NpsDraft.isSubmitting;
  }

  if (studentV5NpsTone instanceof HTMLElement) {
    if (!Number.isFinite(score)) {
      studentV5NpsTone.hidden = true;
      studentV5NpsTone.textContent = "";
    } else {
      const tone = (() => {
        if (score <= 2) return "Péssima";
        if (score <= 4) return "Muito ruim";
        if (score <= 6) return "Ruim";
        if (score === 7) return "Razoável";
        if (score === 8) return "Boa";
        if (score === 9) return "Ótima";
        return "Excelente!";
      })();
      studentV5NpsTone.hidden = false;
      studentV5NpsTone.textContent = tone;
    }
  }
};

const openStudentTeacherChangeModal = ({ alunoId, professorId, professorNome }) => {
  if (!alunoId || !professorId) return;

  openModal({
    title: "Solicitar troca de professor",
    bodyHtml: `
      <div class="modal-form">
        <div class="modal-inline-note">Professor atual: <strong>${escapeHtml(professorNome || "Professor")}</strong></div>
        <div class="modal-field">
          <span style="display:block; font-weight:800; margin-bottom:10px;">Motivo</span>
          <div class="modal-radio" data-teacher-change-reasons>
            ${[
              "Não me adapto ao estilo de ensino",
              "Prefiro outro horário que este professor não tem",
              "Quero experimentar outro professor",
              "Dificuldade de comunicação",
              "Outro motivo",
            ]
              .map(
                (label, idx) => `
                <label class="modal-radio-option">
                  <input type="radio" name="teacherChangeReason" value="${escapeHtml(label)}" ${idx === 0 ? "checked" : ""} />
                  <span>${escapeHtml(label)}</span>
                </label>
              `
              )
              .join("")}
          </div>
        </div>
        <label class="modal-field">
          <span>Comentário (opcional)</span>
          <textarea class="modal-textarea" data-teacher-change-comment placeholder="Se quiser, conte mais detalhes..."></textarea>
        </label>
        <div class="modal-inline-error" data-teacher-change-error hidden></div>
      </div>
    `,
    primaryLabel: "Enviar solicitação",
    secondaryLabel: "Cancelar",
    hideSecondary: false,
    showTrash: false,
    onPrimary: () => {
      const reasons = modalBody?.querySelector('input[name="teacherChangeReason"]:checked');
      const commentEl = modalBody?.querySelector("[data-teacher-change-comment]");
      const errEl = modalBody?.querySelector("[data-teacher-change-error]");
      const motivo = reasons instanceof HTMLInputElement ? reasons.value.trim() : "";
      const comentario = commentEl instanceof HTMLTextAreaElement ? commentEl.value.trim() : "";

      if (errEl instanceof HTMLElement) {
        errEl.hidden = true;
        errEl.textContent = "";
      }

      if (!motivo) {
        if (errEl instanceof HTMLElement) {
          errEl.hidden = false;
          errEl.textContent = "Selecione um motivo para continuar.";
        }
        return false;
      }

      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;

      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
          const docRef = firebase.doc(firebase.collection(firebase.primaryDb, "trocaProfessor"));
          await withTimeout(
            firebase.setDoc(docRef, {
              alunoId,
              professorAtualId: professorId,
              motivo,
              comentario,
              status: "pendente",
              criadoEm: firebase.serverTimestamp(),
            }),
            12_000,
            "student_teacher_change_save"
          );
          closeModal();
        } catch (error) {
          console.error("[student] teacher change request failed:", error);
          if (errEl instanceof HTMLElement) {
            errEl.hidden = false;
            errEl.textContent = "Não foi possível enviar agora. Tente novamente.";
          }
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
        }
      })();

      return false;
    },
  });
};

const renderStudentDashboard = () => {
  if (currentRole !== "student") return;
  if (!(dashboardStudent instanceof HTMLElement)) return;

  const now = new Date();
  const hour = now.getHours();
  let greeting = "Boa noite";
  if (hour >= 6 && hour < 12) greeting = "Bom dia";
  else if (hour >= 12 && hour < 18) greeting = "Boa tarde";

  const studentName =
    sessionUser && sessionUser.role === "student" ? sessionUser.name : ROLE_DEFS.student?.defaultName || "Aluno";

  if (studentV5Greeting instanceof HTMLElement) {
    studentV5Greeting.textContent = `${greeting}, ${studentName}.`;
  }
  if (studentV5Date instanceof HTMLElement) {
    studentV5Date.textContent = formatStudentLongDate(now);
  }
  if (studentV5Avatar instanceof HTMLElement) {
    studentV5Avatar.textContent = getInitials(studentName);
  }
  if (studentV5Plan instanceof HTMLElement) {
    studentV5Plan.textContent = "Plano Gold ativo";
  }

  ensureStudentV5NpsScale();

  const renderFromCache = () => {
    const userData = studentV5DashboardState.userData && typeof studentV5DashboardState.userData === "object" ? studentV5DashboardState.userData : {};
    const nivel = typeof userData.nivel === "string" ? userData.nivel.trim() : "";
    const progressRaw = Number(userData.progressoNivel);
    const progressPct = Number.isFinite(progressRaw) ? (progressRaw > 1 ? clampNumber(progressRaw, 0, 100) : clampNumber(progressRaw * 100, 0, 100)) : 0;

    if (studentV5Level instanceof HTMLElement) studentV5Level.textContent = nivel || "—";
    if (studentV5LevelBar instanceof HTMLElement) studentV5LevelBar.style.width = `${progressPct}%`;
    if (studentV5LevelSub instanceof HTMLElement) {
      studentV5LevelSub.textContent = nivel ? `${Math.round(progressPct)}% concluído` : "—";
    }

    const aulas = Array.isArray(studentV5DashboardState.aulas) ? studentV5DashboardState.aulas : [];
    const done = aulas.filter((a) => a && !isCancelledStatus(a.status) && isDoneStatus(a.status));
    const doneMinutes = done.reduce((acc, a) => acc + Math.max(0, (a.endMin || 0) - (a.startMin || 0)), 0);
    const totalHours = doneMinutes / 60;

    if (studentV5Hours instanceof HTMLElement) studentV5Hours.textContent = done.length ? formatHours(totalHours) : "0h";

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthMinutes = done
      .filter((a) => a.startMs && a.startMs >= monthStart.getTime() && a.startMs <= monthEnd.getTime())
      .reduce((acc, a) => acc + Math.max(0, (a.endMin || 0) - (a.startMin || 0)), 0);
    if (studentV5HoursDelta instanceof HTMLElement) {
      studentV5HoursDelta.textContent = `+${formatHours(monthMinutes / 60)} este mês`;
    }

    if (studentV5LessonsDone instanceof HTMLElement) studentV5LessonsDone.textContent = String(done.length);

    const activeDays = done.map((a) => a.dateKey).filter(Boolean);
    const streakData = calcStreakFromDateKeys(activeDays, now);
    if (studentV5Streak instanceof HTMLElement) studentV5Streak.textContent = String(streakData.current);
    if (studentV5StreakRecord instanceof HTMLElement) studentV5StreakRecord.textContent = `Recorde: ${streakData.record} dias`;

    // Upcoming lessons (top card): reuse the same state used in "Aulas ao vivo" so reschedule works everywhere.
    const lessons = Array.isArray(studentLessonsState.lessons) ? studentLessonsState.lessons : [];
    const next3 = lessons.slice(0, 3);
    if (studentV5LessonsEmpty instanceof HTMLElement) studentV5LessonsEmpty.hidden = next3.length > 0;
    if (studentV5LessonsList instanceof HTMLElement) {
      studentV5LessonsList.innerHTML = next3
        .map((lesson, idx) => {
          const date = parseDateKey(lesson.dateKey);
          const day = date ? date.getDate() : 0;
          const dow = date ? date.getDay() : 0;
          const abbr = STUDENT_V5_WEEKDAY_ABBR[dow] || "";
          const timeLabel = `${formatHmFromMinutes(lesson.startMin)} — ${formatHmFromMinutes(lesson.endMin)}`;
          const prof = lesson.professor || "Professor";

          const badge = (() => {
            if (idx !== 0 || !date) return "";
            const start = new Date(date);
            start.setMinutes(lesson.startMin);
            const diffDays = Math.max(0, Math.round((startOfDay(start).getTime() - startOfDay(now).getTime()) / 86400000));
            const label = diffDays === 0 ? "Hoje" : diffDays === 1 ? "Amanhã" : `Em ${diffDays} dias`;
            return `<span class="student-v5-lesson-badge">${escapeHtml(label)}</span>`;
          })();

          const action = (() => {
            if (idx === 0) return badge;
            const req = lesson.request;
            const disabled = req && String(req.status || "").toLowerCase() === "pendente";
            const statusPill = req ? `<span class="${statusClassForRequest(req.status)}">${escapeHtml(statusLabelForRequest(req.status))}</span>` : "";
            return `
              <div class="student-v5-lesson-actions">
                ${statusPill}
                <button class="student-v5-lesson-link" type="button" data-live-reschedule="${escapeHtml(lesson.id)}" ${disabled ? "disabled" : ""}>
                  Reagendar
                </button>
              </div>
            `;
          })();

          return `
            <li class="student-v5-lesson ${idx === 0 ? "is-primary" : ""}">
              <div class="student-v5-lesson-left">
                <div class="student-v5-lesson-datechip" aria-hidden="true">
                  <strong>${day ? String(day).padStart(2, "0") : "—"}</strong>
                  <span>${escapeHtml(abbr)}</span>
                </div>
                <div class="student-v5-lesson-meta">
                  <span class="student-v5-lesson-time">${escapeHtml(timeLabel)}</span>
                  <span class="student-v5-lesson-prof">${escapeHtml(prof)}</span>
                </div>
              </div>
              ${idx === 0 ? `<div class="student-v5-lesson-actions">${badge}</div>` : action}
            </li>
          `;
        })
        .join("");
    }

    // Teacher card: inferred from the next lesson (if any).
    const teacherName = studentV5DashboardState.teacherData?.nome || lessons[0]?.professor || "";
    if (studentV5TeacherName instanceof HTMLElement) {
      studentV5TeacherName.textContent = teacherName || "Nenhuma informação cadastrada";
      studentV5TeacherName.classList.toggle("is-placeholder", !teacherName);
    }
    if (studentV5TeacherAvatar instanceof HTMLElement) {
      studentV5TeacherAvatar.textContent = teacherName ? getInitials(teacherName) : "—";
    }
    const teacherSpec =
      (studentV5DashboardState.teacherData && (studentV5DashboardState.teacherData.especialidade || studentV5DashboardState.teacherData.specialty)) ||
      (teacherName ? "Professora particular" : "");
    if (studentV5TeacherSpec instanceof HTMLElement) {
      studentV5TeacherSpec.textContent = teacherSpec || "Nenhuma informação cadastrada";
      studentV5TeacherSpec.classList.toggle("is-placeholder", !teacherSpec);
    }

    const teacherId = studentV5DashboardState.teacherId;
    const aulasTeacher = teacherId ? aulas.filter((a) => a && a.professorId === teacherId && !isCancelledStatus(a.status)) : [];
    if (studentV5TeacherClasses instanceof HTMLElement) studentV5TeacherClasses.textContent = String(aulasTeacher.length || 0);
    if (studentV5TeacherMonths instanceof HTMLElement) {
      const first = aulasTeacher
        .filter((a) => a.startMs)
        .sort((a, b) => (a.startMs || 0) - (b.startMs || 0))[0];
      if (first && first.startMs) {
        const firstDate = new Date(first.startMs);
        const months = (now.getFullYear() * 12 + now.getMonth()) - (firstDate.getFullYear() * 12 + firstDate.getMonth()) + 1;
        studentV5TeacherMonths.textContent = String(Math.max(1, months));
      } else {
        studentV5TeacherMonths.textContent = "—";
      }
    }

    if (studentV5TeacherRating instanceof HTMLElement) {
      const evals = Array.isArray(studentV5DashboardState.avaliacoes) ? studentV5DashboardState.avaliacoes : [];
      const relevant = teacherId ? evals.filter((e) => e && e.professorId === teacherId && Number.isFinite(e.score10)) : [];
      const avg = relevant.length ? relevant.reduce((acc, e) => acc + (Number(e.score10) || 0), 0) / relevant.length : null;
      studentV5TeacherRating.textContent = avg == null ? "—" : String(Math.round(avg * 10) / 10).replace(".", ",");
    }

    // NPS (90 days cooldown).
    const cooldownActive = Boolean(studentV5DashboardState.lastNps && studentV5DashboardState.npsCooldownUntilMs > now.getTime());
    if (studentV5NpsSurvey instanceof HTMLElement) studentV5NpsSurvey.hidden = cooldownActive;
    if (studentV5NpsThanks instanceof HTMLElement) studentV5NpsThanks.hidden = !cooldownActive;
    if (cooldownActive && studentV5NpsLastScore instanceof HTMLElement) {
      studentV5NpsLastScore.textContent = String(studentV5DashboardState.lastNps?.nota ?? "—");
    }
    if (!cooldownActive) {
      syncStudentV5NpsScaleUI();
    }

    // Learning path.
    if (studentV5Path instanceof HTMLElement) {
      const idx = levelIndexFromValue(nivel);
      const currentIdx = idx >= 0 ? idx : 0;
      const fillPct = Math.round(progressPct);
      studentV5Path.innerHTML = STUDENT_V5_LEVELS.map((label, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;
        const cls = isCurrent ? "is-current" : isFuture ? "is-future" : "";
        const doneOpacity = isDone ? 0.15 + (0.2 * i) / Math.max(1, currentIdx) : 0;
        const fillHeight = isDone ? 100 : isCurrent ? fillPct : 0;
        const fillColor = isDone
          ? `rgba(93,202,165,${doneOpacity.toFixed(3)})`
          : isCurrent
            ? "linear-gradient(180deg, rgba(255,78,70,0.95) 0%, rgba(255,78,70,0.55) 100%)"
            : "transparent";
        const fillStyle = `height:${fillHeight}%; background:${fillColor};`;
        const badge = isCurrent && nivel ? `<div class="student-v5-path-badge">${fillPct}%</div>` : "";
        return `
          <div class="student-v5-path-item">
            <div class="student-v5-path-bar ${cls}">
              <div class="student-v5-path-fill" style="${fillStyle}"></div>
              ${badge}
            </div>
            <div class="student-v5-path-label">${escapeHtml(label)}</div>
          </div>
        `;
      }).join("");
    }

    // Recommendations.
    const recs = Array.isArray(studentV5DashboardState.recomendacoes) ? studentV5DashboardState.recomendacoes : [];
    const top3 = recs.slice(0, 3);
    if (studentV5RecsEmpty instanceof HTMLElement) studentV5RecsEmpty.hidden = top3.length > 0;
    if (studentV5Recs instanceof HTMLElement) {
      studentV5Recs.innerHTML = top3
        .map((rec, idx) => {
          const rawTag = String(rec.tag || "").trim().toUpperCase();
          const tag = rawTag || (idx === 1 ? "LISTENING" : idx === 2 ? "REVIEW" : "SPEAKING");
          const cls = tag.includes("LISTEN") ? "is-listening" : tag.includes("REVIEW") || tag.includes("REVIS") ? "is-review" : "is-speaking";
          const text = rec.text || "Nenhuma informação cadastrada";
          return `
            <div class="student-v5-rec">
              <div class="student-v5-rec-tag ${cls}">${escapeHtml(tag)}</div>
              <p class="student-v5-rec-text">${escapeHtml(text)}</p>
            </div>
          `;
        })
        .join("");
    }
  };

  renderFromCache();

  const nowMs = now.getTime();
  const studentId = sessionUser && sessionUser.role === "student" ? sessionUser.id : "";
  const shouldReload = !studentV5DashboardState.loadedAt || nowMs - studentV5DashboardState.loadedAt > 20_000 || studentV5DashboardState.alunoId !== studentId;

  if (!shouldReload || studentV5DashboardState.isLoading) return;
  studentV5DashboardState.isLoading = true;

  (async () => {
    try {
      const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
      const user = await waitForFirebaseAuthReady(firebase, 5000);
      if (!user) throw new Error("auth/no-current-user");

      const alunoId = studentId || String(user.uid || "");
      studentV5DashboardState.alunoId = alunoId;

      // Refresh shared lessons state (used by "Aulas ao vivo" and dashboard quick actions).
      await renderStudentLiveLessons({ force: true });

      // User document (nivel / progresso / etc).
      try {
        const snap = firebase.getDoc ? await withTimeout(firebase.getDoc(firebase.doc(firebase.primaryDb, "users", alunoId)), 10_000, "student_v5_user") : null;
        studentV5DashboardState.userData = snap && typeof snap.data === "function" ? snap.data() : null;
      } catch (error) {
        studentV5DashboardState.userData = null;
      }

      // All lessons for metrics (completed count, hours, streak, teacher inference).
      try {
        const snap = await withTimeout(
          firebase.getDocs(firebase.query(firebase.collection(firebase.primaryDb, "aulas"), firebase.where("alunoId", "==", alunoId))),
          12_000,
          "student_v5_aulas"
        );
        const aulas = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data ? docSnap.data() : null;
          if (!data || typeof data !== "object") return;
          const professorId = typeof data.professorId === "string" ? data.professorId.trim() : "";
          const dateKey = typeof data.dateKey === "string" ? data.dateKey.trim() : "";
          const startMin = Number.isFinite(Number(data.startMin)) ? clampNumber(data.startMin, 0, 1440) : timeToMinutes(data.horaInicio);
          const endMin = Number.isFinite(Number(data.endMin)) ? clampNumber(data.endMin, 0, 1440) : timeToMinutes(data.horaFim);
          if (!dateKey || !Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return;
          const startDate = parseDateKey(dateKey);
          const startMs = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0).getTime() + startMin * 60000 : 0;
          const endMs = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0).getTime() + endMin * 60000 : 0;
          aulas.push({
            professorId,
            dateKey,
            startMin,
            endMin,
            startMs,
            endMs,
            status: String(data.status || "").trim().toLowerCase() || "agendada",
          });
        });
        studentV5DashboardState.aulas = aulas;
      } catch (error) {
        studentV5DashboardState.aulas = [];
      }

      // Teacher inference (use the next scheduled lesson if available).
      const lessons = Array.isArray(studentLessonsState.lessons) ? studentLessonsState.lessons : [];
      const inferredTeacherId = lessons[0] && lessons[0].professorId ? String(lessons[0].professorId) : "";
      studentV5DashboardState.teacherId = inferredTeacherId;
      studentV5DashboardState.teacherData = null;
      if (inferredTeacherId) {
        try {
          const snap = firebase.getDoc ? await withTimeout(firebase.getDoc(firebase.doc(firebase.primaryDb, "users", inferredTeacherId)), 10_000, "student_v5_teacher") : null;
          studentV5DashboardState.teacherData = snap && typeof snap.data === "function" ? snap.data() : null;
        } catch (error) {
          studentV5DashboardState.teacherData = null;
        }
      }

      // Avaliacoes (optional): used for teacher rating.
      try {
        const snap = await withTimeout(
          firebase.getDocs(firebase.query(firebase.collection(firebase.primaryDb, "avaliacoes"), firebase.where("alunoId", "==", alunoId))),
          12_000,
          "student_v5_avaliacoes"
        );
        const rows = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data ? docSnap.data() : null;
          if (!data || typeof data !== "object") return;
          const professorId = typeof data.professorId === "string" ? data.professorId.trim() : "";
          const score10 = Number(data.score10 ?? data.nota ?? data.score ?? data.rating ?? null);
          if (!professorId || !Number.isFinite(score10)) return;
          rows.push({ professorId, score10 });
        });
        studentV5DashboardState.avaliacoes = rows;
      } catch (error) {
        studentV5DashboardState.avaliacoes = [];
      }

      // Recomendacoes (optional).
      try {
        const snap = await withTimeout(
          firebase.getDocs(firebase.query(firebase.collection(firebase.primaryDb, "recomendacoes"), firebase.where("alunoId", "==", alunoId))),
          12_000,
          "student_v5_recs"
        );
        const rows = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data ? docSnap.data() : null;
          if (!data || typeof data !== "object") return;
          const text =
            typeof data.texto === "string"
              ? data.texto.trim()
              : typeof data.text === "string"
                ? data.text.trim()
                : typeof data.recomendacao === "string"
                  ? data.recomendacao.trim()
                  : typeof data.descricao === "string"
                    ? data.descricao.trim()
                    : "";
          const tag =
            typeof data.tag === "string"
              ? data.tag.trim()
              : typeof data.tipo === "string"
                ? data.tipo.trim()
                : typeof data.categoria === "string"
                  ? data.categoria.trim()
                  : "";
          if (!text) return;
          rows.push({ text, tag });
        });
        studentV5DashboardState.recomendacoes = rows;
      } catch (error) {
        studentV5DashboardState.recomendacoes = [];
      }

      // NPS (cooldown 90d).
      try {
        const snap = await withTimeout(
          firebase.getDocs(firebase.query(firebase.collection(firebase.primaryDb, "nps"), firebase.where("alunoId", "==", alunoId))),
          12_000,
          "student_v5_nps"
        );
        let last = null;
        snap.forEach((docSnap) => {
          const data = docSnap.data ? docSnap.data() : null;
          if (!data || typeof data !== "object") return;
          const nota = Number(data.nota ?? data.score ?? data.rating ?? null);
          const createdAtMs = parseFirestoreDateToMs(data.criadoEm ?? data.createdAt ?? data.data ?? null);
          if (!Number.isFinite(nota) || nota < 0 || nota > 10) return;
          if (!createdAtMs) return;
          if (!last || createdAtMs > last.createdAtMs) {
            last = { nota: Math.round(nota), createdAtMs };
          }
        });
        studentV5DashboardState.lastNps = last;
        studentV5DashboardState.npsCooldownUntilMs = last ? last.createdAtMs + 90 * 24 * 60 * 60 * 1000 : 0;
      } catch (error) {
        studentV5DashboardState.lastNps = null;
        studentV5DashboardState.npsCooldownUntilMs = 0;
      }

      studentV5DashboardState.loadedAt = Date.now();
      renderFromCache();
    } catch (error) {
      console.error("[student] dashboard load failed:", error);
    } finally {
      studentV5DashboardState.isLoading = false;
      studentV5DashboardState.loadedAt = Date.now();
    }
  })();
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

const getTeacherLessons = () => {
  const events = Array.isArray(teacherEventsState?.events) ? teacherEventsState.events : [];
  return events
    .filter((evt) => evt && evt.type === "lesson")
    .map((evt) => {
      const time = formatHmFromMinutes(evt.startMin);
      return {
        id: evt.id,
        dateKey: evt.dateKey,
        time,
        studentName: typeof evt.title === "string" ? evt.title : "",
        durationMinutes: Math.max(1, Math.round((evt.endMin || 0) - (evt.startMin || 0))),
      };
    });
};

const getTeacherCancellationEvents = () => [];

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
  const slots = getAvailableSlots(today).slice(0, 6);

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
  if (currentRole !== "teacher") return;
  if (!(dashboardTeacher instanceof HTMLElement)) return;

  const now = new Date();

  // Keep the countdown fresh while the teacher stays on the dashboard.
  if (!teacherV4DashboardState.refreshTimer) {
    teacherV4DashboardState.refreshTimer = window.setInterval(() => {
      if (currentRole !== "teacher" || body.dataset.activePanel !== "dashboard") {
        window.clearInterval(teacherV4DashboardState.refreshTimer);
        teacherV4DashboardState.refreshTimer = 0;
        return;
      }
      renderTeacherDashboard();
    }, 60_000);
  }
  const hour = now.getHours();
  let greeting = "Boa noite";
  if (hour >= 6 && hour < 12) greeting = "Bom dia";
  else if (hour >= 12 && hour < 18) greeting = "Boa tarde";

  const teacherName =
    sessionUser && sessionUser.role === "teacher" ? sessionUser.name : ROLE_DEFS.teacher?.defaultName || "Professor";

  const capitalize = (value) => {
    const text = String(value || "");
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const formatTeacherLongDate = (date) => {
    try {
      const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      return capitalize(fmt.format(date));
    } catch (error) {
      return "";
    }
  };

  if (teacherV4Greeting instanceof HTMLElement) {
    teacherV4Greeting.textContent = `${greeting}, ${teacherName}.`;
  }
  if (teacherV4Date instanceof HTMLElement) {
    teacherV4Date.textContent = formatTeacherLongDate(now);
  }
  if (teacherV4Avatar instanceof HTMLElement) {
    teacherV4Avatar.textContent = getInitials(teacherName);
  }

  const setPlaceholderText = (el, text = "Nenhuma informação cadastrada") => {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = text;
    el.classList.add("is-placeholder");
  };

  const clearPlaceholderText = (el) => {
    if (!(el instanceof HTMLElement)) return;
    el.classList.remove("is-placeholder");
  };

  const parseMinutesNullable = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return clampNumber(value, 0, 1440);
    const raw = String(value || "").trim();
    if (!/^\d{2}:\d{2}$/.test(raw)) return null;
    return timeToMinutes(raw);
  };

  const buildDateFromKey = (dateKey) => {
    const raw = String(dateKey || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(5, 7));
    const d = Number(raw.slice(8, 10));
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const dateTimeFromKeyMinutes = (dateKey, minutes) => {
    const base = buildDateFromKey(dateKey);
    if (!base) return null;
    const safeMin = clampNumber(minutes, 0, 24 * 60 - 1);
    const dt = new Date(base);
    dt.setMinutes(safeMin);
    return dt;
  };

  const isCancelledStatus = (status) => {
    const s = String(status || "").trim().toLowerCase();
    return s === "cancelada" || s === "cancelado" || s === "cancelled" || s === "canceled";
  };

  const isPendingRescheduleStatus = (status) => {
    const s = String(status || "").trim().toLowerCase();
    return s === "pendente" || s === "pending";
  };

  const formatDecimalPt = (num, digits = 1) => {
    const n = Number(num);
    if (!Number.isFinite(n)) return "—";
    try {
      return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    } catch (error) {
      return String(n.toFixed(digits)).replace(".", ",");
    }
  };

  const formatHoursLabel = (minutesTotal) => {
    const minutes = Number(minutesTotal);
    if (!Number.isFinite(minutes) || minutes <= 0) return "0h";
    const hours = minutes / 60;
    const rounded = Math.round(hours * 10) / 10;
    const str = rounded % 1 === 0 ? String(Math.round(rounded)) : formatDecimalPt(rounded, 1);
    return `${str}h`;
  };

  const getMonthWindow = (reference) => {
    const base = new Date(reference);
    base.setHours(0, 0, 0, 0);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { start, end };
  };

  const shiftMonth = (date, deltaMonths) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + deltaMonths);
    return d;
  };

  const renderStars = (container, avg10) => {
    if (!(container instanceof HTMLElement)) return;
    const score = Number(avg10);
    if (!Number.isFinite(score) || score <= 0) {
      container.innerHTML = "";
      return;
    }
    const stars = Math.max(0, Math.min(5, Math.floor((score / 10) * 5 + 1e-6)));
    const filled = `<svg viewBox="0 0 24 24" fill="#FBBF24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    const empty = `<svg viewBox="0 0 24 24" fill="rgba(255,255,255,0.08)" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    container.innerHTML = Array.from({ length: 5 })
      .map((_, idx) => (idx < stars ? filled : empty))
      .join("");
  };

  if (teacherV4PendingList instanceof HTMLElement) teacherV4PendingList.innerHTML = "";
  if (teacherV4Timeline instanceof HTMLElement) teacherV4Timeline.innerHTML = "";
  if (teacherV4WeekGrid instanceof HTMLElement) teacherV4WeekGrid.innerHTML = "";
  if (teacherV4NoticesList instanceof HTMLElement) teacherV4NoticesList.innerHTML = "";

  const todayKey = createDateKey(now);
  const weekDays = getWeekDaysMonToSat(now);
  const weekKeys = weekDays.map((d) => createDateKey(d));
  const weekStartKey = weekKeys[0];
  const weekEndKey = weekKeys[weekKeys.length - 1];

  const { start: monthStart, end: monthEnd } = getMonthWindow(now);
  const { start: lastMonthStart, end: lastMonthEnd } = getMonthWindow(shiftMonth(now, -1));

  const shouldReload = Date.now() - (teacherV4DashboardState.loadedAt || 0) > 120_000;
  if (teacherV4DashboardState.isLoading) return;

  const renderFromCache = () => {
    const aulas = Array.isArray(teacherV4DashboardState.aulas) ? teacherV4DashboardState.aulas : [];
    const avaliacoes = Array.isArray(teacherV4DashboardState.avaliacoes) ? teacherV4DashboardState.avaliacoes : [];
    const avisos = Array.isArray(teacherV4DashboardState.avisos) ? teacherV4DashboardState.avisos : [];
    const reag = Array.isArray(teacherV4DashboardState.reagendamentos) ? teacherV4DashboardState.reagendamentos : [];
    const workHours = teacherV4DashboardState.workHours;

    const lessonsOnly = aulas.filter((evt) => evt && evt.type === "lesson" && !isCancelledStatus(evt.status));
    const lessonsToday = lessonsOnly.filter((evt) => evt.dateKey === todayKey);
    const doneToday = lessonsToday.filter((evt) => evt.endMs <= now.getTime());
    const remainingToday = lessonsToday.filter((evt) => evt.endMs > now.getTime());

    if (teacherV4TodayCount instanceof HTMLElement) teacherV4TodayCount.textContent = String(lessonsToday.length);
    if (teacherV4TodaySub instanceof HTMLElement) {
      teacherV4TodaySub.textContent = `${doneToday.length} feitas · ${remainingToday.length} restantes`;
    }

    const isInRange = (ms, start, end) => {
      if (!ms) return false;
      const date = new Date(ms);
      return date >= start && date <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    };

    const monthLessons = lessonsOnly.filter((evt) => isInRange(evt.startMs, monthStart, monthEnd));
    const lastMonthLessons = lessonsOnly.filter((evt) => isInRange(evt.startMs, lastMonthStart, lastMonthEnd));
    const monthMinutes = monthLessons.reduce((acc, evt) => acc + Math.max(0, evt.endMin - evt.startMin), 0);
    const lastMonthMinutes = lastMonthLessons.reduce((acc, evt) => acc + Math.max(0, evt.endMin - evt.startMin), 0);

    if (teacherV4MonthHours instanceof HTMLElement) teacherV4MonthHours.textContent = formatHoursLabel(monthMinutes);
    if (teacherV4MonthDelta instanceof HTMLElement) {
      const deltaMin = monthMinutes - lastMonthMinutes;
      const sign = deltaMin >= 0 ? "+" : "−";
      const deltaAbs = Math.abs(deltaMin);
      teacherV4MonthDelta.textContent = `${sign}${formatHoursLabel(deltaAbs)} vs mês anterior`;
    }

    if (teacherV4StudentsCount instanceof HTMLElement) {
      const unique = new Set(monthLessons.map((evt) => evt.alunoId).filter(Boolean));
      teacherV4StudentsCount.textContent = String(unique.size);
    }

    // Próxima aula (hoje)
    const nextToday = lessonsToday
      .filter((evt) => evt.startMs > now.getTime())
      .sort((a, b) => a.startMs - b.startMs)[0];

    const showNext = Boolean(nextToday);
    if (teacherV4NextTop instanceof HTMLElement) teacherV4NextTop.hidden = !showNext;
    if (teacherV4NextGrid instanceof HTMLElement) teacherV4NextGrid.hidden = !showNext;
    if (teacherV4NextEmpty instanceof HTMLElement) teacherV4NextEmpty.hidden = showNext;

    if (!nextToday) {
      if (teacherV4NextMinutes instanceof HTMLElement) teacherV4NextMinutes.textContent = "—";
      if (teacherV4NextTime instanceof HTMLElement) teacherV4NextTime.textContent = "—";
      if (teacherV4StudentName instanceof HTMLElement) teacherV4StudentName.textContent = "—";
      if (teacherV4StudentMeta instanceof HTMLElement) teacherV4StudentMeta.textContent = "—";
      setPlaceholderText(teacherV4StudentProfile, "Nenhuma informação cadastrada");
      setPlaceholderText(teacherV4StudentGoal, "Nenhuma informação cadastrada");
      setPlaceholderText(teacherV4PlanTheme, "Nenhuma informação cadastrada");
      if (teacherV4PlanTopics instanceof HTMLElement) teacherV4PlanTopics.innerHTML = "";
      if (teacherV4PlanMaterial instanceof HTMLElement) teacherV4PlanMaterial.hidden = true;
      if (teacherV4LastMeta instanceof HTMLElement) teacherV4LastMeta.textContent = "—";
      if (teacherV4LastTheme instanceof HTMLElement) teacherV4LastTheme.textContent = "—";
      setPlaceholderText(teacherV4LastNotes, "Nenhuma informação cadastrada");
      if (teacherV4LastTags instanceof HTMLElement) teacherV4LastTags.innerHTML = "";
    } else {
      const minutesUntil = Math.max(0, Math.ceil((nextToday.startMs - now.getTime()) / 60000));
      if (teacherV4NextMinutes instanceof HTMLElement) teacherV4NextMinutes.textContent = String(minutesUntil);
      if (teacherV4NextTime instanceof HTMLElement) {
        teacherV4NextTime.textContent = `${formatHmFromMinutes(nextToday.startMin)} — ${formatHmFromMinutes(nextToday.endMin)}`;
      }

      if (teacherV4StudentAvatar instanceof HTMLElement) {
        teacherV4StudentAvatar.textContent = getInitials(nextToday.alunoNome || "Aluno");
      }
      if (teacherV4StudentName instanceof HTMLElement) teacherV4StudentName.textContent = nextToday.alunoNome || "Aluno";
      if (teacherV4StudentMeta instanceof HTMLElement) {
        const metaParts = [];
        if (nextToday.nivelAluno) metaParts.push(nextToday.nivelAluno);
        if (nextToday.idadeAluno) metaParts.push(`${nextToday.idadeAluno} anos`);
        teacherV4StudentMeta.textContent = metaParts.length ? metaParts.join(" · ") : "—";
      }

      if (teacherV4StudentProfile instanceof HTMLElement) {
        if (nextToday.alunoPerfil) {
          clearPlaceholderText(teacherV4StudentProfile);
          teacherV4StudentProfile.textContent = nextToday.alunoPerfil;
        } else {
          setPlaceholderText(teacherV4StudentProfile, "Nenhuma informação cadastrada");
        }
      }

      if (teacherV4StudentGoal instanceof HTMLElement) {
        if (nextToday.alunoObjetivo) {
          clearPlaceholderText(teacherV4StudentGoal);
          teacherV4StudentGoal.textContent = nextToday.alunoObjetivo;
        } else {
          setPlaceholderText(teacherV4StudentGoal, "Nenhuma informação cadastrada");
        }
      }

      if (teacherV4PlanTheme instanceof HTMLElement) {
        if (nextToday.tema) {
          clearPlaceholderText(teacherV4PlanTheme);
          teacherV4PlanTheme.textContent = nextToday.tema;
        } else {
          setPlaceholderText(teacherV4PlanTheme, "Nenhuma informação cadastrada");
        }
      }

      if (teacherV4PlanTopics instanceof HTMLElement) {
        const topics = Array.isArray(nextToday.topicos) ? nextToday.topicos : [];
        teacherV4PlanTopics.innerHTML = topics
          .map(
            (topic) => `
              <li class="teacher-v4-topic">
                <span class="teacher-v4-topic-dot" aria-hidden="true"></span>
                <p class="teacher-v4-topic-text">${escapeHtml(topic)}</p>
              </li>
            `
          )
          .join("");
      }

      if (teacherV4PlanMaterial instanceof HTMLElement && teacherV4PlanMaterialTitle instanceof HTMLElement) {
        const material = String(nextToday.material || "").trim();
        teacherV4PlanMaterial.hidden = !material;
        teacherV4PlanMaterialTitle.textContent = material;
      }

      // Last lesson summary (previous, same student).
      const prev = lessonsOnly
        .filter((evt) => evt.alunoId && evt.alunoId === nextToday.alunoId)
        .filter((evt) => evt.endMs < now.getTime())
        .sort((a, b) => b.endMs - a.endMs)[0];

      if (!prev) {
        if (teacherV4LastMeta instanceof HTMLElement) teacherV4LastMeta.textContent = "—";
        if (teacherV4LastTheme instanceof HTMLElement) teacherV4LastTheme.textContent = "—";
        setPlaceholderText(teacherV4LastNotes, "Nenhuma informação cadastrada");
        if (teacherV4LastTags instanceof HTMLElement) teacherV4LastTags.innerHTML = "";
      } else {
        // Meta: date + optional rating.
        const dateLabel = formatBrDateFromDateKey(prev.dateKey || "");
        let meta = dateLabel || "—";
        if (prev.weekdayLabel) meta = `${dateLabel} — ${prev.weekdayLabel}`;

        const rating = avaliacoes.find((a) => a && a.aulaId === prev.id);

        if (teacherV4LastMeta instanceof HTMLElement) {
          const left = meta || "—";
          const ratingMarkup =
            rating && Number.isFinite(rating.score10)
              ? `
                <span class="teacher-v4-last-rating">
                  <svg viewBox="0 0 24 24" fill="#FBBF24" aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                  <span>${escapeHtml(formatDecimalPt(rating.score10, 1))}</span>
                </span>
              `
              : "";
          teacherV4LastMeta.innerHTML = `<span>${escapeHtml(left)}</span>${ratingMarkup}`;
        }
        if (teacherV4LastTheme instanceof HTMLElement) teacherV4LastTheme.textContent = prev.tema || "—";
        if (teacherV4LastNotes instanceof HTMLElement) {
          const notes = String(prev.observacoes || "").trim();
          if (notes) {
            clearPlaceholderText(teacherV4LastNotes);
            teacherV4LastNotes.textContent = notes;
          } else {
            setPlaceholderText(teacherV4LastNotes, "Nenhuma informação cadastrada");
          }
        }

        if (teacherV4LastTags instanceof HTMLElement) {
          const tags = Array.isArray(prev.pontosAtencao) ? prev.pontosAtencao : [];
          teacherV4LastTags.innerHTML = tags
            .map((tag) => {
              if (!tag || typeof tag !== "object") return "";
              const text = String(tag.texto || tag.text || "").trim();
              if (!text) return "";
              const kind = String(tag.tipo || "").trim().toLowerCase();
              const cls = kind === "positivo" ? "is-positive" : "is-weak";
              return `<span class="teacher-v4-tag ${cls}">${escapeHtml(text)}</span>`;
            })
            .join("");
        }
      }
    }

    // Timeline today.
    if (teacherV4Timeline instanceof HTMLElement && teacherV4TimelineEmpty instanceof HTMLElement) {
      teacherV4TimelineEmpty.hidden = lessonsToday.length > 0;
      const nextId = nextToday ? nextToday.id : "";
      teacherV4Timeline.innerHTML = lessonsToday
        .sort((a, b) => a.startMs - b.startMs)
        .map((evt) => {
          const isDone = evt.endMs <= now.getTime();
          const isNext = !isDone && nextId && evt.id === nextId;
          const itemClass = isDone ? "is-completed" : isNext ? "is-next" : "";
          const badge = isDone ? "Concluída" : isNext ? `Em ${Math.max(1, Math.ceil((evt.startMs - now.getTime()) / 60000))} min` : "";
          const meta = evt.timelineMeta || "";
          return `
            <div class="teacher-v4-timeline-item ${itemClass}">
              <div class="teacher-v4-timeline-dot" aria-hidden="true"></div>
              <div class="teacher-v4-timeline-card">
                <div class="teacher-v4-timeline-left">
                  <p class="teacher-v4-timeline-time">${escapeHtml(formatHmFromMinutes(evt.startMin))}</p>
                  <div class="teacher-v4-timeline-sep" aria-hidden="true"></div>
                  <div style="min-width:0;">
                    <p class="teacher-v4-timeline-name">${escapeHtml(evt.alunoNome || evt.title || "Aula")}</p>
                    <p class="teacher-v4-timeline-meta">${escapeHtml(meta)}</p>
                  </div>
                </div>
                <span class="teacher-v4-timeline-badge">${escapeHtml(badge)}</span>
              </div>
            </div>
          `;
        })
        .join("");
    }

    // Week grid.
    if (teacherV4WeekGrid instanceof HTMLElement && teacherV4WeekTotal instanceof HTMLElement) {
      const weekLessons = lessonsOnly.filter((evt) => evt.dateKey >= weekStartKey && evt.dateKey <= weekEndKey);
      const totals = { count: 0, minutes: 0 };
      const byKey = new Map();
      weekKeys.forEach((k) => byKey.set(k, []));
      weekLessons.forEach((evt) => {
        if (!byKey.has(evt.dateKey)) return;
        byKey.get(evt.dateKey).push(evt);
      });

      teacherV4WeekGrid.innerHTML = weekDays
        .map((day) => {
          const key = createDateKey(day);
          const entries = byKey.get(key) || [];
          const count = entries.length;
          const minutes = entries.reduce((acc, evt) => acc + Math.max(0, evt.endMin - evt.startMin), 0);
          totals.count += count;
          totals.minutes += minutes;
          const isToday = key === todayKey;
          const label = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB"][Math.max(0, Math.min(5, (day.getDay() + 6) % 7))] || "";
          return `
            <div class="teacher-v4-weekday ${isToday ? "is-today" : ""}">
              <p class="teacher-v4-weekday-label">${label}</p>
              <p class="teacher-v4-weekday-date">${String(day.getDate())}</p>
              <p class="teacher-v4-weekday-count">${count}</p>
              <p class="teacher-v4-weekday-sub">aulas</p>
            </div>
          `;
        })
        .join("");

      teacherV4WeekTotal.textContent = `${totals.count} aulas · ${formatHoursLabel(totals.minutes)}`;
    }

    // Pendências.
    const pendingReschedules = reag
      .filter((r) => r && isPendingRescheduleStatus(r.status))
      .slice(0, 3)
      .map((r) => ({
        kind: "reschedule",
        title: "Reagendamento solicitado",
        meta: `${r.alunoNome || "Aluno"} · ${formatBrDateFromDateKey(r.dateKey)} ${r.horaInicio ? `· ${r.horaInicio}` : ""}`.trim(),
      }));

    const expiring = (() => {
      const groups = new Map();
      lessonsOnly
        .filter((evt) => evt.recorrente && evt.grupoRecorrenciaId)
        .forEach((evt) => {
          const key = evt.grupoRecorrenciaId;
          const prev = groups.get(key);
          if (!prev || evt.startMs > prev.maxStartMs) {
            groups.set(key, { maxStartMs: evt.startMs, alunoNome: evt.alunoNome || "", dateKey: evt.dateKey || "" });
          }
        });

      const horizonMs = now.getTime() + 14 * 24 * 60 * 60 * 1000;
      const items = Array.from(groups.values())
        .filter((g) => g.maxStartMs && g.maxStartMs <= horizonMs && g.maxStartMs >= now.getTime())
        .sort((a, b) => a.maxStartMs - b.maxStartMs)
        .slice(0, 2)
        .map((g) => ({
          kind: "recurrence",
          title: "Recorrência expirando",
          meta: `${g.alunoNome || "Aluno"} · Renovar até ${formatBrDateFromDateKey(g.dateKey)}`,
        }));
      return items;
    })();

    const pendingItems = [...pendingReschedules, ...expiring];

    if (teacherV4PendingCount instanceof HTMLElement) teacherV4PendingCount.textContent = String(pendingItems.length);
    if (teacherV4PendingList instanceof HTMLElement && teacherV4PendingEmpty instanceof HTMLElement) {
      teacherV4PendingEmpty.hidden = pendingItems.length > 0;
      teacherV4PendingList.innerHTML = pendingItems
        .map((item) => {
          const cls = item.kind === "reschedule" ? "is-yellow" : "is-blue";
          return `
            <div class="teacher-v4-pending-item ${cls}">
              <div>
                <p class="teacher-v4-pending-item-title">${escapeHtml(item.title)}</p>
                <p class="teacher-v4-pending-item-meta">${escapeHtml(item.meta)}</p>
              </div>
              <svg class="teacher-v4-pending-item-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          `;
        })
        .join("");
    }

    // Performance.
    const pastLessons = lessonsOnly.filter((evt) => evt.endMs < now.getTime());
    const pastMonth = pastLessons.filter((evt) => isInRange(evt.startMs, monthStart, monthEnd));
    const present = pastMonth.length;
    const canceledPastMonth = aulas.filter((evt) => evt && evt.type === "lesson" && isCancelledStatus(evt.status)).filter((evt) =>
      isInRange(evt.startMs, monthStart, monthEnd)
    ).length;
    const denom = present + canceledPastMonth;
    const presencePct = denom ? Math.round((present / denom) * 100) : 0;

    if (teacherV4PresenceValue instanceof HTMLElement) teacherV4PresenceValue.textContent = `${presencePct}%`;
    if (teacherV4PresenceBar instanceof HTMLElement) teacherV4PresenceBar.style.width = `${presencePct}%`;
    if (teacherV4PresencePill instanceof HTMLElement) {
      const ok = presencePct >= 85;
      teacherV4PresencePill.hidden = false;
      teacherV4PresencePill.textContent = ok ? "Saudável" : "Atenção";
    }

    const monthEval = avaliacoes.filter((a) => a && isInRange(a.createdAtMs, monthStart, monthEnd));
    const avgEval = monthEval.length
      ? monthEval.reduce((acc, row) => acc + (Number(row.score10) || 0), 0) / monthEval.length
      : null;

    if (teacherV4ReviewsCount instanceof HTMLElement) teacherV4ReviewsCount.textContent = String(monthEval.length);
    if (teacherV4ReviewsAverage instanceof HTMLElement) teacherV4ReviewsAverage.textContent = avgEval == null ? "—" : formatDecimalPt(avgEval, 1);
    renderStars(teacherV4ReviewsStars, avgEval || 0);

    // Occupancy: scheduled minutes / available minutes for the current week (Mon-Sat).
    const weekLessons = lessonsOnly.filter((evt) => evt.dateKey >= weekStartKey && evt.dateKey <= weekEndKey);
    const scheduledMinutesWeek = weekLessons.reduce((acc, evt) => acc + Math.max(0, evt.endMin - evt.startMin), 0);
    let availableMinutesWeek = 0;
    if (workHours && typeof workHours === "object") {
      weekDays.forEach((day) => {
        const dow = day.getDay();
        const windows = Array.isArray(workHours[String(dow)]) ? workHours[String(dow)] : [];
        windows.forEach((w) => {
          if (!w) return;
          const start = clampNumber(w.startMin, 0, 1440);
          const end = clampNumber(w.endMin, 0, 1440);
          if (end > start) availableMinutesWeek += end - start;
        });
      });
    }
    const occupancyPct = availableMinutesWeek ? Math.min(100, Math.round((scheduledMinutesWeek / availableMinutesWeek) * 100)) : 0;
    if (teacherV4OccupancyValue instanceof HTMLElement) teacherV4OccupancyValue.textContent = `${occupancyPct}%`;
    if (teacherV4OccupancyBar instanceof HTMLElement) teacherV4OccupancyBar.style.width = `${occupancyPct}%`;
    if (teacherV4OccupancyPill instanceof HTMLElement) {
      teacherV4OccupancyPill.hidden = false;
      teacherV4OccupancyPill.textContent = occupancyPct >= 70 ? "Bom" : "Baixo";
    }

    // Rating badge (header): use overall average, fallback to month average.
    const avgAll = avaliacoes.length
      ? avaliacoes.reduce((acc, row) => acc + (Number(row.score10) || 0), 0) / avaliacoes.length
      : null;
    if (teacherV4Rating instanceof HTMLElement) {
      teacherV4Rating.textContent = avgAll == null ? "—" : formatDecimalPt(avgAll, 1);
    }

    // Notices.
    if (teacherV4NoticesList instanceof HTMLElement && teacherV4NoticesEmpty instanceof HTMLElement) {
      teacherV4NoticesEmpty.hidden = avisos.length > 0;
      teacherV4NoticesList.innerHTML = avisos
        .slice(0, 3)
        .map((n) => {
          const important = Boolean(n.important);
          const title = n.title || "Aviso";
          const meta = n.meta || "";
          const text = n.text || "";
          const tag = important ? `<span class="teacher-v4-notice-tag">Importante</span>` : "";
          return `
            <div class="teacher-v4-notice ${important ? "is-important" : ""}">
              <div class="teacher-v4-notice-head">
                <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                  <p class="teacher-v4-notice-title">${escapeHtml(title)}</p>
                  ${tag}
                </div>
                <span class="teacher-v4-notice-meta">${escapeHtml(meta)}</span>
              </div>
              <p class="teacher-v4-notice-text">${escapeHtml(text)}</p>
            </div>
          `;
        })
        .join("");
    }
  };

  if (!shouldReload && teacherV4DashboardState.teacherId) {
    renderFromCache();
    return;
  }

  teacherV4DashboardState.isLoading = true;

  (async () => {
    try {
      const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
      const user = await waitForFirebaseAuthReady(firebase, 5000);
      if (!user) throw new Error("auth/no-current-user");

      const teacherId = String(user.uid || "");
      teacherV4DashboardState.teacherId = teacherId;

      // Fetch aulas for this teacher (single-field query avoids composite indexes).
      const aulasSnap = await withTimeout(
        firebase.getDocs(firebase.query(firebase.collection(firebase.primaryDb, "aulas"), firebase.where("professorId", "==", teacherId))),
        16_000,
        "teacher_v4_aulas"
      );

      const aulas = [];
      aulasSnap.forEach((docSnap) => {
        const data = docSnap.data ? docSnap.data() : null;
        if (!data || typeof data !== "object") return;
        const id = String(docSnap.id || "").trim();
        const professorId = String(data.professorId || "").trim();
        if (!id || !professorId) return;

        const alunoIdRaw = data.alunoId == null ? null : String(data.alunoId || "").trim();
        const alunoId = alunoIdRaw || null;
        const dateKey = String(data.dateKey || "").trim();
        const startMin = Number.isFinite(Number(data.startMin)) ? clampNumber(Number(data.startMin), 0, 1440) : parseMinutesNullable(data.horaInicio);
        const endMin = Number.isFinite(Number(data.endMin)) ? clampNumber(Number(data.endMin), 0, 1440) : parseMinutesNullable(data.horaFim);
        if (!dateKey || !Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return;

        const start = dateTimeFromKeyMinutes(dateKey, startMin);
        const end = dateTimeFromKeyMinutes(dateKey, endMin);
        if (!start || !end) return;

        const status = String(data.status || "").trim().toLowerCase() || "agendada";
        const alunoNome = typeof data.alunoNome === "string" ? data.alunoNome.trim() : "";
        const professorNome = typeof data.professorNome === "string" ? data.professorNome.trim() : "";
        const recorrente = typeof data.recorrente === "boolean" ? data.recorrente : false;
        const grupoRecorrenciaId = typeof data.grupoRecorrenciaId === "string" && data.grupoRecorrenciaId.trim() ? data.grupoRecorrenciaId.trim() : null;

        const tema = typeof data.tema === "string" ? data.tema.trim() : "";
        const topicos = Array.isArray(data.topicos) ? data.topicos.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()) : [];
        const material = typeof data.material === "string" ? data.material.trim() : "";
        const observacoes = typeof data.observacoes === "string" ? data.observacoes.trim() : "";
        const pontosAtencao = Array.isArray(data.pontosAtencao) ? data.pontosAtencao : [];

        const nivelAluno =
          typeof data.nivelAluno === "string"
            ? data.nivelAluno.trim()
            : typeof data.nivel === "string"
              ? data.nivel.trim()
              : typeof data.level === "string"
                ? data.level.trim()
                : "";
        const idadeAlunoRaw = data.idadeAluno ?? data.idade ?? data.age ?? null;
        const idadeAluno = Number.isFinite(Number(idadeAlunoRaw)) ? Math.max(0, Math.floor(Number(idadeAlunoRaw))) : null;

        const type = alunoId ? "lesson" : "manual";
        const title = type === "lesson" ? alunoNome || "Aluno" : String(data.title || "").trim() || "Evento";
        const cat = tema ? String(tema.split(":")[0]).trim() : "";
        const timelineMeta = [nivelAluno || "", cat || ""].filter(Boolean).join(" · ");

        aulas.push({
          id,
          professorId,
          professorNome: professorNome || null,
          alunoId,
          alunoNome: alunoNome || null,
          dateKey,
          startMin,
          endMin,
          startMs: start.getTime(),
          endMs: end.getTime(),
          status,
          type,
          title,
          recorrente: Boolean(recorrente),
          grupoRecorrenciaId,
          tema,
          topicos,
          material,
          observacoes,
          pontosAtencao,
          nivelAluno: nivelAluno || "",
          idadeAluno,
          timelineMeta,
          weekdayLabel: (() => {
            const wd = weekdayLongFromDateKey(dateKey);
            return wd ? wd.replace(/^\w/, (c) => c.toUpperCase()) : "";
          })(),
          alunoPerfil: "",
          alunoObjetivo: "",
        });
      });

      // Determine next lesson for today and fetch student profile/goal for it (single doc read).
      const lessonsToday = aulas.filter((evt) => evt.type === "lesson" && evt.dateKey === todayKey && !isCancelledStatus(evt.status));
      const nextToday = lessonsToday
        .filter((evt) => evt.startMs > now.getTime())
        .sort((a, b) => a.startMs - b.startMs)[0];

      if (nextToday && nextToday.alunoId) {
        try {
          // We request getDoc lazily; if the module isn't exported, fall back to a query.
          const docRef = firebase.doc(firebase.primaryDb, "users", nextToday.alunoId);
          const snap = firebase.getDoc ? await withTimeout(firebase.getDoc(docRef), 10_000, "teacher_v4_student_doc") : null;
          const studentData = snap && typeof snap.data === "function" ? snap.data() : null;
          if (studentData && typeof studentData === "object") {
            const perfil = typeof studentData.perfil === "string" ? studentData.perfil.trim() : "";
            const objetivo = typeof studentData.objetivo === "string" ? studentData.objetivo.trim() : "";
            nextToday.alunoPerfil = perfil;
            nextToday.alunoObjetivo = objetivo;
          }
        } catch (error) {
          // ignore, keep placeholders
        }
      }

      // Avaliacoes (optional).
      let avaliacoes = [];
      try {
        const snap = await withTimeout(
          firebase.getDocs(firebase.query(firebase.collection(firebase.primaryDb, "avaliacoes"), firebase.where("professorId", "==", teacherId))),
          12_000,
          "teacher_v4_avaliacoes"
        );
        const rows = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data ? docSnap.data() : null;
          if (!data || typeof data !== "object") return;
          const aulaId = typeof data.aulaId === "string" ? data.aulaId.trim() : typeof data.lessonId === "string" ? data.lessonId.trim() : "";
          const created = data.criadoEm ?? data.createdAt ?? data.data ?? null;
          const createdAt =
            created && typeof created.toDate === "function"
              ? created.toDate()
              : created instanceof Date
                ? created
                : typeof created === "number"
                  ? new Date(created)
                  : null;
          const createdAtMs = createdAt instanceof Date && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : 0;
          const rawScore = data.nota ?? data.score ?? data.rating ?? data.value ?? null;
          const scoreNum = Number(rawScore);
          if (!Number.isFinite(scoreNum)) return;
          const score10 = scoreNum <= 5 ? scoreNum * 2 : scoreNum;
          rows.push({ id: docSnap.id, aulaId: aulaId || "", score10: clampNumber(score10, 0, 10), createdAtMs });
        });
        avaliacoes = rows;
      } catch (error) {
        avaliacoes = [];
      }

      // Avisos (optional).
      let avisos = [];
      try {
        const snap = await withTimeout(firebase.getDocs(firebase.collection(firebase.primaryDb, "avisos")), 12_000, "teacher_v4_avisos");
        const rows = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data ? docSnap.data() : null;
          if (!data || typeof data !== "object") return;
          const title = typeof data.titulo === "string" ? data.titulo.trim() : typeof data.title === "string" ? data.title.trim() : "";
          const text = typeof data.texto === "string" ? data.texto.trim() : typeof data.text === "string" ? data.text.trim() : "";
          const important = Boolean(data.importante ?? data.important ?? false);
          const created = data.criadoEm ?? data.createdAt ?? data.data ?? null;
          const createdAt =
            created && typeof created.toDate === "function"
              ? created.toDate()
              : created instanceof Date
                ? created
                : typeof created === "number"
                  ? new Date(created)
                  : null;
          const createdAtMs = createdAt instanceof Date && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : 0;
          rows.push({
            id: docSnap.id,
            title: title || "Aviso",
            text,
            important,
            createdAtMs,
            meta: createdAt ? `${formatShortDate(createdAt)}${createdAtMs ? ` · ${formatTimeHm(createdAt)}` : ""}` : "",
          });
        });
        avisos = rows.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      } catch (error) {
        avisos = [];
      }

      // Reagendamentos pendentes para o professor (optional).
      let reagendamentos = [];
      try {
        const snap = await withTimeout(
          firebase.getDocs(firebase.query(firebase.collection(firebase.primaryDb, "reagendamentos"), firebase.where("professorId", "==", teacherId))),
          12_000,
          "teacher_v4_reagendamentos"
        );
        const rows = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data ? docSnap.data() : null;
          if (!data || typeof data !== "object") return;
          const status = String(data.status || "").trim().toLowerCase() || "pendente";
          const alunoNome = typeof data.alunoNome === "string" ? data.alunoNome.trim() : "";
          const dateKey = typeof data.dateKey === "string" ? data.dateKey.trim() : "";
          const horaInicio = typeof data.horaInicio === "string" ? data.horaInicio.trim() : "";
          const horaFim = typeof data.horaFim === "string" ? data.horaFim.trim() : "";
          rows.push({ id: docSnap.id, status, alunoNome, dateKey, horaInicio, horaFim });
        });
        reagendamentos = rows;
      } catch (error) {
        reagendamentos = [];
      }

      // Work hours (optional, used for occupancy).
      let workHours = null;
      try {
        const res = await withTimeout(fetchWithAuth("/api/teacher-workhours"), 10_000, "teacher_v4_workhours");
        const json = await res.json().catch(() => null);
        if (res.ok && json && typeof json === "object") {
          workHours = json.workHours && typeof json.workHours === "object" ? json.workHours : null;
        }
      } catch (error) {
        workHours = null;
      }

      teacherV4DashboardState.aulas = aulas;
      teacherV4DashboardState.avaliacoes = avaliacoes;
      teacherV4DashboardState.avisos = avisos;
      teacherV4DashboardState.reagendamentos = reagendamentos;
      teacherV4DashboardState.workHours = workHours;
      teacherV4DashboardState.loadedAt = Date.now();
    } catch (error) {
      console.error("[teacher-v4] renderTeacherDashboard failed:", error);
    } finally {
      teacherV4DashboardState.isLoading = false;
      renderFromCache();
    }
  })();
};

const formatTimeZoneOffset = (date) => {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `GMT${sign}${hours}:${minutes}`;
};

const formatTimeZoneOffsetFromMinutes = (offsetMinutes) => {
  const safe = clampNumber(Math.round(offsetMinutes), -12 * 60, 14 * 60);
  const sign = safe >= 0 ? "+" : "-";
  const absolute = Math.abs(safe);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `GMT${sign}${hours}:${minutes}`;
};

const getDisplayTimeZoneNameFromKey = (timeZoneKey) => {
  const safe = String(timeZoneKey || "").trim() || "America/Sao_Paulo";
  const knownTimeZones = {
    "America/Sao_Paulo": "America/São Paulo",
  };

  if (knownTimeZones[safe]) {
    return knownTimeZones[safe];
  }

  return safe.replace(/_/g, " ");
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

const TEACHER_CAL_SLOT_MINUTES = 15;
const TEACHER_CAL_MIN_DURATION_MINUTES = 15;
const TEACHER_CAL_DEFAULT_DURATION_MINUTES = 30;

const clampNumber = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
};

const getTeacherGridMeta = (gridEl) => {
  if (!(gridEl instanceof HTMLElement)) return null;
  const startHour = Number(gridEl.dataset.teacherCalStart);
  const endHour = Number(gridEl.dataset.teacherCalEnd);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour < startHour) return null;

  const gridStartMin = startHour * 60;
  const gridEndMin = (endHour + 1) * 60;
  const selectableEndMin = gridEndMin - TEACHER_CAL_SLOT_MINUTES;
  const rect = gridEl.getBoundingClientRect();
  const spanMinutes = Math.max(1, gridEndMin - gridStartMin);
  const pxPerMinute = rect.height ? rect.height / spanMinutes : 0;

  return { startHour, endHour, gridStartMin, gridEndMin, selectableEndMin, rect, spanMinutes, pxPerMinute };
};

const roundToNearestSlotMin = (minutes) => {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n / TEACHER_CAL_SLOT_MINUTES) * TEACHER_CAL_SLOT_MINUTES;
};

const formatHmFromMinutes = (minutes) => {
  const safe = clampNumber(Math.round(minutes), 0, 23 * 60 + 59);
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const mins = String(safe % 60).padStart(2, "0");
  return `${hours}:${mins}`;
};

const calcTeacherSlotMinutesFromClientY = (gridEl, clientY) => {
  const meta = getTeacherGridMeta(gridEl);
  if (!meta) return null;
  const y = clampNumber(clientY - meta.rect.top, 0, meta.rect.height);
  const ratio = meta.rect.height ? y / meta.rect.height : 0;
  return meta.gridStartMin + ratio * meta.spanMinutes;
};

const ensureTeacherCalSelectionEl = (gridEl) => {
  if (teacherCalSelection?.el instanceof HTMLElement && teacherCalSelection.el.closest(".teacher-cal-grid") === gridEl) {
    return teacherCalSelection.el;
  }
  if (teacherCalSelection?.el instanceof HTMLElement) {
    teacherCalSelection.el.remove();
  }

  const el = document.createElement("div");
  el.className = "teacher-cal-selection";
  el.innerHTML = `<span class="teacher-cal-selection-time"></span>`;
  gridEl.appendChild(el);
  return el;
};

const syncTeacherCalSelectionUI = () => {
  if (!teacherCalSelection) return;
  const { gridEl, startMin, endMin } = teacherCalSelection;
  if (!(gridEl instanceof HTMLElement)) return;

  const meta = getTeacherGridMeta(gridEl);
  if (!meta) return;

  const el = ensureTeacherCalSelectionEl(gridEl);
  const top = (startMin - meta.gridStartMin) * meta.pxPerMinute;
  const height = Math.max(18, (endMin - startMin) * meta.pxPerMinute);

  el.style.top = `${top}px`;
  el.style.height = `${height}px`;

  const label = el.querySelector(".teacher-cal-selection-time");
  if (label instanceof HTMLElement) {
    label.textContent = `${formatHmFromMinutes(startMin)} – ${formatHmFromMinutes(endMin)}`;
  }

  teacherCalSelection.el = el;
};

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

const buildDateFromDateKeyAndMinutes = (dateKey, minutes) => {
  const base = parseDateKey(dateKey);
  if (!base) return null;
  const start = new Date(base);
  const safe = clampNumber(Math.round(minutes), 0, 23 * 60 + 59);
  start.setHours(Math.floor(safe / 60), safe % 60, 0, 0);
  return start;
};

const getTeacherEventsRangeForView = () => {
  const view = teacherCalendarState.view;
  const focus = teacherCalendarState.focusDate;

  if (view === "week") {
    const days = getWeekDaysMonToSat(focus);
    const from = createDateKey(days[0]);
    const to = createDateKey(days[days.length - 1]);
    return { from, to };
  }

  if (view === "month") {
    const fromDate = new Date(focus.getFullYear(), focus.getMonth(), 1);
    const toDate = new Date(focus.getFullYear(), focus.getMonth() + 1, 0);
    return { from: createDateKey(fromDate), to: createDateKey(toDate) };
  }

  const dayKey = createDateKey(focus);
  return { from: dayKey, to: dayKey };
};

const refreshTeacherEvents = async ({ force = false } = {}) => {
  if (currentRole !== "teacher" && currentRole !== "admin") return;
  if (teacherEventsState.isLoading) return;
  const { from, to } = getTeacherEventsRangeForView();
  const rangeKey = `${from}:${to}`;
  const now = Date.now();

  if (!force && teacherEventsState.rangeKey === rangeKey && teacherEventsState.lastLoadedAt && now - teacherEventsState.lastLoadedAt < 15_000) {
    return;
  }

  teacherEventsState.isLoading = true;
  try {
    const res = await fetchWithAuth(`/api/schedule-events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    if (!res.ok) throw new Error("teacher_events_fetch_failed");
    const data = await res.json().catch(() => null);
    const raw = Array.isArray(data?.events) ? data.events : [];
    teacherEventsState.events = raw
      .map((evt) => {
        if (!evt || typeof evt !== "object") return null;
        if (typeof evt.id !== "string" || typeof evt.type !== "string") return null;
        if (typeof evt.dateKey !== "string") return null;
        const startMin = Number(evt.startMin);
        const endMin = Number(evt.endMin);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
        return {
          id: evt.id,
          type: evt.type === "lesson" ? "lesson" : "manual",
          dateKey: evt.dateKey,
          startMin,
          endMin,
          title: typeof evt.title === "string" ? evt.title : "",
          description: typeof evt.description === "string" ? evt.description : "",
          guests: Array.isArray(evt.guests) ? evt.guests : [],
          documents: Array.isArray(evt.documents) ? evt.documents : [],
          recorrente: Boolean(evt.recorrente),
          grupoRecorrenciaId: typeof evt.grupoRecorrenciaId === "string" ? evt.grupoRecorrenciaId : null,
          alunoId: typeof evt.alunoId === "string" ? evt.alunoId : null,
          professorId: typeof evt.professorId === "string" ? evt.professorId : "",
        };
      })
      .filter(Boolean);
    teacherEventsState.rangeKey = rangeKey;
    teacherEventsState.lastLoadedAt = Date.now();

    if (body.dataset.activePanel === "ao-vivo") {
      renderTeacherCalendar();
    }
  } catch (error) {
    // Keep last known snapshot if backend is unreachable.
  } finally {
    teacherEventsState.isLoading = false;
  }
};

const refreshAdminRescheduleRequests = async ({ force = false } = {}) => {
  if (currentRole !== "admin") return;
  if (adminRescheduleState.isLoading) return;
  const now = Date.now();
  if (!force && adminRescheduleState.lastLoadedAt && now - adminRescheduleState.lastLoadedAt < 15_000) return;

  adminRescheduleState.isLoading = true;
  try {
    const res = await fetchWithAuth("/api/schedule-reschedule");
    if (!res.ok) throw new Error("reschedule_fetch_failed");
    const data = await res.json().catch(() => null);
    const raw = Array.isArray(data?.requests) ? data.requests : [];
    adminRescheduleState.requests = raw
      .map((req) => {
        if (!req || typeof req !== "object") return null;
        const id = typeof req.id === "string" ? req.id : "";
        const aulaId = typeof req.aulaId === "string" ? req.aulaId : "";
        const motivo = typeof req.motivo === "string" ? req.motivo : "";
        const criadoEm = typeof req.criadoEm === "string" ? req.criadoEm : "";
        const alunoNome = typeof req?.aluno?.nome === "string" ? req.aluno.nome : "";
        const aula = req?.aula && typeof req.aula === "object" ? req.aula : null;
        const dateKey = typeof aula?.dateKey === "string" ? aula.dateKey : "";
        const horaInicio = typeof aula?.horaInicio === "string" ? aula.horaInicio : "";
        const horaFim = typeof aula?.horaFim === "string" ? aula.horaFim : "";
        const professorNome = typeof aula?.professorNome === "string" ? aula.professorNome : "";
        if (!id || !aulaId) return null;
        return { id, aulaId, motivo, criadoEm, alunoNome, dateKey, horaInicio, horaFim, professorNome };
      })
      .filter(Boolean);

    adminRescheduleState.lastLoadedAt = Date.now();
    if (body.dataset.activePanel === "ao-vivo") {
      renderAdminRescheduleRequests();
    }
  } catch (error) {
    // keep last snapshot
  } finally {
    adminRescheduleState.isLoading = false;
  }
};

const renderAdminRescheduleRequests = () => {
  if (!(adminRescheduleList instanceof HTMLElement)) return;
  refreshAdminRescheduleRequests();
  const items = Array.isArray(adminRescheduleState.requests) ? adminRescheduleState.requests : [];

  if (adminRescheduleEmpty instanceof HTMLElement) {
    adminRescheduleEmpty.hidden = items.length > 0;
  }

  adminRescheduleList.innerHTML = items
    .map((req) => {
      const weekday = weekdayLongFromDateKey(req.dateKey);
      const dateLabel = formatBrDateFromDateKey(req.dateKey);
      const when = `${weekday} · ${dateLabel} · ${req.horaInicio || ""}`;
      const prof = req.professorNome ? ` · ${req.professorNome}` : "";
      return `
        <li class="admin-requests-item">
          <div class="admin-requests-main">
            <div class="admin-requests-title">${escapeHtml(req.alunoNome || "Aluno")}</div>
            <div class="admin-requests-meta">${escapeHtml(when)}${escapeHtml(prof)}</div>
            <div class="admin-requests-reason">${escapeHtml(req.motivo || "")}</div>
          </div>
          <div class="admin-requests-actions">
            <button class="admin-requests-btn" type="button" data-admin-reschedule-approve="${escapeHtml(req.id)}">Aprovar</button>
            <button class="admin-requests-btn is-danger" type="button" data-admin-reschedule-reject="${escapeHtml(req.id)}">Recusar</button>
          </div>
        </li>
      `;
    })
    .join("");
};

const apiWorkHoursToLocalWorkHours = (apiWorkHours) => {
  const base = defaultWorkHours();
  Object.keys(liveSlotPresetsBase).forEach((dayKey) => {
    const windowsRaw = apiWorkHours && typeof apiWorkHours === "object" ? apiWorkHours[String(dayKey)] : null;
    const windows = Array.isArray(windowsRaw) ? windowsRaw : [];
    const normalized = windows
      .map((w) => {
        if (!w || typeof w !== "object") return null;
        const startMin = Number(w.startMin);
        const endMin = Number(w.endMin);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
        return { start: formatHmFromMinutes(startMin), end: formatHmFromMinutes(endMin) };
      })
      .filter(Boolean);

    if (!normalized.length) {
      base[dayKey] = { enabled: false, windows: [{ start: "", end: "" }] };
      return;
    }

    base[dayKey] = { enabled: true, windows: normalized };
  });
  return base;
};

const workHoursDraftToApiPayload = (draft) => {
  const out = {};
  out["0"] = [];
  Object.keys(liveSlotPresetsBase).forEach((dayKey) => {
    const entry = draft?.[dayKey];
    if (!entry || entry.enabled === false) {
      out[String(dayKey)] = [];
      return;
    }
    const windows = Array.isArray(entry.windows) ? entry.windows : [];
    out[String(dayKey)] = windows
      .map((w) => {
        const startMin = timeToMinutes(w?.start);
        const endMin = timeToMinutes(w?.end);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
        return { startMin, endMin };
      })
      .filter(Boolean);
  });
  return { workHours: out };
};

const refreshTeacherWorkHours = async ({ force = false } = {}) => {
  if (currentRole !== "teacher") return;
  if (teacherWorkHoursApiState.isLoading) return;
  const now = Date.now();
  if (!force && teacherWorkHoursApiState.lastLoadedAt && now - teacherWorkHoursApiState.lastLoadedAt < 30_000) return;

  teacherWorkHoursApiState.isLoading = true;
  try {
    const res = await fetchWithAuth("/api/teacher-workhours");
    if (!res.ok) throw new Error("work_hours_fetch_failed");
    const data = await res.json().catch(() => null);
    teacherWorkHours = apiWorkHoursToLocalWorkHours(data?.workHours);
    persistTeacherWorkHours();
    teacherWorkHoursApiState.lastLoadedAt = Date.now();

    if (body.dataset.activePanel === "ao-vivo") {
      renderTeacherCalendar();
    }
  } catch (error) {
    // ignore
  } finally {
    teacherWorkHoursApiState.isLoading = false;
  }
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
  if ((currentRole === "teacher" || currentRole === "admin") && teacherEventsState.lastLoadedAt) {
    return teacherEventsState.events
      .filter((evt) => evt.type === "lesson")
      .map((evt) => {
        const start = buildDateFromDateKeyAndMinutes(evt.dateKey, evt.startMin);
        const end = buildDateFromDateKeyAndMinutes(evt.dateKey, evt.endMin);
        if (!start || !end) return null;
        return {
          id: evt.id,
          type: "lesson",
          title: evt.title || "Aluno",
          start,
          end,
          recorrente: Boolean(evt.recorrente),
          grupoRecorrenciaId: evt.grupoRecorrenciaId || null,
          alunoId: evt.alunoId || null,
          professorId: evt.professorId || "",
        };
      })
      .filter(Boolean);
  }

  return [];
};

const getManualEvents = () => {
  if ((currentRole === "teacher" || currentRole === "admin") && teacherEventsState.lastLoadedAt) {
    return teacherEventsState.events
      .filter((evt) => evt.type === "manual")
      .map((evt) => {
        const start = buildDateFromDateKeyAndMinutes(evt.dateKey, evt.startMin);
        const end = buildDateFromDateKeyAndMinutes(evt.dateKey, evt.endMin);
        if (!start || !end) return null;
        return {
          id: evt.id,
          type: "manual",
          title: evt.title || "",
          description: evt.description || "",
          guests: Array.isArray(evt.guests) ? evt.guests : [],
          documents: Array.isArray(evt.documents) ? evt.documents : [],
          start,
          end,
          recorrente: Boolean(evt.recorrente),
          grupoRecorrenciaId: evt.grupoRecorrenciaId || null,
          alunoId: evt.alunoId || null,
          professorId: evt.professorId || "",
        };
      })
      .filter(Boolean);
  }

  return [];
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
      <div class="teacher-cal-grid" data-teacher-cal-grid="${createDateKey(date)}" data-teacher-cal-start="${startHour}" data-teacher-cal-end="${endHour}">
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
        <div class="teacher-cal-week-col" data-teacher-cal-col="${createDateKey(date)}">
          <div class="teacher-cal-grid" data-teacher-cal-grid="${createDateKey(date)}" data-teacher-cal-start="${startHour}" data-teacher-cal-end="${endHour}">
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
      <div class="teacher-cal-month-cell" data-teacher-cal-month-day="${createDateKey(date)}">
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
  if (currentRole !== "teacher" && currentRole !== "admin") return;
  if (!liveTeacherRoot || liveTeacherRoot.hidden) return;
  if (!teacherCalViewport) return;

  // Any in-progress drag selection should be cleared when re-rendering the calendar view.
  clearTeacherCalendarSelection();
  refreshTeacherWorkHours();
  refreshTeacherEvents();

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
  const labelMap = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };
  const isEnabled = entry.enabled !== false;

  const disabledRow = `
    <div class="modal-work-row is-disabled" data-wh-row="${dayKey}:0">
      <label class="modal-work-day">
        <input type="checkbox" ${isEnabled ? "checked" : ""} data-wh-enabled="${dayKey}" />
        <span>${labelMap[dayKey] || dayKey}</span>
      </label>
      <div class="modal-work-unavailable">Indisponível</div>
    </div>
  `;

  const enabledRows = windows.map((_, index) => renderWorkHoursRow({ dayKey, index })).join("");

  return `
    <div class="modal-work-daygroup" data-wh-daygroup="${dayKey}">
      ${isEnabled ? enabledRows : disabledRow}
    </div>
  `;
};

const renderWorkHoursModalBody = () => {
  const keys = Object.keys(liveSlotPresetsBase);
  return `
    <div class="modal-form">
      <div class="modal-help">Defina quando você está disponível para receber agendamentos.</div>
      <div class="modal-inline-error" data-wh-global-error hidden></div>
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
  // Try to load the server-side snapshot before editing, so the modal reflects what's actually saved.
  refreshTeacherWorkHours({ force: true }).finally(() => {
    workHoursDraft = createWorkHoursDraft();
    openModal({
      title: "Horário de trabalho",
      bodyHtml: renderWorkHoursModalBody(),
      primaryLabel: "Salvar",
      secondaryLabel: "Voltar",
      onPrimary: () => {
      const ok = validateWorkHoursDraft();
      if (!ok) return false;

      const globalError = modalBody?.querySelector("[data-wh-global-error]");
      if (globalError instanceof HTMLElement) {
        globalError.hidden = true;
        globalError.textContent = "";
      }

      const previousPrimaryLabel = modalPrimary ? modalPrimary.textContent : "";
      if (modalPrimary) {
        modalPrimary.disabled = true;
        modalPrimary.textContent = "Salvando…";
      }
      if (modalSecondary) modalSecondary.disabled = true;

      Promise.resolve()
        .then(async () => {
          const res = await fetchWithAuth("/api/teacher-workhours", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(workHoursDraftToApiPayload(workHoursDraft)),
          });

          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const error = new Error("save_failed");
            error.status = res.status;
            error.payload = data;
            throw error;
          }

          teacherWorkHours = workHoursDraft;
          persistTeacherWorkHours();
          teacherWorkHoursApiState.lastLoadedAt = Date.now();
          closeModal();
          renderTeacherCalendar();
        })
        .catch((error) => {
          // Log the root cause so it shows up in the browser console when debugging.
          // eslint-disable-next-line no-console
          console.error("[work-hours] save failed", error);

          let message = "Não foi possível salvar agora. Tente novamente.";
          const status = Number(error?.status) || 0;
          const payload = error?.payload && typeof error.payload === "object" ? error.payload : null;
          const code = typeof payload?.error === "string" ? payload.error : "";

          if (status === 401) message = "Sua sessão expirou. Faça login novamente.";
          if (status === 403) message = "Sem permissão para salvar seus horários.";
          if (code === "invalid_work_hours") message = "Revise os horários e tente novamente.";
          if (code === "invalid_json") message = "Erro ao enviar os dados. Tente novamente.";
          if (code === "internal_error") message = "Erro interno ao salvar. Tente novamente em instantes.";

          // Helpful for debugging (kept subtle, avoids polluting the UI too much).
          if (status && message.includes("Tente novamente")) {
            message = `${message} (Erro ${status})`;
          }

          if (globalError instanceof HTMLElement) {
            globalError.hidden = false;
            globalError.textContent = message;
          }
        })
        .finally(() => {
          if (modalPrimary) {
            modalPrimary.disabled = false;
            modalPrimary.textContent = previousPrimaryLabel || "Salvar";
          }
          if (modalSecondary) modalSecondary.disabled = false;
        });

      return false;
      },
    });
    validateWorkHoursDraft();
  });
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

function syncAdminEventUserSelects() {
  if (currentRole !== "admin") return;
  if (!createEventDraft || !modalBody || modalOverlay?.hidden) return;
  if (activeModalKind !== "event-form") return;

  const studentSelect = modalBody.querySelector("[data-ce-admin-student]");
  const teacherSelect = modalBody.querySelector("[data-ce-admin-teacher]");
  if (!(studentSelect instanceof HTMLSelectElement) || !(teacherSelect instanceof HTMLSelectElement)) return;

  const teacherRows = adminUsersState?.teacher?.rows ? adminUsersState.teacher.rows : [];
  const studentRows = adminUsersState?.student?.rows ? adminUsersState.student.rows : [];

  const teachersSorted = (Array.isArray(teacherRows) ? teacherRows : [])
    .filter((r) => r && r.ativo)
    .slice()
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

  const studentsSorted = (Array.isArray(studentRows) ? studentRows : [])
    .filter((r) => r && r.ativo)
    .slice()
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

  const selectedTeacherId = String(createEventDraft.professorId || "").trim();
  const selectedStudentId = String(createEventDraft.alunoId || "").trim();

  teacherSelect.innerHTML = teachersSorted.length
    ? `<option value="">Selecione um professor</option>${teachersSorted
        .map((row) => {
          const isSelected = selectedTeacherId && row.id === selectedTeacherId;
          return `<option value="${escapeHtml(row.id)}" ${isSelected ? "selected" : ""}>${escapeHtml(row.nome)}</option>`;
        })
        .join("")}`
    : `<option value="">Carregando professores…</option>`;

  studentSelect.innerHTML = studentsSorted.length
    ? `<option value="">Selecione um aluno</option>${studentsSorted
        .map((row) => {
          const isSelected = selectedStudentId && row.id === selectedStudentId;
          return `<option value="${escapeHtml(row.id)}" ${isSelected ? "selected" : ""}>${escapeHtml(row.nome)}</option>`;
        })
        .join("")}`
    : `<option value="">Carregando alunos…</option>`;
}

const buildCreateEventBody = ({ readOnly = false } = {}) => {
  const draft = createEventDraft || {};
  const guests = Array.isArray(draft.guests) ? draft.guests : [];
  const docs = Array.isArray(draft.documents) ? draft.documents : [];
  const isAdmin = currentRole === "admin";
  const showAdminLinks = isAdmin && !readOnly;
  const teacherRows = showAdminLinks && adminUsersState?.teacher?.rows ? adminUsersState.teacher.rows : [];
  const studentRows = showAdminLinks && adminUsersState?.student?.rows ? adminUsersState.student.rows : [];
  const activeTeachers = Array.isArray(teacherRows) ? teacherRows.filter((r) => r && r.ativo) : [];
  const activeStudents = Array.isArray(studentRows) ? studentRows.filter((r) => r && r.ativo) : [];
  const teachersSorted = activeTeachers.slice().sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  const studentsSorted = activeStudents.slice().sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

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
  const repeatEnabled = Boolean(draft.recorrente);
  const repeatMode = String(draft.repeatMode || "weekly");
  const weeklyLabel = (() => {
    const weekday = weekdayLongFromDateKey(String(draft.dateKey || ""));
    return weekday ? `Semanal: cada ${weekday.toLowerCase()}` : "Semanal: toda semana";
  })();

  const selectedTeacherId = String(draft.professorId || "").trim();
  const selectedStudentId = String(draft.alunoId || "").trim();

  const teacherOptions = teachersSorted.length
    ? `<option value="">Selecione um professor</option>${teachersSorted
        .map((row) => {
          const isSelected = selectedTeacherId && row.id === selectedTeacherId;
          return `<option value="${escapeHtml(row.id)}" ${isSelected ? "selected" : ""}>${escapeHtml(row.nome)}</option>`;
        })
        .join("")}`
    : `<option value="">Carregando professores…</option>`;

  const studentOptions = studentsSorted.length
    ? `<option value="">Selecione um aluno</option>${studentsSorted
        .map((row) => {
          const isSelected = selectedStudentId && row.id === selectedStudentId;
          return `<option value="${escapeHtml(row.id)}" ${isSelected ? "selected" : ""}>${escapeHtml(row.nome)}</option>`;
        })
        .join("")}`
    : `<option value="">Carregando alunos…</option>`;

  return `
    <div class="modal-form">
      ${
        showAdminLinks
          ? `
            <div class="modal-row" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);">
              <label class="modal-field">
                <span>Aluno</span>
                <select class="modal-input" data-ce-admin-student ${disabledAttr}>${studentOptions}</select>
              </label>
              <label class="modal-field">
                <span>Professor</span>
                <select class="modal-input" data-ce-admin-teacher ${disabledAttr}>${teacherOptions}</select>
              </label>
            </div>
          `
          : ""
      }

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

      <div class="modal-row" style="grid-template-columns: minmax(0, 1fr);">
        <label class="modal-field modal-field-inline">
          <span>Se repete</span>
          <input type="checkbox" data-ce-repeat ${repeatEnabled ? "checked" : ""} ${disabledAttr} />
        </label>
      </div>

      <div class="modal-row" data-ce-repeat-options ${repeatEnabled ? "" : "hidden"} style="grid-template-columns: minmax(0, 1fr);">
        <label class="modal-field">
          <span>Frequência</span>
          <select class="modal-input" data-ce-repeat-mode ${disabledAttr}>
            <option value="weekly" ${repeatMode !== "daily" ? "selected" : ""}>${escapeHtml(weeklyLabel)}</option>
            <option value="daily" ${repeatMode === "daily" ? "selected" : ""}>Todos os dias (segunda a sábado)</option>
          </select>
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
  const adminStudentEl = modalBody.querySelector("[data-ce-admin-student]");
  const adminTeacherEl = modalBody.querySelector("[data-ce-admin-teacher]");
  const dateEl = modalBody.querySelector("[data-ce-date]");
  const startEl = modalBody.querySelector("[data-ce-start]");
  const endEl = modalBody.querySelector("[data-ce-end]");

  [titleEl, adminStudentEl, adminTeacherEl, dateEl, startEl, endEl].forEach((el) => {
    if (el instanceof HTMLElement) el.classList.remove("is-error");
  });

  const title = String(createEventDraft.title || "").trim();
  const requiresTitle = currentRole === "teacher" && createEventDraft.eventType !== "lesson";
  if (requiresTitle && !title) {
    if (titleEl instanceof HTMLElement) titleEl.classList.add("is-error");
    hasError = true;
  }

  const requiresLinks = currentRole === "admin" && createEventDraft.eventType === "lesson";
  if (requiresLinks) {
    const alunoId = String(createEventDraft.alunoId || "").trim();
    const professorId = String(createEventDraft.professorId || "").trim();
    if (!alunoId) {
      if (adminStudentEl instanceof HTMLElement) adminStudentEl.classList.add("is-error");
      hasError = true;
    }
    if (!professorId) {
      if (adminTeacherEl instanceof HTMLElement) adminTeacherEl.classList.add("is-error");
      hasError = true;
    }
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

  if (createEventDraft.recorrente) {
    const mode = String(createEventDraft.repeatMode || "").trim().toLowerCase();
    if (mode !== "weekly" && mode !== "daily") {
      hasError = true;
      if (errorEl instanceof HTMLElement) {
        errorEl.hidden = false;
        errorEl.textContent = "Selecione uma frequência válida.";
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
  const showTrash = !readOnly && mode === "edit" && (currentRole === "admin" || eventType === "manual");

  const saveFromDraft = () => {
    const ok = validateCreateEventDraft();
    if (!ok) return false;
    const date = parseDateKey(createEventDraft.dateKey);
    if (!date) return false;
    const start = getSlotDateTime(date, clampTime(createEventDraft.startTime, "08:00"));
    const end = getSlotDateTime(date, clampTime(createEventDraft.endTime, "09:00"));
    if (end.getTime() <= start.getTime()) return false;
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = end.getHours() * 60 + end.getMinutes();

    const payload = {
      id: createEventDraft.eventId || undefined,
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
      dateKey: createEventDraft.dateKey,
      startMin,
      endMin,
    };

    if (mode === "create" && createEventDraft.recorrente) {
      payload.recorrente = true;
      payload.repeatMode = String(createEventDraft.repeatMode || "weekly");
    }

    if (currentRole === "admin") {
      payload.professorId = String(createEventDraft.professorId || "").trim();
      const alunoId = String(createEventDraft.alunoId || "").trim();
      payload.alunoId = alunoId ? alunoId : null;
    }

    const errorEl = modalBody?.querySelector("[data-ce-error]");
    if (errorEl instanceof HTMLElement) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }

    if (modalPrimary) modalPrimary.disabled = true;
    if (modalSecondary) modalSecondary.disabled = true;

    const method = mode === "create" ? "POST" : "PUT";
    fetchWithAuth("/api/schedule-events", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            data?.error === "title_required"
              ? "Preencha o título para salvar."
              : data?.error === "invalid_time"
                ? "O horário de início deve ser anterior ao de fim."
                : data?.error === "professor_required"
                  ? "Selecione um professor para salvar."
                  : "Não foi possível salvar agora.";
          if (errorEl instanceof HTMLElement) {
            errorEl.hidden = false;
            errorEl.textContent = msg;
          }
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
          return;
        }

        closeModal();
        refreshTeacherEvents({ force: true });
        renderTeacherCalendar();
      })
      .catch(() => {
        if (errorEl instanceof HTMLElement) {
          errorEl.hidden = false;
          errorEl.textContent = "Não foi possível salvar agora. Tente novamente.";
        }
        if (modalPrimary) modalPrimary.disabled = false;
        if (modalSecondary) modalSecondary.disabled = false;
      });

    return false;
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
          const id = createEventDraft?.eventId || "";
          if (!id) return false;

          const runDelete = (mode) => {
            if (modalPrimary) modalPrimary.disabled = true;
            if (modalSecondary) modalSecondary.disabled = true;

            fetchWithAuth(
              `/api/schedule-events?id=${encodeURIComponent(id)}&mode=${encodeURIComponent(mode || "single")}`,
              {
                method: "DELETE",
              }
            )
              .then(async (res) => {
                if (!res.ok) throw new Error("delete_failed");
                closeModal();
                refreshTeacherEvents({ force: true });
                renderTeacherCalendar();
              })
              .catch(() => {
                if (modalBody) {
                  modalBody.innerHTML = "Não foi possível remover agora. Tente novamente.";
                }
                if (modalPrimary) modalPrimary.disabled = false;
                if (modalSecondary) modalSecondary.disabled = false;
              });
          };

          const groupId = String(createEventDraft?.grupoRecorrenciaId || "").trim();
          if (groupId) {
            openModal({
              title: "Remover evento recorrente",
              bodyHtml: "Este evento faz parte de uma recorrência. O que você deseja fazer?",
              primaryLabel: "Excluir apenas este",
              secondaryLabel: "Excluir todos os futuros",
              hideSecondary: false,
              showTrash: false,
              onPrimary: () => {
                runDelete("single");
                return false;
              },
              onSecondary: () => {
                runDelete("future");
                return false;
              },
            });
            return false;
          }

          openModal({
            title: "Remover evento",
            bodyHtml: "Tem certeza que deseja remover este evento? Esta ação não pode ser desfeita.",
            primaryLabel: "Remover evento",
            secondaryLabel: "Cancelar",
            hideSecondary: false,
            showTrash: false,
            onSecondary: () => {
              openTeacherEventFormModalFromDraft();
              return false;
            },
            onPrimary: () => {
              runDelete("single");
              return false;
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
    if (currentRole === "admin") {
      loadUsersFromFirestore("teacher");
      loadUsersFromFirestore("student");
      syncAdminEventUserSelects();
    }
    validateCreateEventDraft();
    syncGuestDropdown();
  } else {
    setModalPrimaryDisabled(false);
  }
};

const openTeacherCreateEventModalAt = ({ dateKey, startTime, endTime } = {}) => {
  const date = parseDateKey(dateKey);
  if (!date) return;
  const eventType = currentRole === "admin" ? "lesson" : "manual";

  createEventDraft = {
    mode: "create",
    readOnly: false,
    eventType,
    eventId: "",
    alunoId: "",
    professorId: "",
    title: "",
    description: "",
    guests: [],
    guestQuery: "",
    documents: [],
    recorrente: false,
    repeatMode: "weekly",
    grupoRecorrenciaId: "",
    dateKey: createDateKey(date),
    startTime: clampTime(startTime, "09:00"),
    endTime: clampTime(endTime, "09:30"),
  };

  openTeacherEventFormModalFromDraft();
};

const openTeacherCreateEventModal = () => {
  const focus = teacherCalendarState.focusDate;
  const startHour = Math.min(Math.max(new Date().getHours(), 6), 20);
  const startDefault = `${String(startHour).padStart(2, "0")}:00`;
  const endDefault = `${String(Math.min(startHour + 1, 23)).padStart(2, "0")}:00`;
  const eventType = currentRole === "admin" ? "lesson" : "manual";

  createEventDraft = {
    mode: "create",
    readOnly: false,
    eventType,
    eventId: "",
    alunoId: "",
    professorId: "",
    title: "",
    description: "",
    guests: [],
    guestQuery: "",
    documents: [],
    recorrente: false,
    repeatMode: "weekly",
    grupoRecorrenciaId: "",
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
    const isAdmin = currentRole === "admin";
    createEventDraft = {
      mode: isAdmin ? "edit" : "view",
      readOnly: !isAdmin,
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
      alunoId: target.alunoId || "",
      professorId: target.professorId || "",
      recorrente: Boolean(target.recorrente),
      repeatMode: "weekly",
      grupoRecorrenciaId: target.grupoRecorrenciaId || "",
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
    alunoId: "",
    professorId: target.professorId || "",
    title: target.title || "",
    description: target.description || "",
    guests,
    guestQuery: "",
    documents: Array.isArray(target.documents) ? target.documents : [],
    dateKey: createDateKey(target.start),
    startTime: buildEventTimeHm(target.start),
    endTime: buildEventTimeHm(target.end),
    recorrente: Boolean(target.recorrente),
    repeatMode: "weekly",
    grupoRecorrenciaId: target.grupoRecorrenciaId || "",
  };

  openTeacherEventFormModalFromDraft();
};

const getSlotDateTime = (date, time) => {
  const [hours, minutes] = time.split(":").map(Number);
  const slotDate = new Date(date);
  slotDate.setHours(hours, minutes, 0, 0);
  return slotDate;
};

// Student "Aulas ao vivo" (modelo novo): lista fixa de aulas + solicitação de reagendamento.
const WEEKDAY_LONG = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const weekdayLongFromDateKey = (dateKey) => {
  const raw = String(dateKey || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [y, m, d] = raw.split("-").map((v) => Number(v));
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_LONG[dow] || "";
};

const formatBrDateFromDateKey = (dateKey) => {
  const raw = String(dateKey || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const y = raw.slice(0, 4);
  const m = raw.slice(5, 7);
  const d = raw.slice(8, 10);
  return `${d}/${m}/${y}`;
};

const statusLabelForRequest = (status) => {
  const s = String(status || "").trim().toLowerCase();
  if (s === "aprovado") return "Aprovado";
  if (s === "recusado") return "Recusado";
  return "Pendente";
};

const statusClassForRequest = (status) => {
  const s = String(status || "").trim().toLowerCase();
  if (s === "aprovado") return "badge-aprovado";
  if (s === "recusado") return "badge-recusado";
  return "badge-pendente";
};

const openStudentRescheduleModal = (lesson) => {
  if (!lesson) return;
  const weekday = weekdayLongFromDateKey(lesson.dateKey);
  const dateLabel = formatBrDateFromDateKey(lesson.dateKey);
  const timeLabel = lesson.time || "";

  openModal({
    title: "Solicitar reagendamento",
    bodyHtml: `
      <div class="modal-form">
        <div class="modal-inline-note">Aula: <strong>${escapeHtml(weekday)}</strong> · ${escapeHtml(dateLabel)} · ${escapeHtml(timeLabel)}</div>
        <label class="modal-field">
          <span>Motivo</span>
          <textarea class="modal-textarea" data-reschedule-reason placeholder="Escreva o motivo do reagendamento..."></textarea>
        </label>
        <div class="modal-inline-error" data-reschedule-error hidden></div>
      </div>
    `,
    primaryLabel: "Enviar",
    secondaryLabel: "Voltar",
    hideSecondary: false,
    showTrash: false,
    onPrimary: () => {
      const reasonEl = modalBody?.querySelector("[data-reschedule-reason]");
      const errEl = modalBody?.querySelector("[data-reschedule-error]");
      const motivo = reasonEl instanceof HTMLTextAreaElement ? reasonEl.value.trim() : "";

      if (errEl instanceof HTMLElement) {
        errEl.hidden = true;
        errEl.textContent = "";
      }

      if (!motivo) {
        if (errEl instanceof HTMLElement) {
          errEl.hidden = false;
          errEl.textContent = "Escreva um motivo para continuar.";
        }
        return false;
      }

      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;

      fetchWithAuth("/api/schedule-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aulaId: lesson.id, motivo }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const msg =
              data?.error === "motivo_required"
                ? "Escreva um motivo para continuar."
                : data?.error === "not_found"
                  ? "Aula não encontrada."
                  : "Não foi possível enviar agora. Tente novamente.";
            if (errEl instanceof HTMLElement) {
              errEl.hidden = false;
              errEl.textContent = msg;
            }
            if (modalPrimary) modalPrimary.disabled = false;
            if (modalSecondary) modalSecondary.disabled = false;
            return;
          }

          closeModal();
          renderStudentLiveLessons({ force: true });
        })
        .catch(() => {
          if (errEl instanceof HTMLElement) {
            errEl.hidden = false;
            errEl.textContent = "Não foi possível enviar agora. Tente novamente.";
          }
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
        });

      return false;
    },
  });
};

const renderStudentLiveLessons = async ({ force = false } = {}) => {
  if (!(liveStudentLessonsList instanceof HTMLElement)) return;
  if (currentRole !== "student") return;

  const now = Date.now();
  const shouldFetch = Boolean(force) || !studentLessonsState.lastLoadedAt || now - studentLessonsState.lastLoadedAt >= 15_000;

  if (shouldFetch && !studentLessonsState.isLoading) {
    studentLessonsState.isLoading = true;
    try {
      const res = await fetchWithAuth("/api/schedule-lessons");
      if (!res.ok) throw new Error("lessons_fetch_failed");
      const data = await res.json().catch(() => null);
      const raw = Array.isArray(data?.lessons) ? data.lessons : [];

      studentLessonsState.lessons = raw
        .map((lesson) => {
          if (!lesson || typeof lesson !== "object") return null;
          const id = typeof lesson.id === "string" ? lesson.id : "";
          const dateKey = typeof lesson.dateKey === "string" ? lesson.dateKey : "";
          const startMin = Number(lesson.startMin);
          const endMin = Number(lesson.endMin);
          if (!id || !dateKey || !Number.isFinite(startMin) || !Number.isFinite(endMin)) return null;
          const professorId = typeof lesson.professorId === "string" ? lesson.professorId : "";
          const professor = typeof lesson.professor_nome === "string" ? lesson.professor_nome : "";
          const req = lesson.reagendamento && typeof lesson.reagendamento === "object" ? lesson.reagendamento : null;
          const reqStatus = req && typeof req.status === "string" ? req.status : "";
          const reqId = req && typeof req.id === "string" ? req.id : "";
          return {
            id,
            dateKey,
            startMin,
            endMin,
            time: formatHmFromMinutes(startMin),
            professorId,
            professor,
            request: reqId ? { id: reqId, status: reqStatus || "pendente" } : null,
          };
        })
        .filter(Boolean);

      studentLessonsState.lastLoadedAt = Date.now();
    } catch (error) {
      // keep last snapshot
    } finally {
      studentLessonsState.isLoading = false;
    }
  }

  const lessons = Array.isArray(studentLessonsState.lessons) ? studentLessonsState.lessons : [];
  if (liveStudentEmpty instanceof HTMLElement) {
    liveStudentEmpty.hidden = lessons.length > 0;
  }

  liveStudentLessonsList.innerHTML = lessons
    .map((lesson) => {
      const weekday = weekdayLongFromDateKey(lesson.dateKey);
      const dateLabel = formatBrDateFromDateKey(lesson.dateKey);
      const professor = lesson.professor ? lesson.professor : "Professor";
      const req = lesson.request;
      const badge = req
        ? `<span class="live-fixed-badge ${statusClassForRequest(req.status)}">${escapeHtml(statusLabelForRequest(req.status))}</span>`
        : "";
      const disabled = req && String(req.status || "").toLowerCase() === "pendente" ? "disabled" : "";
      return `
        <li class="live-fixed-item">
          <div class="live-fixed-main">
            <div class="live-fixed-when">
              <span class="live-fixed-weekday">${escapeHtml(weekday)}</span>
              <span class="live-fixed-date">${escapeHtml(dateLabel)}</span>
            </div>
            <div class="live-fixed-meta">
              <span class="live-fixed-time">${escapeHtml(lesson.time)}</span>
              <span class="live-fixed-prof">${escapeHtml(professor)}</span>
            </div>
          </div>
          <div class="live-fixed-actions">
            ${badge}
            <button class="live-fixed-action" type="button" data-live-reschedule="${escapeHtml(lesson.id)}" ${disabled}>
              Solicitar reagendamento
            </button>
          </div>
        </li>
      `;
    })
    .join("");
};

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD0qyhYh6MWRPMRDN_SYqdDEeogS3thQPE",
  authDomain: "plataforma-space.firebaseapp.com",
  projectId: "plataforma-space",
  storageBucket: "plataforma-space.firebasestorage.app",
  messagingSenderId: "984031970274",
  appId: "1:984031970274:web:fff5da2fe5e318b04aefbb",
  measurementId: "G-X28MKDJPKE",
};

let firebaseAdminApiPromise = null;

const withTimeout = (promise, ms, label) => {
  const timeoutMs = Number(ms);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error("timeout");
      error.code = "timeout";
      error.label = label || "";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
};

const loadFirebaseAdminApi = () => {
  if (firebaseAdminApiPromise) return firebaseAdminApiPromise;

  firebaseAdminApiPromise = Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
  ]).then(([appMod, authMod, fsMod]) => {
    const getOrInitApp = (name) => {
      try {
        return name ? appMod.getApp(name) : appMod.getApp();
      } catch (error) {
        return name ? appMod.initializeApp(FIREBASE_CONFIG, name) : appMod.initializeApp(FIREBASE_CONFIG);
      }
    };

    const primaryApp = getOrInitApp();
    const secondaryApp = getOrInitApp("secondary");

    const primaryAuth = authMod.getAuth(primaryApp);
    const secondaryAuth = authMod.getAuth(secondaryApp);
    const primaryDb = fsMod.getFirestore(primaryApp);
    const secondaryDb = fsMod.getFirestore(secondaryApp);

    return {
      primaryAuth,
      secondaryAuth,
      primaryDb,
      secondaryDb,
      createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
      sendPasswordResetEmail: authMod.sendPasswordResetEmail,
      onAuthStateChanged: authMod.onAuthStateChanged,
      signOut: authMod.signOut,
      collection: fsMod.collection,
      doc: fsMod.doc,
      getDoc: fsMod.getDoc,
      getDocs: fsMod.getDocs,
      limit: fsMod.limit,
      orderBy: fsMod.orderBy,
      query: fsMod.query,
      setDoc: fsMod.setDoc,
      serverTimestamp: fsMod.serverTimestamp,
      where: fsMod.where,
    };
  });

  return firebaseAdminApiPromise;
};

const waitForFirebaseAuthReady = (firebase, timeoutMs = 4000) => {
  if (!firebase || !firebase.primaryAuth || typeof firebase.onAuthStateChanged !== "function") return Promise.resolve(null);
  if (firebase.primaryAuth.currentUser) return Promise.resolve(firebase.primaryAuth.currentUser);

  const ms = Number(timeoutMs);
  const safeTimeout = Number.isFinite(ms) && ms > 0 ? ms : 4000;

  return new Promise((resolve) => {
    let settled = false;
    let unsub = null;

    const finish = (user) => {
      if (settled) return;
      settled = true;
      try {
        if (typeof unsub === "function") unsub();
      } catch (error) {
        // ignore
      }
      resolve(user || null);
    };

    unsub = firebase.onAuthStateChanged(firebase.primaryAuth, (user) => finish(user));
    window.setTimeout(() => finish(null), safeTimeout);
  });
};

let cachedFirebaseIdToken = {
  uid: "",
  token: "",
  expiresAt: 0,
};

const getFirebaseIdTokenForApi = async () => {
  try {
    const firebase = await loadFirebaseAdminApi();
    const user = await waitForFirebaseAuthReady(firebase, 3500);
    if (!user || typeof user.getIdToken !== "function") return "";

    const uid = String(user.uid || "");
    const now = Date.now();
    if (cachedFirebaseIdToken.uid === uid && cachedFirebaseIdToken.token && cachedFirebaseIdToken.expiresAt > now) {
      return cachedFirebaseIdToken.token;
    }

    const token = await user.getIdToken();
    cachedFirebaseIdToken = {
      uid,
      token: String(token || ""),
      // Firebase ID tokens are valid for ~1h; we refresh frequently to keep API calls snappy.
      expiresAt: now + 180_000,
    };
    return cachedFirebaseIdToken.token;
  } catch (error) {
    return "";
  }
};

const fetchWithAuth = async (input, init = {}) => {
  const opts = init && typeof init === "object" ? init : {};
  const headers = new Headers(opts.headers || {});
  const token = await getFirebaseIdTokenForApi();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...opts, headers, credentials: opts.credentials || "include" });
};

const normalizeUserCreationRole = (value) => {
  const role = normalizeRole(value);
  if (role === "student" || role === "teacher") return role;
  return "";
};

const setAdminUserLoading = (isLoading) => {
  const loading = Boolean(isLoading);
  if (adminUserSubmit instanceof HTMLButtonElement) adminUserSubmit.disabled = loading;
  if (adminUserSpinner instanceof HTMLElement) adminUserSpinner.hidden = !loading;
  if (adminUserSubmitLabel instanceof HTMLElement) adminUserSubmitLabel.hidden = loading;
};

const setAdminUserStatus = (text, tone = "") => {
  if (!(adminUserStatus instanceof HTMLElement)) return;
  adminUserStatus.textContent = text || "";
  adminUserStatus.dataset.tone = tone || "";
};

const formatAdminDate = (value) => {
  if (!value) return "—";
  try {
    const date =
      value instanceof Date
        ? value
        : typeof value?.toDate === "function"
          ? value.toDate()
          : typeof value === "number"
            ? new Date(value)
            : new Date(String(value));
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = String(date.getFullYear());
    return `${d}/${m}/${y}`;
  } catch (error) {
    return "—";
  }
};

const setAdminManageStatus = (type, text, tone = "") => {
  const safeType = type === "teacher" ? "teacher" : type === "growth" ? "growth" : "student";
  const el =
    safeType === "teacher"
      ? adminManageStatusTeacher
      : safeType === "growth"
        ? adminManageStatusGrowth
        : adminManageStatusStudent;
  if (!(el instanceof HTMLElement)) return;
  el.textContent = text || "";
  el.dataset.tone = tone || "";
};

let adminUsersState = {
  teacher: { rows: [], query: "", loadedAt: 0, isLoading: false },
  student: { rows: [], query: "", loadedAt: 0, isLoading: false },
  growth: { rows: [], query: "", loadedAt: 0, isLoading: false },
};

let adminGrowthGoalsState = {
  rows: [],
  byCompetencia: new Map(),
  currentCompetencia: "",
  isLoading: false,
  loadedAt: 0,
};

const getCompetenciaKeySaoPaulo = (date = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    if (!year || !month) return "";
    return `${year}-${month}`;
  } catch (error) {
    return "";
  }
};

const isValidCompetenciaKey = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || "").trim());

const parseMoneyPtBrLoose = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  const sanitized = raw.replace(/[^\d.,-]/g, "");
  let normalized = sanitized;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (normalized.includes(".")) {
    const parts = normalized.split(".");
    const last = parts[parts.length - 1] || "";
    if (parts.length > 2 || last.length === 3) normalized = parts.join("");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};

const currencyPtBrNoCents = (value) => {
  try {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(n);
  } catch (error) {
    return "—";
  }
};

const formatCompetenciaLabelPtBr = (competencia) => {
  const key = String(competencia || "").trim();
  if (!isValidCompetenciaKey(key)) return key || "—";
  const [y, m] = key.split("-");
  const date = new Date(`${y}-${m}-01T12:00:00.000Z`);
  try {
    const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" });
    const text = fmt.format(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch (error) {
    return key;
  }
};

const renderAdminGrowthGoals = () => {
  if (!(adminGoalsTable instanceof HTMLElement)) return;
  if (adminGoalsError instanceof HTMLElement) adminGoalsError.hidden = true;

  const rows = Array.isArray(adminGrowthGoalsState.rows) ? adminGrowthGoalsState.rows : [];
  if (adminGoalsEmpty instanceof HTMLElement) adminGoalsEmpty.hidden = rows.length > 0;

  adminGoalsTable.innerHTML = `
    <div class="admin-goals-row is-head">
      <span>Competência</span>
      <span>Meta</span>
      <span>Status</span>
      <span>Atualizado em</span>
      <span>Atualizado por</span>
      <span></span>
    </div>
    ${rows
      .map((g) => {
        const status = String(g.status || "");
        const badgeClass =
          status === "atual" ? "admin-badge is-current" : status === "futura" ? "admin-badge is-future" : "admin-badge is-past";
        const badgeLabel = status === "atual" ? "Atual" : status === "futura" ? "Futura" : "Passada";
        const by = String(g.updatedByName || "").trim() || "—";
        const updatedAt = String(g.updatedAt || "");
        return `
          <div class="admin-goals-row" data-admin-goal-row="${escapeHtml(g.competencia)}">
            <div class="admin-goals-competencia">${escapeHtml(formatCompetenciaLabelPtBr(g.competencia))}</div>
            <div class="admin-goals-value">${escapeHtml(currencyPtBrNoCents(g.valorMeta))}</div>
            <div><span class="${badgeClass}">${badgeLabel}</span></div>
            <div class="admin-goals-updated">${escapeHtml(formatAdminDate(updatedAt))}</div>
            <div class="admin-goals-by" title="${escapeHtml(by)}">${escapeHtml(by)}</div>
            <div class="admin-goals-action">
              <button class="admin-goals-edit" type="button" data-admin-goal-edit="${escapeHtml(g.competencia)}">Editar</button>
            </div>
          </div>
        `;
      })
      .join("")}
  `;
};

const loadAdminGrowthGoals = async () => {
  if (adminGrowthGoalsState.isLoading) return;
  if (currentRole !== "admin") return;
  if (!(adminGoalsTable instanceof HTMLElement)) return;

  adminGrowthGoalsState.isLoading = true;
  if (adminGoalsError instanceof HTMLElement) adminGoalsError.hidden = true;
  if (adminGoalsEmpty instanceof HTMLElement) adminGoalsEmpty.hidden = true;
  adminGoalsTable.innerHTML = `<div class="growth-contracts-loading">Carregando...</div>`;

  try {
    const res = await fetchWithAuth("/api/growth-goals", { method: "GET" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "request_failed");

    const goals = Array.isArray(data?.goals) ? data.goals : [];
    adminGrowthGoalsState.currentCompetencia = String(data?.currentCompetencia || getCompetenciaKeySaoPaulo());
    adminGrowthGoalsState.rows = goals;
    adminGrowthGoalsState.byCompetencia = new Map(goals.map((g) => [String(g.competencia || ""), g]));
    adminGrowthGoalsState.loadedAt = Date.now();
    renderAdminGrowthGoals();
  } catch (error) {
    console.error("[admin] load growth-goals failed:", error);
    adminGrowthGoalsState.rows = [];
    adminGrowthGoalsState.byCompetencia = new Map();
    adminGoalsTable.innerHTML = "";
    if (adminGoalsEmpty instanceof HTMLElement) adminGoalsEmpty.hidden = true;
    if (adminGoalsError instanceof HTMLElement) adminGoalsError.hidden = false;
  } finally {
    adminGrowthGoalsState.isLoading = false;
  }
};

const openAdminGrowthGoalModal = (presetCompetencia) => {
  if (currentRole !== "admin") return;
  const currentKey = adminGrowthGoalsState.currentCompetencia || getCompetenciaKeySaoPaulo();
  const competencia = presetCompetencia && isValidCompetenciaKey(presetCompetencia) ? presetCompetencia : currentKey;
  const existing = adminGrowthGoalsState.byCompetencia.get(competencia);

  const bodyHtml = `
    <form class="auth-form" data-growth-goal-form>
      <div class="auth-field">
        <div class="auth-label">COMPETÊNCIA</div>
        <input class="auth-input" type="month" data-goal-competencia value="${escapeHtml(competencia)}" />
        <div class="auth-field-hint">Selecione mês/ano. Metas passadas não podem ser criadas.</div>
      </div>

      <div class="auth-field">
        <div class="auth-label">VALOR DA META</div>
        <input class="auth-input" type="text" inputmode="decimal" placeholder="R$ 80.000" data-goal-valor value="${
          existing?.valorMeta ? escapeHtml(String(existing.valorMeta)) : ""
        }" />
        <div class="auth-field-error" data-goal-valor-error hidden>Valor inválido.</div>
      </div>

      <div class="auth-form-error" data-goal-error hidden>Não foi possível salvar agora.</div>
      <div class="auth-form-success" data-goal-success hidden>Meta salva com sucesso.</div>
    </form>
  `;

  openModal({
    title: "Definir meta do mês",
    bodyHtml,
    primaryLabel: "Salvar",
    secondaryLabel: "Voltar",
    hideSecondary: false,
    showTrash: false,
    onPrimary: () => {
      const form = modalBody?.querySelector("[data-growth-goal-form]");
      if (!(form instanceof HTMLFormElement)) return false;
      const competenciaEl = form.querySelector("[data-goal-competencia]");
      const valorEl = form.querySelector("[data-goal-valor]");
      const valorErr = form.querySelector("[data-goal-valor-error]");
      const errEl = form.querySelector("[data-goal-error]");
      const okEl = form.querySelector("[data-goal-success]");

      const competenciaValue = competenciaEl instanceof HTMLInputElement ? String(competenciaEl.value || "").trim() : "";
      const valorRaw = valorEl instanceof HTMLInputElement ? String(valorEl.value || "").trim() : "";
      const valorMeta = parseMoneyPtBrLoose(valorRaw);

      const competenciaOk = isValidCompetenciaKey(competenciaValue);
      const valorOk = Number.isFinite(valorMeta) && valorMeta > 0;

      if (valorErr instanceof HTMLElement) valorErr.hidden = valorOk;
      if (valorEl instanceof HTMLElement) valorEl.classList.toggle("is-error", !valorOk);
      if (errEl instanceof HTMLElement) errEl.hidden = true;
      if (okEl instanceof HTMLElement) okEl.hidden = true;

      if (!competenciaOk || !valorOk) return false;
      if (competenciaValue < currentKey) {
        if (errEl instanceof HTMLElement) {
          errEl.textContent = "Não é possível cadastrar meta para um mês passado.";
          errEl.hidden = false;
        }
        return false;
      }

      (async () => {
        const previousPrimaryLabel = modalPrimary ? modalPrimary.textContent : "";
        try {
          const token = await getFirebaseIdTokenForApi();
          if (!token) {
            throw new Error("invalid_credentials");
          }
          if (modalPrimary) modalPrimary.disabled = true;
          if (modalSecondary) modalSecondary.disabled = true;
          if (modalPrimary) modalPrimary.textContent = "Salvando…";

          const res = await fetchWithAuth("/api/growth-goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competencia: competenciaValue, valorMeta }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const code = String(data?.error || "request_failed");
            const details = data && typeof data === "object" ? data : null;
            const err = new Error(code);
            err.details = details;
            throw err;
          }

          if (okEl instanceof HTMLElement) okEl.hidden = false;
          window.setTimeout(() => {
            closeModal();
          }, 450);

          await loadAdminGrowthGoals();
        } catch (e) {
          console.error("[admin] save growth-goal failed:", e);
          const code = typeof e?.message === "string" ? e.message : "";
          const details = e?.details && typeof e.details === "object" ? e.details : null;
          let msg = "Não foi possível salvar agora. Tente novamente.";
          if (code === "unauthorized" || code === "invalid_credentials") {
            msg = "Sua sessão expirou. Recarregue a página e faça login novamente.";
          }
          if (code === "forbidden") {
            msg = "Você não tem permissão para definir metas.";
          }
          if (code === "past_competencia_not_allowed") msg = "Não é possível cadastrar meta para um mês passado.";
          if (code === "invalid_competencia") msg = "Competência inválida. Selecione mês/ano corretamente.";
          if (code === "invalid_valor") msg = "Valor inválido. Use um número maior que zero.";
          if (code === "firestore_write_failed") {
            const st = Number(details?.firestoreStatus) || 0;
            if (st === 403) {
              msg =
                "Permissão negada ao salvar a meta (Firestore). Atualize as Firestore Rules para permitir write em growthGoals para admins.";
            } else {
              msg = "Não foi possível salvar a meta (Firestore). Verifique as regras/permissões e tente novamente.";
            }
          }
          if (errEl instanceof HTMLElement) {
            errEl.textContent = msg;
            errEl.hidden = false;
          }
        } finally {
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
          if (modalPrimary) modalPrimary.textContent = previousPrimaryLabel || "Salvar";
        }
      })();

      return false;
    },
  });

  window.setTimeout(() => {
    const form = modalBody?.querySelector("[data-growth-goal-form]");
    const competenciaEl = form?.querySelector("[data-goal-competencia]");
    if (competenciaEl instanceof HTMLInputElement) competenciaEl.focus();
  }, 0);
};

const getAdminUsersUiRefs = (type) => {
  const safeType = type === "teacher" ? "teacher" : type === "growth" ? "growth" : "student";
  if (safeType === "teacher") {
    return { table: adminUsersTableTeacher, empty: adminUsersEmptyTeacher, error: adminUsersErrorTeacher };
  }
  if (safeType === "growth") {
    return { table: adminUsersTableGrowth, empty: adminUsersEmptyGrowth, error: adminUsersErrorGrowth };
  }
  return { table: adminUsersTableStudent, empty: adminUsersEmptyStudent, error: adminUsersErrorStudent };
};

const normalizeFirestoreRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "growth") return "growth";
  return "";
};

const normalizeFirestoreActive = (value) => {
  if (typeof value === "boolean") return value;
  return true;
};

const normalizeUserRow = ({ id, nome, email, tipo, ativo, criadoEm }) => {
  const uid = String(id || "").trim();
  const name = String(nome || "").trim();
  const safeEmail = String(email || "").trim().toLowerCase();
  const role = normalizeFirestoreRole(tipo);
  if (!uid || !name || !safeEmail || !role) return null;
  return {
    id: uid,
    nome: name,
    email: safeEmail,
    tipo: role,
    ativo: normalizeFirestoreActive(ativo),
    criadoEm: criadoEm || null,
    initials: getInitials(name),
  };
};

const loadUsersFromFirestore = async (type) => {
  const safeType = type === "teacher" ? "teacher" : type === "growth" ? "growth" : "student";
  const state = adminUsersState[safeType];
  if (state.isLoading) return;

  state.isLoading = true;
  setAdminManageStatus(safeType, "Carregando…");

  const { table, empty, error } = getAdminUsersUiRefs(safeType);
  if (error instanceof HTMLElement) error.hidden = true;

  try {
    const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
    const user = await waitForFirebaseAuthReady(firebase, 5000);
    if (!user) {
      const e = new Error("firebase_not_authenticated");
      e.code = "auth/no-current-user";
      throw e;
    }

    const q = firebase.query(
      firebase.collection(firebase.primaryDb, "users"),
      firebase.where("tipo", "==", safeType)
    );
    const snap = await withTimeout(firebase.getDocs(q), 12_000, "firestore_getDocs");
    const rows = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data ? docSnap.data() : null;
      if (!data || typeof data !== "object") return;
      rows.push(
        normalizeUserRow({
          id: docSnap.id,
          nome: data.nome,
          email: data.email,
          tipo: data.tipo,
          ativo: data.ativo,
          criadoEm: data.criadoEm,
        })
      );
    });

    state.rows = rows.filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    state.loadedAt = Date.now();
    setAdminManageStatus(safeType, "");
    renderAdminUsersTable(safeType);
    if (currentRole === "admin" && activeModalKind === "event-form") {
      syncAdminEventUserSelects();
      validateCreateEventDraft();
    }
  } catch (err) {
    // Surface the root cause for debugging (rules, connectivity, etc.).
    console.error("[admin] loadUsersFromFirestore failed:", safeType, err);
    if (table instanceof HTMLElement) table.innerHTML = "";
    if (empty instanceof HTMLElement) empty.hidden = true;
    if (error instanceof HTMLElement) error.hidden = false;
    const code = typeof err?.code === "string" ? err.code : "";
    let message = "Não foi possível carregar.";
    if (code === "timeout") message = "Tempo esgotado ao carregar. Tente novamente.";
    if (code === "auth/no-current-user") message = "Sessão expirada. Faça login novamente.";
    setAdminManageStatus(safeType, message, "error");
  } finally {
    state.isLoading = false;
  }
};

const renderAdminUsersTable = (type) => {
  const safeType = type === "teacher" ? "teacher" : type === "growth" ? "growth" : "student";
  const state = adminUsersState[safeType];
  const { table, empty, error } = getAdminUsersUiRefs(safeType);
  if (!(table instanceof HTMLElement)) return;
  if (error instanceof HTMLElement) error.hidden = true;

  const q = String(state.query || "").trim().toLowerCase();
  const filtered = q
    ? state.rows.filter((row) => row.nome.toLowerCase().includes(q) || row.email.toLowerCase().includes(q))
    : state.rows;

  if (empty instanceof HTMLElement) empty.hidden = filtered.length > 0;
  table.innerHTML = `
    <div class="admin-users-row admin-users-head">
      <span> </span>
      <span>Nome</span>
      <span>E-mail</span>
      <span>Status</span>
      <span>Cadastro</span>
      <span> </span>
    </div>
    ${filtered
      .map((row) => {
        const badgeClass = row.ativo ? "admin-badge is-active" : "admin-badge is-inactive";
        const badgeLabel = row.ativo ? "Ativo" : "Inativo";
        return `
          <div class="admin-users-row" data-admin-user-row="${escapeHtml(row.id)}" data-admin-user-email="${escapeHtml(
          row.email
        )}" data-admin-user-name="${escapeHtml(row.nome)}" data-admin-user-active="${row.ativo ? "1" : "0"}">
            <div class="admin-user-avatar" aria-hidden="true">${escapeHtml(row.initials)}</div>
            <div class="admin-user-name">${escapeHtml(row.nome)}</div>
            <div class="admin-user-email">${escapeHtml(row.email)}</div>
            <div><span class="${badgeClass}">${badgeLabel}</span></div>
            <div class="admin-user-date">${escapeHtml(formatAdminDate(row.criadoEm))}</div>
            <div class="admin-row-actions" data-admin-actions>
              <button class="admin-actions-trigger" type="button" aria-label="Ações" data-admin-actions-trigger>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6.5 12h.01"></path>
                  <path d="M12 12h.01"></path>
                  <path d="M17.5 12h.01"></path>
                </svg>
              </button>
              <div class="admin-actions-menu" role="menu" aria-label="Ações do usuário">
                <button class="admin-action-item${row.ativo ? " is-danger" : ""}" type="button" data-admin-action-toggle>
                  ${row.ativo ? "Desativar" : "Ativar"}
                </button>
                <button class="admin-action-item" type="button" data-admin-action-reset>
                  Redefinir senha
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("")}
  `;
};

const closeAllAdminActionMenus = () => {
  document.querySelectorAll("[data-admin-actions].is-open").forEach((el) => el.classList.remove("is-open"));
};

if (adminUserForm instanceof HTMLFormElement) {
  adminUserForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (currentRole !== "admin") return;

    const name = adminUserName instanceof HTMLInputElement ? adminUserName.value.trim() : "";
    const email = adminUserEmail instanceof HTMLInputElement ? adminUserEmail.value.trim().toLowerCase() : "";
    const password = adminUserPassword instanceof HTMLInputElement ? adminUserPassword.value : "";
    const role = normalizeUserCreationRole(adminUserRole instanceof HTMLSelectElement ? adminUserRole.value : "");

    const nameOk = Boolean(name);
    const emailOk = isValidEmail(email);
    const passOk = Boolean(password) && password.length >= 6;
    const roleOk = Boolean(role);

    if (adminUserNameError instanceof HTMLElement) adminUserNameError.hidden = nameOk;
    if (adminUserEmailError instanceof HTMLElement) adminUserEmailError.hidden = emailOk;
    if (adminUserPasswordError instanceof HTMLElement) {
      adminUserPasswordError.textContent = password ? "Senha mínimo 6 caracteres" : "Senha obrigatória";
      adminUserPasswordError.hidden = passOk;
    }

    if (adminUserName instanceof HTMLElement) adminUserName.classList.toggle("is-error", !nameOk);
    if (adminUserEmail instanceof HTMLElement) adminUserEmail.classList.toggle("is-error", !emailOk);
    if (adminUserPassword instanceof HTMLElement) adminUserPassword.classList.toggle("is-error", !passOk);

    setAdminUserStatus("");

    if (!nameOk || !emailOk || !passOk || !roleOk) {
      setAdminUserStatus("Preencha os campos para continuar.", "error");
      return;
    }

    setAdminUserLoading(true);
    setAdminUserStatus("Criando…");

    let secondaryAuth = null;

    try {
      const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
      secondaryAuth = firebase.secondaryAuth;

      let credential;
      try {
        credential = await withTimeout(
          firebase.createUserWithEmailAndPassword(firebase.secondaryAuth, email, password),
          12_000,
          "auth_create_user"
        );
      } catch (authErr) {
        console.error("[admin] create user (auth) failed:", authErr);
        throw authErr;
      }
      const uid = String(credential?.user?.uid || "").trim();
      if (!uid) {
        throw new Error("missing_uid");
      }

      const payload = {
        nome: name,
        email,
        tipo: role,
        ativo: true,
        criadoEm: firebase.serverTimestamp(),
      };

      // Prefer the admin's session to write, but fall back to the secondary session (new user) if needed.
      try {
        await withTimeout(
          firebase.setDoc(firebase.doc(firebase.primaryDb, "users", uid), payload, { merge: true }),
          12_000,
          "firestore_setDoc_primary"
        );
      } catch (primaryErr) {
        console.error("[admin] create user (firestore primary) failed:", primaryErr);
        try {
          await withTimeout(
            firebase.setDoc(firebase.doc(firebase.secondaryDb, "users", uid), payload, { merge: true }),
            12_000,
            "firestore_setDoc_secondary"
          );
        } catch (secondaryErr) {
          console.error("[admin] create user (firestore secondary) failed:", secondaryErr);
          throw secondaryErr;
        }
      }

      await withTimeout(
        fetchWithAuth("/api/admin-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, role, name }),
        }).catch(() => {}),
        8000,
        "admin_users_sync"
      );

      setAdminUserStatus("Usuário criado com sucesso.", "success");
      if (adminUserPassword instanceof HTMLInputElement) adminUserPassword.value = "";
      if (adminUserEmail instanceof HTMLInputElement) adminUserEmail.value = "";
      if (adminUserName instanceof HTMLInputElement) adminUserName.value = "";

      // Refresh lists if visible.
      adminUsersState.teacher.loadedAt = 0;
      adminUsersState.student.loadedAt = 0;
      if (body.dataset.activePanel === "professores") {
        loadUsersFromFirestore("teacher");
      }
      if (body.dataset.activePanel === "alunos") {
        loadUsersFromFirestore("student");
      }
    } catch (error) {
      console.error("[admin] create user failed:", error);
      const code = typeof error?.code === "string" ? error.code : "";
      let message = "Nao foi possivel criar o usuario.";
      if (code === "auth/email-already-in-use") message = "Este e-mail já está em uso.";
      if (code === "auth/invalid-email") message = "E-mail inválido.";
      if (code === "auth/weak-password") message = "Senha fraca. Use uma senha mais forte.";
      if (code === "timeout") message = "Tempo esgotado. Tente novamente.";
      setAdminUserStatus(message, "error");
    } finally {
      try {
        const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
        if (secondaryAuth) {
          await withTimeout(firebase.signOut(secondaryAuth), 6000, "auth_secondary_signout");
        }
      } catch (error) {
        // ignore
      }
      setAdminUserLoading(false);
    }
  });
}

const openAdminCreateUserModal = ({ presetRole } = {}) => {
  if (currentRole !== "admin") return;
  const role = presetRole === "teacher" ? "teacher" : presetRole === "growth" ? "growth" : "student";
  activeModalKind = "admin-create-user";

  const title = role === "teacher" ? "Novo Professor" : role === "growth" ? "Novo usuário Growth" : "Novo Aluno";

  const bodyHtml = `
    <form class="auth-form admin-create-form" data-admin-create-form novalidate>
      <label class="auth-field">
        <span>Nome completo</span>
        <input class="auth-input" type="text" autocomplete="name" data-ac-name />
        <div class="auth-inline-error" data-ac-name-error hidden>Nome obrigatório</div>
      </label>
      <label class="auth-field">
        <span>E-mail</span>
        <input class="auth-input" type="email" autocomplete="email" data-ac-email />
        <div class="auth-inline-error" data-ac-email-error hidden>E-mail inválido</div>
      </label>
      <label class="auth-field">
        <span>Senha</span>
        <div class="auth-password">
          <input class="auth-input" type="password" autocomplete="new-password" data-ac-password />
          <button class="auth-eye" type="button" data-ac-eye aria-label="Mostrar senha">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"></path>
              <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"></path>
            </svg>
          </button>
        </div>
        <div class="auth-inline-error" data-ac-password-error hidden>Senha obrigatória</div>
      </label>
      <label class="auth-field">
        <span>Confirmar senha</span>
        <input class="auth-input" type="password" autocomplete="new-password" data-ac-confirm />
        <div class="auth-inline-error" data-ac-confirm-error hidden>As senhas precisam coincidir</div>
      </label>
      <div class="auth-form-error" data-ac-error hidden>Não foi possível criar agora.</div>
      <div class="auth-form-success" data-ac-success hidden>Criado com sucesso.</div>
    </form>
  `;

  openModal({
    title,
    bodyHtml,
    primaryLabel: "Cadastrar",
    secondaryLabel: "Voltar",
    hideSecondary: false,
    showTrash: false,
    onPrimary: () => {
      const form = modalBody?.querySelector("[data-admin-create-form]");
      if (!(form instanceof HTMLFormElement)) return false;
      const nameEl = form.querySelector("[data-ac-name]");
      const emailEl = form.querySelector("[data-ac-email]");
      const passEl = form.querySelector("[data-ac-password]");
      const confirmEl = form.querySelector("[data-ac-confirm]");
      const nameError = form.querySelector("[data-ac-name-error]");
      const emailError = form.querySelector("[data-ac-email-error]");
      const passError = form.querySelector("[data-ac-password-error]");
      const confirmError = form.querySelector("[data-ac-confirm-error]");
      const errorEl = form.querySelector("[data-ac-error]");
      const successEl = form.querySelector("[data-ac-success]");

      const name = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : "";
      const email = emailEl instanceof HTMLInputElement ? emailEl.value.trim().toLowerCase() : "";
      const password = passEl instanceof HTMLInputElement ? passEl.value : "";
      const confirm = confirmEl instanceof HTMLInputElement ? confirmEl.value : "";

      const nameOk = Boolean(name);
      const emailOk = isValidEmail(email);
      const passOk = Boolean(password) && password.length >= 6;
      const confirmOk = password === confirm && Boolean(confirm);

      if (nameError instanceof HTMLElement) nameError.hidden = nameOk;
      if (emailError instanceof HTMLElement) emailError.hidden = emailOk;
      if (passError instanceof HTMLElement) {
        passError.textContent = password ? "Senha mínimo 6 caracteres" : "Senha obrigatória";
        passError.hidden = passOk;
      }
      if (confirmError instanceof HTMLElement) confirmError.hidden = confirmOk;

      if (nameEl instanceof HTMLElement) nameEl.classList.toggle("is-error", !nameOk);
      if (emailEl instanceof HTMLElement) emailEl.classList.toggle("is-error", !emailOk);
      if (passEl instanceof HTMLElement) passEl.classList.toggle("is-error", !passOk);
      if (confirmEl instanceof HTMLElement) confirmEl.classList.toggle("is-error", !confirmOk);

      if (errorEl instanceof HTMLElement) errorEl.hidden = true;
      if (successEl instanceof HTMLElement) successEl.hidden = true;

      if (!nameOk || !emailOk || !passOk || !confirmOk) return false;

      (async () => {
        const previousPrimaryLabel = modalPrimary ? modalPrimary.textContent : "";
        try {
          if (modalPrimary) modalPrimary.disabled = true;
          if (modalSecondary) modalSecondary.disabled = true;
          if (modalPrimary) modalPrimary.textContent = "Cadastrando…";

          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");

          let credential;
          try {
            credential = await withTimeout(
              firebase.createUserWithEmailAndPassword(firebase.secondaryAuth, email, password),
              12_000,
              "auth_create_user"
            );
          } catch (authErr) {
            console.error("[admin] create teacher/student (auth) failed:", authErr);
            throw authErr;
          }

          const uid = String(credential?.user?.uid || "").trim();
          if (!uid) throw new Error("missing_uid");

          const payload = { nome: name, email, tipo: role, ativo: true, criadoEm: firebase.serverTimestamp() };
          try {
            await withTimeout(
              firebase.setDoc(firebase.doc(firebase.primaryDb, "users", uid), payload, { merge: true }),
              12_000,
              "firestore_setDoc_primary"
            );
          } catch (primaryErr) {
            console.error("[admin] create teacher/student (firestore primary) failed:", primaryErr);
            try {
              await withTimeout(
                firebase.setDoc(firebase.doc(firebase.secondaryDb, "users", uid), payload, { merge: true }),
                12_000,
                "firestore_setDoc_secondary"
              );
            } catch (secondaryErr) {
              console.error("[admin] create teacher/student (firestore secondary) failed:", secondaryErr);
              throw secondaryErr;
            }
          }

          await withTimeout(
            fetchWithAuth("/api/admin-users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uid, role, name }),
            }).catch(() => {}),
            8000,
            "admin_users_sync"
          );

          adminUsersState.teacher.loadedAt = 0;
          adminUsersState.student.loadedAt = 0;
          adminUsersState.growth.loadedAt = 0;

          if (successEl instanceof HTMLElement) successEl.hidden = false;
          setAdminManageStatus(role, "Criado com sucesso.", "success");
          window.setTimeout(() => setAdminManageStatus(role, ""), 1200);
          closeModal();
          if (role === "teacher") loadUsersFromFirestore("teacher");
          if (role === "student") loadUsersFromFirestore("student");
          if (role === "growth") loadUsersFromFirestore("growth");
        } catch (e) {
          console.error("[admin] create teacher/student failed:", e);
          const code = typeof e?.code === "string" ? e.code : "";
          let msg = "Não foi possível criar agora.";
          if (code === "auth/email-already-in-use") msg = "Este e-mail já está cadastrado";
          if (code === "auth/weak-password") msg = "Senha muito fraca";
          if (code === "auth/invalid-email") msg = "E-mail inválido";
          if (code === "timeout") msg = "Tempo esgotado. Tente novamente.";
          if (errorEl instanceof HTMLElement) {
            errorEl.textContent = msg;
            errorEl.hidden = false;
          }
        } finally {
          try {
            const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
            await withTimeout(firebase.signOut(firebase.secondaryAuth), 6000, "auth_secondary_signout");
          } catch (e) {
            // ignore
          }
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
          if (modalPrimary && previousPrimaryLabel) modalPrimary.textContent = previousPrimaryLabel;
        }
      })();

      return false;
    },
    onSecondary: () => {
      activeModalKind = "";
    },
  });

  const eye = modalBody?.querySelector("[data-ac-eye]");
  const passEl = modalBody?.querySelector("[data-ac-password]");
  if (eye instanceof HTMLButtonElement && passEl instanceof HTMLInputElement) {
    eye.addEventListener("click", () => {
      passEl.type = passEl.type === "password" ? "text" : "password";
    });
  }
};

adminNewUserButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const raw = String(btn.getAttribute("data-admin-new-user") || "").trim().toLowerCase();
    const presetRole = raw === "teacher" ? "teacher" : raw === "growth" ? "growth" : "student";
    openAdminCreateUserModal({ presetRole });
  });
});

adminSearchInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const raw = String(input.getAttribute("data-admin-search") || "").trim().toLowerCase();
    const type = raw === "teacher" ? "teacher" : raw === "growth" ? "growth" : "student";
    adminUsersState[type].query = input instanceof HTMLInputElement ? input.value : "";
    renderAdminUsersTable(type);
  });
});
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
  const shouldHidePlatformHeader =
    activePanel?.dataset.hidePlatformHeader === "true" ||
    (panelName === "dashboard" && (currentRole === "teacher" || currentRole === "student")) ||
    (currentRole === "admin" && panelName !== "dashboard");
  body.dataset.activePanel = panelName;

  if (platformHeader) {
    platformHeader.hidden = shouldHidePlatformHeader;
  }

  if (panelName === "ao-vivo") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentRole === "teacher" || currentRole === "admin") {
      renderTeacherCalendar();
      if (currentRole === "admin") {
        renderAdminRescheduleRequests();
      }
    } else {
      renderStudentLiveLessons();
    }
    return;
  }

  if (panelName === "professores") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentRole === "admin") {
      loadUsersFromFirestore("teacher");
    }
    return;
  }

  if (panelName === "alunos") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentRole === "admin") {
      loadUsersFromFirestore("student");
    }
    return;
  }

  if (panelName === "growth") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentRole === "admin") {
      loadUsersFromFirestore("growth");
      loadAdminGrowthGoals();
    }
    return;
  }

  if (panelName === "dashboard") {
    if (currentRole === "teacher") {
      renderTeacherDashboard();
    } else if (currentRole === "admin") {
      renderAdminDashboard();
    } else {
      renderStudentDashboard();
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
    if (p === "professores") return "/app/admin/professores";
    if (p === "alunos") return "/app/admin/alunos";
    if (p === "growth") return "/app/admin/growth";
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
    if (sub === "professores") return { role, panel: "professores" };
    if (sub === "alunos") return { role, panel: "alunos" };
    if (sub === "growth") return { role, panel: "growth" };
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
    window.location.replace("/");
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
  closePlatformButton.addEventListener("click", async () => {
    closeModal();

    // Always clear local state first so protected UI doesn't linger if navigation is delayed.
    try {
      clearPlatformStorage();
    } catch (error) {
      // ignore
    }

    fetch("/api/logout", { method: "POST", credentials: "include", keepalive: true }).catch(() => {});
    sessionUser = null;
    sessionChecked = true;

    // Best-effort Firebase signOut. Keep the UI snappy: don't block for long.
    try {
      const firebase = await loadFirebaseAdminApi();
      await waitForFirebaseAuthReady(firebase, 800);
      await withTimeout(firebase.signOut(firebase.primaryAuth), 1500, "auth_signout");
    } catch (error) {
      // ignore
    }

    window.location.replace("/");
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
    // Admin manage tables: actions menu + operations.
    if (currentRole === "admin") {
      const goalOpen = target.closest("[data-admin-growth-goal-open]");
      if (goalOpen instanceof HTMLButtonElement) {
        event.preventDefault();
        openAdminGrowthGoalModal();
        return;
      }

      const goalEdit = target.closest("[data-admin-goal-edit]");
      if (goalEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const competencia = String(goalEdit.getAttribute("data-admin-goal-edit") || "").trim();
        openAdminGrowthGoalModal(competencia);
        return;
      }

      const trigger = target.closest("[data-admin-actions-trigger]");
      if (trigger instanceof HTMLButtonElement) {
        event.preventDefault();
        const container = trigger.closest("[data-admin-actions]");
        if (container instanceof HTMLElement) {
          const wasOpen = container.classList.contains("is-open");
          closeAllAdminActionMenus();
          container.classList.toggle("is-open", !wasOpen);
        }
        return;
      }

      const toggleAction = target.closest("[data-admin-action-toggle]");
      if (toggleAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const row = toggleAction.closest("[data-admin-user-row]");
        if (!(row instanceof HTMLElement)) return;
        const uid = row.getAttribute("data-admin-user-row") || "";
        const name = row.getAttribute("data-admin-user-name") || "Usuário";
        const email = row.getAttribute("data-admin-user-email") || "";
        const isActive = row.getAttribute("data-admin-user-active") === "1";
        const activePanel = String(body.dataset.activePanel || "");
        const type = activePanel === "professores" ? "teacher" : activePanel === "growth" ? "growth" : "student";

        closeAllAdminActionMenus();

        const applyToggle = async (nextActive) => {
          setAdminManageStatus(type, nextActive ? "Ativando…" : "Desativando…");
          try {
            const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
	            await withTimeout(
	              firebase.setDoc(firebase.doc(firebase.primaryDb, "users", uid), { ativo: nextActive }, { merge: true }),
	              12_000,
	              "firestore_toggle_active"
	            );

	            // Keep the scheduling store in sync so admin ranking/slot assignment respects active teachers.
		            await withTimeout(
		              fetchWithAuth("/api/admin-users", {
		                method: "POST",
		                headers: { "Content-Type": "application/json" },
		                body: JSON.stringify({ uid, role: type, name, active: nextActive }),
		              }).catch((error) => {
		                console.warn("[admin] toggle active sync failed:", error);
		              }),
		              8000,
		              "admin_users_toggle_sync"
		            );

		            const list = adminUsersState[type].rows;
	            const idx = list.findIndex((u) => u.id === uid);
	            if (idx >= 0) {
              list[idx] = { ...list[idx], ativo: nextActive };
              adminUsersState[type].rows = [...list].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
            }
            setAdminManageStatus(type, nextActive ? "Usuário ativado." : "Usuário desativado.", "success");
            window.setTimeout(() => setAdminManageStatus(type, ""), 1200);
            renderAdminUsersTable(type);
          } catch (error) {
            console.error("[admin] toggle active failed:", error);
            setAdminManageStatus(type, "Não foi possível atualizar o status.", "error");
          }
        };

        if (isActive) {
          openModal({
            title: "Desativar usuário",
            bodyHtml: `Tem certeza que deseja desativar ${escapeHtml(name)}? O usuário não conseguirá mais acessar a plataforma.`,
            primaryLabel: "Desativar",
            secondaryLabel: "Cancelar",
            hideSecondary: false,
            showTrash: false,
            onPrimary: () => {
              if (modalPrimary) modalPrimary.disabled = true;
              if (modalSecondary) modalSecondary.disabled = true;
              applyToggle(false).finally(() => closeModal());
              return false;
            },
          });
          return;
        }

        applyToggle(true);
        return;
      }

      const resetAction = target.closest("[data-admin-action-reset]");
      if (resetAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const row = resetAction.closest("[data-admin-user-row]");
        if (!(row instanceof HTMLElement)) return;
        const email = row.getAttribute("data-admin-user-email") || "";
        const activePanel = String(body.dataset.activePanel || "");
        const type = activePanel === "professores" ? "teacher" : activePanel === "growth" ? "growth" : "student";

        closeAllAdminActionMenus();

        openModal({
          title: "Redefinir senha",
          bodyHtml: `Enviar link de redefinição de senha para ${escapeHtml(email)}?`,
          primaryLabel: "Enviar link",
          secondaryLabel: "Cancelar",
          hideSecondary: false,
          showTrash: false,
          onPrimary: () => {
            (async () => {
              if (modalPrimary) modalPrimary.disabled = true;
                if (modalSecondary) modalSecondary.disabled = true;
                setAdminManageStatus(type, "Enviando link…");
                try {
                  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
                  await withTimeout(firebase.sendPasswordResetEmail(firebase.primaryAuth, email), 12_000, "auth_reset_email");
                  setAdminManageStatus(type, "Link enviado com sucesso.", "success");
                  window.setTimeout(() => setAdminManageStatus(type, ""), 1200);
                  closeModal();
                } catch (error) {
                  console.error("[admin] sendPasswordResetEmail failed:", error);
                  setAdminManageStatus(type, "Não foi possível enviar o link.", "error");
                  if (modalPrimary) modalPrimary.disabled = false;
                  if (modalSecondary) modalSecondary.disabled = false;
                }
            })();
            return false;
          },
        });
        return;
      }

      // Click outside closes any open action menu.
      if (!target.closest("[data-admin-actions]")) {
        closeAllAdminActionMenus();
      }
    }

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
    if (
      calEvent instanceof HTMLElement &&
      (currentRole === "teacher" || currentRole === "admin") &&
      body.dataset.activePanel === "ao-vivo"
    ) {
      const type = calEvent.getAttribute("data-teacher-cal-event-type") || "";
      const id = calEvent.getAttribute("data-teacher-cal-event-id") || "";
      if (type === "lesson" || type === "manual") {
        openTeacherEventModal({ type, id });
        return;
      }
    }

    const createEventButton = target.closest("[data-teacher-create-event]");
    if (createEventButton instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
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
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      teacherCalendarState.miniCursor = new Date(teacherCalendarState.miniCursor.getFullYear(), teacherCalendarState.miniCursor.getMonth() - 1, 1);
      renderTeacherMiniCalendar();
      return;
    }

    const miniNext = target.closest("[data-teacher-mini-next]");
    if (miniNext instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      teacherCalendarState.miniCursor = new Date(teacherCalendarState.miniCursor.getFullYear(), teacherCalendarState.miniCursor.getMonth() + 1, 1);
      renderTeacherMiniCalendar();
      return;
    }

    const miniDay = target.closest("[data-teacher-mini-day]");
    if (miniDay instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      const key = miniDay.getAttribute("data-teacher-mini-day") || "";
      const date = parseDateKey(key);
      if (!date) return;
      setTeacherFocusDate(date);
      renderTeacherCalendar();
      return;
    }

    const calToday = target.closest("[data-teacher-cal-today]");
    if (calToday instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      setTeacherFocusDate(new Date());
      renderTeacherCalendar();
      return;
    }

    const calPrev = target.closest("[data-teacher-cal-prev]");
    if (calPrev instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
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
      if (currentRole !== "teacher" && currentRole !== "admin") return;
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
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      const nextView = viewBtn.getAttribute("data-teacher-cal-view") || "day";
      if (nextView !== "day" && nextView !== "week" && nextView !== "month") return;
      teacherCalendarState.view = nextView;
      renderTeacherCalendar();
      return;
    }

    const monthMore = target.closest("[data-teacher-month-more]");
    if (monthMore instanceof HTMLButtonElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
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

    const monthCell = target.closest("[data-teacher-cal-month-day]");
    if (monthCell instanceof HTMLElement) {
      if (currentRole !== "teacher" && currentRole !== "admin") return;
      if (body.dataset.activePanel !== "ao-vivo") return;
      if (teacherCalendarState.view !== "month") return;
      const key = monthCell.getAttribute("data-teacher-cal-month-day") || "";
      // Month view does not have a time grid; open the same create modal with a clean default.
      openTeacherCreateEventModalAt({ dateKey: key, startTime: "09:00", endTime: "09:30" });
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

    const studentRescheduleButton = target.closest("[data-live-reschedule]");
    if (studentRescheduleButton instanceof HTMLButtonElement) {
      if (currentRole !== "student") return;
      const lessonId = studentRescheduleButton.getAttribute("data-live-reschedule") || "";
      const lessons = Array.isArray(studentLessonsState.lessons) ? studentLessonsState.lessons : [];
      const lesson = lessons.find((l) => l && l.id === lessonId) || null;
      if (!lesson) return;
      openStudentRescheduleModal(lesson);
      return;
    }

    const teacherChangeBtn = target.closest("[data-student-v5-teacher-change]");
    if (teacherChangeBtn instanceof HTMLButtonElement) {
      if (currentRole !== "student") return;
      const alunoId = sessionUser && sessionUser.role === "student" ? sessionUser.id : "";
      const professorId = studentV5DashboardState.teacherId || "";
      const professorNome = studentV5DashboardState.teacherData?.nome || "";
      if (!alunoId || !professorId) {
        openModal({
          title: "Solicitar troca de professor",
          bodyHtml: "Nenhuma professora vinculada no momento.",
          primaryLabel: "Fechar",
          hideSecondary: true,
        });
        return;
      }
      openStudentTeacherChangeModal({ alunoId, professorId, professorNome });
      return;
    }

    const npsScoreBtn = target.closest("[data-student-v5-nps-score]");
    if (npsScoreBtn instanceof HTMLButtonElement) {
      if (currentRole !== "student") return;
      const score = Number(npsScoreBtn.getAttribute("data-student-v5-nps-score"));
      if (!Number.isFinite(score) || score < 0 || score > 10) return;
      studentV5NpsDraft.score = score;
      if (studentV5NpsFeedback instanceof HTMLElement) {
        studentV5NpsFeedback.hidden = true;
        studentV5NpsFeedback.textContent = "";
        studentV5NpsFeedback.classList.remove("is-error");
      }
      syncStudentV5NpsScaleUI();
      return;
    }

    const npsSubmitBtn = target.closest("[data-student-v5-nps-submit]");
    if (npsSubmitBtn instanceof HTMLButtonElement) {
      if (currentRole !== "student") return;
      if (npsSubmitBtn.disabled) return;
      const alunoId = sessionUser && sessionUser.role === "student" ? sessionUser.id : "";
      const score = studentV5NpsDraft.score;
      if (!alunoId || !Number.isFinite(score)) return;
      if (studentV5NpsDraft.isSubmitting) return;

      const comment = studentV5NpsComment instanceof HTMLTextAreaElement ? studentV5NpsComment.value.trim() : "";
      studentV5NpsDraft.isSubmitting = true;
      syncStudentV5NpsScaleUI();

      const prevLabel = npsSubmitBtn.textContent || "Enviar avaliação";
      npsSubmitBtn.textContent = "Enviando…";

      if (studentV5NpsFeedback instanceof HTMLElement) {
        studentV5NpsFeedback.hidden = true;
        studentV5NpsFeedback.textContent = "";
        studentV5NpsFeedback.classList.remove("is-error");
      }

      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
          const docRef = firebase.doc(firebase.collection(firebase.primaryDb, "nps"));
          await withTimeout(
            firebase.setDoc(docRef, { alunoId, nota: Math.round(score), comentario: comment, criadoEm: firebase.serverTimestamp() }),
            12_000,
            "student_nps_save"
          );

          const createdAtMs = Date.now();
          studentV5DashboardState.lastNps = { nota: Math.round(score), createdAtMs };
          studentV5DashboardState.npsCooldownUntilMs = createdAtMs + 90 * 24 * 60 * 60 * 1000;

          studentV5NpsDraft.score = null;
          if (studentV5NpsComment instanceof HTMLTextAreaElement) studentV5NpsComment.value = "";

          renderStudentDashboard();
        } catch (error) {
          console.error("[student] NPS save failed:", error);
          if (studentV5NpsFeedback instanceof HTMLElement) {
            studentV5NpsFeedback.hidden = false;
            studentV5NpsFeedback.textContent = "Não foi possível enviar agora. Tente novamente.";
            studentV5NpsFeedback.classList.add("is-error");
          }
        } finally {
          studentV5NpsDraft.isSubmitting = false;
          npsSubmitBtn.textContent = prevLabel;
          syncStudentV5NpsScaleUI();
        }
      })();

      return;
    }

    const approveReq = target.closest("[data-admin-reschedule-approve]");
    if (approveReq instanceof HTMLButtonElement) {
      if (currentRole !== "admin") return;
      const id = approveReq.getAttribute("data-admin-reschedule-approve") || "";
      if (!id) return;

      const row = approveReq.closest(".admin-requests-item");
      const rejectBtn = row?.querySelector("[data-admin-reschedule-reject]");
      const previousLabel = approveReq.textContent || "Aprovar";
      approveReq.disabled = true;
      approveReq.textContent = "Aprovando…";
      if (rejectBtn instanceof HTMLButtonElement) rejectBtn.disabled = true;

      fetchWithAuth("/api/schedule-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao: "aprovar" }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const msg =
              data?.error === "already_resolved"
                ? "Essa solicitação já foi resolvida."
                : "Não foi possível aprovar agora. Tente novamente.";
            openModal({ title: "Não foi possível aprovar", bodyHtml: escapeHtml(msg), primaryLabel: "Fechar", hideSecondary: true });
            return;
          }
          refreshAdminRescheduleRequests({ force: true });
          refreshTeacherEvents({ force: true });
        })
        .catch(() => {
          openModal({
            title: "Não foi possível aprovar",
            bodyHtml: "Não foi possível aprovar agora. Tente novamente.",
            primaryLabel: "Fechar",
            hideSecondary: true,
          });
        })
        .finally(() => {
          approveReq.disabled = false;
          approveReq.textContent = previousLabel;
          if (rejectBtn instanceof HTMLButtonElement) rejectBtn.disabled = false;
        });

      return;
    }

    const rejectReq = target.closest("[data-admin-reschedule-reject]");
    if (rejectReq instanceof HTMLButtonElement) {
      if (currentRole !== "admin") return;
      const id = rejectReq.getAttribute("data-admin-reschedule-reject") || "";
      if (!id) return;

      const row = rejectReq.closest(".admin-requests-item");
      const approveBtn = row?.querySelector("[data-admin-reschedule-approve]");
      const previousLabel = rejectReq.textContent || "Recusar";
      rejectReq.disabled = true;
      rejectReq.textContent = "Recusando…";
      if (approveBtn instanceof HTMLButtonElement) approveBtn.disabled = true;

      fetchWithAuth("/api/schedule-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao: "recusar" }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            const msg =
              data?.error === "already_resolved"
                ? "Essa solicitação já foi resolvida."
                : "Não foi possível recusar agora. Tente novamente.";
            openModal({ title: "Não foi possível recusar", bodyHtml: escapeHtml(msg), primaryLabel: "Fechar", hideSecondary: true });
            return;
          }
          refreshAdminRescheduleRequests({ force: true });
          refreshTeacherEvents({ force: true });
        })
        .catch(() => {
          openModal({
            title: "Não foi possível recusar",
            bodyHtml: "Não foi possível recusar agora. Tente novamente.",
            primaryLabel: "Fechar",
            hideSecondary: true,
          });
        })
        .finally(() => {
          rejectReq.disabled = false;
          rejectReq.textContent = previousLabel;
          if (approveBtn instanceof HTMLButtonElement) approveBtn.disabled = false;
        });

      return;
    }
  }

  if (!(target instanceof Element) || !target.closest("[data-chart-dropdown]")) {
    closeAllDropdowns();
  }
});

const isTeacherCalendarGridInteractive = () => {
  if (currentRole !== "teacher" && currentRole !== "admin") return false;
  if (body.dataset.activePanel !== "ao-vivo") return false;
  if (!liveTeacherRoot || liveTeacherRoot.hidden) return false;
  if (!teacherCalViewport) return false;
  if (teacherCalendarState.view !== "day" && teacherCalendarState.view !== "week") return false;
  if (modalOverlay && !modalOverlay.hidden) return false;
  return true;
};

document.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  if (!isTeacherCalendarGridInteractive()) return;
  if (!(event.target instanceof Element)) return;

  const gridEl = event.target.closest(".teacher-cal-grid");
  if (!(gridEl instanceof HTMLElement)) return;
  if (teacherCalViewport && !teacherCalViewport.contains(gridEl)) return;

  // Clicking an existing event should keep the normal behavior.
  if (event.target.closest("[data-teacher-cal-event-id]")) return;

  const dateKey = gridEl.getAttribute("data-teacher-cal-grid") || "";
  if (!parseDateKey(dateKey)) return;

  const meta = getTeacherGridMeta(gridEl);
  if (!meta) return;

  const rawStart = calcTeacherSlotMinutesFromClientY(gridEl, event.clientY);
  if (rawStart === null) return;

  clearTeacherCalendarSelection();

  const startMax = meta.selectableEndMin - TEACHER_CAL_MIN_DURATION_MINUTES;
  const startMin = clampNumber(roundToNearestSlotMin(rawStart), meta.gridStartMin, startMax);
  const endMin = clampNumber(
    startMin + TEACHER_CAL_DEFAULT_DURATION_MINUTES,
    startMin + TEACHER_CAL_MIN_DURATION_MINUTES,
    meta.selectableEndMin
  );

  teacherCalSelection = { gridEl, dateKey, startMin, endMin, el: null };
  teacherCalDrag = { gridEl, dateKey, startMin, endMin };
  body.classList.add("is-cal-dragging");
  syncTeacherCalSelectionUI();
  event.preventDefault();
});

window.addEventListener("mousemove", (event) => {
  if (!teacherCalDrag) return;
  if (!isTeacherCalendarGridInteractive()) return;

  const gridEl = teacherCalDrag.gridEl;
  if (!(gridEl instanceof HTMLElement)) return;
  const meta = getTeacherGridMeta(gridEl);
  if (!meta) return;

  const rawEnd = calcTeacherSlotMinutesFromClientY(gridEl, event.clientY);
  if (rawEnd === null) return;

  let endMin = roundToNearestSlotMin(rawEnd);
  endMin = clampNumber(endMin, teacherCalDrag.startMin + TEACHER_CAL_MIN_DURATION_MINUTES, meta.selectableEndMin);

  if (endMin === teacherCalDrag.endMin) return;
  teacherCalDrag.endMin = endMin;
  if (teacherCalSelection) teacherCalSelection.endMin = endMin;
  syncTeacherCalSelectionUI();
});

window.addEventListener("mouseup", () => {
  if (!teacherCalDrag) return;
  const drag = teacherCalDrag;
  teacherCalDrag = null;
  body.classList.remove("is-cal-dragging");

  const startTime = formatHmFromMinutes(drag.startMin);
  const endTime = formatHmFromMinutes(drag.endMin);
  openTeacherCreateEventModalAt({ dateKey: drag.dateKey, startTime, endTime });
});

window.addEventListener("blur", () => {
  if (teacherCalDrag || teacherCalSelection) {
    clearTeacherCalendarSelection();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (teacherCalDrag || teacherCalSelection) {
      clearTeacherCalendarSelection();
      return;
    }

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
    const dayGroup = modalBody.querySelector(`[data-wh-daygroup="${CSS.escape(dayKey)}"]`);
    if (dayGroup instanceof HTMLElement) {
      // Re-render the group so disabled days collapse into the "Indisponível" UI (and vice-versa).
      dayGroup.outerHTML = renderWorkHoursDayGroup(dayKey);
    }
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
    const repeatSelect = modalBody.querySelector("[data-ce-repeat-mode]");
    if (repeatSelect instanceof HTMLSelectElement) {
      const weeklyOpt = repeatSelect.querySelector('option[value="weekly"]');
      if (weeklyOpt instanceof HTMLOptionElement) {
        const weekday = weekdayLongFromDateKey(String(target.value || ""));
        weeklyOpt.textContent = weekday ? `Semanal: cada ${weekday.toLowerCase()}` : "Semanal: toda semana";
      }
    }
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
  if (!createEventDraft || !modalBody || modalOverlay?.hidden) return;
  if (activeModalKind !== "event-form") return;
  if (createEventDraft.readOnly) return;

  if (target instanceof HTMLInputElement && target.matches("[data-ce-repeat]")) {
    createEventDraft.recorrente = Boolean(target.checked);
    const options = modalBody.querySelector("[data-ce-repeat-options]");
    if (options instanceof HTMLElement) {
      options.hidden = !createEventDraft.recorrente;
    }
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLSelectElement && target.matches("[data-ce-repeat-mode]")) {
    createEventDraft.repeatMode = target.value;
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLSelectElement && target.matches("[data-ce-admin-student]")) {
    createEventDraft.alunoId = target.value;
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLSelectElement && target.matches("[data-ce-admin-teacher]")) {
    createEventDraft.professorId = target.value;
    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLInputElement && target.matches("[data-ce-doc-input]")) {
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
    if (currentRole === "teacher" || currentRole === "admin") {
      renderTeacherCalendar();
      if (currentRole === "admin") {
        renderAdminRescheduleRequests();
      }
    } else {
      renderStudentLiveLessons();
    }
    return;
  }

  if (currentRole === "teacher" && body.dataset.activePanel === "dashboard") {
    renderTeacherDashboard();
    return;
  }

  if (currentRole === "student" && body.dataset.activePanel === "dashboard") {
    renderStudentDashboard();
    return;
  }
}, 60000);
