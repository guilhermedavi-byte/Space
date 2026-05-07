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
const adminAlertsList = document.querySelector("[data-admin-alerts-list]");
const adminAlertsEmpty = document.querySelector("[data-admin-alerts-empty]");
const adminAlertsCount = document.querySelector("[data-admin-alerts-count]");
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
const adminAgendasList = document.querySelector("[data-admin-agendas-list]");
const adminAgendasEmpty = document.querySelector("[data-admin-agendas-empty]");
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
const pedagogicoList = document.querySelector("[data-pedagogico-list]");
const pedagogicoEmpty = document.querySelector("[data-pedagogico-empty]");
const pedagogicoError = document.querySelector("[data-pedagogico-error]");
const pedagogicoStatus = document.querySelector("[data-pedagogico-status]");
const pedagogicoPendingBadge = document.querySelector("[data-pedagogico-pending]");
const pedagogicoDrawer = document.querySelector("[data-pedagogico-drawer]");
const pedagogicoDrawerTitle = document.querySelector("[data-pedagogico-drawer-title]");
const pedagogicoDrawerAutosave = document.querySelector("[data-pedagogico-autosave]");
const pedagogicoFormContainer = document.querySelector("[data-pedagogico-form-container]");

// Admin > Alunos (histórico pedagógico por professor)
const adminStudentsTeacherSelect = document.querySelector("[data-admin-students-teacher]"); // legacy (removed from template)
const adminStudentsFiltersTrigger = document.querySelector("[data-admin-students-filters-trigger]");
const adminStudentsFiltersBadge = document.querySelector("[data-admin-students-filters-badge]");
const adminStudentsList = document.querySelector("[data-admin-students-list]");
const adminStudentsEmpty = document.querySelector("[data-admin-students-empty]");
const adminStudentsError = document.querySelector("[data-admin-students-error]");
const adminStudentsStatus = document.querySelector("[data-admin-students-status]");
const adminStudentHistoryDrawer = document.querySelector("[data-admin-student-history-drawer]");
const adminStudentHistoryTitle = document.querySelector("[data-admin-student-history-title]");
const adminStudentHistorySub = document.querySelector("[data-admin-student-history-sub]");
// Drawer content was refactored to a unified "Ficha do aluno". The inner content is rendered dynamically.
const adminStudentSheet = document.querySelector("[data-admin-student-sheet]");

// Admin > Controle Pedagógico (gestão)
const adminPedRoot = document.querySelector("[data-admin-pedagogico]");
const adminPedStatus = document.querySelector("[data-admin-ped-status]");
const adminPedAgenda = document.querySelector("[data-admin-ped-agenda]");
const adminPedEmpty = document.querySelector("[data-admin-ped-empty]");
const adminPedError = document.querySelector("[data-admin-ped-error]");
const adminPedClasses = document.querySelector("[data-admin-ped-classes]");
const adminPedEmptyClasses = document.querySelector("[data-admin-ped-empty-classes]");
const adminPedTeachers = document.querySelector("[data-admin-ped-teachers]");
const adminPedConflicts = document.querySelector("[data-admin-ped-conflicts]");
const adminPedEmptyConflicts = document.querySelector("[data-admin-ped-empty-conflicts]");

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

// Professor > Alunos
const teacherStudentsList = document.querySelector("[data-teacher-students-list]");
const teacherStudentsEmpty = document.querySelector("[data-teacher-students-empty]");
const teacherStudentsError = document.querySelector("[data-teacher-students-error]");
const teacherStudentsStatus = document.querySelector("[data-teacher-students-status]");
const teacherStudentHistoryDrawer = document.querySelector("[data-teacher-student-history-drawer]");
const teacherStudentHistoryTitle = document.querySelector("[data-teacher-student-history-title]");
const teacherStudentHistorySub = document.querySelector("[data-teacher-student-history-sub]");
const teacherStudentHistoryBody = document.querySelector("[data-teacher-student-history-body]");
const teacherStudentHistoryEmpty = document.querySelector("[data-teacher-student-history-empty]");
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

// Strict YYYY-MM-DD validation (guards against invalid dates like 2026-02-31).
const isValidDateKey = (value) => {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const [year, month, day] = value.split("-").map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
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

// Alguns pontos do app ainda comparam `currentRole` como string "teacher".
// Esta função garante compatibilidade caso algum fluxo injete "professor".
const isTeacherAccessRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "teacher" || normalized === "professor";
};

// Handler único (robusto) para abrir o drawer a partir de um eventId clicado na lista.
function handlePedagogicoItemOpen(eventId) {
  const id = String(eventId || "").trim();
  const lesson = Array.isArray(pedagogicoState.lessons)
    ? pedagogicoState.lessons.find((l) => String(l?.id || "") === id)
    : null;

  if (!lesson) return;

  const start = buildDateFromDateKeyAndMinutes(lesson.dateKey, lesson.startMin);
  const isFuture = start ? start.getTime() > Date.now() : false;
  if (isFuture) return;

  try {
    openPedagogicoDrawer({ lesson });
  } catch (error) {
    console.error("[PEDAGOGICO] erro ao abrir drawer:", error);
  }
}

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

  document.querySelectorAll("[data-teacher-only]").forEach((el) => {
    if (el instanceof HTMLElement) {
      el.hidden = currentRole !== "teacher";
    }
  });

  // Defensive: ensure Admin sidebar contains the "Alunos" entry (some deploys may serve an older template).
  if (currentRole === "admin") {
    try {
      const sidebarNav = document.querySelector(".sidebar-nav");
      if (sidebarNav instanceof HTMLElement) {
        const existing = sidebarNav.querySelector('[data-panel-target="alunos"]');
        if (!(existing instanceof HTMLButtonElement)) {
          const btn = document.createElement("button");
          btn.className = "sidebar-link";
          btn.type = "button";
          btn.setAttribute("data-panel-target", "alunos");
          btn.setAttribute("data-admin-only", "");
          btn.title = "Alunos";
          btn.innerHTML = `
            <span class="sidebar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3.5 19.5v-1.2a3.3 3.3 0 0 1 3.3-3.3h6.4a3.3 3.3 0 0 1 3.3 3.3v1.2"></path>
                <circle cx="10" cy="8.2" r="3.2"></circle>
                <path d="M18.5 9.5h3"></path>
                <path d="M20 8v3"></path>
              </svg>
            </span>
            <span class="sidebar-text">Alunos</span>
          `;
          // Insert after "Professores" when possible, otherwise append.
          const after = sidebarNav.querySelector('[data-panel-target="professores"]');
          if (after && after.parentNode === sidebarNav) {
            after.insertAdjacentElement("afterend", btn);
          } else {
            sidebarNav.appendChild(btn);
          }
          // Bind navigation for this dynamically inserted link.
          btn.addEventListener("click", () => {
            const role = sessionUser?.role || currentRole;
            navigateApp(panelPathForRole(role, "alunos"));
          });
        }

        // Also ensure Admin sidebar contains "Controle Pedagógico" entry.
        const existingPed = sidebarNav.querySelector('[data-panel-target="admin-controle-pedagogico"]');
        if (!(existingPed instanceof HTMLButtonElement)) {
          const btn = document.createElement("button");
          btn.className = "sidebar-link";
          btn.type = "button";
          btn.setAttribute("data-panel-target", "admin-controle-pedagogico");
          btn.setAttribute("data-admin-only", "");
          btn.title = "Controle Pedagógico";
          btn.innerHTML = `
            <span class="sidebar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 5.5h8"></path>
                <path d="M9 9h8"></path>
                <path d="M9 12.5h8"></path>
                <path d="M9 16h6"></path>
                <path d="M7 4.5h-.6A2.9 2.9 0 0 0 3.5 7.4v11.2A2.9 2.9 0 0 0 6.4 21.5h11.2a2.9 2.9 0 0 0 2.9-2.9V7.4a2.9 2.9 0 0 0-2.9-2.9H17"></path>
                <path d="M8.5 3.5h4a1 1 0 0 1 1 1v2h-6v-2a1 1 0 0 1 1-1Z"></path>
              </svg>
            </span>
            <span class="sidebar-text">Controle Pedagógico</span>
          `;
          // Insert after "Alunos" when possible, otherwise after "Professores", otherwise append.
          const after =
            sidebarNav.querySelector('[data-panel-target="alunos"]') ||
            sidebarNav.querySelector('[data-panel-target="professores"]');
          if (after && after.parentNode === sidebarNav) {
            after.insertAdjacentElement("afterend", btn);
          } else {
            sidebarNav.appendChild(btn);
          }
          btn.addEventListener("click", () => {
            const role = sessionUser?.role || currentRole;
            navigateApp(panelPathForRole(role, "admin-controle-pedagogico"));
          });
        }
      }
    } catch {
      // ignore
    }
  }

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

const WEEKLY_CUSTOM_DAY_DEFS = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" },
];

const createDefaultRepeatConfig = () => {
  const days = {};
  WEEKLY_CUSTOM_DAY_DEFS.forEach((d) => {
    days[d.key] = { enabled: false, startTime: "", endTime: "" };
  });
  return { enabled: false, type: "", weekday: "", dayOfMonth: null, days };
};

const createDefaultWeeklyCustomRepeat = () => createDefaultRepeatConfig();

const WEEKDAY_KEY_BY_UTC_DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const weekdayKeyFromDateKey = (dateKey) => {
  const raw = String(dateKey || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [y, m, d] = raw.split("-").map((v) => Number(v));
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_KEY_BY_UTC_DOW[dow] || "";
};

const dayOfMonthFromDateKey = (dateKey) => {
  const raw = String(dateKey || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 0;
  const d = Number(raw.slice(8, 10));
  return Number.isFinite(d) ? d : 0;
};
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
  // Reset any disabled state from a previous modal operation (prevents "stuck" primary buttons).
  modalPrimary.disabled = false;
  modalSecondary.disabled = false;
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

  renderAdminSheetsMetrics();
  renderAdminAlerts();
};

let adminSheetsMetricsState = {
  fetchedAt: 0,
  isLoading: false,
  data: null,
};

let adminAlertsState = {
  fetchedAt: 0,
  isLoading: false,
  data: null,
};

const renderAdminAlertsList = (alerts) => {
  if (!(adminAlertsList instanceof HTMLElement)) return;
  const rows = Array.isArray(alerts) ? alerts : [];
  if (adminAlertsEmpty instanceof HTMLElement) adminAlertsEmpty.hidden = rows.length > 0;

  if (adminAlertsCount instanceof HTMLElement) {
    adminAlertsCount.hidden = rows.length <= 0;
    adminAlertsCount.textContent = rows.length > 0 ? String(rows.length) : "0";
  }

  if (!rows.length) {
    adminAlertsList.innerHTML = "";
    return;
  }

  const safeRows = rows.slice(0, 8);
  adminAlertsList.innerHTML = safeRows
    .map((a) => {
      const aluno = String(a?.alunoNome || a?.alunoId || "Aluno");
      const prof = String(a?.professorNome || a?.professorId || "Professor");
      const dateKey = String(a?.dateKey || "");
      const when = isValidDateKey(dateKey) ? formatPedagogicoDate(dateKey) : "—";
      const nextKey = String(a?.novaDataRemarcacao || "");
      const nextWhen = isValidDateKey(nextKey) ? formatPedagogicoDate(nextKey) : "";
      const nextHm =
        a?.horarioInicioRemarcacao && a?.horarioFimRemarcacao
          ? `${String(a.horarioInicioRemarcacao)}–${String(a.horarioFimRemarcacao)}`
          : "";
      const meta = nextWhen ? `→ ${nextWhen}${nextHm ? ` · ${nextHm}` : ""}` : "";
      return `
        <li class="admin-alerts-item">
          <div class="admin-alerts-item-main">
            <div class="admin-alerts-item-title">Professor remarcou aula</div>
            <div class="admin-alerts-item-sub">${escapeHtml(`${aluno} · ${prof} · ${when}${meta ? ` ${meta}` : ""}`)}</div>
          </div>
        </li>
      `;
    })
    .join("");
};

const renderAdminAlerts = async () => {
  if (currentRole !== "admin") return;
  if (!(adminAlertsList instanceof HTMLElement)) return;
  if (adminAlertsState.isLoading) return;

  const now = Date.now();
  if (adminAlertsState.data && now - adminAlertsState.fetchedAt < 60_000) {
    renderAdminAlertsList(adminAlertsState.data);
    return;
  }

  adminAlertsState.isLoading = true;
  try {
    const res = await fetchWithAuth("/api/admin-alerts", { method: "GET" });
    const data = await res.json().catch(() => null);
    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
    if (res.ok) {
      adminAlertsState.data = alerts;
      adminAlertsState.fetchedAt = Date.now();
      renderAdminAlertsList(alerts);
    }
  } catch {
    // keep existing UI
  } finally {
    adminAlertsState.isLoading = false;
  }
};

const formatPercentPtBr1 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
};

const formatMonthsPtBr1 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} meses`;
};

const formatTimesPtBr1 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}x`;
};

const applyAdminSheetsMetricsToUI = (payload) => {
  // Capture selectors at apply-time (the admin dashboard DOM may be injected later).
  const adminSheetsMetricEls = Array.from(document.querySelectorAll("[data-admin-sheets-metric]"));
  const adminSheetsChurnMeta = document.querySelector('[data-admin-sheets-metric-meta="churnMes"]');

  const data = payload && typeof payload === "object" ? payload : {};
  const alunosAtivos = Number(data.alunosAtivos);
  const alunosNovosMes = Number(data.alunosNovosMes);
  const churnMes = Number(data.churnMes);
  const churnPercentual = Number(data.churnPercentual);
  const ltvMedio = Number(data.ltvMedio);
  const tempMedioMeses = Number(data.tempMedioMeses);
  const cac = Number(data.cac);
  const ltvCac = Number(data.ltvCac);

  adminSheetsMetricEls.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const key = String(el.getAttribute("data-admin-sheets-metric") || "").trim();
    if (!key) return;
    if (key === "alunosAtivos") el.textContent = Number.isFinite(alunosAtivos) ? String(alunosAtivos) : "—";
    else if (key === "alunosNovosMes") el.textContent = Number.isFinite(alunosNovosMes) ? String(alunosNovosMes) : "—";
    else if (key === "churnPercentual") el.textContent = formatPercentPtBr1(churnPercentual);
    else if (key === "ltvMedio") el.textContent = currencyPtBrNoCents(ltvMedio);
    else if (key === "tempMedioMeses") el.textContent = formatMonthsPtBr1(tempMedioMeses);
    else if (key === "cac") el.textContent = currencyPtBrNoCents(cac);
    else if (key === "ltvCac") el.textContent = formatTimesPtBr1(ltvCac);
  });

  if (adminSheetsChurnMeta instanceof HTMLElement) {
    adminSheetsChurnMeta.textContent = Number.isFinite(churnMes) ? `${churnMes} cancelamentos` : "—";
  }
};

const renderAdminSheetsMetrics = async () => {
  if (currentRole !== "admin") return;
  if (adminSheetsMetricsState.isLoading) return;

  const now = Date.now();
  if (adminSheetsMetricsState.data && now - adminSheetsMetricsState.fetchedAt < 240_000) {
    applyAdminSheetsMetricsToUI(adminSheetsMetricsState.data);
    return;
  }

  adminSheetsMetricsState.isLoading = true;
  try {
    const res = await fetchWithAuth("/api/admin-sheets-metrics", { method: "GET" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== "object") return;
    adminSheetsMetricsState.data = data;
    adminSheetsMetricsState.fetchedAt = Date.now();
    applyAdminSheetsMetricsToUI(data);
  } catch (error) {
    // Keep existing values on screen if the sheet fetch fails.
  } finally {
    adminSheetsMetricsState.isLoading = false;
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

const ADMIN_SELECTED_TEACHERS_STORAGE_KEY = "admin_selected_teachers";
const ADMIN_TEACHER_AGENDA_PALETTE = [
  "#5C9BD6", // azul
  "#E8A838", // amarelo
  "#4CAF82", // verde
  "#E05C5C", // vermelho
  "#9B6DD6", // roxo
  "#E87D3E", // laranja
  "#5CC4C4", // teal
];

const adminTeacherAgendasState = {
  isLoading: false,
  loadedAt: 0,
  teachers: [], // { id, nome, initials, ativo }
  selectedIds: null, // Set<string> (null => default/all)
  colorById: new Map(), // Map<string, string>
};

const adminTeacherWorkHoursState = {
  isLoading: false,
  loadedAt: 0,
  byId: new Map(), // Map<string, LocalWorkHours>
};

const getAdminTeacherWorkHours = (teacherId) => {
  const uid = String(teacherId || "").trim();
  if (!uid) return null;
  return adminTeacherWorkHoursState.byId.get(uid) || null;
};

const refreshAdminTeacherWorkHours = async ({ teacherIds, force = false } = {}) => {
  if (currentRole !== "admin") return;
  const ids = Array.isArray(teacherIds) ? teacherIds.map((id) => String(id || "").trim()).filter(Boolean) : [];
  if (!ids.length) return;

  const now = Date.now();
  if (!force && adminTeacherWorkHoursState.loadedAt && now - adminTeacherWorkHoursState.loadedAt < 30_000) {
    return;
  }
  if (adminTeacherWorkHoursState.isLoading) return;

  adminTeacherWorkHoursState.isLoading = true;
  try {
    const results = await Promise.all(
      ids.map(async (uid) => {
        const res = await fetchWithAuth(`/api/teacher-workhours?uid=${encodeURIComponent(uid)}`, { method: "GET" });
        if (!res.ok) return { uid, ok: false, workHours: null };
        const data = await res.json().catch(() => null);
        const apiWorkHours = data?.workHours && typeof data.workHours === "object" ? data.workHours : null;
        return { uid, ok: true, workHours: apiWorkHoursToLocalWorkHours(apiWorkHours) };
      })
    );

    results.forEach((row) => {
      if (row.ok && row.workHours) {
        adminTeacherWorkHoursState.byId.set(row.uid, row.workHours);
      }
    });
    adminTeacherWorkHoursState.loadedAt = Date.now();

    if (body.dataset.activePanel === "ao-vivo") {
      renderTeacherCalendar();
    }
  } catch (error) {
    // ignore (fallback is "no restriction")
  } finally {
    adminTeacherWorkHoursState.isLoading = false;
  }
};

const clampNumber = (value, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
};

const clampInt = (value, min, max, fallback = min) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;

  const hasMin = typeof min === "number" && Number.isFinite(min);
  const hasMax = typeof max === "number" && Number.isFinite(max);

  if (hasMin && parsed < min) return min;
  if (hasMax && parsed > max) return max;
  return parsed;
};

const toRgba = (hex, alpha) => {
  const raw = String(hex || "").trim().replace("#", "");
  const safeAlpha = clampNumber(alpha, 0, 1);
  if (raw.length !== 6) return `rgba(255,255,255,${safeAlpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if (![r, g, b].every((v) => Number.isFinite(v))) return `rgba(255,255,255,${safeAlpha})`;
  return `rgba(${r},${g},${b},${safeAlpha})`;
};

const getAdminTeacherColor = (teacherId) => {
  const uid = String(teacherId || "").trim();
  if (!uid) return ADMIN_TEACHER_AGENDA_PALETTE[0];
  const existing = adminTeacherAgendasState.colorById.get(uid);
  if (existing) return existing;
  // Deterministic-ish fallback: use a small hash to pick a palette index.
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  const color = ADMIN_TEACHER_AGENDA_PALETTE[hash % ADMIN_TEACHER_AGENDA_PALETTE.length];
  adminTeacherAgendasState.colorById.set(uid, color);
  return color;
};

const loadAdminSelectedTeacherIds = (allTeacherIds) => {
  const ids = Array.isArray(allTeacherIds) ? allTeacherIds.filter(Boolean) : [];
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(ADMIN_SELECTED_TEACHERS_STORAGE_KEY) || "null");
  } catch (e) {
    parsed = null;
  }
  // If the key exists (even as an empty array), treat it as the source of truth for selection.
  if (Array.isArray(parsed)) {
    const selected = parsed.filter((id) => typeof id === "string");
    const filtered = selected.filter((id) => ids.includes(id));
    return new Set(filtered);
  }
  // Default: all selected.
  return new Set(ids);
};

const persistAdminSelectedTeacherIds = (selectedSet) => {
  if (!(selectedSet instanceof Set)) return;
  try {
    localStorage.setItem(ADMIN_SELECTED_TEACHERS_STORAGE_KEY, JSON.stringify(Array.from(selectedSet)));
  } catch (e) {
    // ignore
  }
};

const getAdminSelectedTeacherIdsSet = () => {
  if (currentRole !== "admin") return null;
  if (adminTeacherAgendasState.selectedIds instanceof Set) return adminTeacherAgendasState.selectedIds;
  const ids = Array.isArray(adminTeacherAgendasState.teachers)
    ? adminTeacherAgendasState.teachers.filter((t) => t && typeof t === "object" && t.ativo !== false).map((t) => t.id).filter(Boolean)
    : [];
  if (!ids.length) return null;
  const selected = loadAdminSelectedTeacherIds(ids);
  adminTeacherAgendasState.selectedIds = selected;
  return selected;
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

let teacherCalWorkHoursTooltip = null;
const ensureTeacherCalWorkHoursTooltip = () => {
  if (teacherCalWorkHoursTooltip instanceof HTMLElement) return teacherCalWorkHoursTooltip;
  const el = document.createElement("div");
  el.className = "calendar-slot-tooltip";
  el.textContent = "Fora do horário de trabalho";
  el.hidden = true;
  document.body.appendChild(el);
  teacherCalWorkHoursTooltip = el;
  return el;
};

const showTeacherCalWorkHoursTooltip = ({ x, y } = {}) => {
  const tip = ensureTeacherCalWorkHoursTooltip();
  const left = Number.isFinite(Number(x)) ? Number(x) : 0;
  const top = Number.isFinite(Number(y)) ? Number(y) : 0;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.hidden = false;
};

const hideTeacherCalWorkHoursTooltip = () => {
  if (!(teacherCalWorkHoursTooltip instanceof HTMLElement)) return;
  teacherCalWorkHoursTooltip.hidden = true;
};

const getWorkWindowForMinute = (minutes, windows) => {
  const m = Number(minutes);
  const arr = Array.isArray(windows) ? windows : [];
  if (!Number.isFinite(m) || !arr.length) return null;
  return arr.find((w) => m >= w.start && m < w.end) || null;
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

const normalizeAdminAgendaTeacher = ({ id, nome, ativo }) => {
  const uid = String(id || "").trim();
  const name = String(nome || "").trim();
  if (!uid || !name) return null;
  return { id: uid, nome: name, initials: getInitials(name), ativo: ativo !== false };
};

const fetchAdminAgendaTeachers = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }

  const q = firebase.query(firebase.collection(firebase.primaryDb, "users"), firebase.where("tipo", "==", "teacher"));
  const snap = await withTimeout(firebase.getDocs(q), 12_000, "firestore_getDocs_teachers_agendas");
  const out = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data ? docSnap.data() : null;
    if (!data || typeof data !== "object") return;
    out.push(
      normalizeAdminAgendaTeacher({
        id: docSnap.id,
        nome: data.nome,
        ativo: typeof data.ativo === "boolean" ? data.ativo : true,
      })
    );
  });
  return out.filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

const applyAdminTeacherAgendasToUI = () => {
  if (!(adminAgendasList instanceof HTMLElement)) return;
  const teachers = Array.isArray(adminTeacherAgendasState.teachers) ? adminTeacherAgendasState.teachers : [];
  const activeTeachers = teachers.filter((t) => t.ativo !== false);

  // Assign palette colors by index for the current snapshot (keeps colors stable as long as ordering is stable).
  activeTeachers.forEach((teacher, idx) => {
    if (!adminTeacherAgendasState.colorById.get(teacher.id)) {
      adminTeacherAgendasState.colorById.set(
        teacher.id,
        ADMIN_TEACHER_AGENDA_PALETTE[idx % ADMIN_TEACHER_AGENDA_PALETTE.length]
      );
    }
  });

  const teacherIds = activeTeachers.map((t) => t.id);
  if (!(adminTeacherAgendasState.selectedIds instanceof Set)) {
    adminTeacherAgendasState.selectedIds = loadAdminSelectedTeacherIds(teacherIds);
  }
  const selected = adminTeacherAgendasState.selectedIds instanceof Set ? adminTeacherAgendasState.selectedIds : new Set();

  if (adminAgendasEmpty instanceof HTMLElement) {
    adminAgendasEmpty.hidden = activeTeachers.length > 0;
  }

  adminAgendasList.innerHTML = activeTeachers
    .map((teacher) => {
      const color = getAdminTeacherColor(teacher.id);
      const isOn = selected.has(teacher.id);
      return `
        <li class="admin-agenda-item" data-admin-agenda-id="${escapeHtml(teacher.id)}">
          <button
            class="admin-agenda-toggle${isOn ? " is-on" : ""}"
            type="button"
            style="--agenda-color:${escapeHtml(color)}"
            data-admin-agenda-toggle="${escapeHtml(teacher.id)}"
            aria-label="${isOn ? "Ocultar" : "Mostrar"} agenda de ${escapeHtml(teacher.nome)}"
            aria-pressed="${isOn ? "true" : "false"}"
          ></button>
          <div class="admin-agenda-avatar" aria-hidden="true">${escapeHtml(teacher.initials || "")}</div>
          <div class="admin-agenda-name">${escapeHtml(teacher.nome)}</div>
        </li>
      `;
    })
    .join("");
};

const renderAdminTeacherAgendas = async ({ force = false } = {}) => {
  if (currentRole !== "admin") return;
  if (!(adminAgendasList instanceof HTMLElement)) return;
  if (adminTeacherAgendasState.isLoading) return;

  const now = Date.now();
  if (!force && adminTeacherAgendasState.loadedAt && now - adminTeacherAgendasState.loadedAt < 60_000) {
    applyAdminTeacherAgendasToUI();
    return;
  }

  adminTeacherAgendasState.isLoading = true;
  try {
    const teachers = await fetchAdminAgendaTeachers();
    adminTeacherAgendasState.teachers = teachers;
    adminTeacherAgendasState.loadedAt = Date.now();

    // Re-hydrate selected ids with the new teacher snapshot (keeping explicit "none" selection when stored).
    const ids = teachers.filter((t) => t.ativo !== false).map((t) => t.id);
    const selected = loadAdminSelectedTeacherIds(ids);
    adminTeacherAgendasState.selectedIds = selected;
    applyAdminTeacherAgendasToUI();
    if (body.dataset.activePanel === "ao-vivo") {
      renderTeacherCalendar();
    }
  } catch (error) {
    console.error("[admin] agendas load failed:", error);
    adminTeacherAgendasState.teachers = [];
    adminTeacherAgendasState.selectedIds = new Set();
    applyAdminTeacherAgendasToUI();
  } finally {
    adminTeacherAgendasState.isLoading = false;
  }
};

const toggleAdminTeacherAgenda = (teacherId) => {
  if (currentRole !== "admin") return;
  const id = String(teacherId || "").trim();
  if (!id) return;
  const teachers = Array.isArray(adminTeacherAgendasState.teachers) ? adminTeacherAgendasState.teachers : [];
  const activeIds = teachers.filter((t) => t.ativo !== false).map((t) => t.id);
  if (!activeIds.length) return;

  if (!(adminTeacherAgendasState.selectedIds instanceof Set)) {
    adminTeacherAgendasState.selectedIds = loadAdminSelectedTeacherIds(activeIds);
  }
  const selected = adminTeacherAgendasState.selectedIds;

  if (selected.has(id)) selected.delete(id);
  else selected.add(id);

  persistAdminSelectedTeacherIds(selected);
  applyAdminTeacherAgendasToUI();
  if (body.dataset.activePanel === "ao-vivo") {
    renderTeacherCalendar();
  }
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
  let events = [...getLessonEvents(), ...getManualEvents()];
  if (currentRole === "admin") {
    const selected = getAdminSelectedTeacherIdsSet();
    if (selected instanceof Set) {
      events = events.filter((event) => selected.has(String(event.professorId || "").trim()));
    }
  }
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

const isMinuteWithinWindows = (minutes, windows) => {
  const m = Number(minutes);
  const arr = Array.isArray(windows) ? windows : [];
  if (!Number.isFinite(m) || !arr.length) return false;
  return arr.some((w) => m >= w.start && m < w.end);
};

const getWorkWindowsForGrid = ({ gridEl, dateKey } = {}) => {
  if (!(gridEl instanceof HTMLElement)) return null;
  const key = String(dateKey || gridEl.getAttribute("data-teacher-cal-grid") || "").trim();
  const date = parseDateKey(key);
  if (!date) return null;

  const dayIndex = String(date.getDay());

  if (currentRole === "teacher") {
    const work = teacherWorkHours[dayIndex] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
    return normalizeWorkWindows(work);
  }

  if (currentRole === "admin") {
    const teacherId = String(gridEl.getAttribute("data-teacher-cal-teacher") || "").trim();
    const selected = getAdminSelectedTeacherIdsSet();
    const singleSelected = selected instanceof Set && selected.size === 1 ? Array.from(selected)[0] : "";
    const effectiveTeacherId = teacherId || singleSelected;
    if (!effectiveTeacherId) return null;
    const workHours = getAdminTeacherWorkHours(effectiveTeacherId);
    if (!workHours) return null; // not loaded yet => no restriction
    const work = workHours[dayIndex] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
    return normalizeWorkWindows(work);
  }

  return null;
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

  const today = startOfDay(new Date());
  const isToday = sameDateKey(date, today);

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
  let baseWorkHours = teacherWorkHours;
  let singleTeacherId = "";
  if (currentRole === "admin") {
    const selected = getAdminSelectedTeacherIdsSet();
    singleTeacherId = selected instanceof Set && selected.size === 1 ? Array.from(selected)[0] : "";
    const adminWork = singleTeacherId ? getAdminTeacherWorkHours(singleTeacherId) : null;
    if (adminWork) baseWorkHours = adminWork;
  }

  const work = baseWorkHours[dayIndex] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
  const windows = normalizeWorkWindows(work);
  const segments = computeOffHoursSegments({ windows, gridStartMin, gridEndMin });
  const offHours = `
    <div class="teacher-cal-offhours" aria-hidden="true">
      ${segments
        .map((seg) => {
          const top = ((seg.start - gridStartMin) / 60) * hourHeight;
          const height = ((seg.end - seg.start) / 60) * hourHeight;
          return `<div class="teacher-cal-offhours-seg calendar-slot is-unavailable" style="top:${top}px;height:${height}px"></div>`;
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

  const renderEventButton = (event, accentColor) => {
    const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
    const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
    const top = ((startMinutes - gridStartMin) / 60) * hourHeight;
    const height = Math.max(18, ((endMinutes - startMinutes) / 60) * hourHeight);
    const leftPct = (event.colIndex / event.colCount) * 100;
    const widthPct = 100 / event.colCount;
    const timeLabel = `${formatTimeHm(event.start)} – ${formatTimeHm(event.end)}`;

    const color = String(accentColor || "").trim();
    const tintBg = color ? toRgba(color, 0.22) : "";
    const tintBorder = color ? toRgba(color, 0.6) : "";
    const tintShadow = color ? `0 12px 26px ${toRgba(color, 0.18)}` : "";
    const extraStyle = color
      ? `background:${tintBg};border:1px solid ${tintBorder};box-shadow:${tintShadow};`
      : "";

    return `
      <button
        class="teacher-cal-event is-${event.type}"
        style="top:${top}px;height:${height}px;left:calc(${leftPct}% + 8px);width:calc(${widthPct}% - 16px);${extraStyle}"
        type="button"
        data-teacher-cal-event-type="${event.type}"
        data-teacher-cal-event-id="${escapeHtml(event.id)}"
      >
        <span class="teacher-cal-event-title">${escapeHtml(event.title)}</span>
        <span class="teacher-cal-event-time">${escapeHtml(timeLabel)}</span>
      </button>
    `;
  };

  // Admin: allow splitting the day view into one column per selected teacher agenda.
  if (currentRole === "admin") {
    const selected = getAdminSelectedTeacherIdsSet();
    const selectedIds = selected instanceof Set ? Array.from(selected) : [];
    const activeTeachers = Array.isArray(adminTeacherAgendasState.teachers)
      ? adminTeacherAgendasState.teachers.filter((t) => t && typeof t === "object" && t.ativo !== false)
      : [];
    const selectedTeachers = selectedIds.length
      ? activeTeachers.filter((t) => selected.has(t.id))
      : [];

    if (selected instanceof Set && selected.size > 1) {
      const columns =
        selectedTeachers.length > 0
          ? selectedTeachers
          : selectedIds.map((id) => ({ id, nome: "Professor", initials: "", ativo: true }));

      const headCells = columns
        .map((teacher) => {
          const color = getAdminTeacherColor(teacher.id);
          return `
            <div class="teacher-cal-head-cell teacher-cal-agenda-head">
              <div class="teacher-cal-agenda-label">
                <span class="teacher-cal-agenda-dot" style="background:${escapeHtml(color)}" aria-hidden="true"></span>
                <span>${escapeHtml(teacher.nome || "Professor")}</span>
              </div>
            </div>
          `;
        })
        .join("");

      const colMarkup = columns
        .map((teacher) => {
          const teacherId = String(teacher.id || "").trim();
          const color = getAdminTeacherColor(teacherId);
          const colEvents = events.filter((evt) => String(evt.professorId || "").trim() === teacherId);
          const laidOut = layoutOverlappingEvents(colEvents);
          const eventsMarkup = laidOut.map((evt) => renderEventButton(evt, color)).join("");

          const teacherWorkHoursForCol = getAdminTeacherWorkHours(teacherId);
          const workForCol = teacherWorkHoursForCol
            ? teacherWorkHoursForCol[dayIndex] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] }
            : null;
          const windowsForCol = workForCol ? normalizeWorkWindows(workForCol) : [];
          const segsForCol = workForCol ? computeOffHoursSegments({ windows: windowsForCol, gridStartMin, gridEndMin }) : [];
          const offHoursForCol = segsForCol.length
            ? `
              <div class="teacher-cal-offhours" aria-hidden="true">
                ${segsForCol
                  .map((seg) => {
                    const top = ((seg.start - gridStartMin) / 60) * hourHeight;
                    const height = ((seg.end - seg.start) / 60) * hourHeight;
                    return `<div class="teacher-cal-offhours-seg calendar-slot is-unavailable" style="top:${top}px;height:${height}px"></div>`;
                  })
                  .join("")}
              </div>
            `
            : `<div class="teacher-cal-offhours" aria-hidden="true"></div>`;
          return `
            <div class="teacher-cal-grid teacher-cal-grid-split" data-teacher-cal-grid="${createDateKey(
              date
            )}" data-teacher-cal-start="${startHour}" data-teacher-cal-end="${endHour}" data-teacher-cal-teacher="${escapeHtml(
            teacherId
          )}">
              ${rows.join("")}
              ${offHoursForCol}
              ${nowLine}
              <div class="teacher-cal-events-layer">${eventsMarkup}</div>
            </div>
          `;
        })
        .join("");

      teacherCalViewport.innerHTML = `
        <div class="teacher-cal-day is-multi" style="grid-template-columns: 60px repeat(${columns.length}, minmax(0, 1fr));">
          <div class="teacher-cal-head-cell"></div>
          ${headCells}
          <div class="teacher-cal-timecol">${times.join("")}</div>
          ${colMarkup}
        </div>
      `;
      return;
    }
  }

  const laidOut = layoutOverlappingEvents(events);
  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "").toUpperCase();
  const head = `
    <div class="teacher-cal-head-cell"></div>
    <div class="teacher-cal-head-cell">
      <div class="teacher-cal-day-label">
        <span>${weekdayLabel}</span>
        <span class="teacher-cal-day-num${isToday ? " is-today" : ""}">${date.getDate()}</span>
      </div>
    </div>
  `;

  const eventsMarkup = laidOut
    .map((event) => {
      const accent = currentRole === "admin" ? getAdminTeacherColor(event.professorId) : "";
      return renderEventButton(event, accent);
    })
    .join("");

  teacherCalViewport.innerHTML = `
    <div class="teacher-cal-day">
      ${head}
      <div class="teacher-cal-timecol">${times.join("")}</div>
      <div class="teacher-cal-grid" data-teacher-cal-grid="${createDateKey(date)}" data-teacher-cal-start="${startHour}" data-teacher-cal-end="${endHour}" ${
        currentRole === "admin" && singleTeacherId ? `data-teacher-cal-teacher="${escapeHtml(singleTeacherId)}"` : ""
      }>
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
      let baseWorkHours = teacherWorkHours;
      if (currentRole === "admin") {
        const selected = getAdminSelectedTeacherIdsSet();
        const singleSelected = selected instanceof Set && selected.size === 1 ? Array.from(selected)[0] : "";
        const adminWork = singleSelected ? getAdminTeacherWorkHours(singleSelected) : null;
        if (adminWork) baseWorkHours = adminWork;
      }

      const work = baseWorkHours[dayIndex] || { enabled: true, windows: [{ start: "00:00", end: "23:59" }] };
      const windows = normalizeWorkWindows(work);
      const segments = computeOffHoursSegments({ windows, gridStartMin, gridEndMin });
      const offHours = `
        <div class="teacher-cal-offhours" aria-hidden="true">
          ${segments
            .map((seg) => {
              const top = ((seg.start - gridStartMin) / 60) * hourHeight;
              const height = ((seg.end - seg.start) / 60) * hourHeight;
              return `<div class="teacher-cal-offhours-seg calendar-slot is-unavailable" style="top:${top}px;height:${height}px"></div>`;
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
          <div class="teacher-cal-grid" data-teacher-cal-grid="${createDateKey(date)}" data-teacher-cal-start="${startHour}" data-teacher-cal-end="${endHour}" ${
            currentRole === "admin"
              ? (() => {
                  const selected = getAdminSelectedTeacherIdsSet();
                  const singleSelected = selected instanceof Set && selected.size === 1 ? Array.from(selected)[0] : "";
                  return singleSelected ? `data-teacher-cal-teacher=\"${escapeHtml(singleSelected)}\"` : "";
                })()
              : ""
          }>
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
  if (currentRole === "admin") {
    const selected = getAdminSelectedTeacherIdsSet();
    const ids = selected instanceof Set ? Array.from(selected) : [];
    if (ids.length) refreshAdminTeacherWorkHours({ teacherIds: ids });
  }
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
	  const isCreateMode = String(draft.mode || "create") === "create";
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
		  const repeatMode = repeatEnabled ? String(draft.repeatMode || "weekly") : "none";
		  const customRepeat = draft.repeat && typeof draft.repeat === "object" ? draft.repeat : createDefaultRepeatConfig();
		  const customDays = customRepeat.days && typeof customRepeat.days === "object" ? customRepeat.days : {};
		  const repeatType = String(customRepeat.type || "").trim().toLowerCase();
		  const weeklyLabel = (() => {
		    const weekday = weekdayLongFromDateKey(String(draft.dateKey || ""));
		    return weekday ? `Semanal: cada ${weekday.toLowerCase()}` : "Semanal: toda semana";
		  })();
		  const weeklyChoiceLabel = (() => {
		    const weekday = weekdayLongFromDateKey(String(draft.dateKey || ""));
		    return weekday ? `Semanalmente em ${weekday.toLowerCase()}` : "Semanalmente";
		  })();
		  const monthlyChoiceLabel = (() => {
		    const day = dayOfMonthFromDateKey(String(draft.dateKey || ""));
		    return day ? `Todo dia ${day} de cada mês` : "Todo dia deste mês";
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

		      ${
		        isAdmin && isCreateMode && !readOnly
		          ? `
		            <div class="modal-row" style="grid-template-columns: minmax(0, 1fr);">
		              <label class="ce-repeat-toggle">
		                <input type="checkbox" data-ce-repeat-enabled ${repeatEnabled ? "checked" : ""} ${disabledAttr} />
		                <span>Repetir evento</span>
		              </label>
		            </div>
		
		            <div class="ce-repeat-config" data-ce-repeat-config ${repeatEnabled ? "" : "hidden"}>
		              <div class="ce-repeat-options" role="radiogroup" aria-label="Tipo de recorrência">
		                <label class="ce-repeat-option">
		                  <input type="radio" name="ce-repeat-type" value="weekly" data-ce-repeat-type ${
                        repeatType === "weekly" ? "checked" : ""
                      } ${disabledAttr} />
		                  <span>${escapeHtml(weeklyChoiceLabel)}</span>
		                </label>
		                <label class="ce-repeat-option">
		                  <input type="radio" name="ce-repeat-type" value="monthly" data-ce-repeat-type ${
                        repeatType === "monthly" ? "checked" : ""
                      } ${disabledAttr} />
		                  <span>${escapeHtml(monthlyChoiceLabel)}</span>
		                </label>
		                <label class="ce-repeat-option">
		                  <input type="radio" name="ce-repeat-type" value="weekly_custom" data-ce-repeat-type ${
                        repeatType === "weekly_custom" ? "checked" : ""
                      } ${disabledAttr} />
		                  <span>Personalizar</span>
		                </label>
		              </div>

		              <div class="ce-repeat-custom" data-ce-repeat-custom ${repeatType === "weekly_custom" ? "" : "hidden"}>
		                <div class="ce-repeat-hint">Repetir semanalmente em:</div>
		                <div class="ce-repeat-days">
		                  ${WEEKLY_CUSTOM_DAY_DEFS.map((d) => {
		                    const day = customDays && customDays[d.key] ? customDays[d.key] : { enabled: false, startTime: "", endTime: "" };
		                    const enabled = Boolean(day.enabled);
		                    const startVal = enabled && day.startTime ? day.startTime : "";
		                    const endVal = enabled && day.endTime ? day.endTime : "";
		                    return `
		                      <div class="ce-repeat-day">
		                        <label class="ce-repeat-day-check">
		                          <input type="checkbox" data-ce-repeat-day="${escapeHtml(d.key)}" ${enabled ? "checked" : ""} ${disabledAttr} />
		                          <span>${escapeHtml(d.label)}</span>
		                        </label>
		                        <div class="ce-repeat-day-times" data-ce-repeat-day-times="${escapeHtml(d.key)}" ${enabled ? "" : "hidden"}>
		                          <label class="modal-field">
		                            <span>Início</span>
		                            <input class="modal-input" type="time" data-ce-repeat-start="${escapeHtml(d.key)}" value="${escapeHtml(startVal)}" ${disabledAttr} />
		                          </label>
		                          <label class="modal-field">
		                            <span>Fim</span>
		                            <input class="modal-input" type="time" data-ce-repeat-end="${escapeHtml(d.key)}" value="${escapeHtml(endVal)}" ${disabledAttr} />
		                          </label>
		                        </div>
		                      </div>
		                    `;
		                  }).join("")}
		                </div>
		              </div>
		            </div>
		          `
		          : isAdmin
		            ? `
		                <div class="modal-row" style="grid-template-columns: minmax(0, 1fr);">
		                  <div class="modal-field">
		                    <span>Recorrência</span>
		                    <div class="modal-help">${
                          draft.recorrente
                            ? "Evento recorrente (a edição da recorrência não está disponível)."
                            : "Não se repete."
                        }</div>
		                  </div>
		                </div>
		              `
		            : `
		                <div class="modal-row" style="grid-template-columns: minmax(0, 1fr);">
		                  <label class="modal-field">
		                    <span>Frequência</span>
		                    <select class="modal-input" data-ce-repeat-mode ${disabledAttr}>
		                      <option value="none" ${repeatMode === "none" ? "selected" : ""}>Não se repete</option>
		                      <option value="weekly" ${repeatMode === "weekly" ? "selected" : ""}>${escapeHtml(weeklyLabel)}</option>
		                      <option value="daily" ${repeatMode === "daily" ? "selected" : ""}>Todos os dias (segunda a sábado)</option>
		                    </select>
		                  </label>
		                </div>
		              `
		      }

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
  // Keep the draft in sync with the modal DOM. Some controls (notably <select>)
  // do not reliably fire `input` across browsers, which could leave the draft empty
  // even when the UI shows selected values (blocking the Save button).
  const syncDraftFromDom = () => {
    const titleEl = modalBody.querySelector("[data-ce-title]");
    const adminStudentEl = modalBody.querySelector("[data-ce-admin-student]");
    const adminTeacherEl = modalBody.querySelector("[data-ce-admin-teacher]");
    const dateEl = modalBody.querySelector("[data-ce-date]");
    const startEl = modalBody.querySelector("[data-ce-start]");
    const endEl = modalBody.querySelector("[data-ce-end]");
    const repeatEnabledEl = modalBody.querySelector("[data-ce-repeat-enabled]");

    if (titleEl instanceof HTMLInputElement) createEventDraft.title = titleEl.value;
    if (adminStudentEl instanceof HTMLSelectElement) createEventDraft.alunoId = adminStudentEl.value;
    if (adminTeacherEl instanceof HTMLSelectElement) createEventDraft.professorId = adminTeacherEl.value;
    if (dateEl instanceof HTMLInputElement) createEventDraft.dateKey = dateEl.value;
    if (startEl instanceof HTMLInputElement) createEventDraft.startTime = startEl.value;
    if (endEl instanceof HTMLInputElement) createEventDraft.endTime = endEl.value;

    if (repeatEnabledEl instanceof HTMLInputElement) {
      const enabled = Boolean(repeatEnabledEl.checked);
      createEventDraft.recorrente = enabled;
      if (!createEventDraft.repeat || typeof createEventDraft.repeat !== "object") {
        createEventDraft.repeat = createDefaultRepeatConfig();
      }
      createEventDraft.repeat.enabled = enabled;
    }
  };

  syncDraftFromDom();

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
    const alunoId = String(createEventDraft.alunoId || "").trim() || (adminStudentEl instanceof HTMLSelectElement ? adminStudentEl.value : "");
    const professorId =
      String(createEventDraft.professorId || "").trim() || (adminTeacherEl instanceof HTMLSelectElement ? adminTeacherEl.value : "");
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

	  if (String(createEventDraft.mode || "create") === "create" && createEventDraft.recorrente) {
	    if (currentRole === "admin") {
	      const repeat = createEventDraft.repeat && typeof createEventDraft.repeat === "object" ? createEventDraft.repeat : null;
	      const repeatType = String(repeat?.type || "").trim().toLowerCase();
	      const days = repeat?.days && typeof repeat.days === "object" ? repeat.days : {};
	      const enabledKeys = WEEKLY_CUSTOM_DAY_DEFS.filter((d) => Boolean(days?.[d.key]?.enabled)).map((d) => d.key);

	      // Reset any previous per-day error state.
	      WEEKLY_CUSTOM_DAY_DEFS.forEach((d) => {
	        const checkEl = modalBody.querySelector(`[data-ce-repeat-day="${CSS.escape(d.key)}"]`);
	        const startElDay = modalBody.querySelector(`[data-ce-repeat-start="${CSS.escape(d.key)}"]`);
	        const endElDay = modalBody.querySelector(`[data-ce-repeat-end="${CSS.escape(d.key)}"]`);
	        [checkEl, startElDay, endElDay].forEach((el) => {
	          if (el instanceof HTMLElement) el.classList.remove("is-error");
	        });
	      });

	      if (!repeatType) {
	        hasError = true;
	        if (errorEl instanceof HTMLElement) {
	          errorEl.hidden = false;
	          errorEl.textContent = "Selecione o tipo de recorrência para repetir o evento.";
	        }
	      } else if (repeatType !== "weekly_custom") {
	        // weekly/monthly use the main date/time fields, nothing else is required here.
	      } else if (!enabledKeys.length) {
	        hasError = true;
	        if (errorEl instanceof HTMLElement) {
	          errorEl.hidden = false;
	          errorEl.textContent = "Selecione pelo menos um dia da semana para repetir o evento.";
	        }
	      } else {
	        for (const key of enabledKeys) {
	          const day = days?.[key] || {};
	          const startRaw = String(day.startTime || "").trim();
	          const endRaw = String(day.endTime || "").trim();
	          const startOkDay = /^\d{2}:\d{2}$/.test(startRaw);
	          const endOkDay = /^\d{2}:\d{2}$/.test(endRaw);
	          const startElDay = modalBody.querySelector(`[data-ce-repeat-start="${CSS.escape(key)}"]`);
	          const endElDay = modalBody.querySelector(`[data-ce-repeat-end="${CSS.escape(key)}"]`);

	          if (!startOkDay) {
	            hasError = true;
	            if (startElDay instanceof HTMLElement) startElDay.classList.add("is-error");
	          }
	          if (!endOkDay) {
	            hasError = true;
	            if (endElDay instanceof HTMLElement) endElDay.classList.add("is-error");
	          }
	          if (startOkDay && endOkDay) {
	            const startMinDay = timeToMinutes(startRaw);
	            const endMinDay = timeToMinutes(endRaw);
	            if (endMinDay <= startMinDay) {
	              hasError = true;
	              if (startElDay instanceof HTMLElement) startElDay.classList.add("is-error");
	              if (endElDay instanceof HTMLElement) endElDay.classList.add("is-error");
	              if (errorEl instanceof HTMLElement) {
	                errorEl.hidden = false;
	                errorEl.textContent = "O horário de início deve ser anterior ao de fim.";
	              }
	            }
	          }
	        }

	        if (hasError && errorEl instanceof HTMLElement && errorEl.hidden) {
	          errorEl.hidden = false;
	          errorEl.textContent = "Preencha os dias e horários para repetir o evento.";
	        }
	      }
	    } else {
	      const mode = String(createEventDraft.repeatMode || "").trim().toLowerCase();
	      if (mode !== "weekly" && mode !== "daily") {
	        hasError = true;
	        if (errorEl instanceof HTMLElement) {
	          errorEl.hidden = false;
	          errorEl.textContent = "Selecione uma frequência válida.";
	        }
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

  // TEMP DEBUG: helps identify which validation is blocking the Save button in Admin modal.
  // Requested: log every time validation runs (do not gate by a one-time flag).
  if (currentRole === "admin") {
    const selectedAluno = String(createEventDraft.alunoId || "").trim();
    const selectedProfessor = String(createEventDraft.professorId || "").trim();
    const titulo = String(createEventDraft.title || "").trim();
    const data = String(createEventDraft.dateKey || "").trim();
    const inicio = String(createEventDraft.startTime || "").trim();
    const fim = String(createEventDraft.endTime || "").trim();

    const requiresLinks = currentRole === "admin" && createEventDraft.eventType === "lesson";
    const repeatEnabled = Boolean(createEventDraft.recorrente);
    const repeatType = String(createEventDraft?.repeat?.type || "").trim().toLowerCase();
    const docsLoading = (createEventDraft.documents || []).some((doc) => doc && doc.loading);

    const isSubmitting = Boolean(modalPrimary?.disabled) && !hasError;

    // eslint-disable-next-line no-console
    console.log("[SALVAR AULA DEBUG]", {
      aluno: selectedAluno,
      professor: selectedProfessor,
      titulo,
      data,
      inicio,
      fim,
      isValid: !hasError,
      isSubmitting,
      // extra visibility (helps pinpoint which branch is failing)
      requiresLinks,
      repeatEnabled,
      repeatType,
      docsLoading,
    });
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
    // Read from DOM right before saving, so the payload reflects what the user sees.
    const adminStudentEl = modalBody?.querySelector("[data-ce-admin-student]");
    const adminTeacherEl = modalBody?.querySelector("[data-ce-admin-teacher]");
    const titleEl = modalBody?.querySelector("[data-ce-title]");

    // LOG TEMPORÁRIO: confirma se os selects existem no DOM e quais valores estão selecionados.
    // eslint-disable-next-line no-console
    console.log("[DOM READ]", {
      studentEl: adminStudentEl?.tagName,
      studentValue: adminStudentEl?.value,
      teacherEl: adminTeacherEl?.tagName,
      teacherValue: adminTeacherEl?.value,
    });

    if (adminStudentEl instanceof HTMLSelectElement && adminStudentEl.value) {
      createEventDraft.alunoId = adminStudentEl.value;
    }
    if (adminTeacherEl instanceof HTMLSelectElement && adminTeacherEl.value) {
      createEventDraft.professorId = adminTeacherEl.value;
    }
    if (titleEl instanceof HTMLInputElement && titleEl.value) {
      createEventDraft.title = titleEl.value;
    }

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
      eventType: createEventDraft.eventType === "lesson" ? "lesson" : "manual",
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

    if (currentRole === "admin" && payload.eventType === "lesson") {
      const alunoId = String(adminStudentEl instanceof HTMLSelectElement ? adminStudentEl.value : createEventDraft.alunoId || "").trim();
      const professorId = String(
        adminTeacherEl instanceof HTMLSelectElement ? adminTeacherEl.value : createEventDraft.professorId || ""
      ).trim();

      payload.alunoId = alunoId;
      payload.professorId = professorId;

      // Recorrencia opcional: por padrão, aula única.
      if (!createEventDraft.recorrente) payload.repeat = { enabled: false };

      // Não fazer POST silencioso sem os vínculos obrigatórios.
      if (!alunoId || !professorId) {
        const errorEl = modalBody?.querySelector("[data-ce-error]");
        if (errorEl instanceof HTMLElement) {
          errorEl.hidden = false;
          errorEl.textContent = !alunoId ? "Selecione um aluno." : "Selecione um professor.";
        }
        validateCreateEventDraft();
        return false;
      }
    }

		    if (mode === "create" && createEventDraft.recorrente) {
		      payload.recorrente = true;
		      if (currentRole === "admin") {
		        const repeat = createEventDraft.repeat && typeof createEventDraft.repeat === "object" ? createEventDraft.repeat : null;
	        const repeatType = String(repeat?.type || "").trim().toLowerCase();
	        const daysMap = repeat?.days && typeof repeat.days === "object" ? repeat.days : {};
	        if (repeatType === "weekly") {
	          payload.repeat = { enabled: true, type: "weekly", weekday: weekdayKeyFromDateKey(createEventDraft.dateKey) };
	        } else if (repeatType === "monthly") {
	          payload.repeat = { enabled: true, type: "monthly", dayOfMonth: dayOfMonthFromDateKey(createEventDraft.dateKey) };
	        } else if (repeatType === "weekly_custom") {
	          const days = WEEKLY_CUSTOM_DAY_DEFS.filter((d) => Boolean(daysMap?.[d.key]?.enabled)).map((d) => ({
	            weekday: d.key,
	            startTime: String(daysMap?.[d.key]?.startTime || "").trim(),
	            endTime: String(daysMap?.[d.key]?.endTime || "").trim(),
	          }));
	          payload.repeat = { enabled: true, type: "weekly_custom", days };
		        }
		      } else {
		        payload.repeatMode = String(createEventDraft.repeatMode || "weekly");
		      }
		    }
    if (currentRole === "admin" && payload.eventType === "lesson" && payload.recorrente && payload.repeat && payload.repeat.enabled) {
      // repeat já montado acima (weekly/monthly/custom). Apenas garantir o shape correto.
      if (typeof payload.repeat.enabled !== "boolean") payload.repeat.enabled = true;
    }

	  // Helpful during rollout: confirms exactly what will be sent to the backend.
	  // eslint-disable-next-line no-console
	  console.log("Tentando salvar aula", payload);

    // LOG TEMPORÁRIO: payload completo enviado ao backend.
    // eslint-disable-next-line no-console
    console.log("[PAYLOAD ENVIADO]", JSON.stringify(payload, null, 2));

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
          // eslint-disable-next-line no-console
          console.error("Erro real ao salvar aula:", { status: res.status, data, payload });
          const msg =
            data?.error === "title_required"
              ? "Preencha o título para salvar."
              : data?.error === "invalid_time"
                ? "O horário de início deve ser anterior ao de fim."
                : data?.error === "professor_required"
                  ? "Selecione um professor para salvar."
                  : data?.error === "invalid_repeat"
                    ? "Preencha a recorrência (tipo, dias e horários) para salvar."
                    : data?.error === "forbidden"
                      ? "Sem permissão para salvar este evento."
                      : data?.error === "unauthorized" || data?.error === "invalid_credentials"
                        ? "Sua sessão expirou. Recarregue a página e faça login novamente."
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
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Erro real ao salvar aula:", error);
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

      // Keep admin selects wired to the draft so Save enables immediately after selection.
      const adminStudentEl = modalBody?.querySelector("[data-ce-admin-student]");
      const adminTeacherEl = modalBody?.querySelector("[data-ce-admin-teacher]");

      if (adminStudentEl instanceof HTMLSelectElement) {
        createEventDraft.alunoId = adminStudentEl.value;
        adminStudentEl.addEventListener("change", () => {
          if (!createEventDraft) return;
          createEventDraft.alunoId = adminStudentEl.value;
          validateCreateEventDraft();
        });
      }

      if (adminTeacherEl instanceof HTMLSelectElement) {
        createEventDraft.professorId = adminTeacherEl.value;
        adminTeacherEl.addEventListener("change", () => {
          if (!createEventDraft) return;
          createEventDraft.professorId = adminTeacherEl.value;
          validateCreateEventDraft();
        });
      }
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
	    repeat: createDefaultRepeatConfig(),
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
	    repeat: createDefaultRepeatConfig(),
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
	      repeat: createDefaultRepeatConfig(),
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
	    repeat: createDefaultRepeatConfig(),
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

let pedagogicoState = {
  isLoading: false,
  lastLoadedAt: 0,
  lessons: [],
  logsByEventId: new Map(),
  pendingCount: 0,
};

let pedagogicoActive = null; // { lesson, existing }
let pedagogicoDraft = null; // estado do form no drawer (fonte de verdade)
let pedagogicoDirty = false;
let pedagogicoAutosaveTimer = null;
let pedagogicoCleanupFns = [];

const formatPedagogicoDate = (dateKey) => {
  const d = parseDateKey(dateKey);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
};

const setPedagogicoPendingBadge = (count) => {
  const n = Math.max(0, Number(count) || 0);
  pedagogicoState.pendingCount = n;
  if (!(pedagogicoPendingBadge instanceof HTMLElement)) return;
  if (n <= 0) {
    pedagogicoPendingBadge.hidden = true;
    pedagogicoPendingBadge.textContent = "0";
    return;
  }
  pedagogicoPendingBadge.hidden = false;
  pedagogicoPendingBadge.textContent = String(n);
};

const setPedagogicoStatus = (text, tone = "") => {
  if (!(pedagogicoStatus instanceof HTMLElement)) return;
  pedagogicoStatus.textContent = String(text || "");
  pedagogicoStatus.dataset.tone = String(tone || "");
};

const setPedagogicoAutosaveLabel = (text) => {
  if (!(pedagogicoDrawerAutosave instanceof HTMLElement)) return;
  pedagogicoDrawerAutosave.textContent = String(text || "");
};

let teacherStudentsState = {
  isLoading: false,
  loadedAt: 0,
  events: [],
  eventsById: new Map(),
  logs: [],
  summaries: [],
  history: {
    isOpen: false,
    alunoId: "",
    filter: "all", // all | realizada | falta_aluno | remarcada | alerts
    items: [],
  },
};

const setTeacherStudentsStatus = (text, tone = "") => {
  if (!(teacherStudentsStatus instanceof HTMLElement)) return;
  teacherStudentsStatus.textContent = String(text || "");
  teacherStudentsStatus.dataset.tone = String(tone || "");
};

const markPedagogicoDirty = () => {
  pedagogicoDirty = true;
  setPedagogicoAutosaveLabel("Alterações não salvas");
};

const clearPedagogicoAutosaveTimer = () => {
  if (pedagogicoAutosaveTimer) window.clearInterval(pedagogicoAutosaveTimer);
  pedagogicoAutosaveTimer = null;
};

const closePedagogicoDrawer = () => {
  pedagogicoCleanupFns.forEach((fn) => {
    try {
      if (typeof fn === "function") fn();
    } catch {
      // ignore
    }
  });
  pedagogicoCleanupFns = [];
  if (pedagogicoDrawer instanceof HTMLElement) {
    pedagogicoDrawer.classList.remove("is-open");
    window.setTimeout(() => {
      if (pedagogicoDrawer instanceof HTMLElement) pedagogicoDrawer.hidden = true;
    }, 220);
  }
  if (pedagogicoFormContainer instanceof HTMLElement) pedagogicoFormContainer.innerHTML = "";
  pedagogicoActive = null;
  pedagogicoDirty = false;
  clearPedagogicoAutosaveTimer();
};

// (sem portal/multiselect no formulario atual)

const PED_MOTIVO_FALTA = [
  ["atrasou_trabalho", "Se atrasou no trabalho"],
  ["saude", "Saúde"],
  ["familia", "Família"],
  ["esqueceu", "Esqueceu"],
  ["internet_tecnologia", "Internet/tecnologia"],
  ["viagem", "Viagem"],
  ["cansaco", "Cansaço"],
  ["nao_informado", "Não informado"],
  ["outro", "Outro"],
];

const PED_MOTIVO_REMARCACAO = [
  ["atrasou_trabalho", "Se atrasou no trabalho"],
  ["saude", "Saúde"],
  ["familia", "Família"],
  ["internet_tecnologia", "Internet/tecnologia"],
  ["viagem", "Viagem"],
  ["aluno_pediu", "Aluno pediu remarcação"],
  ["professor_remarcou", "Professor remarcou"],
  ["escola_remarcou", "Escola remarcou"],
  ["nao_informado", "Não informado"],
  ["outro", "Outro"],
];

const PED_RISCO_EVASAO = [
  ["baixo", "Baixo"],
  ["medio", "Médio"],
  ["alto", "Alto"],
];

const sanitizeLessonLogDraft = (raw = {}) => {
  const src = raw && typeof raw === "object" ? raw : {};
  const statusAula = normalizePedagogicoStatus(src.statusAula);
  return {
    statusAula, // realizada | falta_aluno | remarcada
    conteudoTrabalhado: String(src.conteudoTrabalhado || src.oQueFoiTrabalhado || "").trim(),
    engajamentoNota: clampInt(Number(src.engajamentoNota ?? src.engajamento ?? 0), 0, 5, 0),
    evolucaoNota: clampInt(Number(src.evolucaoNota ?? src.evolucao ?? 0), 0, 5, 0),
    humorAluno: String(src.humorAluno || "").trim().toLowerCase(),
    proximaAula: String(src.proximaAula || "").trim(),
    avisosCoordenacao: Array.isArray(src.avisosCoordenacao)
      ? src.avisosCoordenacao.map((v) => String(v || "").trim()).filter(Boolean)
      : Array.isArray(src.avisos)
        ? src.avisos.map((v) => String(v || "").trim()).filter(Boolean)
        : [],
    observacoesInternas: String(src.observacoesInternas || "").trim(),
    motivoFalta: String(src.motivoFalta || "").trim().toLowerCase(),
    motivoRemarcacao: String(src.motivoRemarcacao || "").trim().toLowerCase(),
    novaDataRemarcacao: String(src.novaDataRemarcacao || src.novaData || "").trim(),
    horarioInicioRemarcacao: String(src.horarioInicioRemarcacao || src.novoHorarioInicio || src.novoInicio || "").trim(),
    horarioFimRemarcacao: String(src.horarioFimRemarcacao || src.novoHorarioFim || src.novoFim || "").trim(),
    riscoEvasao: String(src.riscoEvasao || "").trim().toLowerCase(),
    observacao: String(src.observacao || src.observacoesInternas || "").trim().slice(0, 250),
  };
};

const PED_AVISOS_COORD = [
  { value: "🔴 Risco de cancelamento", tone: "red" },
  { value: "🟡 Aluno desmotivado", tone: "yellow" },
  { value: "🟡 Frequência caindo", tone: "yellow" },
  { value: "🟡 Não está evoluindo", tone: "yellow" },
  { value: "🟢 Muito satisfeito", tone: "green" },
  { value: "🟢 Quer mais aulas", tone: "green" },
  { value: "🟢 Potencial indicação", tone: "green" },
];

const normalizePedAvisos = (raw) => {
  const allowed = new Set(PED_AVISOS_COORD.map((a) => a.value));
  const out = [];
  const arr = Array.isArray(raw) ? raw : [];
  arr.forEach((item) => {
    const v = String(item || "").trim();
    if (!v) return;
    if (!allowed.has(v)) return;
    if (!out.includes(v)) out.push(v);
  });
  return out;
};

const computePedPrecisaIntervencao = (avisos) => {
  const arr = Array.isArray(avisos) ? avisos : [];
  const negative = new Set(["🔴 Risco de cancelamento", "🟡 Aluno desmotivado", "🟡 Frequência caindo", "🟡 Não está evoluindo"]);
  return arr.some((a) => negative.has(String(a || "").trim()));
};

const normalizePedagogicoStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "realizada" || normalized === "realizado" || normalized === "aula_realizada") return "realizada";
  if (normalized === "falta do aluno" || normalized === "falta_aluno" || normalized === "falta" || normalized === "no_show") return "falta_aluno";
  if (normalized === "remarcada" || normalized === "remarcado" || normalized === "rescheduled") return "remarcada";
  return "realizada";
};

const PEDAGOGICO_STATUS = {
  REALIZADA: "realizada",
  FALTA_ALUNO: "falta_aluno",
  REMARCADA: "remarcada",
};

const renderPedSelectOptions = (options, selected) => {
  const sel = String(selected || "");
  const list = Array.isArray(options) ? options : [];
  return list
    .map(([val, label]) => `<option value="${escapeHtml(String(val))}" ${sel === String(val) ? "selected" : ""}>${escapeHtml(String(label))}</option>`)
    .join("");
};

const renderRealizadaFieldsHtml = (draft = {}) => {
  const d = draft && typeof draft === "object" ? draft : {};
  return `
    <div class="ped-field">
      <div class="ped-label">O que foi trabalhado</div>
      <textarea class="ped-ta ped-ta--conteudo" data-ped-field="conteudoTrabalhado" rows="3" placeholder="Descreva brevemente o conteúdo da aula...">${escapeHtml(
        String(d.conteudoTrabalhado || "")
      )}</textarea>
    </div>

    <div class="ped-grid2">
      <div class="ped-field">
        <div class="ped-label">Engajamento</div>
        ${renderPedStars(d.engajamentoNota || 0, "engajamentoNota")}
      </div>
      <div class="ped-field">
        <div class="ped-label">Evolução do aluno</div>
        ${renderPedStars(d.evolucaoNota || 0, "evolucaoNota")}
      </div>
    </div>

    <div class="ped-field">
      <div class="ped-label">Humor do aluno</div>
      ${renderPedHumorChips(d.humorAluno || "")}
    </div>

    <div class="ped-field">
      <div class="ped-label">Próxima aula</div>
      <input class="ped-in" type="text" data-ped-field="proximaAula" value="${escapeHtml(String(d.proximaAula || ""))}" placeholder="Tema para a próxima aula..." />
    </div>

    <div class="ped-field">
      <div class="ped-label">Avisos para a coordenação</div>
      ${renderPedAvisosTrigger(d.avisosCoordenacao || [])}
    </div>

    <div class="ped-field">
      <div class="ped-label">Observações internas</div>
      <textarea class="ped-ta ped-ta--obs" data-ped-field="observacoesInternas" rows="2" placeholder="Apenas visível para professor e admin...">${escapeHtml(
        String(d.observacoesInternas || "")
      )}</textarea>
    </div>
  `;
};

const renderFaltaAlunoFieldsHtml = (draft = {}) => {
  const d = draft && typeof draft === "object" ? draft : {};
  const motivo = String(d.motivoFalta || "");
  const risco = String(d.riscoEvasao || "");
  const obs = String(d.observacao || "");
  return `
    <div class="ped-form-group ped-field">
      <div class="ped-label">Motivo da falta</div>
      <div class="ped-sel-wrap">
        <select class="ped-sel" data-ped-field="motivoFalta">
          <option value="">Selecione</option>
          ${renderPedSelectOptions(PED_MOTIVO_FALTA, motivo)}
        </select>
        <span class="ped-arr">▼</span>
      </div>
    </div>

    <div class="ped-form-group ped-field">
      <div class="ped-label">Risco de evasão</div>
      <div class="ped-sel-wrap">
        <select class="ped-sel" data-ped-field="riscoEvasao">
          <option value="">Selecione</option>
          ${renderPedSelectOptions(PED_RISCO_EVASAO, risco)}
        </select>
        <span class="ped-arr">▼</span>
      </div>
    </div>

    <div class="ped-form-group ped-field">
      <div class="ped-label">Observação opcional</div>
      <textarea class="ped-ta" data-ped-field="observacao" rows="2" maxlength="250" placeholder="Ex: aluno não entrou na aula e não avisou...">${escapeHtml(
        obs
      )}</textarea>
    </div>
  `;
};

const renderRemarcadaFieldsHtml = (draft = {}) => {
  const d = draft && typeof draft === "object" ? draft : {};
  const motivo = String(d.motivoRemarcacao || "");
  const risco = String(d.riscoEvasao || "");
  const obs = String(d.observacao || "");
  const dateKey = String(d.novaDataRemarcacao || d.novaData || "");
  const ini = String(d.horarioInicioRemarcacao || d.novoInicio || "");
  const fim = String(d.horarioFimRemarcacao || d.novoFim || "");

  // Ajuste: incluir option "Aluno pediu remarcação" com value solicitado.
  const options = [
    ["atrasou_trabalho", "Se atrasou no trabalho"],
    ["saude", "Saúde"],
    ["familia", "Família"],
    ["internet_tecnologia", "Internet/tecnologia"],
    ["viagem", "Viagem"],
    ["aluno_pediu_remarcacao", "Aluno pediu remarcação"],
    ["professor_remarcou", "Professor remarcou"],
    ["escola_remarcou", "Escola remarcou"],
    ["nao_informado", "Não informado"],
    ["outro", "Outro"],
  ];

  return `
    <div class="ped-form-group ped-field">
      <div class="ped-label">Motivo da remarcação</div>
      <div class="ped-sel-wrap">
        <select class="ped-sel" data-ped-field="motivoRemarcacao">
          <option value="">Selecione</option>
          ${renderPedSelectOptions(options, motivo)}
        </select>
        <span class="ped-arr">▼</span>
      </div>
    </div>

    <div class="ped-form-grid-3 ped-grid2">
      <div class="ped-form-group ped-field">
        <div class="ped-label">Nova data</div>
        <input class="ped-in" type="date" data-ped-field="novaData" value="${escapeHtml(dateKey)}" />
      </div>
      <div class="ped-form-group ped-field">
        <div class="ped-label">Início</div>
        <input class="ped-in" type="time" data-ped-field="novoInicio" value="${escapeHtml(ini)}" />
      </div>
      <div class="ped-form-group ped-field">
        <div class="ped-label">Fim</div>
        <input class="ped-in" type="time" data-ped-field="novoFim" value="${escapeHtml(fim)}" />
      </div>
    </div>

    <div class="ped-form-group ped-field">
      <div class="ped-label">Risco de evasão</div>
      <div class="ped-sel-wrap">
        <select class="ped-sel" data-ped-field="riscoEvasao">
          <option value="">Selecione</option>
          ${renderPedSelectOptions(PED_RISCO_EVASAO, risco)}
        </select>
        <span class="ped-arr">▼</span>
      </div>
    </div>

    <div class="ped-form-group ped-field">
      <div class="ped-label">Observação opcional</div>
      <textarea class="ped-ta" data-ped-field="observacao" rows="2" maxlength="250" placeholder="Ex: aluno pediu para remarcar por causa do trabalho...">${escapeHtml(
        obs
      )}</textarea>
    </div>
  `;
};

const getPedagogicoDynamicFieldsHtml = (status, draft) => {
  const normalizedStatus = normalizePedagogicoStatus(status);
  if (normalizedStatus === PEDAGOGICO_STATUS.FALTA_ALUNO) return renderFaltaAlunoFieldsHtml(draft);
  if (normalizedStatus === PEDAGOGICO_STATUS.REMARCADA) return renderRemarcadaFieldsHtml(draft);
  return renderRealizadaFieldsHtml(draft);
};

const renderPedStars = (value = 0, fieldKey) => {
  const n = clampInt(Number(value || 0), 0, 5, 0);
  const safeKey = String(fieldKey || "");
  const stars = [1, 2, 3, 4, 5]
    .map((idx) => {
      const on = idx <= n ? "on" : "";
      return `<button type="button" class="ped-star ${on}" data-ped-star="${idx}" aria-label="${idx} estrelas">★</button>`;
    })
    .join("");
  return `
    <div class="ped-stars" data-ped-stars="${escapeHtml(safeKey)}">
      <input type="hidden" data-ped-field="${escapeHtml(safeKey)}" value="${escapeHtml(String(n))}" />
      ${stars}
    </div>
  `;
};

const renderPedHumorChips = (selected = "") => {
  const sel = String(selected || "").trim().toLowerCase();
  const options = [
    ["animado", "😊 Animado"],
    ["neutro", "😐 Neutro"],
    ["cansado", "😴 Cansado"],
    ["ansioso", "😰 Ansioso"],
  ];
  return `
    <div class="ped-chips" data-ped-humor>
      <input type="hidden" data-ped-field="humorAluno" value="${escapeHtml(sel)}" />
      ${options
        .map(([val, label]) => {
          const on = sel === val ? "on" : "";
          return `<button type="button" class="ped-chip ${on}" data-ped-chip="${escapeHtml(val)}">${escapeHtml(label)}</button>`;
        })
        .join("")}
    </div>
  `;
};

const renderPedAvisosTrigger = (selected = []) => {
  const arr = normalizePedAvisos(selected);
  const count = arr.length;
  const label = count ? `${count} avisos selecionados` : "Nenhum aviso";
  return `
    <div class="ped-multisel-wrap" data-ped-multisel>
      <input type="hidden" data-ped-field="avisosCoordenacao" value="${escapeHtml(JSON.stringify(arr))}" />
      <button type="button" class="ped-multisel-trigger" data-ped-avisos-trigger>
        <span data-ped-avisos-label>${escapeHtml(label)}</span>
        <span class="ped-multisel-badge" data-ped-avisos-badge ${count ? "" : "hidden"}>${escapeHtml(String(count))}</span>
      </button>
      <div class="ped-pills" data-ped-avisos-pills>
        ${arr
          .map((v) => {
            const tone = (PED_AVISOS_COORD.find((a) => a.value === v)?.tone) || "yellow";
            const cls = tone === "red" ? "ped-pill-red" : tone === "green" ? "ped-pill-green" : "ped-pill-yellow";
            return `<span class="ped-pill ${cls}">${escapeHtml(v)}</span>`;
          })
          .join("")}
      </div>
    </div>
  `;
};

const renderPedagogicoForm = ({ lesson, existingLog } = {}) => {
  if (!(pedagogicoFormContainer instanceof HTMLElement)) return;
  const safeLesson = lesson && typeof lesson === "object" ? lesson : {};
  const baseDraft = sanitizeLessonLogDraft(existingLog?.payload || {});
  pedagogicoDraft = pedagogicoDraft && typeof pedagogicoDraft === "object" ? { ...baseDraft, ...pedagogicoDraft } : { ...baseDraft };
  const studentNameRaw = String(safeLesson.title || "Aluno");
  if (pedagogicoDrawerTitle instanceof HTMLElement) {
    pedagogicoDrawerTitle.textContent = "Registro da aula";
  }

  const status = normalizePedagogicoStatus(pedagogicoDraft.statusAula);

  pedagogicoFormContainer.innerHTML = `
    <div class="ped-shell" data-ped-form>
      <div class="ped-scroll" data-ped-scroll>
      <div class="ped-lesson-summary">${escapeHtml(
        `${studentNameRaw} • ${formatPedagogicoDate(safeLesson.dateKey)} • ${formatHmFromMinutes(safeLesson.startMin)}–${formatHmFromMinutes(safeLesson.endMin)}`
      )}</div>

      <div class="ped-field">
        <div class="ped-label">Status da aula</div>
        <div class="ped-sel-wrap">
          <select class="ped-sel" data-ped-status>
            <option value="realizada" ${status === "realizada" ? "selected" : ""}>Realizada</option>
            <option value="falta_aluno" ${status === "falta_aluno" ? "selected" : ""}>Falta do aluno</option>
            <option value="remarcada" ${status === "remarcada" ? "selected" : ""}>Remarcada</option>
          </select>
          <span class="ped-arr">▼</span>
        </div>
      </div>

      <div class="ped-divider"></div>

      <div data-ped-dynamic-fields>
        ${getPedagogicoDynamicFieldsHtml(status, pedagogicoDraft)}
      </div>
      </div>

      <div class="ped-footer" data-ped-footer>
        <button class="ped-btn-close" type="button" data-pedagogico-drawer-close>Fechar</button>
        <button class="ped-btn-save" type="button" data-pedagogico-save>Salvar registro</button>
      </div>
    </div>
  `;

  const formRoot = pedagogicoFormContainer.querySelector("[data-ped-form]");
  if (!(formRoot instanceof HTMLElement)) return;
  const scrollRoot = formRoot.querySelector("[data-ped-scroll]") || formRoot;

  // Bind dynamic controls for the initial render.
  const dynamic = scrollRoot.querySelector("[data-ped-dynamic-fields]");
  if (dynamic instanceof HTMLElement) {
    bindStars(dynamic);
    bindHumor(dynamic);
    bindAvisosTrigger(dynamic);
  }
  bindAvisosAutoClose(scrollRoot);

  // Delegated "dirty" binding so it keeps working after re-renders of dynamic fields.
  if (scrollRoot instanceof HTMLElement && !scrollRoot.dataset.pedDirtyBound) {
    scrollRoot.dataset.pedDirtyBound = "true";
    const onDirty = (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (!t.matches("input, textarea, select")) return;
      // Ignore status "change" here; we handle it separately and will call markPedagogicoDirty there.
      markPedagogicoDirty();
    };
    scrollRoot.addEventListener("input", onDirty);
    scrollRoot.addEventListener("change", onDirty);
    pedagogicoCleanupFns.push(() => {
      scrollRoot.removeEventListener("input", onDirty);
      scrollRoot.removeEventListener("change", onDirty);
    });
  }

  setPedagogicoAutosaveLabel(existingLog?.statusAula ? "Salvo" : "—");
};

const bindStars = (rootEl) => {
    if (!(rootEl instanceof HTMLElement)) return;
    rootEl.querySelectorAll("[data-ped-stars]").forEach((starsWrap) => {
      if (!(starsWrap instanceof HTMLElement)) return;
      const key = String(starsWrap.getAttribute("data-ped-stars") || "");
      const hidden = starsWrap.querySelector(`[data-ped-field="${CSS.escape(key)}"]`);
      if (!(hidden instanceof HTMLInputElement)) return;
      const setValue = (n) => {
        const clamped = clampInt(Number(n || 0), 0, 5, 0);
        hidden.value = String(clamped);
        starsWrap.querySelectorAll("[data-ped-star]").forEach((btn) => {
          if (!(btn instanceof HTMLElement)) return;
          const v = clampInt(Number(btn.getAttribute("data-ped-star") || 0), 0, 5, 0);
          btn.classList.toggle("on", v > 0 && v <= clamped);
        });
      };
      starsWrap.addEventListener("click", (ev) => {
        const target = ev.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest("[data-ped-star]");
        if (!(btn instanceof HTMLElement)) return;
        ev.preventDefault();
        ev.stopPropagation();
        setValue(btn.getAttribute("data-ped-star"));
        markPedagogicoDirty();
      });
    });
};

const bindHumor = (rootEl) => {
    const wrap = rootEl instanceof HTMLElement ? rootEl.querySelector("[data-ped-humor]") : null;
    if (!(wrap instanceof HTMLElement)) return;
    const hidden = wrap.querySelector('[data-ped-field="humorAluno"]');
    if (!(hidden instanceof HTMLInputElement)) return;
    wrap.addEventListener("click", (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const chip = target.closest("[data-ped-chip]");
      if (!(chip instanceof HTMLElement)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const val = String(chip.getAttribute("data-ped-chip") || "").trim().toLowerCase();
      hidden.value = val;
      wrap.querySelectorAll("[data-ped-chip]").forEach((btn) => {
        if (!(btn instanceof HTMLElement)) return;
        const v = String(btn.getAttribute("data-ped-chip") || "").trim().toLowerCase();
        btn.classList.toggle("on", v === val);
      });
      markPedagogicoDirty();
    });
};

let pedAvisosTriggerEl = null;

const closePedAvisosPortal = () => {
    pedagogicoCleanupFns = pedagogicoCleanupFns.filter((fn) => fn !== closePedAvisosPortal);
    const el = document.getElementById("ped-avisos-portal");
    if (el && el.parentNode) el.parentNode.removeChild(el);
    pedAvisosTriggerEl = null;
    document.removeEventListener("keydown", onKeydown, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
};

const onKeydown = (ev) => {
    if (ev.key === "Escape") closePedAvisosPortal();
};

const onPointerDown = (ev) => {
    const portal = document.getElementById("ped-avisos-portal");
    const trigger = pedAvisosTriggerEl;
    const target = ev.target;
    if (!(target instanceof Node)) return;
    if (portal && portal.contains(target)) return;
    if (trigger && trigger.contains(target)) return;
    closePedAvisosPortal();
};

const openPedAvisosPortal = (scrollRoot) => {
    const scope = scrollRoot instanceof HTMLElement ? scrollRoot : document;
    const trigger = scrollRoot.querySelector("[data-ped-avisos-trigger]");
    if (!(trigger instanceof HTMLElement)) return;
    closePedAvisosPortal();
    pedAvisosTriggerEl = trigger;

    const hidden = scrollRoot.querySelector('[data-ped-field="avisosCoordenacao"]');
    if (!(hidden instanceof HTMLInputElement)) return;
    let selected = [];
    try {
      selected = normalizePedAvisos(JSON.parse(String(hidden.value || "[]")));
    } catch {
      selected = [];
    }

    const rect = trigger.getBoundingClientRect();
    const portal = document.createElement("div");
    portal.id = "ped-avisos-portal";
    portal.style.position = "fixed";
    portal.style.left = `${Math.round(rect.left)}px`;
    portal.style.width = `${Math.round(rect.width)}px`;
    portal.style.zIndex = "999999";
    portal.innerHTML = `
      <div class="ped-portal-dropdown" role="listbox" aria-label="Avisos para a coordenação">
        <div class="ped-portal-dropdown-surface">
          ${PED_AVISOS_COORD
            .map((opt) => {
              const on = selected.includes(opt.value);
              return `
                <button type="button" class="ped-multisel-option ${on ? `is-on is-${escapeHtml(opt.tone)}` : ""}" data-ped-avisos-opt="${escapeHtml(
                  opt.value
                )}">
                  <span class="ped-multisel-check">${on ? "✓" : ""}</span>
                  <span class="ped-multisel-text">${escapeHtml(opt.value)}</span>
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `;

    const applyToTrigger = (arr) => {
      const list = normalizePedAvisos(arr);
      hidden.value = JSON.stringify(list);
      const badge = trigger.querySelector("[data-ped-avisos-badge]");
      const labelEl = trigger.querySelector("[data-ped-avisos-label]");
      if (labelEl instanceof HTMLElement) {
        labelEl.textContent = list.length ? `${list.length} avisos selecionados` : "Nenhum aviso";
      }
      if (badge instanceof HTMLElement) {
        badge.textContent = String(list.length);
        badge.hidden = list.length <= 0;
      }
      const pillsWrap = scrollRoot.querySelector("[data-ped-avisos-pills]");
      if (pillsWrap instanceof HTMLElement) {
        pillsWrap.innerHTML = list
          .map((v) => {
            const tone = (PED_AVISOS_COORD.find((a) => a.value === v)?.tone) || "yellow";
            const cls = tone === "red" ? "ped-pill-red" : tone === "green" ? "ped-pill-green" : "ped-pill-yellow";
            return `<span class="ped-pill ${cls}">${escapeHtml(v)}</span>`;
          })
          .join("");
      }
      markPedagogicoDirty();
    };

    portal.addEventListener("click", (ev) => {
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest("[data-ped-avisos-opt]");
      if (!(btn instanceof HTMLElement)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const value = String(btn.getAttribute("data-ped-avisos-opt") || "").trim();
      if (!value) return;
      const has = selected.includes(value);
      selected = has ? selected.filter((v) => v !== value) : [...selected, value];
      applyToTrigger(selected);
      // update ui
      portal.querySelectorAll("[data-ped-avisos-opt]").forEach((b) => {
        if (!(b instanceof HTMLElement)) return;
        const v = String(b.getAttribute("data-ped-avisos-opt") || "");
        const on = selected.includes(v);
        b.classList.toggle("is-on", on);
        b.classList.toggle("is-red", on && v.startsWith("🔴"));
        b.classList.toggle("is-yellow", on && v.startsWith("🟡"));
        b.classList.toggle("is-green", on && v.startsWith("🟢"));
        const check = b.querySelector(".ped-multisel-check");
        if (check instanceof HTMLElement) check.textContent = on ? "✓" : "";
      });
    });

    document.body.appendChild(portal);
    // Position: prefer below; if it doesn't fit, open upwards with a safe maxHeight.
    const dropdownEl = portal.querySelector(".ped-portal-dropdown");
    const margin = 12;
    const belowSpace = window.innerHeight - rect.bottom - margin;
    const aboveSpace = rect.top - margin;
    const maxH = 280;
    const useBelow = belowSpace >= 160 || belowSpace >= aboveSpace;
    const effectiveMax = Math.max(120, Math.min(maxH, useBelow ? belowSpace : aboveSpace));
    if (dropdownEl instanceof HTMLElement) dropdownEl.style.maxHeight = `${Math.round(effectiveMax)}px`;
    const top = useBelow ? rect.bottom + 8 : Math.max(margin, rect.top - 8 - effectiveMax);
    portal.style.top = `${Math.round(top)}px`;

    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    pedagogicoCleanupFns.push(closePedAvisosPortal);
};

const bindAvisosTrigger = (rootEl) => {
    const trigger = rootEl instanceof HTMLElement ? rootEl.querySelector("[data-ped-avisos-trigger]") : null;
    if (!(trigger instanceof HTMLElement)) return;
    trigger.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const scrollRoot = rootEl.closest("[data-ped-scroll]") || rootEl;
      openPedAvisosPortal(scrollRoot);
    });
};

const bindAvisosAutoClose = (rootEl) => {
    if (!(rootEl instanceof HTMLElement)) return;
    const onScroll = () => closePedAvisosPortal();
    const onResize = () => closePedAvisosPortal();
    rootEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    pedagogicoCleanupFns.push(() => {
      rootEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    });
};

const rerenderPedagogicoDynamicFields = (nextStatus) => {
  const root = pedagogicoFormContainer instanceof HTMLElement ? pedagogicoFormContainer.querySelector("[data-ped-form]") : null;
  if (!(root instanceof HTMLElement)) return null;
  const scrollRoot = root.querySelector("[data-ped-scroll]") || root;
  const dynamic = scrollRoot.querySelector("[data-ped-dynamic-fields]");
  if (!(dynamic instanceof HTMLElement)) return null;

  const normalized = normalizePedagogicoStatus(nextStatus);
  dynamic.innerHTML = getPedagogicoDynamicFieldsHtml(normalized, pedagogicoDraft || {});

  // Rebind interactive widgets inside the swapped markup.
  bindStars(dynamic);
  bindHumor(dynamic);
  bindAvisosTrigger(dynamic);

  return { scrollRoot, dynamic };
};

const readPedagogicoDraftFromDom = () => {
  const root = pedagogicoFormContainer instanceof HTMLElement ? pedagogicoFormContainer.querySelector("[data-ped-form]") : null;
  if (!(root instanceof HTMLElement) || !pedagogicoActive?.lesson) return null;

  const scope = (root.querySelector("[data-ped-scroll]") || root);

  const getField = (key) => {
    const el = scope.querySelector(`[data-ped-field="${key}"]`);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return String(el.value || "");
    return "";
  };

  const statusSelect = scope.querySelector("[data-ped-status]");
  const statusRaw =
    statusSelect instanceof HTMLSelectElement
      ? statusSelect.value
      : getField("statusAula");
  const statusAula = normalizePedagogicoStatus(statusRaw);
  let avisosCoordenacao = [];
  try {
    avisosCoordenacao = normalizePedAvisos(JSON.parse(String(getField("avisosCoordenacao") || "[]")));
  } catch {
    avisosCoordenacao = [];
  }

  const draft = {
    statusAula, // realizada | falta | remarcada
    conteudoTrabalhado: getField("conteudoTrabalhado").trim(),
    engajamentoNota: clampInt(Number(getField("engajamentoNota") || 0), 0, 5, 0),
    evolucaoNota: clampInt(Number(getField("evolucaoNota") || 0), 0, 5, 0),
    humorAluno: getField("humorAluno").trim().toLowerCase(),
    proximaAula: getField("proximaAula").trim(),
    avisosCoordenacao,
    observacoesInternas: getField("observacoesInternas").trim(),
    motivoFalta: getField("motivoFalta").trim().toLowerCase(),
    motivoRemarcacao: getField("motivoRemarcacao").trim().toLowerCase(),
    novaDataRemarcacao: (getField("novaData").trim() || getField("novaDataRemarcacao").trim()),
    horarioInicioRemarcacao: (getField("novoInicio").trim() || getField("horarioInicioRemarcacao").trim()),
    horarioFimRemarcacao: (getField("novoFim").trim() || getField("horarioFimRemarcacao").trim()),
    riscoEvasao: getField("riscoEvasao").trim().toLowerCase(),
    observacao: getField("observacao").trim().slice(0, 250),
  };

  return draft;
};

const savePedagogicoLog = async ({ autosave = false } = {}) => {
  if (currentRole !== "teacher") return false;
  if (!sessionUser?.id) return false;
  if (!pedagogicoActive?.lesson) return false;

  const lesson = pedagogicoActive.lesson;
  const draftRaw = readPedagogicoDraftFromDom();
  const draft = sanitizeLessonLogDraft(draftRaw || {});
  if (!draft) return false;
  if (!draft.statusAula) {
    if (!autosave) setPedagogicoStatus("Selecione o status da aula para salvar.", "error");
    return false;
  }

  const has = (v) => Boolean(String(v || "").trim());

  // Regras mínimas (não deixar salvar payload inconsistente)
  if (draft.statusAula === "realizada") {
    if (!has(draft.conteudoTrabalhado)) {
      if (!autosave) setPedagogicoStatus("Preencha o que foi trabalhado para salvar.", "error");
      return false;
    }
    if (draft.engajamentoNota <= 0) {
      if (!autosave) setPedagogicoStatus("Selecione o engajamento para salvar.", "error");
      return false;
    }
    if (draft.evolucaoNota <= 0) {
      if (!autosave) setPedagogicoStatus("Selecione a evolução do aluno para salvar.", "error");
      return false;
    }
    if (!has(draft.humorAluno)) {
      if (!autosave) setPedagogicoStatus("Selecione o humor do aluno para salvar.", "error");
      return false;
    }
    if (!has(draft.proximaAula)) {
      if (!autosave) setPedagogicoStatus("Preencha a próxima aula para salvar.", "error");
      return false;
    }
  }
  if (draft.statusAula === "falta_aluno") {
    if (!has(draft.motivoFalta)) {
      if (!autosave) setPedagogicoStatus("Selecione o motivo da falta para salvar.", "error");
      return false;
    }
    if (!has(draft.riscoEvasao)) {
      if (!autosave) setPedagogicoStatus("Selecione o risco de evasão para salvar.", "error");
      return false;
    }
  }
  if (draft.statusAula === "remarcada") {
    if (!has(draft.motivoRemarcacao) || !has(draft.novaDataRemarcacao) || !has(draft.horarioInicioRemarcacao) || !has(draft.horarioFimRemarcacao)) {
      if (!autosave) setPedagogicoStatus("Preencha o motivo, a nova data e os horários para salvar.", "error");
      return false;
    }
    if (!has(draft.riscoEvasao)) {
      if (!autosave) setPedagogicoStatus("Selecione o risco de evasão para salvar.", "error");
      return false;
    }
    if (
      !isValidDateKey(draft.novaDataRemarcacao) ||
      !/^\d{2}:\d{2}$/.test(draft.horarioInicioRemarcacao) ||
      !/^\d{2}:\d{2}$/.test(draft.horarioFimRemarcacao)
    ) {
      if (!autosave) setPedagogicoStatus("Nova data ou horário inválidos.", "error");
      return false;
    }
    const startMin = timeToMinutes(draft.horarioInicioRemarcacao);
    const endMin = timeToMinutes(draft.horarioFimRemarcacao);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
      if (!autosave) setPedagogicoStatus("Horário de fim deve ser maior que o de início.", "error");
      return false;
    }
  }

  const payload = {
    eventId: lesson.id,
    professorId: sessionUser.id,
    alunoId: lesson.alunoId || "",
    dateKey: lesson.dateKey,
    precisaIntervencao: draft.statusAula === "realizada" ? computePedPrecisaIntervencao(draft.avisosCoordenacao) : false,
    ...draft,
  };
  if (window.__PED_DEBUG) {
    // eslint-disable-next-line no-console
    console.log("[PED SAVE PAYLOAD]", payload);
  }

  if (!autosave) setPedagogicoStatus("Salvando…");
  setPedagogicoAutosaveLabel("Salvando…");

  try {
    const res = await fetchWithAuth("/api/lesson-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("lesson_log_save_failed");
    const data = await res.json().catch(() => null);
    const logId = typeof data?.id === "string" ? data.id : "";
    pedagogicoDirty = false;
    setPedagogicoAutosaveLabel("Salvo");
    if (!autosave) setPedagogicoStatus("Registro salvo.", "success");
    window.setTimeout(() => setPedagogicoStatus(""), 1200);

    const stored = { id: logId, eventId: lesson.id, statusAula: draft.statusAula, payload: { ...payload } };
    pedagogicoState.logsByEventId.set(lesson.id, stored);
    renderTeacherPedagogico({ silent: true });

    // Se remarcada, criar novo evento na agenda (apenas no save manual, não no autosave).
    if (
      !autosave &&
      draft.statusAula === "remarcada" &&
      draft.novaDataRemarcacao &&
      draft.horarioInicioRemarcacao &&
      draft.horarioFimRemarcacao
    ) {
      try {
        const startMin = timeToMinutes(draft.horarioInicioRemarcacao);
        const endMin = timeToMinutes(draft.horarioFimRemarcacao);
        const createPayload = {
          eventType: "lesson",
          alunoId: lesson.alunoId || "",
          professorId: lesson.professorId || sessionUser.id,
          dateKey: draft.novaDataRemarcacao,
          startMin,
          endMin,
          title: "Aula",
          description: "",
          guests: [],
          documents: [],
          repeat: { enabled: false },
        };
        const resCreate = await fetchWithAuth("/api/schedule-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        if (!resCreate.ok) throw new Error("remarcacao_create_failed");
      } catch (error) {
        console.error("[pedagogico] remarcacao create event failed:", error);
        setPedagogicoStatus("Registro salvo, mas não foi possível criar o novo evento.", "error");
      }
    }
    return true;
  } catch (error) {
    console.error("[pedagogico] save failed:", error);
    setPedagogicoAutosaveLabel("Erro ao salvar");
    if (!autosave) setPedagogicoStatus("Não foi possível salvar agora.", "error");
    return false;
  }
};

const openPedagogicoDrawer = ({ lesson } = {}) => {
  if (!(pedagogicoDrawer instanceof HTMLElement)) return;
  if (!lesson || typeof lesson !== "object") return;
  const start = buildDateFromDateKeyAndMinutes(lesson.dateKey, lesson.startMin);
  if (start && start.getTime() > Date.now()) return;

  const existingLog = pedagogicoState.logsByEventId.get(lesson.id) || null;
  pedagogicoActive = { lesson, existing: Boolean(existingLog) };
  pedagogicoDirty = false;
  setPedagogicoStatus("");
  renderPedagogicoForm({ lesson, existingLog });

  pedagogicoDrawer.hidden = false;
  window.requestAnimationFrame(() => {
    if (pedagogicoDrawer instanceof HTMLElement) pedagogicoDrawer.classList.add("is-open");
  });
  clearPedagogicoAutosaveTimer();
  pedagogicoAutosaveTimer = window.setInterval(() => {
    if (!pedagogicoDirty) return;
    savePedagogicoLog({ autosave: true }).catch(() => {});
  }, 30_000);
};

const renderTeacherPedagogico = async ({ silent = false } = {}) => {
  if (currentRole !== "teacher") return;
  if (!(pedagogicoList instanceof HTMLElement)) return;
  if (pedagogicoState.isLoading) return;
  const now = Date.now();
  if (!silent && pedagogicoState.lastLoadedAt && now - pedagogicoState.lastLoadedAt < 12_000) {
    renderTeacherPedagogicoList();
    return;
  }

  pedagogicoState.isLoading = true;
  if (!silent) setPedagogicoStatus("Carregando…");
  if (pedagogicoError instanceof HTMLElement) pedagogicoError.hidden = true;
  if (pedagogicoEmpty instanceof HTMLElement) pedagogicoEmpty.hidden = true;

  try {
    const [eventsRes, logsRes] = await Promise.all([fetchWithAuth("/api/schedule-events"), fetchWithAuth("/api/lesson-logs")]);
    if (!eventsRes.ok) throw new Error("events_fetch_failed");
    const eventsData = await eventsRes.json().catch(() => null);
    const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
    const currentUserId = String(sessionUser?.id || "").trim();

    let logs = [];
    if (logsRes.ok) {
      const logsData = await logsRes.json().catch(() => null);
      logs = Array.isArray(logsData?.logs) ? logsData.logs : [];
    }

    const logsByEventId = new Map();
    logs.forEach((log) => {
      if (!log || typeof log !== "object") return;
      const eventId = typeof log.eventId === "string" ? log.eventId : "";
      if (!eventId) return;
      logsByEventId.set(eventId, log);
    });

    const lessons = events
      // O professor pode registrar logs também para eventos "manual" (muitos professores criam "Aula" como evento manual).
      .filter((evt) => evt && typeof evt === "object" && (evt.type === "lesson" || evt.type === "manual"))
      .map((evt) => ({
        id: String(evt.id || ""),
        alunoId: typeof evt.alunoId === "string" ? evt.alunoId : "",
        professorId: typeof evt.professorId === "string" ? evt.professorId : "",
        dateKey: String(evt.dateKey || ""),
        startMin: Number(evt.startMin) || 0,
        endMin: Number(evt.endMin) || 0,
        title: String(evt.title || "Aluno"),
        description: String(evt.description || "Aula"),
      }))
      .filter((evt) => evt.id && isValidDateKey(evt.dateKey) && evt.endMin > evt.startMin)
      .sort((a, b) => (a.dateKey === b.dateKey ? a.startMin - b.startMin : a.dateKey.localeCompare(b.dateKey)));

    pedagogicoState.lessons = lessons;
    pedagogicoState.logsByEventId = logsByEventId;
    pedagogicoState.lastLoadedAt = Date.now();

    renderTeacherPedagogicoList();
    if (!silent) setPedagogicoStatus("");
  } catch (error) {
    console.error("[pedagogico] load failed:", error);
    if (pedagogicoError instanceof HTMLElement) pedagogicoError.hidden = false;
    setPedagogicoStatus("Não foi possível carregar agora.", "error");
  } finally {
    pedagogicoState.isLoading = false;
  }
};

const renderTeacherPedagogicoList = () => {
  if (!(pedagogicoList instanceof HTMLElement)) return;
  const lessons = Array.isArray(pedagogicoState.lessons) ? pedagogicoState.lessons : [];
  const logsByEventId = pedagogicoState.logsByEventId instanceof Map ? pedagogicoState.logsByEventId : new Map();

  const now = Date.now();
  let pending = 0;

  if (!lessons.length) {
    pedagogicoList.innerHTML = "";
    if (pedagogicoEmpty instanceof HTMLElement) pedagogicoEmpty.hidden = false;
    setPedagogicoPendingBadge(0);
    return;
  }

  const html = lessons
    .map((lesson) => {
      const start = buildDateFromDateKeyAndMinutes(lesson.dateKey, lesson.startMin);
      const isFuture = start ? start.getTime() > now : false;
      const log = logsByEventId.get(lesson.id) || null;
      const status = log && typeof log.statusAula === "string" ? String(log.statusAula).trim().toLowerCase() : "";
      const isDone = Boolean(status);
      const isPending = !isFuture && !isDone;

      if (isPending) pending += 1;

      const badgeText = isFuture ? "AULA FUTURA" : isDone ? "CONCLUÍDA" : "EM ABERTO";
      const badgeClass = isFuture ? "is-blue" : isDone ? "is-green" : "is-yellow";
      const rowClass = isFuture ? "is-future" : isDone ? "is-done" : "is-pending";
      const dateLabel = `${formatPedagogicoDate(lesson.dateKey)} · ${formatHmFromMinutes(lesson.startMin)}–${formatHmFromMinutes(lesson.endMin)}`;
      const disabledAttr = isFuture ? "disabled" : "";

      return `
        <button type="button" class="pedagogico-item ${rowClass}" data-pedagogico-item="${escapeHtml(lesson.id)}" ${disabledAttr}>
          <div class="pedagogico-item-main">
            <div class="pedagogico-item-date">${escapeHtml(dateLabel)}</div>
            <div class="pedagogico-item-student">${escapeHtml(lesson.title)}</div>
            <div class="pedagogico-item-title">${escapeHtml(lesson.description || "Aula")}</div>
          </div>
          <span class="pedagogico-badge ${badgeClass}">${badgeText}</span>
        </button>
      `;
    })
    .join("");

  pedagogicoList.innerHTML = html;
  if (pedagogicoEmpty instanceof HTMLElement) pedagogicoEmpty.hidden = true;
  setPedagogicoPendingBadge(pending);

  // Listener direto no container: mais robusto do que depender apenas do listener global no document.
  if (!pedagogicoList.dataset.clickBound) {
    pedagogicoList.dataset.clickBound = "true";
    pedagogicoList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const item = target.closest("[data-pedagogico-item]");
      if (!(item instanceof HTMLElement)) return;

      event.preventDefault();
      event.stopPropagation();

      const id = String(item.getAttribute("data-pedagogico-item") || item.dataset.pedagogicoItem || "").trim();
      if (!id) return;
      handlePedagogicoItemOpen(id);
    });
  }
};

let teacherStudentActionsPopoverEl = null;

const closeTeacherStudentActionsPopover = () => {
  if (teacherStudentActionsPopoverEl instanceof HTMLElement) {
    teacherStudentActionsPopoverEl.remove();
  }
  teacherStudentActionsPopoverEl = null;
};

const openTeacherStudentActionsPopover = ({ triggerEl, alunoId } = {}) => {
  if (!(triggerEl instanceof HTMLElement)) return;
  closeTeacherStudentActionsPopover();
  const safeAlunoId = String(alunoId || "").trim();
  if (!safeAlunoId) return;

  const pop = document.createElement("div");
  pop.className = "admin-actions-popover";
  pop.setAttribute("role", "menu");
  pop.setAttribute("data-teacher-student-actions-popover", "true");
  pop.innerHTML = `
    <button class="admin-action-item" type="button" data-teacher-student-action="history" data-teacher-student-aluno="${escapeHtml(
      safeAlunoId
    )}">Ver histórico do aluno</button>
  `;
  document.body.appendChild(pop);
  teacherStudentActionsPopoverEl = pop;

  const rect = triggerEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 10;
  const spaceBelow = window.innerHeight - rect.bottom;
  const shouldFlipUp = spaceBelow < popRect.height + margin;
  const top = shouldFlipUp ? rect.top - margin - popRect.height : rect.bottom + margin;
  const left = rect.right - popRect.width;
  pop.style.top = `${clampToViewport(top, margin, window.innerHeight - popRect.height - margin)}px`;
  pop.style.left = `${clampToViewport(left, margin, window.innerWidth - popRect.width - margin)}px`;
};

const buildTeacherStudentHistoryItems = ({ alunoId } = {}) => {
  const aId = String(alunoId || "").trim();
  const logs = Array.isArray(teacherStudentsState.logs) ? teacherStudentsState.logs : [];
  const eventsById = teacherStudentsState.eventsById instanceof Map ? teacherStudentsState.eventsById : new Map();
  const out = [];

  logs.forEach((log) => {
    if (!log || typeof log !== "object") return;
    if (aId && String(log.alunoId || "") !== aId) return;
    const evt = eventsById.get(String(log.eventId || "")) || null;
    const payload = log.payload && typeof log.payload === "object" ? log.payload : {};
    const statusAula = String(log.statusAula || "").trim().toLowerCase();
    const dateKey = String(evt?.dateKey || log.dateKey || "").trim();
    const startMin = Number(evt?.startMin) || 0;
    const endMin = Number(evt?.endMin) || 0;
    const avisos = Array.isArray(payload.avisosCoordenacao) ? payload.avisosCoordenacao : [];
    const needsAlert =
      payload.precisaIntervencao === true ||
      avisos.some((v) => String(v).startsWith("🔴") || String(v).startsWith("🟡")) ||
      (statusAula === "remarcada" && String(payload.motivoRemarcacao || "") === "professor_remarcou");

    out.push({
      eventId: String(log.eventId || ""),
      statusAula,
      dateKey,
      startMin,
      endMin,
      updatedAt: String(log.atualizadoEm || log.criadoEm || ""),
      payload,
      precisaIntervencao: needsAlert,
    });
  });

  out.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return String(b.dateKey).localeCompare(String(a.dateKey));
    if (a.startMin !== b.startMin) return b.startMin - a.startMin;
    const ams = a.updatedAt ? Date.parse(a.updatedAt) : NaN;
    const bms = b.updatedAt ? Date.parse(b.updatedAt) : NaN;
    if (Number.isFinite(ams) && Number.isFinite(bms)) return bms - ams;
    return 0;
  });

  return out;
};

const renderTeacherStudentHistoryDrawer = () => {
  if (!(teacherStudentHistoryBody instanceof HTMLElement)) return;
  const hist = teacherStudentsState.history;
  const items = Array.isArray(hist.items) ? hist.items : [];
  const filter = String(hist.filter || "all");

  const filtered = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === "alerts") return Boolean(it.precisaIntervencao);
    return it.statusAula === filter;
  });

  const total = items.length;
  const realizadas = items.filter((i) => i.statusAula === "realizada").length;
  const faltas = items.filter((i) => i.statusAula === "falta_aluno").length;
  const remarcadas = items.filter((i) => i.statusAula === "remarcada").length;
  const last = items[0] || null;
  const lastRisk = normalizeRiskLabel(last?.payload?.riscoEvasao || "") || "Sem dados";
  const lastUpdated = last?.updatedAt ? formatAdminHistoryStamp(last.updatedAt) : "Sem dados";

  let lastContent = "";
  let lastEng = "";
  let lastEvo = "";
  let lastHumor = "";
  let lastNext = "";
  let lastAvisos = [];
  let lastObs = "";
  if (last && last.statusAula === "realizada") {
    lastContent = String(last.payload?.conteudoTrabalhado || "").trim();
    const e1 = Number(last.payload?.engajamentoNota || 0);
    const e2 = Number(last.payload?.evolucaoNota || 0);
    lastEng = e1 ? `${e1}/5` : "";
    lastEvo = e2 ? `${e2}/5` : "";
    lastHumor = String(last.payload?.humorAluno || "").trim();
    lastNext = String(last.payload?.proximaAula || "").trim();
    lastAvisos = Array.isArray(last.payload?.avisosCoordenacao) ? last.payload.avisosCoordenacao : [];
    lastObs = String(last.payload?.observacoesInternas || "").trim();
  }

  const summaryHtml = `
    <div class="teacher-students-history-summary">
      <div class="teacher-students-summary-card"><span>Total de registros</span><strong>${escapeHtml(String(total))}</strong></div>
      <div class="teacher-students-summary-card"><span>Aulas realizadas</span><strong>${escapeHtml(String(realizadas))}</strong></div>
      <div class="teacher-students-summary-card"><span>Faltas</span><strong>${escapeHtml(String(faltas))}</strong></div>
      <div class="teacher-students-summary-card"><span>Remarcações</span><strong>${escapeHtml(String(remarcadas))}</strong></div>
      <div class="teacher-students-summary-card"><span>Último risco</span><strong>${escapeHtml(lastRisk)}</strong></div>
      <div class="teacher-students-summary-card"><span>Última atualização</span><strong>${escapeHtml(lastUpdated)}</strong></div>
    </div>
  `;

  const infoHtml = `
    <div class="teacher-students-history-info">
      <div class="teacher-students-info-row"><span>Último conteúdo</span><strong>${escapeHtml(lastContent || "Sem dados")}</strong></div>
      <div class="teacher-students-info-row"><span>Último engajamento</span><strong>${escapeHtml(lastEng || "Sem dados")}</strong></div>
      <div class="teacher-students-info-row"><span>Última evolução</span><strong>${escapeHtml(lastEvo || "Sem dados")}</strong></div>
      <div class="teacher-students-info-row"><span>Último humor</span><strong>${escapeHtml(lastHumor || "Sem dados")}</strong></div>
      <div class="teacher-students-info-row"><span>Próxima aula</span><strong>${escapeHtml(lastNext || "Sem dados")}</strong></div>
      <div class="teacher-students-info-row"><span>Avisos</span><strong>${escapeHtml(lastAvisos.length ? `${lastAvisos.length} aviso(s)` : "Sem dados")}</strong></div>
      <div class="teacher-students-info-row"><span>Observações recentes</span><strong>${escapeHtml(lastObs || "Sem dados")}</strong></div>
    </div>
  `;

  const timelineHtml = filtered
    .map((it) => {
      const stamp = it.dateKey ? `${formatPedagogicoDate(it.dateKey)} • ${formatHmFromMinutes(it.startMin)}–${formatHmFromMinutes(it.endMin)}` : "—";
      const statusLabel = it.statusAula === "realizada" ? "Realizada" : it.statusAula === "falta_aluno" ? "Falta do aluno" : "Remarcada";
      const alertBadge = it.precisaIntervencao ? `<span class="teacher-students-tl-alert">Alerta</span>` : "";
      const p = it.payload || {};
      let details = "";
      if (it.statusAula === "realizada") {
        const avisos = Array.isArray(p.avisosCoordenacao) ? p.avisosCoordenacao : [];
        details = `
          <div class="teacher-students-tl-details">Conteúdo: ${escapeHtml(String(p.conteudoTrabalhado || "").trim() || "—")}</div>
          <div class="teacher-students-tl-details">Engajamento: <strong>${escapeHtml(String(p.engajamentoNota || 0))}/5</strong> · Evolução: <strong>${escapeHtml(
          String(p.evolucaoNota || 0)
        )}/5</strong></div>
          <div class="teacher-students-tl-details">Humor: ${escapeHtml(String(p.humorAluno || "").trim() || "—")} · Próxima aula: ${escapeHtml(
          String(p.proximaAula || "").trim() || "—"
        )}</div>
          ${avisos.length ? `<div class="teacher-students-tl-avisos">${avisos.map((a) => `<span class="admin-students-pill">${escapeHtml(String(a))}</span>`).join("")}</div>` : ""}
          ${p.observacoesInternas ? `<div class="teacher-students-tl-obs">${escapeHtml(String(p.observacoesInternas))}</div>` : ""}
        `;
      } else if (it.statusAula === "falta_aluno") {
        details = `
          <div class="teacher-students-tl-details">Motivo: ${escapeHtml(String(p.motivoFalta || "").trim() || "—")}</div>
          <div class="teacher-students-tl-details">Risco: <strong>${escapeHtml(normalizeRiskLabel(p.riscoEvasao || "") || "Sem dados")}</strong></div>
          ${p.observacao ? `<div class="teacher-students-tl-obs">${escapeHtml(String(p.observacao))}</div>` : ""}
        `;
      } else {
        const novaData = String(p.novaDataRemarcacao || p.novaData || "").trim();
        const ini = String(p.horarioInicioRemarcacao || p.novoInicio || "").trim();
        const fim = String(p.horarioFimRemarcacao || p.novoFim || "").trim();
        const when = novaData && ini && fim ? `${formatPedagogicoDate(novaData)} • ${ini}–${fim}` : novaData ? formatPedagogicoDate(novaData) : "";
        details = `
          <div class="teacher-students-tl-details">Motivo: ${escapeHtml(String(p.motivoRemarcacao || "").trim() || "—")}</div>
          ${when ? `<div class=\"teacher-students-tl-details\">Nova aula: <strong>${escapeHtml(when)}</strong></div>` : ""}
          <div class="teacher-students-tl-details">Risco: <strong>${escapeHtml(normalizeRiskLabel(p.riscoEvasao || "") || "Sem dados")}</strong></div>
          ${p.observacao ? `<div class="teacher-students-tl-obs">${escapeHtml(String(p.observacao))}</div>` : ""}
        `;
      }

      return `
        <article class="teacher-students-tl-item">
          <div class="teacher-students-tl-head">
            <div class="teacher-students-tl-stamp">${escapeHtml(stamp)}</div>
            ${alertBadge}
          </div>
          <div class="teacher-students-tl-title">${escapeHtml(statusLabel)}</div>
          <div class="teacher-students-tl-by">Professor: ${escapeHtml(sessionUser?.name || "Professor")}</div>
          ${details}
        </article>
      `;
    })
    .join("");

  teacherStudentHistoryBody.innerHTML = `${summaryHtml}${infoHtml}<div class="teacher-students-timeline">${timelineHtml}</div>`;
  if (teacherStudentHistoryEmpty instanceof HTMLElement) teacherStudentHistoryEmpty.hidden = filtered.length > 0;
};

const openTeacherStudentHistoryDrawer = async ({ alunoId } = {}) => {
  if (currentRole !== "teacher") return;
  const aId = String(alunoId || "").trim();
  if (!aId) return;
  const items = buildTeacherStudentHistoryItems({ alunoId: aId });
  teacherStudentsState.history = { isOpen: true, alunoId: aId, filter: "all", items };

  if (teacherStudentHistoryTitle instanceof HTMLElement) teacherStudentHistoryTitle.textContent = "Histórico do aluno";
  if (teacherStudentHistorySub instanceof HTMLElement) {
    const name = teacherStudentsState.summaries.find((s) => s.alunoId === aId)?.nome || "Aluno";
    teacherStudentHistorySub.textContent = name;
  }

  document.querySelectorAll("[data-teacher-student-history-filter]").forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const isActive = String(btn.getAttribute("data-teacher-student-history-filter") || "") === "all";
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  renderTeacherStudentHistoryDrawer();

  if (teacherStudentHistoryDrawer instanceof HTMLElement) {
    teacherStudentHistoryDrawer.hidden = false;
    window.requestAnimationFrame(() => {
      if (teacherStudentHistoryDrawer instanceof HTMLElement) teacherStudentHistoryDrawer.classList.add("is-open");
    });
  }
};

const closeTeacherStudentHistoryDrawer = () => {
  if (teacherStudentHistoryDrawer instanceof HTMLElement) {
    teacherStudentHistoryDrawer.classList.remove("is-open");
    window.setTimeout(() => {
      if (teacherStudentHistoryDrawer instanceof HTMLElement) teacherStudentHistoryDrawer.hidden = true;
    }, 220);
  }
  teacherStudentsState.history = { isOpen: false, alunoId: "", filter: "all", items: [] };
};

const renderTeacherStudentsPanel = async ({ force = false } = {}) => {
  if (currentRole !== "teacher") return;
  if (!(teacherStudentsList instanceof HTMLElement)) return;
  if (teacherStudentsState.isLoading) return;

  const now = Date.now();
  if (!force && teacherStudentsState.loadedAt && now - teacherStudentsState.loadedAt < 20_000) {
    renderTeacherStudentsList();
    return;
  }

  teacherStudentsState.isLoading = true;
  setTeacherStudentsStatus("Carregando…");
  if (teacherStudentsError instanceof HTMLElement) teacherStudentsError.hidden = true;
  if (teacherStudentsEmpty instanceof HTMLElement) teacherStudentsEmpty.hidden = true;

  try {
    const [eventsRes, logsRes] = await Promise.all([fetchWithAuth("/api/schedule-events", { method: "GET" }), fetchWithAuth("/api/lesson-logs", { method: "GET" })]);
    if (!eventsRes.ok) throw new Error("teacher_students_events_failed");
    const eventsData = await eventsRes.json().catch(() => null);
    const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
    const eventsById = new Map();
    events.forEach((e) => {
      if (e && typeof e === "object" && e.id) eventsById.set(String(e.id), e);
    });

    const logsData = logsRes.ok ? await logsRes.json().catch(() => null) : null;
    const logs = Array.isArray(logsData?.logs) ? logsData.logs : [];

    teacherStudentsState.events = events;
    teacherStudentsState.eventsById = eventsById;
    teacherStudentsState.logs = logs;

    const alunoIds = new Set();
    events
      .filter((evt) => evt && typeof evt === "object" && evt.type === "lesson" && evt.alunoId)
      .forEach((evt) => alunoIds.add(String(evt.alunoId)));
    logs.forEach((log) => {
      const a = String(log?.alunoId || "").trim();
      if (a) alunoIds.add(a);
    });

    const lastEventByAluno = new Map();
    events.forEach((evt) => {
      if (!evt || typeof evt !== "object") return;
      if (evt.type !== "lesson") return;
      const a = String(evt.alunoId || "").trim();
      if (!a) return;
      const prev = lastEventByAluno.get(a) || null;
      if (!prev) {
        lastEventByAluno.set(a, evt);
        return;
      }
      const prevKey = String(prev.dateKey || "");
      const nextKey = String(evt.dateKey || "");
      if (nextKey && prevKey && nextKey !== prevKey) {
        if (nextKey > prevKey) lastEventByAluno.set(a, evt);
        return;
      }
      const prevStart = Number(prev.startMin) || 0;
      const nextStart = Number(evt.startMin) || 0;
      if (nextStart > prevStart) lastEventByAluno.set(a, evt);
    });

    const perAluno = new Map();
    logs.forEach((log) => {
      if (!log || typeof log !== "object") return;
      const a = String(log.alunoId || "").trim();
      if (!a) return;
      const bucket = perAluno.get(a) || { total: 0, lastLog: null, lastRisk: "", lastStatus: "", hasAlert: false };
      bucket.total += 1;
      const status = String(log.statusAula || "").trim().toLowerCase();
      bucket.lastStatus = status || bucket.lastStatus;
      const updatedAt = String(log.atualizadoEm || log.criadoEm || "").trim();
      const ms = updatedAt ? Date.parse(updatedAt) : NaN;
      const lastMs = bucket.lastLog?.atualizadoEm ? Date.parse(String(bucket.lastLog.atualizadoEm)) : NaN;
      if (!bucket.lastLog || (Number.isFinite(ms) && (!Number.isFinite(lastMs) || ms > lastMs))) {
        bucket.lastLog = log;
      }
      const risk = String(log?.payload?.riscoEvasao || "").trim().toLowerCase();
      if (risk) bucket.lastRisk = risk;
      const avisos = Array.isArray(log?.payload?.avisosCoordenacao) ? log.payload.avisosCoordenacao : [];
      const needsAlert =
        log?.payload?.precisaIntervencao === true ||
        avisos.some((v) => String(v).startsWith("🔴") || String(v).startsWith("🟡")) ||
        (status === "remarcada" && String(log?.payload?.motivoRemarcacao || "") === "professor_remarcou");
      if (needsAlert) bucket.hasAlert = true;
      perAluno.set(a, bucket);
    });

    const summaries = Array.from(alunoIds)
      .map((alunoId) => {
        const bucket = perAluno.get(alunoId) || { total: 0, lastLog: null, lastRisk: "", lastStatus: "", hasAlert: false };
        const lastLog = bucket.lastLog;
        const evt = lastLog?.eventId ? eventsById.get(String(lastLog.eventId)) : null;
        const lastEvent = lastEventByAluno.get(alunoId) || evt || null;
        const lastLessonLabel =
          lastEvent && lastEvent.dateKey
            ? `${formatPedagogicoDate(lastEvent.dateKey)} • ${formatHmFromMinutes(lastEvent.startMin)}–${formatHmFromMinutes(lastEvent.endMin)}`
            : "—";
        const nome = lastEvent?.title ? String(lastEvent.title) : "Aluno";
        const riskLabel = normalizeRiskLabel(bucket.lastRisk) || "Sem dados";
        const statusLabel =
          bucket.lastStatus === "realizada" ? "Realizada" : bucket.lastStatus === "falta_aluno" ? "Falta do aluno" : bucket.lastStatus === "remarcada" ? "Remarcada" : "Sem dados";
        const hasAlert = Boolean(bucket.hasAlert);
        return {
          alunoId,
          nome,
          email: "",
          lastLessonLabel,
          totalLogs: bucket.total,
          riskLabel,
          statusLabel,
          hasAlert,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    teacherStudentsState.summaries = summaries;
    teacherStudentsState.loadedAt = Date.now();
    setTeacherStudentsStatus("");
    renderTeacherStudentsList();
  } catch (error) {
    console.error("[teacher] students load failed:", error);
    if (teacherStudentsError instanceof HTMLElement) teacherStudentsError.hidden = false;
    setTeacherStudentsStatus("Não foi possível carregar agora.", "error");
  } finally {
    teacherStudentsState.isLoading = false;
  }
};

const renderTeacherStudentsList = () => {
  if (!(teacherStudentsList instanceof HTMLElement)) return;
  const rows = Array.isArray(teacherStudentsState.summaries) ? teacherStudentsState.summaries : [];
  if (teacherStudentsEmpty instanceof HTMLElement) teacherStudentsEmpty.hidden = rows.length > 0;
  if (rows.length === 0) {
    teacherStudentsList.innerHTML = "";
    return;
  }

  teacherStudentsList.innerHTML = rows
    .map((row) => {
      const alertBadge = row.hasAlert ? `<span class="admin-students-alert">Alerta</span>` : "";
      return `
        <div class="teacher-students-row" data-teacher-student-row="${escapeHtml(row.alunoId)}">
          <div class="admin-students-avatar" aria-hidden="true">${escapeHtml(getInitials(row.nome))}</div>
          <div class="teacher-students-main">
            <div class="admin-students-name"><span>${escapeHtml(row.nome)}</span>${alertBadge}</div>
            <div class="admin-students-meta">
              <span class="admin-students-email">${escapeHtml(row.email || "—")}</span>
              <span class="admin-students-dot" aria-hidden="true">•</span>
              <span>Última aula registrada: <strong>${escapeHtml(row.lastLessonLabel)}</strong></span>
              <span class="admin-students-dot" aria-hidden="true">•</span>
              <span>Registros: <strong>${escapeHtml(String(row.totalLogs))}</strong></span>
            </div>
            <div class="admin-students-kpis">
              <span>Último status: <strong>${escapeHtml(row.statusLabel)}</strong></span>
              <span>Risco: <strong>${escapeHtml(row.riskLabel)}</strong></span>
            </div>
          </div>
          <button class="admin-students-actions-trigger" type="button" aria-label="Ações" data-teacher-student-actions-trigger="${escapeHtml(
            row.alunoId
          )}">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6.5 12h.01"></path>
              <path d="M12 12h.01"></path>
              <path d="M17.5 12h.01"></path>
            </svg>
          </button>
        </div>
      `;
    })
    .join("");
};

const activatePedagogicoLessonFromEl = (event, pedItem) => {
  if (!(pedItem instanceof HTMLElement)) return false;
  const eventId = String(pedItem.getAttribute("data-pedagogico-item") || "").trim();
  if (!eventId) return false;
  // Não bloqueia por role aqui: o problema atual é usabilidade (clique não chega).

  const lesson = Array.isArray(pedagogicoState.lessons) ? pedagogicoState.lessons.find((l) => String(l?.id || "") === eventId) : null;
  if (!lesson) return false;

  const start = buildDateFromDateKeyAndMinutes(lesson.dateKey, lesson.startMin);
  const isFuture = start ? start.getTime() > Date.now() : false;
  if (isFuture) return true; // futuro: consome o evento, mas não abre drawer

  if (event && typeof event.preventDefault === "function") event.preventDefault();

  handlePedagogicoItemOpen(eventId);
  return true;
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
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js"),
  ]).then(([appMod, authMod, fsMod, storageMod]) => {
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
    const primaryStorage = storageMod.getStorage(primaryApp);

    return {
      primaryAuth,
      secondaryAuth,
      primaryDb,
      secondaryDb,
      primaryStorage,
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
	      deleteDoc: fsMod.deleteDoc,
	      serverTimestamp: fsMod.serverTimestamp,
	      where: fsMod.where,
      ref: storageMod.ref,
      uploadBytes: storageMod.uploadBytes,
      getDownloadURL: storageMod.getDownloadURL,
      deleteObject: storageMod.deleteObject,
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

const waitForAuthToken = async (firebase, timeoutMs = 12000) => {
  if (!firebase || !firebase.primaryAuth || typeof firebase.onAuthStateChanged !== "function") {
    // eslint-disable-next-line no-console
    console.log("[waitForAuthToken] iniciado (firebase inválido)");
    throw new Error("not-authenticated");
  }

  const ms = Number(timeoutMs);
  const safeTimeout = Number.isFinite(ms) && ms > 0 ? ms : 12000;

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-console
    console.log("[waitForAuthToken] iniciado");
    let settled = false;
    let unsub = null;

    const finish = (err, token) => {
      if (settled) return;
      settled = true;
      try {
        if (typeof unsub === "function") unsub();
      } catch (e) {
        // ignore
      }
      if (err) reject(err);
      else resolve(String(token || ""));
    };

    const timer = window.setTimeout(() => finish(new Error("not-authenticated"), ""), safeTimeout);

    unsub = firebase.onAuthStateChanged(firebase.primaryAuth, async (user) => {
      // eslint-disable-next-line no-console
      console.log("[waitForAuthToken] user:", user?.uid ?? "null");
      window.clearTimeout(timer);
      if (!user || typeof user.getIdToken !== "function") {
        finish(new Error("not-authenticated"), "");
        return;
      }
      try {
        const token = await user.getIdToken(true);
        finish(null, token);
      } catch (e) {
        finish(e, "");
      }
    });
  });
};

let cachedFirebaseIdToken = {
  uid: "",
  token: "",
  expiresAt: 0,
};

const getFirebaseIdTokenForApi = async (forceRefresh = false) => {
  try {
    const firebase = await loadFirebaseAdminApi();
    if (forceRefresh) {
      const token = await waitForAuthToken(firebase, 12000);
      const user = firebase?.primaryAuth?.currentUser;
      const uid = user ? String(user.uid || "") : "";
      const now = Date.now();
      cachedFirebaseIdToken = { uid, token: String(token || ""), expiresAt: now + 180_000 };
      return cachedFirebaseIdToken.token;
    }

    const user = await waitForFirebaseAuthReady(firebase, 3500);
    if (!user || typeof user.getIdToken !== "function") return "";

    const uid = String(user.uid || "");
    const now = Date.now();
    if (!forceRefresh && cachedFirebaseIdToken.uid === uid && cachedFirebaseIdToken.token && cachedFirebaseIdToken.expiresAt > now) {
      return cachedFirebaseIdToken.token;
    }

    // Use `true` to force refresh when needed (ex: growth-goals save right after login).
    const token = await user.getIdToken(false);
    cachedFirebaseIdToken = {
      uid,
      token: String(token || ""),
      // Firebase ID tokens are valid for ~1h; we refresh frequently to keep API calls snappy.
      expiresAt: now + 180_000,
    };
    return cachedFirebaseIdToken.token;
  } catch (error) {
    if (forceRefresh) throw error;
    return "";
  }
};

const fetchWithAuth = async (input, init = {}) => {
  const opts = init && typeof init === "object" ? init : {};
  const headers = new Headers(opts.headers || {});
  const force = Boolean(opts.forceRefreshIdToken);
  const token = await getFirebaseIdTokenForApi(force);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  // Do not forward our custom option to `fetch`.
  if (Object.prototype.hasOwnProperty.call(opts, "forceRefreshIdToken")) delete opts.forceRefreshIdToken;
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
  teacher: { rows: [], query: "", loadedAt: 0, isLoading: false, statusFilter: "active" }, // active | inactive
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

let adminStudentsState = {
  isLoading: false,
  loadedAt: 0,
  teachers: [], // [{id,nome,ativo,initials}]
  teachersById: new Map(),
  studentsById: new Map(), // uid -> {id,nome,email,ativo,initials}
  students: [], // raw student rows
  eventsLoadedAt: 0,
  events: [], // from /api/schedule-events
  logsLoadedAt: 0,
  logs: [], // all lessonLogs (admin can read)
  summariesAll: [], // all derived student rows
  summaries: [], // derived + filtered student rows
  filters: {
    status: "all", // all | active | inactive
    createdFrom: "",
    createdTo: "",
    canceledFrom: "",
    canceledTo: "",
    teacherId: "",
    plan: "",
    country: "",
  },
	  history: {
	    isOpen: false,
	    alunoId: "",
	    activeTab: "overview", // overview | history | lessons | financeiro | atividades | arquivos
	    editMode: false,
	    filter: "all", // all | realizada | falta_aluno | remarcada | alerts
	    items: [], // derived timeline items (log + event)
	    alunoMeta: null,
	    teacherMeta: null,
	  },
	};

const setAdminStudentsStatus = (text, tone = "") => {
  if (!(adminStudentsStatus instanceof HTMLElement)) return;
  adminStudentsStatus.textContent = String(text || "");
  adminStudentsStatus.dataset.tone = String(tone || "");
};

const normalizeRiskLabel = (value) => {
  const s = String(value || "").trim().toLowerCase();
  if (s === "baixo") return "Baixo";
  if (s === "medio" || s === "médio") return "Médio";
  if (s === "alto") return "Alto";
  return "";
};

// Admin > Alunos: student files (Storage + Firestore metadata)
const ADMIN_STUDENT_FILE_EXTS = ["pdf", "doc", "docx", "png", "jpg", "jpeg"];
const MAX_STUDENT_FILE_BYTES = 25 * 1024 * 1024; // 25MB hard cap to prevent accidental huge uploads.

const normalizeFileExt = (name) => {
  const n = String(name || "");
  const idx = n.lastIndexOf(".");
  if (idx < 0) return "";
  return n.slice(idx + 1).trim().toLowerCase();
};

const sanitizeStorageFileName = (name) => {
  const raw = String(name || "").trim();
  if (!raw) return "arquivo";
  // Keep extension, replace unsafe chars.
  const parts = raw.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".") || "arquivo";
  const safeBase = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
  const safeExt = ext ? ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) : "";
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
};

const isAllowedStudentFile = (file) => {
  if (!(file instanceof File)) return { ok: false, reason: "Arquivo inválido." };
  const ext = normalizeFileExt(file.name);
  if (!ext || !ADMIN_STUDENT_FILE_EXTS.includes(ext)) return { ok: false, reason: "Tipo de arquivo não permitido." };
  if (file.size > MAX_STUDENT_FILE_BYTES) return { ok: false, reason: "Arquivo muito grande." };
  return { ok: true, ext };
};

const createStudentFileId = () => `sf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const formatIsoToAdminStamp = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(String(iso));
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yy} • ${hh}:${mi}`;
  } catch {
    return "—";
  }
};

const readAdminStudentFilesFromFirestore = async ({ alunoId } = {}) => {
  const id = String(alunoId || "").trim();
  if (!id) return [];
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_student_files");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }

  // Subcollection under users/{studentId}/files/{fileId}
  const col = firebase.collection(firebase.primaryDb, "users", id, "files");
  let snap;
  try {
    snap = await withTimeout(firebase.getDocs(firebase.query(col, firebase.orderBy("uploadedAt", "desc"))), 12_000, "firestore_student_files_list");
  } catch (err) {
    // fallback: if orderBy isn't available due to missing index/field, list without ordering.
    snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_student_files_list_fallback");
  }

  const files = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data ? docSnap.data() : null;
    if (!data || typeof data !== "object") return;
    const uploadedAtIso = data.uploadedAt ? (typeof data.uploadedAt?.toDate === "function" ? data.uploadedAt.toDate().toISOString() : String(data.uploadedAt)) : "";
    files.push({
      id: docSnap.id,
      studentId: String(data.studentId || id),
      fileName: String(data.fileName || ""),
      fileType: String(data.fileType || ""),
      fileSize: Number.isFinite(Number(data.fileSize)) ? Number(data.fileSize) : 0,
      fileUrl: String(data.fileUrl || ""),
      storagePath: String(data.storagePath || ""),
      uploadedAt: uploadedAtIso,
      uploadedBy: String(data.uploadedBy || ""),
    });
  });

  // Ensure newest first if fallback was used.
  files.sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  return files;
};

const renderAdminStudentFilesTab = () => {
  if (!(adminStudentHistoryDrawer instanceof HTMLElement)) return;
  const sheetEl = document.querySelector("[data-admin-student-sheet]");
  if (!(sheetEl instanceof HTMLElement)) return;

  const panel = sheetEl.querySelector("[data-admin-student-files]") || sheetEl.querySelector('[data-admin-student-tab-panel="arquivos"]');
  if (!(panel instanceof HTMLElement)) return;
  const hist = adminStudentsState.history;
  const alunoId = String(hist?.alunoId || "").trim();
  const files = Array.isArray(hist?.files) ? hist.files : [];
  const isLoading = Boolean(hist?.filesLoading);
  const errorMsg = String(hist?.filesError || "");

  const listHtml = isLoading
    ? `<div class="admin-student-files-empty">Carregando arquivos…</div>`
    : errorMsg
      ? `<div class="admin-student-files-empty is-error">${escapeHtml(errorMsg)}</div>`
      : files.length
        ? `<div class="admin-student-files-list">
            ${files
              .map((f) => {
                const ext = normalizeFileExt(f.fileName) || (f.fileType ? String(f.fileType).split("/").pop() : "");
                const stamp = formatIsoToAdminStamp(f.uploadedAt);
                const openDisabled = f.fileUrl ? "" : "disabled";
                return `
                  <div class="admin-student-file" data-admin-student-file="${escapeHtml(String(f.id))}">
                    <div class="admin-student-file-main">
                      <div class="admin-student-file-name">${escapeHtml(f.fileName || "Arquivo")}</div>
                      <div class="admin-student-file-meta">
                        <span>${escapeHtml((ext || "—").toUpperCase())}</span>
                        <span class="admin-student-file-dot">•</span>
                        <span>${escapeHtml(stamp)}</span>
                        <span class="admin-student-file-dot">•</span>
                        <span>${escapeHtml(formatBytes(f.fileSize || 0))}</span>
                      </div>
                    </div>
                    <div class="admin-student-file-actions">
                      <a class="admin-student-file-btn" href="${escapeHtml(f.fileUrl || "#")}" target="_blank" rel="noopener" ${openDisabled ? 'aria-disabled="true" tabindex="-1"' : ""}>Abrir</a>
                      <a class="admin-student-file-btn" href="${escapeHtml(f.fileUrl || "#")}" download ${openDisabled ? 'aria-disabled="true" tabindex="-1"' : ""}>Baixar</a>
                      <button class="admin-student-file-btn is-danger" type="button" data-admin-student-file-delete="${escapeHtml(String(f.id))}" data-admin-student-file-aluno="${escapeHtml(
                  alunoId
                )}">Excluir</button>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>`
        : `<div class="admin-student-files-empty">Nenhum arquivo.</div>`;

  panel.innerHTML = `
    <div class="admin-student-panel-card">
      <div class="admin-student-panel-title">Arquivos</div>
      <div class="admin-student-files-upload">
        <div class="admin-student-upload-zone" data-admin-student-files-upload-zone role="button" tabindex="0">
          <strong>Enviar arquivos</strong>
          <span>PDF, DOC, DOCX, PNG, JPG, JPEG</span>
        </div>
        <input type="file" hidden multiple data-admin-student-files-input accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
        <div class="admin-student-files-inline-error" data-admin-student-files-error hidden>—</div>
      </div>
      ${listHtml}
    </div>
  `;
};

const ensureAdminStudentFilesLoaded = async ({ force = false } = {}) => {
  const hist = adminStudentsState.history;
  const alunoId = String(hist?.alunoId || "").trim();
  if (!alunoId) return;
  if (!force && Array.isArray(hist?.files) && hist.filesLoadedAt && Date.now() - hist.filesLoadedAt < 30_000) return;

  adminStudentsState.history.filesLoading = true;
  adminStudentsState.history.filesError = "";
  renderAdminStudentFilesTab();
  try {
    const files = await readAdminStudentFilesFromFirestore({ alunoId });
    adminStudentsState.history.files = files;
    adminStudentsState.history.filesLoadedAt = Date.now();
  } catch (error) {
    console.error("[admin] load student files failed:", error);
    adminStudentsState.history.filesError = "Não foi possível carregar os arquivos.";
  } finally {
    adminStudentsState.history.filesLoading = false;
    renderAdminStudentFilesTab();
  }
};

const uploadAdminStudentFiles = async ({ alunoId, files } = {}) => {
  const id = String(alunoId || "").trim();
  const fileList = Array.isArray(files) ? files : [];
  if (!id || !fileList.length) return;

  const sheetEl = document.querySelector("[data-admin-student-sheet]");
  const panel = sheetEl instanceof HTMLElement ? sheetEl.querySelector('[data-admin-student-tab-panel="arquivos"]') : null;
  const inlineError = panel instanceof HTMLElement ? panel.querySelector("[data-admin-student-files-error]") : null;
  const setInlineError = (msg) => {
    if (!(inlineError instanceof HTMLElement)) return;
    inlineError.textContent = String(msg || "");
    inlineError.hidden = !msg;
  };
  setInlineError("");

  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_student_files_upload");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) throw new Error("not-authenticated");

  adminStudentsState.history.filesLoading = true;
  renderAdminStudentFilesTab();

  try {
    for (const file of fileList) {
      const check = isAllowedStudentFile(file);
      if (!check.ok) {
        setInlineError(check.reason || "Arquivo inválido.");
        continue;
      }

      const fileId = createStudentFileId();
      const safeName = sanitizeStorageFileName(file.name);
      const storagePath = `student_files/${id}/${fileId}_${safeName}`;
      const storageRef = firebase.ref(firebase.primaryStorage, storagePath);

      await withTimeout(firebase.uploadBytes(storageRef, file), 30_000, "storage_upload_student_file");
      const url = await withTimeout(firebase.getDownloadURL(storageRef), 12_000, "storage_get_url_student_file");

      const metaDoc = firebase.doc(firebase.primaryDb, "users", id, "files", fileId);
      const payload = {
        studentId: id,
        fileName: file.name,
        fileUrl: url,
        storagePath,
        fileType: file.type || "",
        fileSize: file.size || 0,
        uploadedAt: firebase.serverTimestamp(),
        uploadedBy: String(user.uid || ""),
      };
      await withTimeout(firebase.setDoc(metaDoc, payload, { merge: true }), 12_000, "firestore_student_file_meta");
    }

    await ensureAdminStudentFilesLoaded({ force: true });
  } catch (error) {
    console.error("[admin] upload student files failed:", error);
    setInlineError("Não foi possível enviar agora.");
  } finally {
    adminStudentsState.history.filesLoading = false;
    renderAdminStudentFilesTab();
  }
};

const deleteAdminStudentFile = async ({ alunoId, fileId } = {}) => {
  const id = String(alunoId || "").trim();
  const fId = String(fileId || "").trim();
  if (!id || !fId) return;

  const hist = adminStudentsState.history;
  const files = Array.isArray(hist?.files) ? hist.files : [];
  const meta = files.find((f) => String(f?.id || "") === fId) || null;
  const fileName = meta?.fileName || "este arquivo";
  const storagePath = meta?.storagePath || "";

  openModal({
    title: "Excluir arquivo",
    bodyHtml: `<div style="display:grid; gap:10px;">
      <p style="margin:0; color: rgba(255,255,255,0.75); font-size: 13px; line-height: 1.45;">
        Tem certeza que deseja excluir <strong>${escapeHtml(fileName)}</strong>?
      </p>
      <p style="margin:0; color: rgba(255,255,255,0.45); font-size: 12px; line-height: 1.45;">
        O arquivo será removido do armazenamento e também do cadastro do aluno.
      </p>
    </div>`,
    primaryLabel: "Excluir",
    secondaryLabel: "Cancelar",
    onPrimary: () => {
      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;
      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_student_file_delete");
          // Remove storage first (best effort), then metadata.
          if (storagePath) {
            try {
              await withTimeout(firebase.deleteObject(firebase.ref(firebase.primaryStorage, storagePath)), 15_000, "storage_delete_student_file");
            } catch (err) {
              console.error("[admin] storage delete failed (continuing):", err);
            }
          }
          await withTimeout(firebase.deleteDoc(firebase.doc(firebase.primaryDb, "users", id, "files", fId)), 12_000, "firestore_delete_student_file_meta");
          closeModal();
          await ensureAdminStudentFilesLoaded({ force: true });
        } catch (error) {
          console.error("[admin] delete student file failed:", error);
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
        }
      })();
      return false;
    },
  });
};

const toDateKeyFromAny = (value) => {
  if (!value) return "";
  try {
    const date =
      value instanceof Date
        ? value
        : typeof value?.toDate === "function"
          ? value.toDate()
          : typeof value === "number"
            ? new Date(value)
            : new Date(String(value));
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const y = String(date.getFullYear()).padStart(4, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    return "";
  }
};

const countActiveAdminStudentsFilters = (filters) => {
  const f = filters && typeof filters === "object" ? filters : {};
  let n = 0;
  if (String(f.status || "all") !== "all") n += 1;
  if (String(f.createdFrom || "")) n += 1;
  if (String(f.createdTo || "")) n += 1;
  if (String(f.canceledFrom || "")) n += 1;
  if (String(f.canceledTo || "")) n += 1;
  if (String(f.teacherId || "")) n += 1;
  if (String(f.plan || "")) n += 1;
  if (String(f.country || "")) n += 1;
  return n;
};

const syncAdminStudentsFiltersBadge = () => {
  if (!(adminStudentsFiltersBadge instanceof HTMLElement)) return;
  const n = countActiveAdminStudentsFilters(adminStudentsState.filters);
  if (n <= 0) {
    adminStudentsFiltersBadge.hidden = true;
    adminStudentsFiltersBadge.textContent = "0";
    return;
  }
  adminStudentsFiltersBadge.hidden = false;
  adminStudentsFiltersBadge.textContent = String(n);
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
    const res = await fetchWithAuth("/api/growth-dashboard?api=growth-goals", { method: "GET", forceRefreshIdToken: true });
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
          const firebase = await loadFirebaseAdminApi();
          // eslint-disable-next-line no-console
          console.log("[meta] currentUser:", firebase?.primaryAuth?.currentUser?.uid ?? "null");
          // eslint-disable-next-line no-console
          console.log("[meta] tentando obter token...");
          const token = await getFirebaseIdTokenForApi(true);
          if (!token) {
            throw new Error("invalid_credentials");
          }
          if (modalPrimary) modalPrimary.disabled = true;
          if (modalSecondary) modalSecondary.disabled = true;
          if (modalPrimary) modalPrimary.textContent = "Salvando…";

          const res = await fetchWithAuth("/api/growth-dashboard?api=growth-goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ competencia: competenciaValue, valorMeta }),
            forceRefreshIdToken: true,
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
          let msg = code ? `Erro: ${code}` : "Não foi possível salvar agora. Tente novamente.";
          if (code === "unauthorized" || code === "invalid_credentials") {
            msg = `Erro: ${code}`;
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

const syncTeacherStatusFilterTabs = () => {
  const filter = adminUsersState?.teacher?.statusFilter === "inactive" ? "inactive" : "active";
  document.querySelectorAll("[data-admin-teacher-filter]").forEach((el) => {
    if (!(el instanceof HTMLButtonElement)) return;
    const value = String(el.getAttribute("data-admin-teacher-filter") || "").trim().toLowerCase();
    const isActive = value === filter;
    el.classList.toggle("is-active", isActive);
    el.setAttribute("aria-selected", isActive ? "true" : "false");
  });
};

const setTeacherStatusFilter = (nextFilter) => {
  const filter = String(nextFilter || "").trim().toLowerCase() === "inactive" ? "inactive" : "active";
  adminUsersState.teacher.statusFilter = filter;
  renderAdminUsersTable("teacher");
};

const renderAdminUsersTable = (type) => {
  const safeType = type === "teacher" ? "teacher" : type === "growth" ? "growth" : "student";
  const state = adminUsersState[safeType];
  const { table, empty, error } = getAdminUsersUiRefs(safeType);
  if (!(table instanceof HTMLElement)) return;
  if (error instanceof HTMLElement) error.hidden = true;

  const q = String(state.query || "").trim().toLowerCase();
  let filtered = q
    ? state.rows.filter((row) => row.nome.toLowerCase().includes(q) || row.email.toLowerCase().includes(q))
    : state.rows;

  if (safeType === "teacher") {
    const filter = state.statusFilter === "inactive" ? "inactive" : "active";
    filtered = filtered.filter((row) => (filter === "active" ? row.ativo : !row.ativo));
    syncTeacherStatusFilterTabs();
  }

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

const fetchUserRowsFromFirestore = async (tipo) => {
  const safeTipo = tipo === "teacher" ? "teacher" : tipo === "growth" ? "growth" : "student";
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_students");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }

  const q = firebase.query(firebase.collection(firebase.primaryDb, "users"), firebase.where("tipo", "==", safeTipo));
  const snap = await withTimeout(firebase.getDocs(q), 12_000, `firestore_getDocs_users_${safeTipo}`);
  const rows = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data ? docSnap.data() : null;
    if (!data || typeof data !== "object") return;
    const base = normalizeUserRow({
      id: docSnap.id,
      nome: data.nome,
      email: data.email,
      tipo: data.tipo,
      ativo: data.ativo,
      criadoEm: data.criadoEm,
    });
    if (!base) return;
    // Optional fields: keep them for Admin > Alunos filters (do not assume they exist).
    const professorId = typeof data.professorId === "string" ? data.professorId.trim() : typeof data.teacherId === "string" ? data.teacherId.trim() : "";
    const plano = typeof data.plano === "string" ? data.plano.trim() : typeof data.plan === "string" ? data.plan.trim() : typeof data.planoKey === "string" ? data.planoKey.trim() : "";
    const pais = typeof data.pais === "string" ? data.pais.trim() : typeof data.country === "string" ? data.country.trim() : "";
    const canceladoEm = data.canceladoEm || data.cancelamentoEm || data.dataCancelamento || null;
    // Student extended profile fields (admin edit modal/sheet). These may not exist for older users.
    const endereco = typeof data.endereco === "string" ? data.endereco : typeof data.address === "string" ? data.address : "";
    const estadoEua = typeof data.estadoEua === "string" ? data.estadoEua : typeof data.estadoEUA === "string" ? data.estadoEUA : typeof data.usState === "string" ? data.usState : "";
    const valorMensalidade = Number.isFinite(Number(data.valorMensalidade)) ? Number(data.valorMensalidade) : data.valorMensalidade ?? null;
	    const tempoContrato =
	      typeof data.tempoContrato === "string"
	        ? data.tempoContrato
	        : Number.isFinite(Number(data.tempoContrato))
	          ? String(Number(data.tempoContrato))
	          : "";
    const faixaIdade = typeof data.faixaIdade === "string" ? data.faixaIdade : "";
    const genero = typeof data.genero === "string" ? data.genero : "";
    const trabalho = typeof data.trabalho === "string" ? data.trabalho : "";
    const possuiFilhos = typeof data.possuiFilhos === "string" ? data.possuiFilhos : typeof data.possuiFilhos === "boolean" ? (data.possuiFilhos ? "sim" : "nao") : "";
    const casado = typeof data.casado === "string" ? data.casado : typeof data.casado === "boolean" ? (data.casado ? "sim" : "nao") : "";
    const pretendeVoltarBrasil = typeof data.pretendeVoltarBrasil === "string" ? data.pretendeVoltarBrasil : "";
    const objetivoPrincipal = typeof data.objetivoPrincipal === "string" ? data.objetivoPrincipal : "";
    const nivelInglesAtual = typeof data.nivelInglesAtual === "string" ? data.nivelInglesAtual : "";
    const criadoKey = toDateKeyFromAny(data.criadoEm);
    const cancelKey = toDateKeyFromAny(canceladoEm);
    rows.push({
      ...base,
      professorId,
      plano,
      pais,
      canceladoEm,
      criadoKey,
      cancelKey,
      endereco,
      estadoEua,
      valorMensalidade,
      tempoContrato,
      faixaIdade,
      genero,
      trabalho,
      possuiFilhos,
      casado,
      pretendeVoltarBrasil,
      objetivoPrincipal,
      nivelInglesAtual,
    });
  });
  return rows.filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

const fetchLessonLogsFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_lessonlogs");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }

  const q = firebase.query(firebase.collection(firebase.primaryDb, "lessonLogs"));
  const snap = await withTimeout(firebase.getDocs(q), 12_000, "firestore_getDocs_lessonLogs_all");
  const logs = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data ? docSnap.data() : null;
    if (!data || typeof data !== "object") return;
    const eventId = typeof data.eventId === "string" ? data.eventId.trim() : "";
    const professorId = typeof data.professorId === "string" ? data.professorId.trim() : "";
    const alunoId = typeof data.alunoId === "string" ? data.alunoId.trim() : "";
    const statusAula = typeof data.statusAula === "string" ? data.statusAula.trim().toLowerCase() : "";
    if (!eventId) return;
    logs.push({
      id: docSnap.id,
      eventId,
      professorId,
      alunoId,
      dateKey: typeof data.dateKey === "string" ? data.dateKey.trim() : "",
      statusAula,
      criadoEm: data.criadoEm ? (typeof data.criadoEm?.toDate === "function" ? data.criadoEm.toDate().toISOString() : String(data.criadoEm)) : "",
      atualizadoEm: data.atualizadoEm ? (typeof data.atualizadoEm?.toDate === "function" ? data.atualizadoEm.toDate().toISOString() : String(data.atualizadoEm)) : "",
      payload: data,
    });
  });

  // newest first to make "last" lookups cheap.
  logs.sort((a, b) => {
    const ak = String(a.dateKey || "");
    const bk = String(b.dateKey || "");
    if (ak !== bk) return bk.localeCompare(ak);
    const ams = a.atualizadoEm ? Date.parse(a.atualizadoEm) : NaN;
    const bms = b.atualizadoEm ? Date.parse(b.atualizadoEm) : NaN;
    if (Number.isFinite(ams) && Number.isFinite(bms)) return bms - ams;
    return 0;
  });

  return logs;
};

const ensureAdminStudentsBaseData = async ({ force = false } = {}) => {
  if (currentRole !== "admin") return;
  const now = Date.now();
  if (!force && adminStudentsState.loadedAt && now - adminStudentsState.loadedAt < 60_000) return;

  adminStudentsState.isLoading = true;
  setAdminStudentsStatus("Carregando…");
  if (adminStudentsError instanceof HTMLElement) adminStudentsError.hidden = true;

  try {
    const [teachers, students, eventsRes, logs] = await Promise.all([
      fetchAdminAgendaTeachers(),
      fetchUserRowsFromFirestore("student"),
      fetchWithAuth("/api/schedule-events", { method: "GET" }),
      fetchLessonLogsFromFirestore(),
    ]);

    adminStudentsState.teachers = Array.isArray(teachers) ? teachers : [];
    const teachersById = new Map();
    adminStudentsState.teachers.forEach((t) => {
      if (t && typeof t === "object" && t.id) teachersById.set(String(t.id), t);
    });
    adminStudentsState.teachersById = teachersById;
    const studentsById = new Map();
    (Array.isArray(students) ? students : []).forEach((row) => {
      if (!row?.id) return;
      studentsById.set(row.id, row);
    });
    adminStudentsState.studentsById = studentsById;
    adminStudentsState.students = Array.isArray(students) ? students : [];

    if (!eventsRes.ok) throw new Error("admin_students_events_failed");
    const eventsData = await eventsRes.json().catch(() => null);
    adminStudentsState.events = Array.isArray(eventsData?.events) ? eventsData.events : [];
    adminStudentsState.eventsLoadedAt = Date.now();

    adminStudentsState.logs = Array.isArray(logs) ? logs : [];
    adminStudentsState.logsLoadedAt = Date.now();

    adminStudentsState.loadedAt = Date.now();
    setAdminStudentsStatus("");
    // Derived lists now default to "all students".
    const derived = deriveAdminStudentsSummaries({ teacherId: "", logs: adminStudentsState.logs });
    adminStudentsState.summariesAll = derived.summaries;
    syncAdminStudentsFiltersBadge();
    applyAdminStudentsFilters();
  } catch (error) {
    console.error("[admin] students base load failed:", error);
    if (adminStudentsError instanceof HTMLElement) adminStudentsError.hidden = false;
    setAdminStudentsStatus("Não foi possível carregar agora.", "error");
  } finally {
    adminStudentsState.isLoading = false;
  }
};

const adminStudentsPopulateTeacherSelect = () => {}; // legacy no-op (teacher select removed)

const loadLessonLogsForTeacher = async (teacherId, { force = false } = {}) => {
  const id = String(teacherId || "").trim();
  if (!id) return [];
  await ensureAdminStudentsBaseData({ force });
  const logs = Array.isArray(adminStudentsState.logs) ? adminStudentsState.logs : [];
  return logs.filter((l) => String(l?.professorId || "").trim() === id);
};

const deriveAdminStudentsSummaries = ({ teacherId, logs } = {}) => {
  const tId = String(teacherId || "").trim();
  const events = Array.isArray(adminStudentsState.events) ? adminStudentsState.events : [];
  const logsArr = Array.isArray(logs) ? logs : [];
  const studentsById = adminStudentsState.studentsById instanceof Map ? adminStudentsState.studentsById : new Map();

  const eventsById = new Map();
  events.forEach((evt) => {
    if (!evt || typeof evt !== "object") return;
    if (!evt.id) return;
    eventsById.set(String(evt.id), evt);
  });

  const lastEventByAluno = new Map();
  events.forEach((evt) => {
    if (!evt || typeof evt !== "object") return;
    if (evt.type !== "lesson") return;
    const a = String(evt.alunoId || "").trim();
    if (!a) return;
    if (tId && String(evt.professorId || "") !== tId) return;
    const prev = lastEventByAluno.get(a) || null;
    if (!prev) {
      lastEventByAluno.set(a, evt);
      return;
    }
    const pk = String(prev.dateKey || "");
    const nk = String(evt.dateKey || "");
    if (nk && pk && nk !== pk) {
      if (nk > pk) lastEventByAluno.set(a, evt);
      return;
    }
    const ps = Number(prev.startMin) || 0;
    const ns = Number(evt.startMin) || 0;
    if (ns > ps) lastEventByAluno.set(a, evt);
  });

  const alunoIds = new Set();
  if (!tId) {
    // School-wide: start with all registered students.
    studentsById.forEach((_v, k) => {
      const id = String(k || "").trim();
      if (id) alunoIds.add(id);
    });
    // Also include any student ids present in events/logs even if the user doc is missing.
    events
      .filter((evt) => evt && typeof evt === "object" && evt.type === "lesson" && evt.alunoId)
      .forEach((evt) => alunoIds.add(String(evt.alunoId)));
  } else {
    events
      .filter((evt) => evt && typeof evt === "object" && evt.type === "lesson" && String(evt.professorId || "") === tId)
      .forEach((evt) => {
        const a = String(evt.alunoId || "").trim();
        if (a) alunoIds.add(a);
      });
  }
  logsArr.forEach((log) => {
    const a = String(log?.alunoId || "").trim();
    const p = String(log?.professorId || "").trim();
    if (a && (!tId || p === tId)) alunoIds.add(a);
  });

  const perAluno = new Map();
  logsArr.forEach((log) => {
    if (!log || typeof log !== "object") return;
    if (tId && String(log.professorId || "") !== tId) return;
    const alunoId = String(log.alunoId || "").trim();
    if (!alunoId) return;
    const bucket = perAluno.get(alunoId) || { total: 0, faltas: 0, remarcadas: 0, lastLog: null, lastRisk: "", hasAlert: false };
    bucket.total += 1;
    const status = String(log.statusAula || "").trim().toLowerCase();
    if (status === "falta_aluno") bucket.faltas += 1;
    if (status === "remarcada") bucket.remarcadas += 1;

    const updatedAt = String(log.atualizadoEm || log.criadoEm || "").trim();
    const candidateMs = updatedAt ? Date.parse(updatedAt) : NaN;
    const lastMs = bucket.lastLog?.atualizadoEm ? Date.parse(String(bucket.lastLog.atualizadoEm)) : NaN;
    if (!bucket.lastLog || (Number.isFinite(candidateMs) && (!Number.isFinite(lastMs) || candidateMs > lastMs))) {
      bucket.lastLog = log;
    }

    const risk = String(log?.payload?.riscoEvasao || log?.payload?.risco_evasao || "").trim().toLowerCase();
    if (risk && (risk === "baixo" || risk === "medio" || risk === "médio" || risk === "alto")) {
      bucket.lastRisk = risk;
    }

    const avisos = Array.isArray(log?.payload?.avisosCoordenacao) ? log.payload.avisosCoordenacao : [];
    const needsAlert =
      log?.payload?.precisaIntervencao === true ||
      avisos.some((v) => String(v).startsWith("🔴") || String(v).startsWith("🟡")) ||
      (status === "remarcada" && String(log?.payload?.motivoRemarcacao || "") === "professor_remarcou");
    if (needsAlert) bucket.hasAlert = true;
    perAluno.set(alunoId, bucket);
  });

  const teacherMeta = tId ? (adminStudentsState.teachersById instanceof Map ? adminStudentsState.teachersById.get(tId) || null : null) : null;

  const summaries = Array.from(alunoIds)
    .map((alunoId) => {
      const meta = studentsById.get(alunoId) || null;
      const bucket = perAluno.get(alunoId) || { total: 0, faltas: 0, remarcadas: 0, lastLog: null, lastRisk: "", hasAlert: false };
      const lastLog = bucket.lastLog;
      let lastLabel = "—";
      if (lastLog?.eventId) {
        const evt = eventsById.get(String(lastLog.eventId)) || null;
        if (evt && evt.dateKey) {
          lastLabel = `${formatPedagogicoDate(evt.dateKey)} • ${formatHmFromMinutes(evt.startMin)}–${formatHmFromMinutes(evt.endMin)}`;
        } else if (lastLog.dateKey) {
          lastLabel = formatPedagogicoDate(lastLog.dateKey);
        }
      } else if (lastLog?.dateKey) {
        lastLabel = formatPedagogicoDate(lastLog.dateKey);
      }
      const lastEvent = lastEventByAluno.get(alunoId) || null;
      if (lastLabel === "—" && lastEvent && lastEvent.dateKey) {
        lastLabel = `${formatPedagogicoDate(lastEvent.dateKey)} • ${formatHmFromMinutes(lastEvent.startMin)}–${formatHmFromMinutes(lastEvent.endMin)}`;
      }

      const riskLabel = normalizeRiskLabel(bucket.lastRisk) || "Sem dados";
      const statusLabel = meta ? (meta.ativo ? "Ativo" : "Inativo") : "—";

      const inferredTeacherId =
        tId ||
        String(meta?.professorId || "").trim() ||
        String(lastEvent?.professorId || "").trim() ||
        String(lastLog?.professorId || "").trim() ||
        "";
      const inferredTeacher =
        inferredTeacherId && adminStudentsState.teachersById instanceof Map ? adminStudentsState.teachersById.get(inferredTeacherId) || null : null;

      return {
        alunoId,
        nome: meta?.nome || "Aluno",
        email: meta?.email || "",
        ativo: typeof meta?.ativo === "boolean" ? meta.ativo : true,
        statusLabel,
        teacherId: inferredTeacherId,
        teacherName: inferredTeacher?.nome || teacherMeta?.nome || "—",
        plano: String(meta?.plano || "").trim(),
        pais: String(meta?.pais || "").trim(),
        criadoKey: String(meta?.criadoKey || ""),
        cancelKey: String(meta?.cancelKey || ""),
        criadoLabel: meta?.criadoEm ? formatAdminDate(meta.criadoEm) : "—",
        cancelLabel: meta?.canceladoEm ? formatAdminDate(meta.canceladoEm) : "—",
        lastLessonLabel: lastLabel,
        totalLogs: bucket.total,
        faltas: bucket.faltas,
        remarcadas: bucket.remarcadas,
        riskLabel,
        hasAlert: Boolean(bucket.hasAlert),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return { summaries, logsByAluno: perAluno, eventsById, teacherMeta };
};

const renderAdminStudentsList = () => {
  if (!(adminStudentsList instanceof HTMLElement)) return;
  if (adminStudentsError instanceof HTMLElement) adminStudentsError.hidden = true;

  const summaries = Array.isArray(adminStudentsState.summaries) ? adminStudentsState.summaries : [];

  if (adminStudentsEmpty instanceof HTMLElement) {
    adminStudentsEmpty.hidden = summaries.length > 0;
    if (summaries.length === 0) adminStudentsEmpty.textContent = "Nenhum aluno encontrado.";
  }

  adminStudentsList.innerHTML = summaries
    .map((row) => {
      const alertBadge = row.hasAlert ? `<span class="admin-students-alert">Alerta</span>` : "";
      const statusTone = row.statusLabel === "Ativo" ? "green" : row.statusLabel === "Inativo" ? "gray" : "muted";
      const statusPill = row.statusLabel ? `<span class="admin-students-chip is-${statusTone}">${escapeHtml(row.statusLabel)}</span>` : "";
      const teacherChip =
        row.teacherName && row.teacherName !== "—" ? `<span class="admin-students-chip">${escapeHtml(row.teacherName)}</span>` : "";
      const planChip = row.plano ? `<span class="admin-students-chip">${escapeHtml(row.plano)}</span>` : "";
      const countryChip = row.pais ? `<span class="admin-students-chip is-country">${escapeHtml(row.pais)}</span>` : "";
      const chips = [statusPill, teacherChip, planChip, countryChip].filter(Boolean).join("");

      return `
        <div class="admin-students-row" role="button" tabindex="0" data-admin-student-open="${escapeHtml(row.alunoId)}">
          <div class="admin-students-avatar" aria-hidden="true">${escapeHtml(getInitials(row.nome))}</div>
          <div class="admin-students-main">
            <div class="admin-students-name">
              <span>${escapeHtml(row.nome)}</span>
              ${alertBadge}
            </div>
            <div class="admin-students-emailline">${escapeHtml(row.email || "—")}</div>
            <div class="admin-students-chips">${chips || `<span class="admin-students-chip is-muted">Sem tags</span>`}</div>
          </div>
          <div class="admin-students-right" aria-hidden="true">
            <span class="admin-students-chevron">›</span>
          </div>
          <button class="admin-students-actions-trigger" type="button" aria-label="Ações" data-admin-student-actions-trigger="${escapeHtml(
            row.alunoId
          )}">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6.5 12h.01"></path>
              <path d="M12 12h.01"></path>
              <path d="M17.5 12h.01"></path>
            </svg>
          </button>
        </div>
      `;
    })
    .join("");
};

const getAdminStudentNextLessonLabel = (alunoId) => {
  const aId = String(alunoId || "").trim();
  if (!aId) return "";
  const events = Array.isArray(adminStudentsState.events) ? adminStudentsState.events : [];
  const now = Date.now();
  let best = null;
  events.forEach((evt) => {
    if (!evt || typeof evt !== "object") return;
    if (evt.type !== "lesson") return;
    if (String(evt.alunoId || "").trim() !== aId) return;
    if (!evt.dateKey || !Number.isFinite(Number(evt.startMin)) || !Number.isFinite(Number(evt.endMin))) return;
    const start = buildDateFromDateKeyAndMinutes(evt.dateKey, Number(evt.startMin));
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return;
    const ms = start.getTime();
    if (ms <= now) return;
    if (!best || ms < best.ms) best = { evt, ms };
  });
  if (!best) return "";
  const e = best.evt;
  return `${formatPedagogicoDate(e.dateKey)} • ${formatHmFromMinutes(e.startMin)}–${formatHmFromMinutes(e.endMin)}`;
};

const formatAdminStudentTenure = (criadoKey) => {
  const key = String(criadoKey || "").trim();
  if (!isValidDateKey(key)) return "—";
  const created = parseDateKey(key);
  if (!(created instanceof Date) || Number.isNaN(created.getTime())) return "—";
  const days = Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000));
  if (days >= 60) {
    const months = Math.max(1, Math.round(days / 30));
    return `${months} ${months === 1 ? "mês" : "meses"}`;
  }
  return `${days} ${days === 1 ? "dia" : "dias"}`;
};

const renderAdminStudentSheet = () => {
  if (!(adminStudentHistoryDrawer instanceof HTMLElement)) return;
  const sheetEl = document.querySelector("[data-admin-student-sheet]");
  if (!(sheetEl instanceof HTMLElement)) return;

  const hist = adminStudentsState.history;
  const editMode = Boolean(hist.editMode);
  const alunoMeta = hist.alunoMeta;
  const alunoName = alunoMeta?.nome || "Aluno";
  const alunoEmail = alunoMeta?.email || "";
  const statusLabel = alunoMeta ? (alunoMeta.ativo ? "Ativo" : "Inativo") : "—";
  const teacherName = hist.teacherMeta?.nome || "";
  const planoRaw = String(alunoMeta?.plano || "").trim();
  const hasPlano = Boolean(planoRaw);
  const planoLabel = hasPlano ? planoRaw : "Sem plano";
  const pais = String(alunoMeta?.pais || "").trim();
  const createdKey = String(alunoMeta?.criadoKey || "");
  const createdLabel = alunoMeta?.criadoEm ? formatAdminDate(alunoMeta.criadoEm) : "—";
  const professorResp =
    (alunoMeta && typeof alunoMeta.professorId === "string" ? alunoMeta.professorId : "") ||
    (alunoMeta && typeof alunoMeta.teacherId === "string" ? alunoMeta.teacherId : "") ||
    "";

  const endereco = String(alunoMeta?.endereco || "").trim();
	  const estadoEua = String(alunoMeta?.estadoEua || "").trim();
	  const valorMensalidade = alunoMeta?.valorMensalidade;
	  const tempoContratoRaw = alunoMeta?.tempoContrato;
	  const tempoContrato = Number.isFinite(Number(tempoContratoRaw)) ? String(Number(tempoContratoRaw)) : String(tempoContratoRaw || "").trim();
	  const faixaIdade = String(alunoMeta?.faixaIdade || "").trim();
	  const genero = String(alunoMeta?.genero || "").trim();
	  const trabalho = String(alunoMeta?.trabalho || "").trim();
  const possuiFilhos = String(alunoMeta?.possuiFilhos || "").trim();
  const casado = String(alunoMeta?.casado || "").trim();
  const pretendeVoltarBrasil = String(alunoMeta?.pretendeVoltarBrasil || "").trim();
  const objetivoPrincipal = String(alunoMeta?.objetivoPrincipal || "").trim();
	  const nivelInglesAtual = String(alunoMeta?.nivelInglesAtual || "").trim();

  const initials = getInitials(alunoName);
  const nextLesson = getAdminStudentNextLessonLabel(hist.alunoId) || "Sem dados";
  const tenure = alunoMeta ? formatAdminStudentTenure(createdKey) : "—";

  const activeTab = String(hist.activeTab || "overview");

  const planOptions = ["Turma", "Gold", "Diamond"];
  const countryOptions = ["Brasil", "EUA", "Canadá", "Reino Unido", "Outro"];
  const jobOptions = [
    "Empresário",
    "Micro Empreendedor Limpeza",
    "Micro Empreendedor Construção",
    "Cuida do lar",
    "Motorista de APP",
    "Restaurante/Supermercado",
    "Empreendedor Estética",
    "Multinacional/Emprego renda alta",
    "Estudante",
    "Funcionário Limpeza",
    "Funcionário Construção",
    "Cuidador(a) de idosos",
  ];
	  const ageOptions = ["Menor de idade", "18-24", "25-29", "30-45", "46-59", "60+"];
	  const usStateOptions = [
	    "Massachusetts",
	    "New Jersey",
	    "New York",
	    "Florida",
	    "Califórnia",
	    "Texas",
	    "Connecticut",
	    "Rhode Island",
	    "Pennsylvania",
	    "Georgia",
	    "Outro",
	  ];

	  const normalizeGeneroValue = (value) => {
	    const v = String(value || "").trim().toLowerCase();
	    if (v === "masculino" || v === "m") return "Masculino";
	    if (v === "feminino" || v === "f") return "Feminino";
	    return "";
	  };

	  const normalizeEnglishLevelValue = (value) => {
	    const raw = String(value || "").trim();
	    const low = raw.toLowerCase();
	    // Back-compat: older values from previous versions.
	    if (low === "iniciante") return "Pré A1";
	    if (low === "basico" || low === "básico") return "A1";
	    if (low === "intermediario" || low === "intermediário") return "B1";
	    if (low === "avancado" || low === "avançado") return "B2";
	    if (low === "fluente") return "C1";
	    return raw;
	  };

  const selectOptions = (opts, selected, emptyLabel = "Selecione…") =>
    [`<option value="">${escapeHtml(emptyLabel)}</option>`]
      .concat(
        opts.map((v) => {
          const sel = String(selected || "") === String(v) ? "selected" : "";
          return `<option value="${escapeHtml(String(v))}" ${sel}>${escapeHtml(String(v))}</option>`;
        })
      )
      .join("");

  const yesNoOptions = (selected) =>
    [
      `<option value="">Selecione…</option>`,
      `<option value="sim" ${selected === "sim" ? "selected" : ""}>Sim</option>`,
      `<option value="nao" ${selected === "nao" ? "selected" : ""}>Não</option>`,
    ].join("");

  const returnOptions = (selected) =>
    [
      `<option value="">Selecione…</option>`,
      `<option value="sim" ${selected === "sim" ? "selected" : ""}>Sim</option>`,
      `<option value="nao" ${selected === "nao" ? "selected" : ""}>Não</option>`,
      `<option value="nao_sabe" ${selected === "nao_sabe" ? "selected" : ""}>Não sabe</option>`,
    ].join("");

	  const englishLevelOptionsList = ["Pré A1", "A1", "A1+", "A2", "A2+", "B1", "B1+", "B2", "B2+", "C1", "C2"];
	  const englishOptions = (selectedRaw) => {
	    const selected = normalizeEnglishLevelValue(selectedRaw);
	    return [`<option value="">Selecione…</option>`]
	      .concat(
	        englishLevelOptionsList.map((v) => {
	          const sel = String(selected || "") === String(v) ? "selected" : "";
	          return `<option value="${escapeHtml(String(v))}" ${sel}>${escapeHtml(String(v))}</option>`;
	        })
	      )
	      .join("");
	  };

  sheetEl.innerHTML = `
    <div class="admin-student-sheet-grid">
      <aside class="admin-student-sheet-left" aria-label="Identidade do aluno">
        <div class="admin-student-id">
          <div class="admin-student-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
          <div class="admin-student-id-main">
            <div class="admin-student-name">${escapeHtml(alunoName)}</div>
            <div class="admin-student-email">${escapeHtml(alunoEmail || "—")}</div>
            <div class="admin-student-tags">
              <span class="admin-student-tag is-${statusLabel === "Ativo" ? "green" : "gray"}">${escapeHtml(statusLabel)}</span>
              <span class="admin-student-tag ${hasPlano ? "is-plan" : "is-plan-empty"}">${escapeHtml(planoLabel)}</span>
              ${pais ? `<span class="admin-student-tag is-country">${escapeHtml(pais)}</span>` : ""}
              ${teacherName ? `<span class="admin-student-tag">${escapeHtml(teacherName)}</span>` : ""}
            </div>
          </div>
        </div>

        <div class="admin-student-metrics" aria-label="Métricas-chave">
          <div class="admin-student-metric"><span>Ticket mensal</span><strong>—</strong></div>
          <div class="admin-student-metric"><span>LTV</span><strong>—</strong></div>
          <div class="admin-student-metric"><span>Plano</span><strong>${escapeHtml(planoLabel)}</strong></div>
          <div class="admin-student-metric"><span>Tempo de casa</span><strong>${escapeHtml(tenure)}</strong></div>
          <div class="admin-student-metric"><span>Próxima aula</span><strong>${escapeHtml(nextLesson)}</strong></div>
        </div>

        <div class="admin-student-personal" aria-label="Dados pessoais">
          <div class="admin-student-personal-title">Dados pessoais</div>
          <div class="admin-student-personal-grid">
            <div class="admin-student-personal-row"><span>Professor responsável</span><strong>${escapeHtml(teacherName || professorResp || "—")}</strong></div>
            <div class="admin-student-personal-row"><span>Data de cadastro</span><strong>${escapeHtml(createdLabel)}</strong></div>
          </div>
        </div>

        <div class="admin-student-left-actions" aria-label="Ações do aluno">
          ${
            editMode
              ? `
                <button type="button" class="button button-outline button-small" data-admin-student-edit-cancel>Cancelar</button>
                <button type="button" class="button button-solid button-small" data-admin-student-edit-save>Salvar</button>
              `
              : `
                <button type="button" class="button button-outline button-small" disabled>Editar</button>
                <button type="button" class="button button-solid button-small" disabled>Cancelar matrícula</button>
              `
          }
        </div>
      </aside>

      <section class="admin-student-sheet-right" aria-label="Detalhes do aluno">
        <div class="admin-student-tabs" role="tablist" aria-label="Seções do aluno">
          <button type="button" class="admin-student-tab${activeTab === "overview" ? " is-active" : ""}" data-admin-student-tab="overview" role="tab" aria-selected="${activeTab === "overview" ? "true" : "false"}">Visão geral</button>
          <button type="button" class="admin-student-tab${activeTab === "history" ? " is-active" : ""}" data-admin-student-tab="history" role="tab" aria-selected="${activeTab === "history" ? "true" : "false"}">Histórico pedagógico</button>
          <button type="button" class="admin-student-tab${activeTab === "lessons" ? " is-active" : ""}" data-admin-student-tab="lessons" role="tab" aria-selected="${activeTab === "lessons" ? "true" : "false"}">Aulas</button>
          <button type="button" class="admin-student-tab${activeTab === "financeiro" ? " is-active" : ""}" data-admin-student-tab="financeiro" role="tab" aria-selected="${activeTab === "financeiro" ? "true" : "false"}">Financeiro</button>
          <button type="button" class="admin-student-tab${activeTab === "atividades" ? " is-active" : ""}" data-admin-student-tab="atividades" role="tab" aria-selected="${activeTab === "atividades" ? "true" : "false"}">Atividades</button>
          <button type="button" class="admin-student-tab${activeTab === "arquivos" ? " is-active" : ""}" data-admin-student-tab="arquivos" role="tab" aria-selected="${activeTab === "arquivos" ? "true" : "false"}">Arquivos</button>
        </div>

        <div class="admin-student-tab-panels">
          <div class="admin-student-tab-panel${activeTab === "overview" ? " is-active" : ""}" data-admin-student-tab-panel="overview" role="tabpanel">
            <div class="admin-student-panel-card">
              <div class="admin-student-panel-title">${editMode ? "Editar aluno" : "Resumo"}</div>
              ${
                editMode
                  ? `
                    <div class="admin-student-form" data-admin-student-edit-form>
                      <label class="admin-student-field">
                        <span>Nome completo</span>
                        <input class="admin-student-input" type="text" data-admin-student-edit-field="nome" value="${escapeHtml(alunoName)}" />
                      </label>
                      <label class="admin-student-field">
                        <span>E-mail</span>
                        <input class="admin-student-input" type="email" data-admin-student-edit-field="email" value="${escapeHtml(alunoEmail)}" />
                      </label>
                      <label class="admin-student-field">
                        <span>Endereço</span>
                        <input class="admin-student-input" type="text" data-admin-student-edit-field="endereco" value="${escapeHtml(endereco)}" />
                      </label>
                      <label class="admin-student-field">
                        <span>Plano</span>
                        <select class="admin-student-input" data-admin-student-edit-field="plano">
                          ${selectOptions(planOptions, planoRaw, "Sem plano")}
                        </select>
                      </label>
                      <label class="admin-student-field">
                        <span>País</span>
                        <select class="admin-student-input" data-admin-student-edit-field="pais">
                          ${selectOptions(countryOptions, pais)}
                        </select>
                      </label>
	                      <label class="admin-student-field">
	                        <span>Estado dos EUA (opcional)</span>
	                        <select class="admin-student-input" data-admin-student-edit-field="estadoEua">
	                          ${selectOptions(usStateOptions, estadoEua)}
	                        </select>
	                      </label>
                      <label class="admin-student-field">
                        <span>Valor de mensalidade</span>
                        <input class="admin-student-input" type="text" inputmode="decimal" data-admin-student-edit-field="valorMensalidade" value="${escapeHtml(
                          typeof valorMensalidade === "number" ? String(valorMensalidade) : String(valorMensalidade || "")
                        )}" />
                      </label>
	                      ${(() => {
	                        const contractVal = String(tempoContrato || "").trim();
	                        const normalized = contractVal === "12" || contractVal === "6" ? contractVal : contractVal ? "custom" : "";
	                        const customMonths = normalized === "custom" ? contractVal : "";
	                        return `
	                          <label class="admin-student-field">
	                            <span>Tempo de contrato</span>
	                            <select class="admin-student-input" data-admin-student-edit-field="tempoContrato">
	                              <option value="">Selecione…</option>
	                              <option value="12" ${normalized === "12" ? "selected" : ""}>12 meses</option>
	                              <option value="6" ${normalized === "6" ? "selected" : ""}>6 meses</option>
	                              <option value="custom" ${normalized === "custom" ? "selected" : ""}>Personalizar</option>
	                            </select>
	                          </label>
	                          <label class="admin-student-field" data-admin-student-edit-contract-custom-wrap ${normalized === "custom" ? "" : "hidden"}>
	                            <span>Tempo de contrato (meses)</span>
	                            <input class="admin-student-input" type="number" inputmode="numeric" min="1" step="1" data-admin-student-edit-field="tempoContratoCustom" value="${escapeHtml(
	                              customMonths
	                            )}" />
	                          </label>
	                        `;
	                      })()}
                      <label class="admin-student-field">
                        <span>Faixa de idade</span>
                        <select class="admin-student-input" data-admin-student-edit-field="faixaIdade">
                          ${selectOptions(ageOptions, faixaIdade)}
                        </select>
                      </label>
	                      <label class="admin-student-field">
	                        <span>Gênero</span>
	                        <select class="admin-student-input" data-admin-student-edit-field="genero">
	                          ${selectOptions(["Masculino", "Feminino"], normalizeGeneroValue(genero))}
	                        </select>
	                      </label>
                      <label class="admin-student-field">
                        <span>Trabalho</span>
                        <select class="admin-student-input" data-admin-student-edit-field="trabalho">
                          ${selectOptions(jobOptions, trabalho)}
                        </select>
                      </label>
                      <label class="admin-student-field">
                        <span>Possui filhos</span>
                        <select class="admin-student-input" data-admin-student-edit-field="possuiFilhos">
                          ${yesNoOptions(possuiFilhos)}
                        </select>
                      </label>
                      <label class="admin-student-field">
                        <span>Casado</span>
                        <select class="admin-student-input" data-admin-student-edit-field="casado">
                          ${yesNoOptions(casado)}
                        </select>
                      </label>
                      <label class="admin-student-field">
                        <span>Pretende voltar ao Brasil</span>
                        <select class="admin-student-input" data-admin-student-edit-field="pretendeVoltarBrasil">
                          ${returnOptions(pretendeVoltarBrasil)}
                        </select>
                      </label>
                      <label class="admin-student-field admin-student-field-wide">
                        <span>Objetivo principal</span>
                        <textarea class="admin-student-input admin-student-textarea" rows="3" data-admin-student-edit-field="objetivoPrincipal">${escapeHtml(
                          objetivoPrincipal
                        )}</textarea>
                      </label>
                      <label class="admin-student-field">
                        <span>Nível de inglês atual</span>
                        <select class="admin-student-input" data-admin-student-edit-field="nivelInglesAtual">
                          ${englishOptions(nivelInglesAtual)}
                        </select>
                      </label>
                      <div class="admin-student-edit-error" data-admin-student-edit-error hidden>—</div>
                    </div>
                  `
                  : `
                    <div class="admin-student-panel-empty">Selecione a tab Histórico pedagógico para ver detalhes das aulas registradas.</div>
                  `
              }
            </div>
          </div>

          <div class="admin-student-tab-panel${activeTab === "history" ? " is-active" : ""}" data-admin-student-tab-panel="history" role="tabpanel">
            <div class="admin-students-history-filters" role="tablist" aria-label="Filtrar histórico do aluno">
              <button class="admin-students-history-filter is-active" type="button" role="tab" aria-selected="true" data-admin-student-history-filter="all">Todos</button>
              <button class="admin-students-history-filter" type="button" role="tab" aria-selected="false" data-admin-student-history-filter="realizada">Realizadas</button>
              <button class="admin-students-history-filter" type="button" role="tab" aria-selected="false" data-admin-student-history-filter="falta_aluno">Faltas</button>
              <button class="admin-students-history-filter" type="button" role="tab" aria-selected="false" data-admin-student-history-filter="remarcada">Remarcadas</button>
              <button class="admin-students-history-filter" type="button" role="tab" aria-selected="false" data-admin-student-history-filter="alerts">Alertas</button>
            </div>

            <div class="admin-students-history" data-admin-student-history-body></div>
            <div class="admin-students-history-empty" data-admin-student-history-empty hidden>Nenhum registro pedagógico encontrado para este aluno.</div>
          </div>

          <div class="admin-student-tab-panel${activeTab === "lessons" ? " is-active" : ""}" data-admin-student-tab-panel="lessons" role="tabpanel">
            <div class="admin-student-panel-card">
              <div class="admin-student-panel-title">Aulas</div>
              <div class="admin-student-panel-empty">Em breve: agenda e histórico completo de aulas.</div>
            </div>
          </div>

          <div class="admin-student-tab-panel${activeTab === "financeiro" ? " is-active" : ""}" data-admin-student-tab-panel="financeiro" role="tabpanel">
            <div class="admin-student-panel-card">
              <div class="admin-student-panel-title">Financeiro</div>
              <div class="admin-student-panel-note">Integração financeira em construção, em breve com Asaas.</div>
              <div class="admin-student-fin-grid">
                <div class="admin-student-fin-card"><span>Plano atual</span><strong>—</strong></div>
                <div class="admin-student-fin-card"><span>Mensalidade</span><strong>—</strong></div>
                <div class="admin-student-fin-card"><span>Próxima cobrança</span><strong>—</strong></div>
                <div class="admin-student-fin-card"><span>Total inadimplente</span><strong>—</strong></div>
              </div>
              <div class="admin-student-fin-table-empty">Nenhuma cobrança disponível.</div>
              <div class="admin-student-fin-timeline-empty">Nenhuma mudança de plano registrada.</div>
            </div>
          </div>

          <div class="admin-student-tab-panel${activeTab === "atividades" ? " is-active" : ""}" data-admin-student-tab-panel="atividades" role="tabpanel">
            <div class="admin-student-panel-card">
              <div class="admin-student-panel-title">Atividades</div>
              <div class="admin-student-panel-empty">Sem atividades registradas.</div>
            </div>
          </div>

          <div class="admin-student-tab-panel${activeTab === "arquivos" ? " is-active" : ""}" data-admin-student-tab-panel="arquivos" role="tabpanel">
            <div data-admin-student-files></div>
          </div>
        </div>
      </section>
    </div>
  `;

  // Always hydrate the history tab content so it's ready when the admin switches tabs.
  renderAdminStudentHistoryTab();
  renderAdminStudentFilesTab();
};

const syncAdminStudentSheetTabs = () => {
  const sheetEl = document.querySelector("[data-admin-student-sheet]");
  if (!(sheetEl instanceof HTMLElement)) return;
  const active = String(adminStudentsState.history?.activeTab || "overview");

  sheetEl.querySelectorAll("[data-admin-student-tab]").forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const isActive = String(btn.getAttribute("data-admin-student-tab") || "") === active;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  sheetEl.querySelectorAll("[data-admin-student-tab-panel]").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    const isActive = String(panel.getAttribute("data-admin-student-tab-panel") || "") === active;
    panel.classList.toggle("is-active", isActive);
  });

  if (active === "history") {
    renderAdminStudentHistoryTab();
  }
};

const renderAdminStudentsPanel = async ({ force = false } = {}) => {
  if (currentRole !== "admin") return;
  if (!(adminStudentsList instanceof HTMLElement)) return;
  await ensureAdminStudentsBaseData({ force });
  renderAdminStudentsList();
};

// Admin > Controle Pedagógico (gestão de aulas recorrentes/templates)
let adminPedagogicoState = {
  isLoading: false,
  loadedAt: 0,
  teachers: [],
  teachersById: new Map(),
  students: [],
  studentsById: new Map(),
  classes: [],
  filters: {
    teacherId: "",
    dow: "",
    type: "",
    studentId: "",
    status: "",
    plan: "",
  },
  activeTab: "agenda", // agenda | aulas | turmas | professores | conflitos
  conflicts: [],
};

const setAdminPedagogicoStatus = (text, tone = "") => {
  if (!(adminPedStatus instanceof HTMLElement)) return;
  adminPedStatus.textContent = String(text || "");
  adminPedStatus.dataset.tone = String(tone || "");
};

const normalizeClassType = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "group" || raw === "grupo" || raw === "em_grupo") return "group";
  return "individual";
};

const normalizeClassStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "paused" || raw === "pausada" || raw === "pausado") return "paused";
  if (raw === "ended" || raw === "encerrada" || raw === "encerrado" || raw === "inativa" || raw === "inativo") return "ended";
  return "active";
};

const normalizePlanKeyLoose = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("diamond")) return "diamond";
  if (raw.includes("gold")) return "gold";
  if (raw.includes("turma")) return "turma";
  return raw;
};

const normalizeDaysOfWeek = (value) => {
  const out = [];
  const arr = Array.isArray(value) ? value : [];
  arr.forEach((item) => {
    const n = Number(item);
    if (Number.isFinite(n) && n >= 0 && n <= 6) {
      if (!out.includes(n)) out.push(n);
      return;
    }
    const raw = String(item || "").trim().toLowerCase();
    const map = {
      mon: 1,
      monday: 1,
      seg: 1,
      tue: 2,
      tuesday: 2,
      ter: 2,
      wed: 3,
      wednesday: 3,
      qua: 3,
      thu: 4,
      thursday: 4,
      qui: 4,
      fri: 5,
      friday: 5,
      sex: 5,
      sat: 6,
      saturday: 6,
      sab: 6,
      dom: 0,
      sun: 0,
      sunday: 0,
    };
    const dow = map[raw];
    if (dow != null && !out.includes(dow)) out.push(dow);
  });
  out.sort((a, b) => a - b);
  return out;
};

const normalizeMinutesValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return clampInt(Math.round(value), 0, 24 * 60, 0);
  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (/^\d{2}:\d{2}$/.test(raw)) {
    const mins = timeToMinutes(raw);
    return Number.isFinite(mins) ? clampInt(mins, 0, 24 * 60, 0) : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? clampInt(Math.round(n), 0, 24 * 60, 0) : 0;
};

const normalizeClassRow = ({ id, data }) => {
  const docId = String(id || "").trim();
  const src = data && typeof data === "object" ? data : {};
  if (!docId) return null;

  const type = normalizeClassType(src.type);
  const status = normalizeClassStatus(src.status);
  const title = String(src.title || "").trim();
  const teacherId = String(src.teacherId || src.professorId || "").trim();
  const teacherName = String(src.teacherName || src.professorNome || src.professorName || "").trim();
  const groupName = String(src.groupName || "").trim();
  const plan = normalizePlanKeyLoose(src.plan || src.plano || "");
  const daysOfWeek = normalizeDaysOfWeek(src.daysOfWeek || src.weekDays || src.diasSemana || []);
  const startMin = normalizeMinutesValue(src.startMin ?? src.startTime ?? src.horaInicio);
  const endMin = normalizeMinutesValue(src.endMin ?? src.endTime ?? src.horaFim);
  const startDate = String(src.startDate || src.startDateKey || src.dateKey || "").trim();
  const endDate = String(src.endDate || src.endDateKey || "").trim();

  const studentIdsRaw = Array.isArray(src.studentIds) ? src.studentIds : Array.isArray(src.alunoIds) ? src.alunoIds : [];
  const studentIds = studentIdsRaw.map((v) => String(v || "").trim()).filter(Boolean);
  const studentNamesRaw = Array.isArray(src.studentNames) ? src.studentNames : Array.isArray(src.alunoNomes) ? src.alunoNomes : [];
  const studentNames = studentNamesRaw.map((v) => String(v || "").trim()).filter(Boolean);

  const createdAtMs = parseFirestoreDateToMs(src.createdAt || src.criadoEm);
  const updatedAtMs = parseFirestoreDateToMs(src.updatedAt || src.atualizadoEm);

  return {
    id: docId,
    type,
    status,
    title,
    teacherId,
    teacherName,
    groupName,
    plan,
    daysOfWeek,
    startMin,
    endMin,
    startDate: isValidDateKey(startDate) ? startDate : "",
    endDate: isValidDateKey(endDate) ? endDate : "",
    studentIds,
    studentNames,
    notes: String(src.notes || src.observacoes || "").trim(),
    createdAtMs,
    updatedAtMs,
    createdBy: String(src.createdBy || "").trim(),
    updatedBy: String(src.updatedBy || "").trim(),
  };
};

const fetchClassesFromFirestore = async () => {
  const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_pedagogico");
  const user = await waitForFirebaseAuthReady(firebase, 5000);
  if (!user) {
    const e = new Error("firebase_not_authenticated");
    e.code = "auth/no-current-user";
    throw e;
  }

  const col = firebase.collection(firebase.primaryDb, "classes");
  const snap = await withTimeout(firebase.getDocs(col), 12_000, "firestore_admin_classes_list");
  const rows = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data ? docSnap.data() : null;
    const row = normalizeClassRow({ id: docSnap.id, data });
    if (row) rows.push(row);
  });
  rows.sort((a, b) => {
    const ta = String(a.teacherName || "").localeCompare(String(b.teacherName || ""), "pt-BR");
    if (ta) return ta;
    const sa = (a.startMin || 0) - (b.startMin || 0);
    if (sa) return sa;
    return String(a.id).localeCompare(String(b.id));
  });
  return rows;
};

const daysLabelShort = (dow) => {
  const n = Number(dow);
  if (n === 1) return "Seg";
  if (n === 2) return "Ter";
  if (n === 3) return "Qua";
  if (n === 4) return "Qui";
  if (n === 5) return "Sex";
  if (n === 6) return "Sáb";
  if (n === 0) return "Dom";
  return "—";
};

const classesOverlap = (a, b) => {
  const aStart = Number(a?.startMin) || 0;
  const aEnd = Number(a?.endMin) || 0;
  const bStart = Number(b?.startMin) || 0;
  const bEnd = Number(b?.endMin) || 0;
  return aStart < bEnd && bStart < aEnd;
};

const classDateRangesOverlap = (a, b) => {
  const aStart = String(a?.startDate || "");
  const aEnd = String(a?.endDate || "");
  const bStart = String(b?.startDate || "");
  const bEnd = String(b?.endDate || "");
  const aTo = aEnd && isValidDateKey(aEnd) ? aEnd : "9999-12-31";
  const bTo = bEnd && isValidDateKey(bEnd) ? bEnd : "9999-12-31";
  const aFrom = aStart && isValidDateKey(aStart) ? aStart : "0000-01-01";
  const bFrom = bStart && isValidDateKey(bStart) ? bStart : "0000-01-01";
  return aFrom <= bTo && bFrom <= aTo;
};

const computeAdminPedagogicoConflicts = (classes) => {
  const arr = Array.isArray(classes) ? classes : [];
  const active = arr.filter((c) => c && normalizeClassStatus(c.status) !== "ended");
  const conflicts = [];
  for (let i = 0; i < active.length; i += 1) {
    const a = active[i];
    for (let j = i + 1; j < active.length; j += 1) {
      const b = active[j];
      if (!a || !b) continue;
      if (!classDateRangesOverlap(a, b)) continue;
      const aDays = new Set(Array.isArray(a.daysOfWeek) ? a.daysOfWeek : []);
      const bDays = new Set(Array.isArray(b.daysOfWeek) ? b.daysOfWeek : []);
      const hasDay = [...aDays].some((d) => bDays.has(d));
      if (!hasDay) continue;
      if (!classesOverlap(a, b)) continue;

      const isTeacherConflict = a.teacherId && b.teacherId && a.teacherId === b.teacherId;
      const aStudents = new Set(Array.isArray(a.studentIds) ? a.studentIds : []);
      const bStudents = new Set(Array.isArray(b.studentIds) ? b.studentIds : []);
      const sharedStudents = [...aStudents].filter((id) => bStudents.has(id));
      const isStudentConflict = sharedStudents.length > 0;

      if (!isTeacherConflict && !isStudentConflict) continue;

      const reason = isTeacherConflict
        ? "Professor com duas aulas no mesmo horário"
        : "Aluno com duas aulas no mesmo horário";

      conflicts.push({
        reason,
        teacherId: a.teacherId || b.teacherId || "",
        classA: a,
        classB: b,
        sharedStudents,
      });
    }
  }
  return conflicts;
};

const adminPedagogicoFilteredClasses = () => {
  const all = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  const f = adminPedagogicoState.filters || {};
  const teacherId = String(f.teacherId || "").trim();
  const dow = String(f.dow || "").trim();
  const type = String(f.type || "").trim().toLowerCase();
  const studentId = String(f.studentId || "").trim();
  const status = String(f.status || "").trim().toLowerCase();
  const plan = String(f.plan || "").trim().toLowerCase();

  return all.filter((c) => {
    if (!c) return false;
    if (teacherId && String(c.teacherId || "") !== teacherId) return false;
    if (dow) {
      const n = Number(dow);
      const days = Array.isArray(c.daysOfWeek) ? c.daysOfWeek : [];
      if (!Number.isFinite(n) || !days.includes(n)) return false;
    }
    if (type && String(c.type || "") !== type) return false;
    if (studentId) {
      const ids = Array.isArray(c.studentIds) ? c.studentIds : [];
      if (!ids.includes(studentId)) return false;
    }
    if (status && String(c.status || "") !== status) return false;
    if (plan && String(c.plan || "").toLowerCase() !== plan) return false;
    return true;
  });
};

const renderAdminPedagogicoMetrics = () => {
  const classes = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  const active = classes.filter((c) => normalizeClassStatus(c?.status) === "active");
  const individual = classes.filter((c) => normalizeClassType(c?.type) === "individual");
  const group = classes.filter((c) => normalizeClassType(c?.type) === "group");
  const teacherIds = new Set(active.map((c) => String(c.teacherId || "")).filter(Boolean));
  const conflicts = Array.isArray(adminPedagogicoState.conflicts) ? adminPedagogicoState.conflicts : [];

  const setMetric = (key, value) => {
    const el = document.querySelector(`[data-admin-ped-metric="${CSS.escape(String(key))}"]`);
    if (el instanceof HTMLElement) el.textContent = value;
  };
  setMetric("active", active.length ? String(active.length) : "0");
  setMetric("individual", individual.length ? String(individual.length) : "0");
  setMetric("group", group.length ? String(group.length) : "0");
  setMetric("teachers", teacherIds.size ? String(teacherIds.size) : "0");
  setMetric("conflicts", conflicts.length ? String(conflicts.length) : "0");
};

const renderAdminPedagogicoTabs = () => {
  const activeTab = String(adminPedagogicoState.activeTab || "agenda");
  document.querySelectorAll("[data-admin-ped-tab]").forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const tab = String(btn.getAttribute("data-admin-ped-tab") || "");
    const isActive = tab === activeTab;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll("[data-admin-ped-panel]").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    const name = String(panel.getAttribute("data-admin-ped-panel") || "");
    const isActive = name === activeTab;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
};

const renderAdminPedagogicoAgenda = () => {
  if (!(adminPedAgenda instanceof HTMLElement)) return;
  const classes = adminPedagogicoFilteredClasses();
  if (adminPedError instanceof HTMLElement) adminPedError.hidden = true;

  if (!classes.length) {
    adminPedAgenda.innerHTML = "";
    if (adminPedEmpty instanceof HTMLElement) adminPedEmpty.hidden = false;
    return;
  }
  if (adminPedEmpty instanceof HTMLElement) adminPedEmpty.hidden = true;

  const teachersById = adminPedagogicoState.teachersById instanceof Map ? adminPedagogicoState.teachersById : new Map();
  const byTeacher = new Map();
  classes.forEach((c) => {
    const tid = String(c.teacherId || "");
    if (!byTeacher.has(tid)) byTeacher.set(tid, []);
    byTeacher.get(tid).push(c);
  });

  const sortedTeacherIds = [...byTeacher.keys()].sort((a, b) => {
    const an = String(teachersById.get(a)?.nome || teachersById.get(a)?.name || "");
    const bn = String(teachersById.get(b)?.nome || teachersById.get(b)?.name || "");
    return an.localeCompare(bn, "pt-BR");
  });

  const days = [1, 2, 3, 4, 5, 6];
  adminPedAgenda.innerHTML = sortedTeacherIds
    .map((teacherId) => {
      const teacher = teachersById.get(teacherId) || {};
      const teacherName = String(teacher.nome || teacher.name || "Professor").trim() || "Professor";
      const items = byTeacher.get(teacherId) || [];

      const dayBuckets = new Map(days.map((d) => [d, []]));
      items.forEach((c) => {
        (Array.isArray(c.daysOfWeek) ? c.daysOfWeek : []).forEach((d) => {
          if (!dayBuckets.has(d)) return;
          dayBuckets.get(d).push(c);
        });
      });
      days.forEach((d) => {
        dayBuckets.get(d).sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
      });

      const dayCols = days
        .map((d) => {
          const list = dayBuckets.get(d) || [];
          const listHtml = list
            .map((c) => {
              const time = `${formatHmFromMinutes(c.startMin)}–${formatHmFromMinutes(c.endMin)}`;
              const status = normalizeClassStatus(c.status);
              const statusLabel = status === "active" ? "Ativa" : status === "paused" ? "Pausada" : "Encerrada";
              const badgeClass = status === "active" ? "is-active" : status === "paused" ? "is-paused" : "is-ended";
              const typeLabel = c.type === "group" ? "Grupo" : "Individual";
              const who =
                c.type === "group"
                  ? `${(Array.isArray(c.studentIds) ? c.studentIds.length : 0) || 0} alunos`
                  : (c.studentNames && c.studentNames[0]) || (c.studentIds && c.studentIds[0]) || "Aluno";
              const plan = c.plan ? String(c.plan).toUpperCase() : "";
              return `
                <button class="admin-ped-slot" type="button" data-admin-ped-class-open="${escapeHtml(c.id)}">
                  <div class="admin-ped-slot-top">
                    <span class="admin-ped-slot-time">${escapeHtml(time)}</span>
                    <span class="admin-ped-slot-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
                  </div>
                  <div class="admin-ped-slot-title">${escapeHtml(c.title || typeLabel)}</div>
                  <div class="admin-ped-slot-meta">${escapeHtml(who)}${plan ? ` · ${escapeHtml(plan)}` : ""}</div>
                </button>
              `;
            })
            .join("");

          return `
            <div class="admin-ped-day-col">
              <div class="admin-ped-day-head">${escapeHtml(daysLabelShort(d))}</div>
              <div class="admin-ped-day-items">${listHtml || `<div class="admin-ped-day-empty">—</div>`}</div>
            </div>
          `;
        })
        .join("");

      return `
        <article class="admin-ped-teacher-block">
          <header class="admin-ped-teacher-head">${escapeHtml(teacherName)}</header>
          <div class="admin-ped-week">${dayCols}</div>
        </article>
      `;
    })
    .join("");
};

const renderAdminPedagogicoClassesList = () => {
  if (!(adminPedClasses instanceof HTMLElement)) return;
  const classes = adminPedagogicoFilteredClasses();
  if (adminPedEmptyClasses instanceof HTMLElement) adminPedEmptyClasses.hidden = classes.length > 0;
  adminPedClasses.innerHTML = classes
    .map((c) => {
      const typeLabel = c.type === "group" ? "Grupo" : "Individual";
      const status = normalizeClassStatus(c.status);
      const statusLabel = status === "active" ? "Ativa" : status === "paused" ? "Pausada" : "Encerrada";
      const badgeClass = status === "active" ? "is-active" : status === "paused" ? "is-paused" : "is-ended";
      const whenDays = (Array.isArray(c.daysOfWeek) ? c.daysOfWeek : []).map(daysLabelShort).join(", ");
      const time = `${formatHmFromMinutes(c.startMin)}–${formatHmFromMinutes(c.endMin)}`;
      const who =
        c.type === "group"
          ? `${(Array.isArray(c.studentIds) ? c.studentIds.length : 0) || 0} alunos`
          : (c.studentNames && c.studentNames[0]) || (c.studentIds && c.studentIds[0]) || "Aluno";
      return `
        <div class="admin-ped-class-row">
          <div class="admin-ped-class-main">
            <div class="admin-ped-class-title">${escapeHtml(c.title || typeLabel)}</div>
            <div class="admin-ped-class-sub">${escapeHtml(whenDays)} · ${escapeHtml(time)} · ${escapeHtml(who)}</div>
          </div>
          <div class="admin-ped-class-meta">
            <span class="admin-ped-pill ${badgeClass}">${escapeHtml(statusLabel)}</span>
            ${c.plan ? `<span class="admin-ped-pill is-plan">${escapeHtml(String(c.plan).toUpperCase())}</span>` : ""}
          </div>
          <div class="admin-ped-class-actions">
            <button class="admin-ped-action" type="button" data-admin-ped-class-edit="${escapeHtml(c.id)}">Editar</button>
            <button class="admin-ped-action is-muted" type="button" data-admin-ped-class-toggle="${escapeHtml(c.id)}">${status === "active" ? "Desativar" : "Ativar"}</button>
            <button class="admin-ped-action is-danger" type="button" data-admin-ped-class-delete="${escapeHtml(c.id)}">Excluir</button>
          </div>
        </div>
      `;
    })
    .join("");
};

const renderAdminPedagogicoTeachersPanel = () => {
  if (!(adminPedTeachers instanceof HTMLElement)) return;
  const teachers = Array.isArray(adminPedagogicoState.teachers) ? adminPedagogicoState.teachers : [];
  const classes = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  const byTeacher = new Map();
  classes.forEach((c) => {
    const tid = String(c.teacherId || "");
    if (!tid) return;
    if (!byTeacher.has(tid)) byTeacher.set(tid, []);
    byTeacher.get(tid).push(c);
  });

  adminPedTeachers.innerHTML = teachers
    .slice()
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
    .map((t) => {
      const list = byTeacher.get(String(t.id || "")) || [];
      const total = list.length;
      const indiv = list.filter((c) => c.type === "individual").length;
      const group = list.filter((c) => c.type === "group").length;
      const students = new Set();
      list.forEach((c) => (Array.isArray(c.studentIds) ? c.studentIds : []).forEach((id) => students.add(id)));
      return `
        <div class="admin-ped-teacher-row">
          <div class="admin-ped-teacher-name">${escapeHtml(String(t.nome || "Professor"))}</div>
          <div class="admin-ped-teacher-stats">
            <span>${escapeHtml(String(total))} aulas</span>
            <span>${escapeHtml(String(indiv))} individuais</span>
            <span>${escapeHtml(String(group))} grupos</span>
            <span>${escapeHtml(String(students.size))} alunos</span>
          </div>
        </div>
      `;
    })
    .join("");
};

const renderAdminPedagogicoConflicts = () => {
  if (!(adminPedConflicts instanceof HTMLElement)) return;
  const conflicts = Array.isArray(adminPedagogicoState.conflicts) ? adminPedagogicoState.conflicts : [];
  if (adminPedEmptyConflicts instanceof HTMLElement) adminPedEmptyConflicts.hidden = conflicts.length > 0;
  adminPedConflicts.innerHTML = conflicts
    .map((c) => {
      const a = c.classA || {};
      const b = c.classB || {};
      const day = (() => {
        const setA = new Set(Array.isArray(a.daysOfWeek) ? a.daysOfWeek : []);
        const setB = new Set(Array.isArray(b.daysOfWeek) ? b.daysOfWeek : []);
        const shared = [...setA].find((d) => setB.has(d));
        return shared != null ? daysLabelShort(shared) : "—";
      })();
      const time = `${formatHmFromMinutes(a.startMin)}–${formatHmFromMinutes(a.endMin)}`;
      return `
        <div class="admin-ped-conflict-row">
          <div class="admin-ped-conflict-title">${escapeHtml(c.reason || "Conflito")}</div>
          <div class="admin-ped-conflict-sub">${escapeHtml(day)} · ${escapeHtml(time)}</div>
          <div class="admin-ped-conflict-meta">
            <button class="admin-ped-action" type="button" data-admin-ped-class-edit="${escapeHtml(a.id || "")}">Ver aula A</button>
            <button class="admin-ped-action" type="button" data-admin-ped-class-edit="${escapeHtml(b.id || "")}">Ver aula B</button>
          </div>
        </div>
      `;
    })
    .join("");
};

const renderAdminControlePedagogicoPanel = async ({ force = false } = {}) => {
  if (currentRole !== "admin") return;
  if (!(adminPedRoot instanceof HTMLElement)) return;
  if (adminPedagogicoState.isLoading) return;

  const now = Date.now();
  if (!force && adminPedagogicoState.loadedAt && now - adminPedagogicoState.loadedAt < 45_000) {
    renderAdminPedagogicoMetrics();
    renderAdminPedagogicoTabs();
    renderAdminPedagogicoAgenda();
    renderAdminPedagogicoClassesList();
    renderAdminPedagogicoTeachersPanel();
    renderAdminPedagogicoConflicts();
    return;
  }

  adminPedagogicoState.isLoading = true;
  setAdminPedagogicoStatus("Carregando…");
  if (adminPedError instanceof HTMLElement) adminPedError.hidden = true;

  try {
    const [teachers, students, classes] = await Promise.all([
      fetchUserRowsFromFirestore("teacher"),
      fetchUserRowsFromFirestore("student"),
      fetchClassesFromFirestore(),
    ]);

    adminPedagogicoState.teachers = teachers.filter((t) => t && typeof t === "object");
    adminPedagogicoState.teachersById = new Map(adminPedagogicoState.teachers.map((t) => [String(t.id || ""), t]));
    adminPedagogicoState.students = students.filter((s) => s && typeof s === "object");
    adminPedagogicoState.studentsById = new Map(adminPedagogicoState.students.map((s) => [String(s.id || ""), s]));
    adminPedagogicoState.classes = Array.isArray(classes) ? classes : [];
    adminPedagogicoState.conflicts = computeAdminPedagogicoConflicts(adminPedagogicoState.classes);
    adminPedagogicoState.loadedAt = Date.now();

    const teacherSelect = adminPedRoot.querySelector('[data-admin-ped-filter="teacherId"]');
    if (teacherSelect instanceof HTMLSelectElement) {
      const selected = String(adminPedagogicoState.filters.teacherId || "");
      teacherSelect.innerHTML =
        `<option value="">Todos</option>` +
        adminPedagogicoState.teachers
          .slice()
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
          .map((t) => `<option value="${escapeHtml(String(t.id))}">${escapeHtml(String(t.nome || "Professor"))}</option>`)
          .join("");
      teacherSelect.value = selected;
    }

    const studentSelect = adminPedRoot.querySelector('[data-admin-ped-filter="studentId"]');
    if (studentSelect instanceof HTMLSelectElement) {
      const selected = String(adminPedagogicoState.filters.studentId || "");
      studentSelect.innerHTML =
        `<option value="">Todos</option>` +
        adminPedagogicoState.students
          .slice()
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
          .map((s) => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(String(s.nome || "Aluno"))}</option>`)
          .join("");
      studentSelect.value = selected;
    }

    setAdminPedagogicoStatus("");
    renderAdminPedagogicoMetrics();
    renderAdminPedagogicoTabs();
    renderAdminPedagogicoAgenda();
    renderAdminPedagogicoClassesList();
    renderAdminPedagogicoTeachersPanel();
    renderAdminPedagogicoConflicts();
  } catch (error) {
    console.error("[admin] controle-pedagogico load failed:", error);
    setAdminPedagogicoStatus("Não foi possível carregar agora.", "error");
    if (adminPedError instanceof HTMLElement) adminPedError.hidden = false;
  } finally {
    adminPedagogicoState.isLoading = false;
  }
};

const findAdminPedClassById = (id) => {
  const safe = String(id || "").trim();
  if (!safe) return null;
  const arr = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
  return arr.find((c) => String(c?.id || "") === safe) || null;
};

const buildAdminPedDaysCheckboxesHtml = (selectedDays) => {
  const set = new Set(Array.isArray(selectedDays) ? selectedDays : []);
  const defs = [
    { d: 1, label: "Seg" },
    { d: 2, label: "Ter" },
    { d: 3, label: "Qua" },
    { d: 4, label: "Qui" },
    { d: 5, label: "Sex" },
    { d: 6, label: "Sáb" },
  ];
  return defs
    .map(
      (it) => `
      <label class="admin-ped-day">
        <input type="checkbox" value="${it.d}" ${set.has(it.d) ? "checked" : ""} data-admin-ped-day />
        <span>${escapeHtml(it.label)}</span>
      </label>
    `
    )
    .join("");
};

const openAdminPedClassModal = ({ mode = "create", classRow = null } = {}) => {
  const isEdit = mode === "edit" && classRow && classRow.id;
  const row = classRow && typeof classRow === "object" ? classRow : null;

  const teachers = Array.isArray(adminPedagogicoState.teachers) ? adminPedagogicoState.teachers : [];
  const students = Array.isArray(adminPedagogicoState.students) ? adminPedagogicoState.students : [];

  const teacherOptions =
    `<option value="">Selecione...</option>` +
    teachers
      .slice()
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
      .map((t) => `<option value="${escapeHtml(String(t.id))}">${escapeHtml(String(t.nome || "Professor"))}</option>`)
      .join("");

  const planOptions = `
    <option value="">Selecione...</option>
    <option value="turma">Turma</option>
    <option value="gold">Gold</option>
    <option value="diamond">Diamond</option>
  `;

  const statusOptions = `
    <option value="active">Ativa</option>
    <option value="paused">Pausada</option>
    <option value="ended">Encerrada</option>
  `;

  const typeValue = isEdit ? normalizeClassType(row.type) : "individual";
  const statusValue = isEdit ? normalizeClassStatus(row.status) : "active";
  const teacherValue = isEdit ? String(row.teacherId || "") : "";
  const planValue = isEdit ? normalizePlanKeyLoose(row.plan) : "";
  const titleValue = isEdit ? String(row.title || "") : "";
  const groupNameValue = isEdit ? String(row.groupName || "") : "";
  const startDate = isEdit ? String(row.startDate || "") : createDateKey(new Date());
  const endDate = isEdit ? String(row.endDate || "") : "";
  const startTime = isEdit ? formatHmFromMinutes(row.startMin || 0) : "14:00";
  const endTime = isEdit ? formatHmFromMinutes(row.endMin || 0) : "14:30";
  const selectedDays = isEdit ? normalizeDaysOfWeek(row.daysOfWeek) : [1];
  const selectedStudents = isEdit ? new Set((Array.isArray(row.studentIds) ? row.studentIds : []).map(String)) : new Set();

  const studentsHtml = students
    .slice()
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
    .map((s) => {
      const id = String(s.id || "");
      const checked = selectedStudents.has(id);
      return `
        <label class="admin-ped-student">
          <input type="checkbox" value="${escapeHtml(id)}" ${checked ? "checked" : ""} data-admin-ped-student />
          <span>${escapeHtml(String(s.nome || "Aluno"))}</span>
        </label>
      `;
    })
    .join("");

  openModal({
    title: isEdit ? "Editar aula" : "Criar aula",
    bodyHtml: `
      <div class="admin-ped-modal" data-admin-ped-class-form>
        <div class="admin-ped-modal-row">
          <label class="admin-ped-modal-field">
            <span>Tipo de aula</span>
            <select class="admin-ped-modal-select" data-admin-ped-field="type">
              <option value="individual">Individual</option>
              <option value="group">Grupo</option>
            </select>
          </label>
          <label class="admin-ped-modal-field">
            <span>Professor</span>
            <select class="admin-ped-modal-select" data-admin-ped-field="teacherId">
              ${teacherOptions}
            </select>
          </label>
        </div>

        <label class="admin-ped-modal-field">
          <span>Título (opcional)</span>
          <input class="admin-ped-modal-input" type="text" data-admin-ped-field="title" placeholder="Ex: Conversação" />
        </label>

        <label class="admin-ped-modal-field admin-ped-modal-group" data-admin-ped-group-name>
          <span>Nome da turma (somente grupo)</span>
          <input class="admin-ped-modal-input" type="text" data-admin-ped-field="groupName" placeholder="Ex: Turma 01" />
        </label>

        <div class="admin-ped-modal-row">
          <label class="admin-ped-modal-field">
            <span>Plano</span>
            <select class="admin-ped-modal-select" data-admin-ped-field="plan">
              ${planOptions}
            </select>
          </label>
          <label class="admin-ped-modal-field">
            <span>Status</span>
            <select class="admin-ped-modal-select" data-admin-ped-field="status">
              ${statusOptions}
            </select>
          </label>
        </div>

        <div class="admin-ped-modal-field">
          <span>Dias da semana</span>
          <div class="admin-ped-days" data-admin-ped-days>
            ${buildAdminPedDaysCheckboxesHtml(selectedDays)}
          </div>
        </div>

        <div class="admin-ped-modal-row">
          <label class="admin-ped-modal-field">
            <span>Início</span>
            <input class="admin-ped-modal-input" type="time" data-admin-ped-field="startTime" />
          </label>
          <label class="admin-ped-modal-field">
            <span>Fim</span>
            <input class="admin-ped-modal-input" type="time" data-admin-ped-field="endTime" />
          </label>
        </div>

        <div class="admin-ped-modal-row">
          <label class="admin-ped-modal-field">
            <span>Data de início</span>
            <input class="admin-ped-modal-input" type="date" data-admin-ped-field="startDate" />
          </label>
          <label class="admin-ped-modal-field">
            <span>Data de término (opcional)</span>
            <input class="admin-ped-modal-input" type="date" data-admin-ped-field="endDate" />
          </label>
        </div>

        <div class="admin-ped-modal-field">
          <span>Alunos</span>
          <div class="admin-ped-students-picker" data-admin-ped-students>
            ${studentsHtml || `<div class="admin-ped-students-empty">Nenhum aluno encontrado.</div>`}
          </div>
        </div>

        <label class="admin-ped-modal-field">
          <span>Observações (opcional)</span>
          <textarea class="admin-ped-modal-textarea" data-admin-ped-field="notes" placeholder="Observações..."></textarea>
        </label>

        <div class="admin-ped-modal-error" data-admin-ped-error hidden></div>
      </div>
    `,
    primaryLabel: isEdit ? "Salvar" : "Criar aula",
    secondaryLabel: "Cancelar",
    hideSecondary: false,
    showTrash: false,
    onPrimary: () => {
      const form = modalBody?.querySelector("[data-admin-ped-class-form]");
      if (!(form instanceof HTMLElement)) return false;
      const errEl = form.querySelector("[data-admin-ped-error]");

      const setErr = (msg) => {
        if (!(errEl instanceof HTMLElement)) return;
        errEl.textContent = String(msg || "");
        errEl.hidden = !msg;
      };

      setErr("");

      const read = (key) => {
        const el = form.querySelector(`[data-admin-ped-field="${CSS.escape(String(key))}"]`);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return String(el.value || "").trim();
        return "";
      };

      const type = normalizeClassType(read("type"));
      const teacherId = read("teacherId");
      const title = read("title");
      const groupName = read("groupName");
      const plan = normalizePlanKeyLoose(read("plan"));
      const status = normalizeClassStatus(read("status"));
      const startDate = read("startDate");
      const endDate = read("endDate");
      const startMin = normalizeMinutesValue(read("startTime"));
      const endMin = normalizeMinutesValue(read("endTime"));
      const notes = read("notes");

      const days = [];
      form.querySelectorAll("[data-admin-ped-day]").forEach((el) => {
        if (!(el instanceof HTMLInputElement)) return;
        if (!el.checked) return;
        const n = Number(el.value);
        if (Number.isFinite(n)) days.push(n);
      });

      const studentIds = [];
      form.querySelectorAll("[data-admin-ped-student]").forEach((el) => {
        if (!(el instanceof HTMLInputElement)) return;
        if (!el.checked) return;
        const id = String(el.value || "").trim();
        if (id) studentIds.push(id);
      });

      if (!teacherId) {
        setErr("Selecione um professor para salvar.");
        return false;
      }
      if (!studentIds.length) {
        setErr(type === "group" ? "Selecione pelo menos 1 aluno para a turma." : "Selecione um aluno para a aula.");
        return false;
      }
      if (type === "individual" && studentIds.length !== 1) {
        setErr("A aula individual deve ter exatamente 1 aluno.");
        return false;
      }
      if (!days.length) {
        setErr("Selecione pelo menos um dia da semana.");
        return false;
      }
      if (!isValidDateKey(startDate)) {
        setErr("Selecione uma data de início válida.");
        return false;
      }
      if (endDate && !isValidDateKey(endDate)) {
        setErr("Selecione uma data de término válida ou deixe em branco.");
        return false;
      }
      if (endDate && startDate > endDate) {
        setErr("A data de término deve ser posterior à data de início.");
        return false;
      }
      if (!startMin || !endMin || endMin <= startMin) {
        setErr("O horário final deve ser maior que o horário inicial.");
        return false;
      }

      const teacherName = String(adminPedagogicoState.teachersById?.get(teacherId)?.nome || "").trim();
      const studentNames = studentIds
        .map((id) => String(adminPedagogicoState.studentsById?.get(id)?.nome || "").trim())
        .filter(Boolean);

      const nextRow = {
        id: isEdit ? row.id : `class_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        type,
        title,
        teacherId,
        teacherName,
        groupName,
        plan,
        status,
        daysOfWeek: normalizeDaysOfWeek(days),
        startMin,
        endMin,
        startDate,
        endDate,
        studentIds,
        studentNames,
        notes,
      };

      const all = Array.isArray(adminPedagogicoState.classes) ? adminPedagogicoState.classes : [];
      const candidates = isEdit ? all.filter((c) => String(c.id || "") !== String(row.id)) : all;
      const tempList = candidates.concat([nextRow]);
      const conflicts = computeAdminPedagogicoConflicts(tempList);
      const hit = conflicts.find((c) => {
        const a = c.classA || {};
        const b = c.classB || {};
        return String(a.id || "") === String(nextRow.id) || String(b.id || "") === String(nextRow.id);
      });
      if (hit) {
        setErr(`Conflito detectado: ${hit.reason}. Ajuste dias/horários para continuar.`);
        return false;
      }

      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;
      const prev = modalPrimary?.textContent || "";
      if (modalPrimary) modalPrimary.textContent = isEdit ? "Salvando…" : "Criando…";

      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_pedagogico_save");
          const user = await waitForFirebaseAuthReady(firebase, 5000);
          if (!user) throw new Error("not_authenticated");

          const docRef = firebase.doc(firebase.primaryDb, "classes", nextRow.id);
          const payload = {
            id: nextRow.id,
            type: nextRow.type,
            title: nextRow.title || "",
            teacherId: nextRow.teacherId,
            teacherName: nextRow.teacherName || "",
            studentIds: nextRow.studentIds,
            studentNames: nextRow.studentNames,
            groupName: nextRow.groupName || "",
            plan: nextRow.plan || "",
            daysOfWeek: nextRow.daysOfWeek,
            startMin: nextRow.startMin,
            endMin: nextRow.endMin,
            startDate: nextRow.startDate,
            endDate: nextRow.endDate || "",
            status: nextRow.status,
            notes: nextRow.notes || "",
            updatedBy: String(user.uid || ""),
            updatedAt: firebase.serverTimestamp(),
            ...(isEdit ? null : { createdBy: String(user.uid || ""), createdAt: firebase.serverTimestamp() }),
          };

          await withTimeout(firebase.setDoc(docRef, payload, { merge: true }), 12_000, "firestore_admin_pedagogico_class_merge");
          closeModal();
          await renderAdminControlePedagogicoPanel({ force: true });
        } catch (e) {
          console.error("[admin] controle-pedagogico save failed:", e);
          setErr("Não foi possível salvar agora.");
        } finally {
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
          if (modalPrimary) modalPrimary.textContent = prev || (isEdit ? "Salvar" : "Criar aula");
        }
      })();

      return false;
    },
    onSecondary: () => true,
  });

  window.setTimeout(() => {
    const form = modalBody?.querySelector("[data-admin-ped-class-form]");
    if (!(form instanceof HTMLElement)) return;
    const typeSel = form.querySelector('[data-admin-ped-field="type"]');
    const teacherSel = form.querySelector('[data-admin-ped-field="teacherId"]');
    const planSel = form.querySelector('[data-admin-ped-field="plan"]');
    const statusSel = form.querySelector('[data-admin-ped-field="status"]');
    const startDateEl = form.querySelector('[data-admin-ped-field="startDate"]');
    const endDateEl = form.querySelector('[data-admin-ped-field="endDate"]');
    const startTimeEl = form.querySelector('[data-admin-ped-field="startTime"]');
    const endTimeEl = form.querySelector('[data-admin-ped-field="endTime"]');
    const titleEl = form.querySelector('[data-admin-ped-field="title"]');
    const groupNameEl = form.querySelector('[data-admin-ped-field="groupName"]');
    const notesEl = form.querySelector('[data-admin-ped-field="notes"]');

    if (typeSel instanceof HTMLSelectElement) typeSel.value = typeValue;
    if (teacherSel instanceof HTMLSelectElement) teacherSel.value = teacherValue;
    if (planSel instanceof HTMLSelectElement) planSel.value = planValue;
    if (statusSel instanceof HTMLSelectElement) statusSel.value = statusValue;
    if (startDateEl instanceof HTMLInputElement) startDateEl.value = startDate;
    if (endDateEl instanceof HTMLInputElement) endDateEl.value = endDate;
    if (startTimeEl instanceof HTMLInputElement) startTimeEl.value = startTime;
    if (endTimeEl instanceof HTMLInputElement) endTimeEl.value = endTime;
    if (titleEl instanceof HTMLInputElement) titleEl.value = titleValue;
    if (groupNameEl instanceof HTMLInputElement) groupNameEl.value = groupNameValue;
    if (notesEl instanceof HTMLTextAreaElement) notesEl.value = String(row?.notes || "");

    const groupWrap = form.querySelector("[data-admin-ped-group-name]");
    if (groupWrap instanceof HTMLElement) groupWrap.hidden = typeValue !== "group";

    if (typeSel instanceof HTMLSelectElement) {
      typeSel.addEventListener("change", () => {
        const next = normalizeClassType(typeSel.value);
        if (groupWrap instanceof HTMLElement) groupWrap.hidden = next !== "group";
      });
    }
  }, 0);
};

const toggleAdminPedClassStatus = ({ classId } = {}) => {
  const id = String(classId || "").trim();
  if (!id) return;
  const row = findAdminPedClassById(id);
  if (!row) return;
  const current = normalizeClassStatus(row.status);
  const next = current === "active" ? "paused" : "active";

  (async () => {
    try {
      const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_pedagogico_toggle");
      const user = await waitForFirebaseAuthReady(firebase, 5000);
      if (!user) throw new Error("not_authenticated");
      const docRef = firebase.doc(firebase.primaryDb, "classes", id);
      await withTimeout(
        firebase.setDoc(
          docRef,
          { status: next, updatedBy: String(user.uid || ""), updatedAt: firebase.serverTimestamp() },
          { merge: true }
        ),
        12_000,
        "firestore_admin_pedagogico_class_toggle"
      );
      await renderAdminControlePedagogicoPanel({ force: true });
    } catch (e) {
      console.error("[admin] controle-pedagogico toggle failed:", e);
      setAdminPedagogicoStatus("Não foi possível atualizar agora.", "error");
    }
  })();
};

const deleteAdminPedClass = ({ classId } = {}) => {
  const id = String(classId || "").trim();
  if (!id) return;
  const row = findAdminPedClassById(id);
  const label = row?.title ? row.title : row?.type === "group" ? "Aula em grupo" : "Aula individual";

  openModal({
    title: "Excluir aula",
    bodyHtml: `Tem certeza que deseja excluir <strong>${escapeHtml(label || "esta aula")}</strong>? Esta ação não pode ser desfeita.`,
    primaryLabel: "Excluir",
    secondaryLabel: "Cancelar",
    hideSecondary: false,
    showTrash: false,
    onPrimary: () => {
      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;
      const prev = modalPrimary?.textContent || "";
      if (modalPrimary) modalPrimary.textContent = "Excluindo…";

      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_pedagogico_delete");
          const user = await waitForFirebaseAuthReady(firebase, 5000);
          if (!user) throw new Error("not_authenticated");
          const docRef = firebase.doc(firebase.primaryDb, "classes", id);
          await withTimeout(firebase.deleteDoc(docRef), 12_000, "firestore_admin_pedagogico_class_delete");
          closeModal();
          await renderAdminControlePedagogicoPanel({ force: true });
        } catch (e) {
          console.error("[admin] controle-pedagogico delete failed:", e);
          if (modalBody instanceof HTMLElement) modalBody.innerHTML = "Não foi possível excluir agora.";
        } finally {
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
          if (modalPrimary) modalPrimary.textContent = prev || "Excluir";
        }
      })();

      return false;
    },
  });
};

let adminStudentsFiltersPopoverEl = null;

const closeAdminStudentsFiltersPopover = () => {
  if (adminStudentsFiltersPopoverEl instanceof HTMLElement) {
    adminStudentsFiltersPopoverEl.remove();
  }
  adminStudentsFiltersPopoverEl = null;
};

const applyAdminStudentsFilters = () => {
  const all = Array.isArray(adminStudentsState.summariesAll) ? adminStudentsState.summariesAll : [];
  const f = adminStudentsState.filters && typeof adminStudentsState.filters === "object" ? adminStudentsState.filters : {};

  const status = String(f.status || "all");
  const createdFrom = String(f.createdFrom || "").trim();
  const createdTo = String(f.createdTo || "").trim();
  const canceledFrom = String(f.canceledFrom || "").trim();
  const canceledTo = String(f.canceledTo || "").trim();
  const teacherId = String(f.teacherId || "").trim();
  const plan = String(f.plan || "").trim().toLowerCase();
  const country = String(f.country || "").trim().toLowerCase();

  const filtered = all.filter((row) => {
    if (!row || typeof row !== "object") return false;
    if (status === "active" && !row.ativo) return false;
    if (status === "inactive" && row.ativo) return false;
    if (createdFrom && String(row.criadoKey || "") < createdFrom) return false;
    if (createdTo && String(row.criadoKey || "") > createdTo) return false;
    if (canceledFrom) {
      const ck = String(row.cancelKey || "");
      if (!ck) return false;
      if (ck < canceledFrom) return false;
    }
    if (canceledTo) {
      const ck = String(row.cancelKey || "");
      if (!ck) return false;
      if (ck > canceledTo) return false;
    }
    if (teacherId && String(row.teacherId || "") !== teacherId) return false;
    if (plan && String(row.plano || "").trim().toLowerCase() !== plan) return false;
    if (country && String(row.pais || "").trim().toLowerCase() !== country) return false;
    return true;
  });

  adminStudentsState.summaries = filtered;
  syncAdminStudentsFiltersBadge();
  renderAdminStudentsList();
};

const openAdminStudentsFiltersPopover = ({ triggerEl } = {}) => {
  if (!(triggerEl instanceof HTMLElement)) return;
  closeAdminStudentsFiltersPopover();

  const teachers = Array.isArray(adminStudentsState.teachers) ? adminStudentsState.teachers : [];
  const teacherOptions = [
    `<option value="">Qualquer professor</option>`,
    ...teachers
      .slice()
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
      .map((t) => `<option value="${escapeHtml(String(t.id))}">${escapeHtml(String(t.nome || "Professor"))}</option>`),
  ].join("");

  // Fixed filter options (do not depend on what is currently loaded in Firestore).
  // This prevents the select from being disabled when there are no rows yet.
  const planOptionsList = ["Turma", "Gold", "Diamond"];
  const countryOptionsList = ["Brasil", "EUA", "Canadá", "Reino Unido", "Outro"];

  const planOptions = [`<option value="">Qualquer plano</option>`]
    .concat(planOptionsList.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`))
    .join("");
  const countryOptions = [`<option value="">Qualquer país</option>`]
    .concat(countryOptionsList.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`))
    .join("");

  const pop = document.createElement("div");
  pop.className = "admin-students-filters-popover";
  pop.setAttribute("data-admin-students-filters-popover", "true");
  pop.innerHTML = `
    <div class="admin-students-filters-row">
      <label>Status</label>
      <select data-admin-students-filter="status">
        <option value="all">Todos</option>
        <option value="active">Ativos</option>
        <option value="inactive">Inativos</option>
      </select>
    </div>

    <div class="admin-students-filters-row">
      <label>Data de criação</label>
      <div class="admin-students-filters-grid2">
        <input type="date" data-admin-students-filter="createdFrom" />
        <input type="date" data-admin-students-filter="createdTo" />
      </div>
    </div>

    <div class="admin-students-filters-row">
      <label>Data de cancelamento</label>
      <div class="admin-students-filters-grid2">
        <input type="date" data-admin-students-filter="canceledFrom" />
        <input type="date" data-admin-students-filter="canceledTo" />
      </div>
    </div>

    <div class="admin-students-filters-row">
      <label>Professor</label>
      <select data-admin-students-filter="teacherId">
        ${teacherOptions}
      </select>
    </div>

    <div class="admin-students-filters-row">
      <label>Plano</label>
      <select data-admin-students-filter="plan">
        ${planOptions}
      </select>
    </div>

    <div class="admin-students-filters-row">
      <label>País</label>
      <select data-admin-students-filter="country">
        ${countryOptions}
      </select>
    </div>

    <div class="admin-students-filters-actions">
      <button type="button" class="admin-students-filters-clear" data-admin-students-filters-clear>Limpar filtros</button>
      <button type="button" class="admin-students-filters-apply" data-admin-students-filters-apply>Aplicar</button>
    </div>
  `;

  document.body.appendChild(pop);
  adminStudentsFiltersPopoverEl = pop;

  // hydrate values
  const f = adminStudentsState.filters;
  pop.querySelectorAll("[data-admin-students-filter]").forEach((el) => {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) return;
    const key = String(el.getAttribute("data-admin-students-filter") || "");
    if (!key) return;
    const val = String(f?.[key] || "");
    el.value = val;
  });

  // Position (fixed) and flip if needed.
  const rect = triggerEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 10;
  const spaceBelow = window.innerHeight - rect.bottom;
  const shouldFlipUp = spaceBelow < popRect.height + margin;
  const top = shouldFlipUp ? rect.top - margin - popRect.height : rect.bottom + margin;
  const left = rect.right - popRect.width;
  pop.style.top = `${clampToViewport(top, margin, window.innerHeight - popRect.height - margin)}px`;
  pop.style.left = `${clampToViewport(left, margin, window.innerWidth - popRect.width - margin)}px`;
};

const selectAdminStudentsTeacher = async () => {}; // legacy no-op (teacher filter removed)

const formatAdminHistoryStamp = (iso) => {
  const raw = String(iso || "").trim();
  if (!raw) return "—";
  const d = new Date(raw);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const computeLessonSummaryText = (log) => {
  const payload = log && typeof log === "object" ? log.payload || {} : {};
  const status = String(log?.statusAula || "").trim().toLowerCase();
  if (status === "realizada") {
    const content = String(payload.conteudoTrabalhado || payload.oQueFoiTrabalhado || "").trim();
    return content ? `Conteúdo: ${content}` : "Sem resumo";
  }
  if (status === "falta_aluno") {
    const motivo = String(payload.motivoFalta || "").trim();
    const risco = normalizeRiskLabel(payload.riscoEvasao || "") || "";
    return `Motivo: ${motivo || "—"}${risco ? ` · Risco: ${risco}` : ""}`;
  }
  if (status === "remarcada") {
    const motivo = String(payload.motivoRemarcacao || "").trim();
    const novaData = String(payload.novaDataRemarcacao || payload.novaData || "").trim();
    const ini = String(payload.horarioInicioRemarcacao || payload.novoInicio || "").trim();
    const fim = String(payload.horarioFimRemarcacao || payload.novoFim || "").trim();
    const when = novaData && ini && fim ? `${formatPedagogicoDate(novaData)} • ${ini}–${fim}` : novaData ? formatPedagogicoDate(novaData) : "";
    return `Motivo: ${motivo || "—"}${when ? ` · Nova aula: ${when}` : ""}`;
  }
  return "Sem resumo";
};

const buildAdminStudentHistoryItems = ({ alunoId, teacherId, logs, eventsById, teacherMeta } = {}) => {
  const aId = String(alunoId || "").trim();
  const tId = String(teacherId || "").trim();
  const list = Array.isArray(logs) ? logs : [];
  const out = [];
  const teachersById = adminStudentsState.teachersById instanceof Map ? adminStudentsState.teachersById : new Map();
  list.forEach((log) => {
    if (!log || typeof log !== "object") return;
    if (tId && String(log.professorId || "") !== tId) return;
    if (aId && String(log.alunoId || "") !== aId) return;
    const evt = eventsById instanceof Map ? eventsById.get(String(log.eventId || "")) : null;
    const dateKey = String(evt?.dateKey || log.dateKey || "").trim();
    const startMin = Number(evt?.startMin) || 0;
    const endMin = Number(evt?.endMin) || 0;
    const statusAula = String(log.statusAula || "").trim().toLowerCase();
    const payload = log.payload && typeof log.payload === "object" ? log.payload : {};
    const avisos = Array.isArray(payload.avisosCoordenacao) ? payload.avisosCoordenacao : [];
    const needsAlert =
      payload.precisaIntervencao === true ||
      avisos.some((v) => String(v).startsWith("🔴") || String(v).startsWith("🟡")) ||
      (statusAula === "remarcada" && String(payload.motivoRemarcacao || "") === "professor_remarcou");

    out.push({
      eventId: String(log.eventId || ""),
      dateKey,
      startMin,
      endMin,
      statusAula,
      professorName:
        teacherMeta?.nome ||
        (String(log.professorId || "").trim() && teachersById.get(String(log.professorId)) ? String(teachersById.get(String(log.professorId)).nome || "") : ""),
      updatedAt: String(log.atualizadoEm || log.criadoEm || ""),
      summaryText: computeLessonSummaryText(log),
      riscoEvasao: normalizeRiskLabel(payload.riscoEvasao || "") || "",
      avisos,
      observacoes: String(payload.observacoesInternas || payload.observacao || "").trim(),
      precisaIntervencao: needsAlert,
      raw: log,
    });
  });

  out.sort((a, b) => {
    const ak = a.dateKey || "";
    const bk = b.dateKey || "";
    if (ak !== bk) return bk.localeCompare(ak);
    if (a.startMin !== b.startMin) return b.startMin - a.startMin;
    const ams = a.updatedAt ? Date.parse(a.updatedAt) : NaN;
    const bms = b.updatedAt ? Date.parse(b.updatedAt) : NaN;
    if (Number.isFinite(ams) && Number.isFinite(bms)) return bms - ams;
    return 0;
  });

  return out;
};

const renderAdminStudentHistoryTab = () => {
  if (!(adminStudentHistoryDrawer instanceof HTMLElement)) return;
  const sheetEl = document.querySelector("[data-admin-student-sheet]");
  if (!(sheetEl instanceof HTMLElement)) return;
  const historyBody = sheetEl.querySelector("[data-admin-student-history-body]");
  const historyEmpty = sheetEl.querySelector("[data-admin-student-history-empty]");
  if (!(historyBody instanceof HTMLElement)) return;

  const hist = adminStudentsState.history;
  const items = Array.isArray(hist.items) ? hist.items : [];
  const filter = String(hist.filter || "all");

  const filtered = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === "alerts") return Boolean(it.precisaIntervencao);
    return it.statusAula === filter;
  });

  // Summary cards
  const total = items.length;
  const faltas = items.filter((i) => i.statusAula === "falta_aluno").length;
  const remarcadas = items.filter((i) => i.statusAula === "remarcada").length;
  const last = items[0] || null;
  const lastStatus = last ? (last.statusAula === "realizada" ? "Realizada" : last.statusAula === "falta_aluno" ? "Falta do aluno" : "Remarcada") : "Sem dados";
  const lastRisk = last?.riscoEvasao ? last.riscoEvasao : "Sem dados";
  const lastUpdated = last?.updatedAt ? formatAdminHistoryStamp(last.updatedAt) : "Sem dados";

  const realizada = items.filter((i) => i.statusAula === "realizada");
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const engVals = realizada.map((i) => Number(i.raw?.payload?.engajamentoNota || 0)).filter((n) => Number.isFinite(n) && n > 0);
  const evoVals = realizada.map((i) => Number(i.raw?.payload?.evolucaoNota || 0)).filter((n) => Number.isFinite(n) && n > 0);
  const engMed = engVals.length ? avg(engVals).toFixed(1) : "";
  const evoMed = evoVals.length ? avg(evoVals).toFixed(1) : "";

  const alertCount = items.filter((i) => i.precisaIntervencao).length;

  const headerHtml = `
    <div class="admin-students-history-summary">
      <div class="admin-students-summary-card"><span>Total registradas</span><strong>${escapeHtml(String(total || 0))}</strong></div>
      <div class="admin-students-summary-card"><span>Faltas</span><strong>${escapeHtml(String(faltas || 0))}</strong></div>
      <div class="admin-students-summary-card"><span>Remarcações</span><strong>${escapeHtml(String(remarcadas || 0))}</strong></div>
      <div class="admin-students-summary-card"><span>Último status</span><strong>${escapeHtml(lastStatus)}</strong></div>
      <div class="admin-students-summary-card"><span>Último risco</span><strong>${escapeHtml(lastRisk)}</strong></div>
      <div class="admin-students-summary-card"><span>Última atualização</span><strong>${escapeHtml(lastUpdated)}</strong></div>
    </div>

    <div class="admin-students-history-indicators">
      <div class="admin-students-indicator"><span>Engajamento médio</span><strong>${engMed ? escapeHtml(`${engMed}/5`) : "Sem dados"}</strong></div>
      <div class="admin-students-indicator"><span>Evolução média</span><strong>${evoMed ? escapeHtml(`${evoMed}/5`) : "Sem dados"}</strong></div>
      <div class="admin-students-indicator"><span>Alertas</span><strong>${alertCount ? escapeHtml(String(alertCount)) : "Sem dados"}</strong></div>
    </div>
  `;

  const timelineHtml = filtered
    .map((it) => {
      const statusLabel = it.statusAula === "realizada" ? "Aula realizada" : it.statusAula === "falta_aluno" ? "Falta do aluno" : "Remarcada";
      const stamp = it.dateKey
        ? `${formatPedagogicoDate(it.dateKey)} • ${formatHmFromMinutes(it.startMin)}–${formatHmFromMinutes(it.endMin)}`
        : "—";
      const alertBadge = it.precisaIntervencao ? `<span class="admin-students-tl-alert">Alerta</span>` : "";
      const avisos = Array.isArray(it.avisos) ? it.avisos : [];
      const avisosHtml = avisos.length
        ? `<div class="admin-students-tl-avisos">${avisos
            .map((a) => {
              const s = String(a || "");
              const tone = s.startsWith("🔴") ? "red" : s.startsWith("🟢") ? "green" : "yellow";
              return `<span class="admin-students-pill is-${tone}">${escapeHtml(s)}</span>`;
            })
            .join("")}</div>`
        : "";
      const obsHtml = it.observacoes ? `<div class="admin-students-tl-obs">${escapeHtml(it.observacoes)}</div>` : "";
      const riskHtml = it.riscoEvasao ? `<div class="admin-students-tl-risk">Risco: <strong>${escapeHtml(it.riscoEvasao)}</strong></div>` : "";
      return `
        <article class="admin-students-tl-item">
          <div class="admin-students-tl-head">
            <div class="admin-students-tl-stamp">${escapeHtml(stamp)}</div>
            ${alertBadge}
          </div>
          <div class="admin-students-tl-title">${escapeHtml(statusLabel)}</div>
          ${it.professorName ? `<div class="admin-students-tl-by">Professor: ${escapeHtml(it.professorName)}</div>` : ""}
          <div class="admin-students-tl-summary">${escapeHtml(it.summaryText)}</div>
          ${riskHtml}
          ${avisosHtml}
          ${obsHtml}
        </article>
      `;
    })
    .join("");

  historyBody.innerHTML = `${headerHtml}<div class="admin-students-timeline">${timelineHtml}</div>`;
  if (historyEmpty instanceof HTMLElement) historyEmpty.hidden = filtered.length > 0;
};

const openAdminStudentHistoryDrawer = async ({ alunoId, teacherId } = {}) => {
  if (currentRole !== "admin") return;
  if (!(adminStudentHistoryDrawer instanceof HTMLElement)) return;
  const aId = String(alunoId || "").trim();
  const tId = String(teacherId || "").trim();
  if (!aId) return;

  setAdminStudentsStatus("Carregando ficha…");
  try {
    await ensureAdminStudentsBaseData({ force: false });
    const allLogs = Array.isArray(adminStudentsState.logs) ? adminStudentsState.logs : [];
    const logs = tId ? allLogs.filter((l) => String(l?.professorId || "").trim() === tId) : allLogs;
    const derived = deriveAdminStudentsSummaries({ teacherId: tId, logs });
    const items = buildAdminStudentHistoryItems({
      alunoId: aId,
      teacherId: tId,
      logs,
      eventsById: derived.eventsById,
      teacherMeta: derived.teacherMeta,
    });

    const alunoMeta = adminStudentsState.studentsById instanceof Map ? adminStudentsState.studentsById.get(aId) || null : null;
    const inferredTeacherId =
      tId ||
      String(alunoMeta?.professorId || "").trim() ||
      String(items[0]?.professorId || "").trim() ||
      "";
    const teacherMeta =
      inferredTeacherId && adminStudentsState.teachersById instanceof Map ? adminStudentsState.teachersById.get(inferredTeacherId) || null : null;

    adminStudentsState.history = {
      isOpen: true,
      alunoId: aId,
      activeTab: "overview",
      editMode: false,
      filter: "all",
      items,
      alunoMeta,
      teacherMeta,
      files: [],
      filesLoadedAt: 0,
      filesLoading: false,
      filesError: "",
    };

    if (adminStudentHistoryTitle instanceof HTMLElement) adminStudentHistoryTitle.textContent = "Ficha do aluno";
    if (adminStudentHistorySub instanceof HTMLElement) {
      const alunoName = alunoMeta?.nome || "Aluno";
      const teacherName = teacherMeta?.nome || "";
      adminStudentHistorySub.textContent = teacherName ? `${alunoName} • ${teacherName}` : `${alunoName}`;
    }

    renderAdminStudentSheet();
    // Preload files so the "Arquivos" tab is instant.
    ensureAdminStudentFilesLoaded({ force: false }).catch(() => {});

    adminStudentHistoryDrawer.hidden = false;
    window.requestAnimationFrame(() => {
      if (adminStudentHistoryDrawer instanceof HTMLElement) adminStudentHistoryDrawer.classList.add("is-open");
    });
    setAdminStudentsStatus("");
  } catch (error) {
    console.error("[admin] open student history failed:", error);
    setAdminStudentsStatus("Não foi possível carregar agora.", "error");
  }
};

const closeAdminStudentHistoryDrawer = () => {
  if (adminStudentHistoryDrawer instanceof HTMLElement) {
    adminStudentHistoryDrawer.classList.remove("is-open");
    window.setTimeout(() => {
      if (adminStudentHistoryDrawer instanceof HTMLElement) adminStudentHistoryDrawer.hidden = true;
    }, 220);
  }
		  adminStudentsState.history = {
		    isOpen: false,
		    alunoId: "",
		    activeTab: "overview",
		    editMode: false,
		    filter: "all",
		    items: [],
		    alunoMeta: null,
		    teacherMeta: null,
        files: [],
        filesLoadedAt: 0,
        filesLoading: false,
        filesError: "",
		  };
		};


const closeAllAdminActionMenus = () => {
  document.querySelectorAll("[data-admin-actions].is-open").forEach((el) => el.classList.remove("is-open"));
  closeAdminActionsPopover();
};

let adminActionsPopoverEl = null;

const closeAdminActionsPopover = () => {
  if (adminActionsPopoverEl instanceof HTMLElement) {
    adminActionsPopoverEl.remove();
  }
  adminActionsPopoverEl = null;
};

// Admin > Alunos (histórico pedagógico) - actions popover (separate from user toggle/reset).
let adminStudentActionsPopoverEl = null;

const closeAdminStudentActionsPopover = () => {
  if (adminStudentActionsPopoverEl instanceof HTMLElement) {
    adminStudentActionsPopoverEl.remove();
  }
  adminStudentActionsPopoverEl = null;
};

const getAdminStudentMetaById = (alunoId) => {
  const id = String(alunoId || "").trim();
  if (!id) return null;
  const map = adminStudentsState.studentsById instanceof Map ? adminStudentsState.studentsById : new Map();
  return map.get(id) || null;
};

const openAdminStudentDeactivateModal = ({ alunoId } = {}) => {
  const id = String(alunoId || "").trim();
  if (!id) return;
  const meta = getAdminStudentMetaById(id);
  const name = meta?.nome || "este aluno";

  openModal({
    title: "Desativar aluno",
    bodyHtml: `
      <div style="display:grid; gap:10px;">
        <p style="margin:0; color: rgba(255,255,255,0.75); font-size: 13px; line-height: 1.45;">
          Tem certeza que deseja desativar <strong>${escapeHtml(name)}</strong>?
        </p>
        <p style="margin:0; color: rgba(255,255,255,0.45); font-size: 12px; line-height: 1.45;">
          O aluno continuará salvo no sistema, mas ficará como inativo.
        </p>
      </div>
    `,
    primaryLabel: "Confirmar desativação",
    secondaryLabel: "Cancelar",
    onPrimary: () => {
      // keep modal open until async completes
      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;
      setAdminStudentsStatus("Desativando…");
      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_student_deactivate");
          await withTimeout(
            firebase.setDoc(
              firebase.doc(firebase.primaryDb, "users", id),
              { ativo: false, canceladoEm: firebase.serverTimestamp(), atualizadoEm: firebase.serverTimestamp() },
              { merge: true }
            ),
            12_000,
            "firestore_deactivate_student"
          );

          adminStudentsState.loadedAt = 0;
          await renderAdminStudentsPanel({ force: true });
          setAdminStudentsStatus("");
          closeModal();
        } catch (error) {
          console.error("[admin] deactivate student failed:", error);
          setAdminStudentsStatus("Não foi possível desativar agora.", "error");
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
        }
      })();
      return false;
    },
  });
};

const openAdminStudentDeleteModal = ({ alunoId } = {}) => {
  const id = String(alunoId || "").trim();
  if (!id) return;
  const meta = getAdminStudentMetaById(id);
  const name = meta?.nome || "este aluno";

  openModal({
    title: "Excluir aluno",
    bodyHtml: `
      <div style="display:grid; gap:12px;">
        <p style="margin:0; color: rgba(255,255,255,0.75); font-size: 13px; line-height: 1.45;">
          Esta é uma ação sensível. Para excluir <strong>${escapeHtml(name)}</strong> definitivamente, digite <strong>excluir</strong>.
        </p>
        <label style="display:grid; gap:6px;">
          <span style="font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.45);">Confirmação</span>
          <input data-admin-student-delete-word type="text" autocomplete="off" spellcheck="false"
            style="width:100%; height:44px; padding:0 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.9); font-size: 13px; outline:none;" />
        </label>
        <div style="font-size:12px; color: rgba(255,255,255,0.45); line-height: 1.45;">
          Atenção: esta ação remove o cadastro do aluno no banco de dados. Use com cuidado.
        </div>
      </div>
    `,
    primaryLabel: "Excluir definitivamente",
    secondaryLabel: "Cancelar",
    onPrimary: () => {
      // keep modal open until async completes
      if (modalPrimary) modalPrimary.disabled = true;
      if (modalSecondary) modalSecondary.disabled = true;
      setAdminStudentsStatus("Excluindo…");
      (async () => {
        try {
          const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_student_delete");
          await withTimeout(firebase.deleteDoc(firebase.doc(firebase.primaryDb, "users", id)), 12_000, "firestore_delete_student");

          // If this sheet is open, close it to avoid referencing a deleted doc.
          if (adminStudentsState.history?.isOpen && String(adminStudentsState.history?.alunoId || "") === id) {
            closeAdminStudentHistoryDrawer();
          }

          adminStudentsState.loadedAt = 0;
          await renderAdminStudentsPanel({ force: true });
          setAdminStudentsStatus("");
          closeModal();
        } catch (error) {
          console.error("[admin] delete student failed:", error);
          setAdminStudentsStatus("Não foi possível excluir agora.", "error");
          if (modalPrimary) modalPrimary.disabled = false;
          if (modalSecondary) modalSecondary.disabled = false;
        }
      })();
      return false;
    },
  });

  // Gate primary button by requiring the exact word "excluir".
  const input = modalBody ? modalBody.querySelector("[data-admin-student-delete-word]") : null;
  if (modalPrimary) modalPrimary.disabled = true;
  if (input instanceof HTMLInputElement) {
    input.focus();
    const sync = () => {
      const ok = String(input.value || "").trim().toLowerCase() === "excluir";
      if (modalPrimary) modalPrimary.disabled = !ok;
    };
    input.addEventListener("input", sync);
    sync();
  }
};

const openAdminStudentActionsPopover = ({ triggerEl, alunoId } = {}) => {
  if (!(triggerEl instanceof HTMLElement)) return;
  closeAdminStudentActionsPopover();

  const safeAlunoId = String(alunoId || "").trim();
  if (!safeAlunoId) return;

  const pop = document.createElement("div");
  pop.className = "admin-actions-popover";
  pop.setAttribute("role", "menu");
  pop.setAttribute("data-admin-student-actions-popover", "true");
  pop.setAttribute("data-admin-student-actions-aluno", safeAlunoId);
  pop.innerHTML = `
    <button class="admin-action-item" type="button" data-admin-student-action="edit" data-admin-student-aluno="${escapeHtml(safeAlunoId)}">
      Editar
    </button>
    <button class="admin-action-item is-danger" type="button" data-admin-student-action="deactivate" data-admin-student-aluno="${escapeHtml(
      safeAlunoId
    )}">
      Desativar
    </button>
    <button class="admin-action-item is-danger" type="button" data-admin-student-action="delete" data-admin-student-aluno="${escapeHtml(
      safeAlunoId
    )}">
      Excluir
    </button>
  `;

  document.body.appendChild(pop);
  adminStudentActionsPopoverEl = pop;

  // Position (fixed) and flip if needed.
  const rect = triggerEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 10;
  const spaceBelow = window.innerHeight - rect.bottom;
  const shouldFlipUp = spaceBelow < popRect.height + margin;
  const top = shouldFlipUp ? rect.top - margin - popRect.height : rect.bottom + margin;
  const left = rect.right - popRect.width;
  pop.style.top = `${clampToViewport(top, margin, window.innerHeight - popRect.height - margin)}px`;
  pop.style.left = `${clampToViewport(left, margin, window.innerWidth - popRect.width - margin)}px`;
};

const clampToViewport = (value, min, max) => Math.max(min, Math.min(max, value));

const openAdminActionsPopover = ({ triggerEl, uid, name, email, isActive }) => {
  if (!(triggerEl instanceof HTMLElement)) return;
  closeAdminActionsPopover();

  const safeUid = String(uid || "").trim();
  const safeName = String(name || "").trim();
  const safeEmail = String(email || "").trim();
  const active = Boolean(isActive);

  const toggleLabel = active ? "Desativar" : "Ativar";
  const toggleClass = active ? "admin-action-item is-danger" : "admin-action-item";

  const pop = document.createElement("div");
  pop.className = "admin-actions-popover";
  pop.setAttribute("role", "menu");
  pop.setAttribute("data-admin-actions-popover", "true");
  if (safeUid) pop.setAttribute("data-admin-actions-uid", safeUid);
  pop.innerHTML = `
    <button
      class="${toggleClass}"
      type="button"
      data-admin-action-toggle
      data-admin-action-uid="${escapeHtml(safeUid)}"
      data-admin-action-name="${escapeHtml(safeName)}"
      data-admin-action-email="${escapeHtml(safeEmail)}"
      data-admin-action-active="${active ? "1" : "0"}"
    >${toggleLabel}</button>
    <button
      class="admin-action-item"
      type="button"
      data-admin-action-reset
      data-admin-action-uid="${escapeHtml(safeUid)}"
      data-admin-action-name="${escapeHtml(safeName)}"
      data-admin-action-email="${escapeHtml(safeEmail)}"
      data-admin-action-active="${active ? "1" : "0"}"
    >Redefinir senha</button>
  `;

  document.body.appendChild(pop);
  adminActionsPopoverEl = pop;

  // Position (fixed) and flip if needed.
  const rect = triggerEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 10;

  const spaceBelow = window.innerHeight - rect.bottom;
  const shouldFlipUp = spaceBelow < popRect.height + margin;

  const top = shouldFlipUp ? rect.top - margin - popRect.height : rect.bottom + margin;
  const left = rect.right - popRect.width;

  pop.style.top = `${clampToViewport(top, margin, window.innerHeight - popRect.height - margin)}px`;
  pop.style.left = `${clampToViewport(left, margin, window.innerWidth - popRect.width - margin)}px`;
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

  const extraStudentFields =
    role === "student"
      ? `
        <label class="auth-field">
          <span>Endereço</span>
          <input class="auth-input" type="text" autocomplete="street-address" data-ac-address />
          <div class="auth-inline-error" data-ac-address-error hidden>Endereço obrigatório</div>
        </label>
        <label class="auth-field">
          <span>Plano</span>
          <select class="auth-input" data-ac-plan>
            <option value="">Selecione…</option>
            <option value="Turma">Turma</option>
            <option value="Gold">Gold</option>
            <option value="Diamond">Diamond</option>
          </select>
          <div class="auth-inline-error" data-ac-plan-error hidden>Plano obrigatório</div>
        </label>
        <label class="auth-field">
          <span>País</span>
          <select class="auth-input" data-ac-country>
            <option value="">Selecione…</option>
            <option value="Brasil">Brasil</option>
            <option value="EUA">EUA</option>
            <option value="Canadá">Canadá</option>
            <option value="Reino Unido">Reino Unido</option>
            <option value="Outro">Outro</option>
          </select>
          <div class="auth-inline-error" data-ac-country-error hidden>País obrigatório</div>
	        </label>
	        <label class="auth-field">
	          <span>Estado dos EUA (opcional)</span>
	          <select class="auth-input" data-ac-us-state>
	            <option value="">Selecione…</option>
	            <option value="Massachusetts">Massachusetts</option>
	            <option value="New Jersey">New Jersey</option>
	            <option value="New York">New York</option>
	            <option value="Florida">Florida</option>
	            <option value="Califórnia">Califórnia</option>
	            <option value="Texas">Texas</option>
	            <option value="Connecticut">Connecticut</option>
	            <option value="Rhode Island">Rhode Island</option>
	            <option value="Pennsylvania">Pennsylvania</option>
	            <option value="Georgia">Georgia</option>
	            <option value="Outro">Outro</option>
	          </select>
	        </label>
	        <label class="auth-field">
	          <span>Valor de mensalidade</span>
	          <input class="auth-input" type="text" inputmode="decimal" autocomplete="off" data-ac-monthly placeholder="Ex: 299,00" />
	          <div class="auth-inline-hint">Aceita número ou formato monetário (ex.: 299,00).</div>
	          <div class="auth-inline-error" data-ac-monthly-error hidden>Informe um valor válido.</div>
	        </label>
	        <label class="auth-field">
	          <span>Tempo de contrato</span>
	          <select class="auth-input" data-ac-contract>
	            <option value="">Selecione…</option>
	            <option value="12">12 meses</option>
	            <option value="6">6 meses</option>
	            <option value="custom">Personalizar</option>
	          </select>
	          <div class="auth-inline-error" data-ac-contract-error hidden>Tempo de contrato obrigatório</div>
	        </label>
	        <label class="auth-field" data-ac-contract-custom-wrap hidden>
	          <span>Tempo de contrato (meses)</span>
	          <input class="auth-input" type="number" inputmode="numeric" min="1" step="1" data-ac-contract-custom placeholder="Ex: 9" />
	          <div class="auth-inline-error" data-ac-contract-custom-error hidden>Informe um número de meses.</div>
	        </label>
	        <label class="auth-field">
	          <span>Faixa de idade</span>
	          <select class="auth-input" data-ac-age-range>
	            <option value="">Selecione…</option>
            <option value="Menor de idade">Menor de idade</option>
            <option value="18-24">18-24</option>
            <option value="25-29">25-29</option>
            <option value="30-45">30-45</option>
            <option value="46-59">46-59</option>
            <option value="60+">60+</option>
          </select>
          <div class="auth-inline-error" data-ac-age-range-error hidden>Faixa de idade obrigatória</div>
	        </label>
	        <label class="auth-field">
	          <span>Gênero</span>
	          <select class="auth-input" data-ac-gender>
	            <option value="">Selecione…</option>
	            <option value="Masculino">Masculino</option>
	            <option value="Feminino">Feminino</option>
	          </select>
	          <div class="auth-inline-error" data-ac-gender-error hidden>Gênero obrigatório</div>
	        </label>
        <label class="auth-field">
          <span>Trabalho</span>
          <select class="auth-input" data-ac-job>
            <option value="">Selecione…</option>
            <option value="Empresário">Empresário</option>
            <option value="Micro Empreendedor Limpeza">Micro Empreendedor Limpeza</option>
            <option value="Micro Empreendedor Construção">Micro Empreendedor Construção</option>
            <option value="Cuida do lar">Cuida do lar</option>
            <option value="Motorista de APP">Motorista de APP</option>
            <option value="Restaurante/Supermercado">Restaurante/Supermercado</option>
            <option value="Empreendedor Estética">Empreendedor Estética</option>
            <option value="Multinacional/Emprego renda alta">Multinacional/Emprego renda alta</option>
            <option value="Estudante">Estudante</option>
            <option value="Funcionário Limpeza">Funcionário Limpeza</option>
            <option value="Funcionário Construção">Funcionário Construção</option>
            <option value="Cuidador(a) de idosos">Cuidador(a) de idosos</option>
          </select>
          <div class="auth-inline-error" data-ac-job-error hidden>Trabalho obrigatório</div>
        </label>
        <label class="auth-field">
          <span>Possui filhos</span>
          <select class="auth-input" data-ac-has-kids>
            <option value="">Selecione…</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
          <div class="auth-inline-error" data-ac-has-kids-error hidden>Campo obrigatório</div>
        </label>
        <label class="auth-field">
          <span>Casado</span>
          <select class="auth-input" data-ac-married>
            <option value="">Selecione…</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
          <div class="auth-inline-error" data-ac-married-error hidden>Campo obrigatório</div>
        </label>
        <label class="auth-field">
          <span>Pretende voltar ao Brasil</span>
          <select class="auth-input" data-ac-return-br>
            <option value="">Selecione…</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
            <option value="nao_sabe">Não sabe</option>
          </select>
          <div class="auth-inline-error" data-ac-return-br-error hidden>Campo obrigatório</div>
        </label>
        <label class="auth-field">
          <span>Objetivo principal</span>
          <textarea class="auth-input admin-create-textarea" rows="3" data-ac-goal placeholder="Descreva o objetivo principal..."></textarea>
          <div class="auth-inline-error" data-ac-goal-error hidden>Objetivo obrigatório</div>
        </label>
	        <label class="auth-field">
	          <span>Nível de inglês atual</span>
	          <select class="auth-input" data-ac-english-level>
	            <option value="">Selecione…</option>
	            <option value="Pré A1">Pré A1</option>
	            <option value="A1">A1</option>
	            <option value="A1+">A1+</option>
	            <option value="A2">A2</option>
	            <option value="A2+">A2+</option>
	            <option value="B1">B1</option>
	            <option value="B1+">B1+</option>
	            <option value="B2">B2</option>
	            <option value="B2+">B2+</option>
	            <option value="C1">C1</option>
	            <option value="C2">C2</option>
	          </select>
	          <div class="auth-inline-error" data-ac-english-level-error hidden>Nível obrigatório</div>
	        </label>
      `
      : "";

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
        ${extraStudentFields}
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
	        <div class="auth-inline-hint" data-ac-password-hint>Mínimo de 6 caracteres.</div>
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
      const addressEl = role === "student" ? form.querySelector("[data-ac-address]") : null;
      const planEl = role === "student" ? form.querySelector("[data-ac-plan]") : null;
      const countryEl = role === "student" ? form.querySelector("[data-ac-country]") : null;
	      const usStateEl = role === "student" ? form.querySelector("[data-ac-us-state]") : null;
	      const monthlyEl = role === "student" ? form.querySelector("[data-ac-monthly]") : null;
	      const contractEl = role === "student" ? form.querySelector("[data-ac-contract]") : null;
	      const contractCustomWrap = role === "student" ? form.querySelector("[data-ac-contract-custom-wrap]") : null;
	      const contractCustomEl = role === "student" ? form.querySelector("[data-ac-contract-custom]") : null;
	      const ageEl = role === "student" ? form.querySelector("[data-ac-age-range]") : null;
      const genderEl = role === "student" ? form.querySelector("[data-ac-gender]") : null;
      const jobEl = role === "student" ? form.querySelector("[data-ac-job]") : null;
      const kidsEl = role === "student" ? form.querySelector("[data-ac-has-kids]") : null;
      const marriedEl = role === "student" ? form.querySelector("[data-ac-married]") : null;
      const returnEl = role === "student" ? form.querySelector("[data-ac-return-br]") : null;
      const goalEl = role === "student" ? form.querySelector("[data-ac-goal]") : null;
      const englishEl = role === "student" ? form.querySelector("[data-ac-english-level]") : null;

      const addressError = role === "student" ? form.querySelector("[data-ac-address-error]") : null;
      const planError = role === "student" ? form.querySelector("[data-ac-plan-error]") : null;
      const countryError = role === "student" ? form.querySelector("[data-ac-country-error]") : null;
	      const monthlyError = role === "student" ? form.querySelector("[data-ac-monthly-error]") : null;
	      const contractError = role === "student" ? form.querySelector("[data-ac-contract-error]") : null;
	      const contractCustomError = role === "student" ? form.querySelector("[data-ac-contract-custom-error]") : null;
	      const ageError = role === "student" ? form.querySelector("[data-ac-age-range-error]") : null;
      const genderError = role === "student" ? form.querySelector("[data-ac-gender-error]") : null;
      const jobError = role === "student" ? form.querySelector("[data-ac-job-error]") : null;
      const kidsError = role === "student" ? form.querySelector("[data-ac-has-kids-error]") : null;
      const marriedError = role === "student" ? form.querySelector("[data-ac-married-error]") : null;
      const returnError = role === "student" ? form.querySelector("[data-ac-return-br-error]") : null;
      const goalError = role === "student" ? form.querySelector("[data-ac-goal-error]") : null;
      const englishError = role === "student" ? form.querySelector("[data-ac-english-level-error]") : null;

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

      let studentOk = true;
      let monthlyValue = NaN;
      if (role === "student") {
        const address = addressEl instanceof HTMLInputElement ? addressEl.value.trim() : "";
        const plan = planEl instanceof HTMLSelectElement ? String(planEl.value || "").trim() : planEl instanceof HTMLInputElement ? planEl.value.trim() : "";
        const country =
          countryEl instanceof HTMLSelectElement ? String(countryEl.value || "").trim() : countryEl instanceof HTMLInputElement ? countryEl.value.trim() : "";
	        const monthlyRaw = monthlyEl instanceof HTMLInputElement ? monthlyEl.value.trim() : "";
	        monthlyValue = parseMoneyPtBrLoose(monthlyRaw);
	        const contract = contractEl instanceof HTMLSelectElement ? String(contractEl.value || "").trim() : "";
	        const contractCustomRaw = contractCustomEl instanceof HTMLInputElement ? String(contractCustomEl.value || "").trim() : "";
	        const contractCustomMonths = Number.parseInt(contractCustomRaw, 10);
	        const contractMonths = contract === "12" ? 12 : contract === "6" ? 6 : contract === "custom" && Number.isFinite(contractCustomMonths) ? contractCustomMonths : 0;
	        const ageRange = ageEl instanceof HTMLSelectElement ? String(ageEl.value || "").trim() : "";
        const gender = genderEl instanceof HTMLSelectElement ? String(genderEl.value || "").trim() : "";
        const job = jobEl instanceof HTMLSelectElement ? String(jobEl.value || "").trim() : jobEl instanceof HTMLInputElement ? jobEl.value.trim() : "";
        const hasKids = kidsEl instanceof HTMLSelectElement ? String(kidsEl.value || "").trim() : "";
        const married = marriedEl instanceof HTMLSelectElement ? String(marriedEl.value || "").trim() : "";
        const returnBr = returnEl instanceof HTMLSelectElement ? String(returnEl.value || "").trim() : "";
        const goal = goalEl instanceof HTMLTextAreaElement ? goalEl.value.trim() : "";
        const english = englishEl instanceof HTMLSelectElement ? String(englishEl.value || "").trim() : "";

        const addressOk = Boolean(address);
	        const planOk = Boolean(plan);
	        const countryOk = Boolean(country);
	        const monthlyOk = Number.isFinite(monthlyValue) && monthlyValue > 0;
	        const contractOk = contractMonths > 0;
	        const contractCustomOk = contract !== "custom" || contractMonths > 0;
	        const ageOk = Boolean(ageRange);
        const genderOk = Boolean(gender);
        const jobOk = Boolean(job);
        const kidsOk = Boolean(hasKids);
        const marriedOk = Boolean(married);
        const returnOk = Boolean(returnBr);
        const goalOk = Boolean(goal);
        const englishOk = Boolean(english);

        if (addressError instanceof HTMLElement) addressError.hidden = addressOk;
        if (planError instanceof HTMLElement) planError.hidden = planOk;
	        if (countryError instanceof HTMLElement) countryError.hidden = countryOk;
	        if (monthlyError instanceof HTMLElement) monthlyError.hidden = monthlyOk;
	        if (contractError instanceof HTMLElement) contractError.hidden = contractOk;
	        if (contractCustomError instanceof HTMLElement) contractCustomError.hidden = contractCustomOk;
	        if (ageError instanceof HTMLElement) ageError.hidden = ageOk;
        if (genderError instanceof HTMLElement) genderError.hidden = genderOk;
        if (jobError instanceof HTMLElement) jobError.hidden = jobOk;
        if (kidsError instanceof HTMLElement) kidsError.hidden = kidsOk;
        if (marriedError instanceof HTMLElement) marriedError.hidden = marriedOk;
        if (returnError instanceof HTMLElement) returnError.hidden = returnOk;
        if (goalError instanceof HTMLElement) goalError.hidden = goalOk;
        if (englishError instanceof HTMLElement) englishError.hidden = englishOk;

        const mark = (el, ok) => {
          if (el instanceof HTMLElement) el.classList.toggle("is-error", !ok);
        };
        mark(addressEl, addressOk);
        mark(planEl, planOk);
	        mark(countryEl, countryOk);
	        mark(monthlyEl, monthlyOk);
	        mark(contractEl, contractOk);
	        mark(contractCustomEl, contractCustomOk);
	        mark(ageEl, ageOk);
        mark(genderEl, genderOk);
        mark(jobEl, jobOk);
        mark(kidsEl, kidsOk);
        mark(marriedEl, marriedOk);
        mark(returnEl, returnOk);
        mark(goalEl, goalOk);
        mark(englishEl, englishOk);

	        studentOk =
	          addressOk &&
	          planOk &&
	          countryOk &&
	          monthlyOk &&
	          contractOk &&
	          ageOk &&
	          genderOk &&
	          jobOk &&
	          kidsOk &&
	          marriedOk &&
	          returnOk &&
	          goalOk &&
	          englishOk;

	        if (contractCustomWrap instanceof HTMLElement) {
	          contractCustomWrap.hidden = contract !== "custom";
	        }
	      }

      if (!nameOk || !emailOk || !passOk || !confirmOk || !studentOk) {
        if (errorEl instanceof HTMLElement) {
          errorEl.textContent = "Preencha todos os campos obrigatórios para continuar.";
          errorEl.hidden = false;
        }
        return false;
      }

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
            if (role === "student") {
              const endereco = addressEl instanceof HTMLInputElement ? String(addressEl.value || "").trim() : "";
              const plano =
                planEl instanceof HTMLSelectElement ? String(planEl.value || "").trim() : planEl instanceof HTMLInputElement ? String(planEl.value || "").trim() : "";
              const pais =
                countryEl instanceof HTMLSelectElement
                  ? String(countryEl.value || "").trim()
                  : countryEl instanceof HTMLInputElement
                    ? String(countryEl.value || "").trim()
                    : "";
	              const estadoEua =
	                usStateEl instanceof HTMLSelectElement
	                  ? String(usStateEl.value || "").trim()
	                  : usStateEl instanceof HTMLInputElement
	                    ? String(usStateEl.value || "").trim()
	                    : "";
	              const mensalidadeRaw = monthlyEl instanceof HTMLInputElement ? String(monthlyEl.value || "").trim() : "";
	              const valorMensalidade = parseMoneyPtBrLoose(mensalidadeRaw);
	              const contract = contractEl instanceof HTMLSelectElement ? String(contractEl.value || "").trim() : "";
	              const contractCustomRaw = contractCustomEl instanceof HTMLInputElement ? String(contractCustomEl.value || "").trim() : "";
	              const contractCustomMonths = Number.parseInt(contractCustomRaw, 10);
	              const tempoContrato = contract === "12" ? 12 : contract === "6" ? 6 : contract === "custom" && Number.isFinite(contractCustomMonths) ? contractCustomMonths : 0;
	              const faixaIdade = ageEl instanceof HTMLSelectElement ? String(ageEl.value || "").trim() : "";
              const genero = genderEl instanceof HTMLSelectElement ? String(genderEl.value || "").trim() : "";
              const trabalho =
                jobEl instanceof HTMLSelectElement ? String(jobEl.value || "").trim() : jobEl instanceof HTMLInputElement ? String(jobEl.value || "").trim() : "";
              const possuiFilhos = kidsEl instanceof HTMLSelectElement ? String(kidsEl.value || "").trim() : "";
              const casado = marriedEl instanceof HTMLSelectElement ? String(marriedEl.value || "").trim() : "";
              const pretendeVoltarBrasil = returnEl instanceof HTMLSelectElement ? String(returnEl.value || "").trim() : "";
              const objetivoPrincipal = goalEl instanceof HTMLTextAreaElement ? String(goalEl.value || "").trim() : "";
              const nivelInglesAtual = englishEl instanceof HTMLSelectElement ? String(englishEl.value || "").trim() : "";

              payload.endereco = endereco;
              payload.plano = plano;
              payload.pais = pais;
              if (estadoEua) payload.estadoEua = estadoEua;
              payload.valorMensalidade = Number.isFinite(valorMensalidade) ? valorMensalidade : null;
              payload.tempoContrato = tempoContrato;
              payload.faixaIdade = faixaIdade;
              payload.genero = genero;
              payload.trabalho = trabalho;
              payload.possuiFilhos = possuiFilhos;
              payload.casado = casado;
              payload.pretendeVoltarBrasil = pretendeVoltarBrasil;
              payload.objetivoPrincipal = objetivoPrincipal;
              payload.nivelInglesAtual = nivelInglesAtual;
            }
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
	          if (role === "student") {
              loadUsersFromFirestore("student");
              // Refresh Admin > Alunos list if it's open.
              adminStudentsState.loadedAt = 0;
              if (body.dataset.activePanel === "alunos") renderAdminStudentsPanel({ force: true });
            }
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

		  // Live validation feedback (same rules as submit, but surfaced while typing).
		  const form = modalBody?.querySelector("[data-admin-create-form]");
		  if (form instanceof HTMLFormElement) {
		    const validate = () => {
	      const nameEl = form.querySelector("[data-ac-name]");
	      const emailEl = form.querySelector("[data-ac-email]");
	      const passEl = form.querySelector("[data-ac-password]");
	      const confirmEl = form.querySelector("[data-ac-confirm]");
	      const nameError = form.querySelector("[data-ac-name-error]");
	      const emailError = form.querySelector("[data-ac-email-error]");
	      const passError = form.querySelector("[data-ac-password-error]");
	      const confirmError = form.querySelector("[data-ac-confirm-error]");

	      const name = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : "";
	      const email = emailEl instanceof HTMLInputElement ? emailEl.value.trim().toLowerCase() : "";
	      const password = passEl instanceof HTMLInputElement ? passEl.value : "";
	      const confirm = confirmEl instanceof HTMLInputElement ? confirmEl.value : "";

		      const nameOk = Boolean(name);
		      const emailOk = !email ? true : isValidEmail(email);
		      const passOk = !password ? true : password.length >= 6;
		      const confirmOk = !confirm ? true : password === confirm;

	      if (nameError instanceof HTMLElement) nameError.hidden = nameOk || !name;
	      if (emailError instanceof HTMLElement) emailError.hidden = emailOk;
	      if (passError instanceof HTMLElement) {
	        passError.textContent = password ? "Senha mínimo 6 caracteres" : "Senha obrigatória";
	        passError.hidden = passOk;
	      }
	      if (confirmError instanceof HTMLElement) confirmError.hidden = confirmOk;

	      if (nameEl instanceof HTMLElement) nameEl.classList.toggle("is-error", Boolean(name) && !nameOk);
	      if (emailEl instanceof HTMLElement) emailEl.classList.toggle("is-error", Boolean(email) && !emailOk);
	      if (passEl instanceof HTMLElement) passEl.classList.toggle("is-error", Boolean(password) && !passOk);
		      if (confirmEl instanceof HTMLElement) confirmEl.classList.toggle("is-error", Boolean(confirm) && !confirmOk);

	          if (role === "student") {
	            const addressEl = form.querySelector("[data-ac-address]");
	            const planEl = form.querySelector("[data-ac-plan]");
	            const countryEl = form.querySelector("[data-ac-country]");
	            const contractEl = form.querySelector("[data-ac-contract]");
	            const contractCustomWrap = form.querySelector("[data-ac-contract-custom-wrap]");
	            const contractCustomEl = form.querySelector("[data-ac-contract-custom]");
	            const monthlyEl = form.querySelector("[data-ac-monthly]");
	            const jobEl = form.querySelector("[data-ac-job]");
	            const goalEl = form.querySelector("[data-ac-goal]");

	            const address = addressEl instanceof HTMLInputElement ? addressEl.value.trim() : "";
	            const plan =
	              planEl instanceof HTMLSelectElement ? String(planEl.value || "").trim() : planEl instanceof HTMLInputElement ? planEl.value.trim() : "";
	            const country =
	              countryEl instanceof HTMLSelectElement ? String(countryEl.value || "").trim() : countryEl instanceof HTMLInputElement ? countryEl.value.trim() : "";
	            const contract = contractEl instanceof HTMLSelectElement ? String(contractEl.value || "").trim() : "";
	            const contractCustomRaw = contractCustomEl instanceof HTMLInputElement ? String(contractCustomEl.value || "").trim() : "";
	            const contractCustomMonths = Number.parseInt(contractCustomRaw, 10);
	            const contractMonths = contract === "12" ? 12 : contract === "6" ? 6 : contract === "custom" && Number.isFinite(contractCustomMonths) ? contractCustomMonths : 0;
	            const monthlyRaw = monthlyEl instanceof HTMLInputElement ? monthlyEl.value.trim() : "";
	            const monthlyOk = !monthlyRaw ? true : Number.isFinite(parseMoneyPtBrLoose(monthlyRaw)) && parseMoneyPtBrLoose(monthlyRaw) > 0;
	            const job = jobEl instanceof HTMLInputElement ? jobEl.value.trim() : "";
	            const goal = goalEl instanceof HTMLTextAreaElement ? goalEl.value.trim() : "";

	            if (addressEl instanceof HTMLElement) addressEl.classList.toggle("is-error", Boolean(addressEl instanceof HTMLInputElement && addressEl.value) && !Boolean(address));
	            if (planEl instanceof HTMLElement) planEl.classList.toggle("is-error", Boolean((planEl instanceof HTMLSelectElement || planEl instanceof HTMLInputElement) && planEl.value) && !Boolean(plan));
	            if (countryEl instanceof HTMLElement) countryEl.classList.toggle("is-error", Boolean((countryEl instanceof HTMLSelectElement || countryEl instanceof HTMLInputElement) && countryEl.value) && !Boolean(country));
	            if (contractCustomWrap instanceof HTMLElement) contractCustomWrap.hidden = contract !== "custom";
	            if (contractEl instanceof HTMLElement)
	              contractEl.classList.toggle("is-error", Boolean(contractEl instanceof HTMLSelectElement && contractEl.value) && !(contractMonths > 0));
	            if (contractCustomEl instanceof HTMLElement)
	              contractCustomEl.classList.toggle("is-error", contract === "custom" && Boolean(contractCustomRaw) && !(contractMonths > 0));
	            if (monthlyEl instanceof HTMLElement) monthlyEl.classList.toggle("is-error", Boolean(monthlyRaw) && !monthlyOk);
	            if (jobEl instanceof HTMLElement) jobEl.classList.toggle("is-error", Boolean((jobEl instanceof HTMLSelectElement || jobEl instanceof HTMLInputElement) && jobEl.value) && !Boolean(job));
	            if (goalEl instanceof HTMLElement) goalEl.classList.toggle("is-error", Boolean(goalEl instanceof HTMLTextAreaElement && goalEl.value) && !Boolean(goal));
	          }
		    };

		    form.addEventListener("input", validate);
		    form.addEventListener("change", validate);
		    form.addEventListener(
	      "blur",
	      () => {
	        validate();
	      },
	      true
	    );
	    validate();
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

if (adminStudentsTeacherSelect instanceof HTMLSelectElement) {
  adminStudentsTeacherSelect.addEventListener("change", () => {
    const next = String(adminStudentsTeacherSelect.value || "").trim();
    selectAdminStudentsTeacher(next, { force: false });
  });
}
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
  if (currentRole === "teacher" && !pedagogicoState.lastLoadedAt) {
    // Keep pending badge up to date even if the teacher doesn't open the panel.
    renderTeacherPedagogico({ silent: true }).catch(() => {});
  }

  // Query live to support dynamically inserted links.
  document.querySelectorAll("[data-panel-target]").forEach((link) => {
    if (!(link instanceof HTMLElement)) return;
    const isActive = String(link.getAttribute("data-panel-target") || "") === panelName;
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
      if (currentRole === "admin") {
        renderAdminTeacherAgendas();
      }
      renderTeacherCalendar();
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
      renderAdminStudentsPanel({ force: false });
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

  if (panelName === "admin-controle-pedagogico") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentRole === "admin") {
      renderAdminControlePedagogicoPanel({ force: false }).catch(() => {});
    }
    return;
  }

  if (panelName === "pedagogico") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentRole === "teacher") {
      renderTeacherPedagogico();
    }
    return;
  }

  if (panelName === "teacher-alunos") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (currentRole === "teacher") {
      renderTeacherStudentsPanel({ force: false });
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
    if (p === "pedagogico") return "/app/professor/pedagogico";
    if (p === "teacher-alunos") return "/app/professor/alunos";
    if (p === "gravadas") return "/app/professor/gravadas";
    if (p === "materiais") return "/app/professor/materiais";
    return "/app/professor";
  }

  if (normalized === "admin") {
    if (p === "professores") return "/app/admin/professores";
    if (p === "alunos") return "/app/admin/alunos";
    if (p === "admin-controle-pedagogico") return "/app/admin/controle-pedagogico";
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
    if (sub === "pedagogico") return { role, panel: "pedagogico" };
    if (sub === "alunos") return { role, panel: "teacher-alunos" };
    if (sub === "gravadas") return { role, panel: "gravadas" };
    if (sub === "materiais") return { role, panel: "materiais" };
    return { role, panel: "dashboard" };
  }

  if (role === "admin") {
    if (sub === "professores") return { role, panel: "professores" };
    if (sub === "alunos") return { role, panel: "alunos" };
    if (sub === "controle-pedagogico") return { role, panel: "admin-controle-pedagogico" };
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
  // Prevent cross-role URL access (ex: /app/admin/* while logged as teacher).
  if (parsed?.role && parsed.role !== currentRole) {
    navigateApp(panelPathForRole(currentRole, "dashboard"));
    return;
  }
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

// Captura na fase de captura para não ser bloqueado por stopPropagation de outros handlers.
document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const pedItem = target.closest("[data-pedagogico-item]");
    if (pedItem instanceof HTMLElement) {
      const handled = activatePedagogicoLessonFromEl(event, pedItem);
      if (handled) {
        // Evita que outros handlers da página consumam esse clique e causem efeitos colaterais.
        event.stopPropagation();
      }
    }
  },
  true,
);

document.addEventListener("click", (event) => {
  const target = event.target;

  if (target instanceof Element) {
    // Admin > Alunos: close filters popover when clicking elsewhere.
    if (
      adminStudentsFiltersPopoverEl instanceof HTMLElement &&
      !target.closest("[data-admin-students-filters-popover]") &&
      !target.closest("[data-admin-students-filters-trigger]")
    ) {
      closeAdminStudentsFiltersPopover();
    }

    // Professor > Alunos: close actions popover when clicking elsewhere.
    if (
      teacherStudentActionsPopoverEl instanceof HTMLElement &&
      !target.closest("[data-teacher-student-actions-popover]") &&
      !target.closest("[data-teacher-student-actions-trigger]")
    ) {
      closeTeacherStudentActionsPopover();
    }

    // Admin > Alunos: close student actions popover when clicking elsewhere.
    if (
      adminStudentActionsPopoverEl instanceof HTMLElement &&
      !target.closest("[data-admin-student-actions-popover]") &&
      !target.closest("[data-admin-student-actions-trigger]")
    ) {
      closeAdminStudentActionsPopover();
    }

    if (currentRole === "teacher") {
      const teacherHistoryClose = target.closest("[data-teacher-student-history-close]");
      if (teacherHistoryClose instanceof HTMLElement) {
        event.preventDefault();
        closeTeacherStudentHistoryDrawer();
        return;
      }

      const teacherHistoryFilterBtn = target.closest("[data-teacher-student-history-filter]");
      if (teacherHistoryFilterBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const next = String(teacherHistoryFilterBtn.getAttribute("data-teacher-student-history-filter") || "all").trim();
        teacherStudentsState.history.filter = next || "all";
        document.querySelectorAll("[data-teacher-student-history-filter]").forEach((btn) => {
          if (!(btn instanceof HTMLButtonElement)) return;
          const isActive =
            String(btn.getAttribute("data-teacher-student-history-filter") || "") === String(teacherStudentsState.history.filter || "all");
          btn.classList.toggle("is-active", isActive);
          btn.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        renderTeacherStudentHistoryDrawer();
        return;
      }

      const teacherActionsTrigger = target.closest("[data-teacher-student-actions-trigger]");
      if (teacherActionsTrigger instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(teacherActionsTrigger.getAttribute("data-teacher-student-actions-trigger") || "").trim();
        openTeacherStudentActionsPopover({ triggerEl: teacherActionsTrigger, alunoId });
        return;
      }

      const teacherAction = target.closest("[data-teacher-student-action]");
      if (teacherAction instanceof HTMLButtonElement) {
        const action = String(teacherAction.getAttribute("data-teacher-student-action") || "").trim();
        if (action === "history") {
          event.preventDefault();
          const alunoId = String(teacherAction.getAttribute("data-teacher-student-aluno") || "").trim();
          closeTeacherStudentActionsPopover();
          openTeacherStudentHistoryDrawer({ alunoId }).catch(() => {});
          return;
        }
      }
    }

    const pedClose = target.closest("[data-pedagogico-drawer-close]");
    if (pedClose instanceof HTMLElement) {
      event.preventDefault();
      closePedagogicoDrawer();
      return;
    }

    const pedSave = target.closest("[data-pedagogico-save]");
    if (pedSave instanceof HTMLButtonElement) {
      event.preventDefault();
      savePedagogicoLog({ autosave: false }).catch(() => {});
      return;
    }

    // (Clique nos itens do Controle Pedagógico é tratado na fase de captura acima.)

    // Admin manage tables: actions menu + operations.
    if (currentRole === "admin") {
      const adminPedNewClass = target.closest("[data-admin-ped-new-class]");
      if (adminPedNewClass instanceof HTMLButtonElement) {
        event.preventDefault();
        // Ensure data is available (teachers/students/classes) before opening the modal.
        renderAdminControlePedagogicoPanel({ force: false })
          .then(() => {
            openAdminPedClassModal({ mode: "create" });
          })
          .catch(() => {
            openAdminPedClassModal({ mode: "create" });
          });
        return;
      }

      const adminPedTab = target.closest("[data-admin-ped-tab]");
      if (adminPedTab instanceof HTMLButtonElement) {
        event.preventDefault();
        const tab = String(adminPedTab.getAttribute("data-admin-ped-tab") || "").trim();
        if (tab) {
          adminPedagogicoState.activeTab = tab;
          renderAdminPedagogicoTabs();
        }
        return;
      }

      const adminPedClassOpen = target.closest("[data-admin-ped-class-open]");
      if (adminPedClassOpen instanceof HTMLButtonElement) {
        event.preventDefault();
        const classId = String(adminPedClassOpen.getAttribute("data-admin-ped-class-open") || "").trim();
        const row = findAdminPedClassById(classId);
        if (row) openAdminPedClassModal({ mode: "edit", classRow: row });
        return;
      }

      const adminPedClassEdit = target.closest("[data-admin-ped-class-edit]");
      if (adminPedClassEdit instanceof HTMLButtonElement) {
        event.preventDefault();
        const classId = String(adminPedClassEdit.getAttribute("data-admin-ped-class-edit") || "").trim();
        const row = findAdminPedClassById(classId);
        if (row) openAdminPedClassModal({ mode: "edit", classRow: row });
        return;
      }

      const adminPedClassToggle = target.closest("[data-admin-ped-class-toggle]");
      if (adminPedClassToggle instanceof HTMLButtonElement) {
        event.preventDefault();
        const classId = String(adminPedClassToggle.getAttribute("data-admin-ped-class-toggle") || "").trim();
        toggleAdminPedClassStatus({ classId });
        return;
      }

      const adminPedClassDelete = target.closest("[data-admin-ped-class-delete]");
      if (adminPedClassDelete instanceof HTMLButtonElement) {
        event.preventDefault();
        const classId = String(adminPedClassDelete.getAttribute("data-admin-ped-class-delete") || "").trim();
        deleteAdminPedClass({ classId });
        return;
      }

      const adminStudentsFiltersTrigger = target.closest("[data-admin-students-filters-trigger]");
      if (adminStudentsFiltersTrigger instanceof HTMLButtonElement) {
        event.preventDefault();
        if (adminStudentsFiltersPopoverEl instanceof HTMLElement) {
          closeAdminStudentsFiltersPopover();
        } else {
          openAdminStudentsFiltersPopover({ triggerEl: adminStudentsFiltersTrigger });
        }
        return;
      }

      const adminStudentsFiltersClear = target.closest("[data-admin-students-filters-clear]");
      if (adminStudentsFiltersClear instanceof HTMLButtonElement) {
        event.preventDefault();
        adminStudentsState.filters = {
          status: "all",
          createdFrom: "",
          createdTo: "",
          canceledFrom: "",
          canceledTo: "",
          teacherId: "",
          plan: "",
          country: "",
        };
        closeAdminStudentsFiltersPopover();
        applyAdminStudentsFilters();
        return;
      }

      const adminStudentsFiltersApply = target.closest("[data-admin-students-filters-apply]");
      if (adminStudentsFiltersApply instanceof HTMLButtonElement) {
        event.preventDefault();
        const pop = adminStudentsFiltersPopoverEl;
        if (pop instanceof HTMLElement) {
          const next = { ...adminStudentsState.filters };
          pop.querySelectorAll("[data-admin-students-filter]").forEach((el) => {
            if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) return;
            const key = String(el.getAttribute("data-admin-students-filter") || "");
            if (!key) return;
            next[key] = String(el.value || "");
          });
          adminStudentsState.filters = next;
        }
        closeAdminStudentsFiltersPopover();
        applyAdminStudentsFilters();
        return;
      }

      const studentHistoryClose = target.closest("[data-admin-student-history-close]");
      if (studentHistoryClose instanceof HTMLElement) {
        event.preventDefault();
        closeAdminStudentHistoryDrawer();
        return;
      }

      const studentTab = target.closest("[data-admin-student-tab]");
      if (studentTab instanceof HTMLButtonElement) {
        event.preventDefault();
        const next = String(studentTab.getAttribute("data-admin-student-tab") || "").trim();
        if (next) {
          adminStudentsState.history.activeTab = next;
          syncAdminStudentSheetTabs();
          if (next === "arquivos") {
            ensureAdminStudentFilesLoaded({ force: false }).catch(() => {});
          }
        }
        return;
      }

      const historyFilterBtn = target.closest("[data-admin-student-history-filter]");
      if (historyFilterBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const next = String(historyFilterBtn.getAttribute("data-admin-student-history-filter") || "all").trim();
        adminStudentsState.history.filter = next || "all";
        document.querySelectorAll("[data-admin-student-history-filter]").forEach((btn) => {
          if (!(btn instanceof HTMLButtonElement)) return;
          const isActive = String(btn.getAttribute("data-admin-student-history-filter") || "") === adminStudentsState.history.filter;
          btn.classList.toggle("is-active", isActive);
          btn.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        renderAdminStudentHistoryTab();
        return;
      }

      const studentEditCancel = target.closest("[data-admin-student-edit-cancel]");
      if (studentEditCancel instanceof HTMLButtonElement) {
        event.preventDefault();
        adminStudentsState.history.editMode = false;
        renderAdminStudentSheet();
        syncAdminStudentSheetTabs();
        return;
      }

      const studentEditSave = target.closest("[data-admin-student-edit-save]");
      if (studentEditSave instanceof HTMLButtonElement) {
        event.preventDefault();

        const hist = adminStudentsState.history;
        const alunoId = String(hist?.alunoId || "").trim();
        const sheetEl = document.querySelector("[data-admin-student-sheet]");
        const formEl = sheetEl instanceof HTMLElement ? sheetEl.querySelector("[data-admin-student-edit-form]") : null;
        const errorEl = sheetEl instanceof HTMLElement ? sheetEl.querySelector("[data-admin-student-edit-error]") : null;

        const setErr = (msg) => {
          if (errorEl instanceof HTMLElement) {
            errorEl.textContent = String(msg || "");
            errorEl.hidden = !msg;
          }
        };

        const getField = (key) => {
          if (!(formEl instanceof HTMLElement)) return null;
          return formEl.querySelector(`[data-admin-student-edit-field="${CSS.escape(String(key))}"]`);
        };

        const readText = (key) => {
          const el = getField(key);
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return String(el.value || "").trim();
          if (el instanceof HTMLSelectElement) return String(el.value || "").trim();
          return "";
        };

        const markError = (key, isError) => {
          const el = getField(key);
          if (el instanceof HTMLElement) el.classList.toggle("is-error", Boolean(isError));
        };

        const nome = readText("nome");
        const email = readText("email").toLowerCase();
        const endereco = readText("endereco");
        const plano = readText("plano");
        const pais = readText("pais");
	        const estadoEua = readText("estadoEua");
	        const valorMensalidadeRaw = readText("valorMensalidade");
	        const valorMensalidade = parseMoneyPtBrLoose(valorMensalidadeRaw);
	        const tempoContratoSel = readText("tempoContrato");
	        const tempoContratoCustomRaw = readText("tempoContratoCustom");
	        const tempoContratoCustom = Number.parseInt(String(tempoContratoCustomRaw || ""), 10);
	        const tempoContrato =
	          tempoContratoSel === "12"
	            ? 12
	            : tempoContratoSel === "6"
	              ? 6
	              : tempoContratoSel === "custom" && Number.isFinite(tempoContratoCustom) && tempoContratoCustom > 0
	                ? tempoContratoCustom
	                : 0;
	        const faixaIdade = readText("faixaIdade");
	        const genero = readText("genero");
        const trabalho = readText("trabalho");
        const possuiFilhos = readText("possuiFilhos");
        const casado = readText("casado");
        const pretendeVoltarBrasil = readText("pretendeVoltarBrasil");
        const objetivoPrincipal = readText("objetivoPrincipal");
        const nivelInglesAtual = readText("nivelInglesAtual");

        // Clear previous errors.
        setErr("");
	        [
	          "nome",
	          "email",
	          "endereco",
	          "plano",
	          "pais",
	          "valorMensalidade",
	          "tempoContrato",
	          "tempoContratoCustom",
	          "faixaIdade",
	          "genero",
	          "trabalho",
          "possuiFilhos",
          "casado",
          "pretendeVoltarBrasil",
          "objetivoPrincipal",
          "nivelInglesAtual",
        ].forEach((k) => markError(k, false));

        const emailOk = isValidEmail(email);
        const monthlyOk = Number.isFinite(valorMensalidade) && valorMensalidade > 0;

	        const contractOk = tempoContrato > 0;
	        const required = [
	          ["nome", Boolean(nome)],
	          ["email", emailOk],
	          ["endereco", Boolean(endereco)],
	          ["pais", Boolean(pais)],
	          ["valorMensalidade", monthlyOk],
	          ["tempoContrato", contractOk],
	          ["faixaIdade", Boolean(faixaIdade)],
	          ["genero", Boolean(genero)],
          ["trabalho", Boolean(trabalho)],
          ["possuiFilhos", Boolean(possuiFilhos)],
          ["casado", Boolean(casado)],
          ["pretendeVoltarBrasil", Boolean(pretendeVoltarBrasil)],
          ["objetivoPrincipal", Boolean(objetivoPrincipal)],
          ["nivelInglesAtual", Boolean(nivelInglesAtual)],
        ];

	        const missing = required.filter(([, ok]) => !ok).map(([k]) => k);
	        if (!alunoId) {
	          setErr("Não foi possível identificar o aluno para salvar.");
	          return;
	        }
	        if (missing.length) {
	          missing.forEach((k) => markError(k, true));
	          if (tempoContratoSel === "custom" && !contractOk) {
	            markError("tempoContratoCustom", true);
	          }
	          setErr("Preencha os campos obrigatórios para salvar.");
	          return;
	        }

        // Async save (merge) to avoid losing unknown fields.
        studentEditSave.disabled = true;
        const cancelBtn = sheetEl instanceof HTMLElement ? sheetEl.querySelector("[data-admin-student-edit-cancel]") : null;
        if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = true;
        const prevLabel = studentEditSave.textContent;
        studentEditSave.textContent = "Salvando…";

        (async () => {
          try {
            const firebase = await withTimeout(loadFirebaseAdminApi(), 8000, "firebase_init_admin_student_edit_save");
            const patch = {
              nome,
              email,
              endereco,
              plano,
              pais,
              estadoEua,
              valorMensalidade,
              tempoContrato,
              faixaIdade,
              genero,
              trabalho,
              possuiFilhos,
              casado,
              pretendeVoltarBrasil,
              objetivoPrincipal,
              nivelInglesAtual,
              atualizadoEm: firebase.serverTimestamp(),
            };

            await withTimeout(firebase.setDoc(firebase.doc(firebase.primaryDb, "users", alunoId), patch, { merge: true }), 12_000, "firestore_student_edit_merge");

            adminStudentsState.loadedAt = 0;
            await ensureAdminStudentsBaseData({ force: true });

            const refreshedMeta = getAdminStudentMetaById(alunoId);
            if (refreshedMeta) {
              adminStudentsState.history.alunoMeta = refreshedMeta;
            }
            adminStudentsState.history.editMode = false;
            renderAdminStudentSheet();
            syncAdminStudentSheetTabs();
            setAdminStudentsStatus("");
          } catch (error) {
            console.error("[admin] student edit save failed:", error);
            setErr("Não foi possível salvar agora.");
            setAdminStudentsStatus("Não foi possível salvar agora.", "error");
          } finally {
            studentEditSave.disabled = false;
            studentEditSave.textContent = prevLabel || "Salvar";
            if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = false;
          }
        })();

        return;
      }

      const studentActionsTrigger = target.closest("[data-admin-student-actions-trigger]");
      if (studentActionsTrigger instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(studentActionsTrigger.getAttribute("data-admin-student-actions-trigger") || "").trim();
        openAdminStudentActionsPopover({ triggerEl: studentActionsTrigger, alunoId });
        return;
      }

      const studentAction = target.closest("[data-admin-student-action]");
      if (studentAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const action = String(studentAction.getAttribute("data-admin-student-action") || "").trim();
        const alunoId = String(studentAction.getAttribute("data-admin-student-aluno") || "").trim();
        closeAdminStudentActionsPopover();

        if (!alunoId) return;

        if (action === "edit") {
          const isSame = Boolean(adminStudentsState.history?.isOpen) && String(adminStudentsState.history?.alunoId || "") === alunoId;
          const activate = () => {
            adminStudentsState.history.editMode = true;
            adminStudentsState.history.activeTab = "overview";
            renderAdminStudentSheet();
            syncAdminStudentSheetTabs();
          };
          if (isSame) {
            activate();
          } else {
            openAdminStudentHistoryDrawer({ alunoId })
              .then(() => activate())
              .catch(() => {});
          }
          return;
        }

        if (action === "deactivate") {
          openAdminStudentDeactivateModal({ alunoId });
          return;
        }

        if (action === "delete") {
          openAdminStudentDeleteModal({ alunoId });
          return;
        }

        return;
      }

      const studentOpen = target.closest("[data-admin-student-open]");
      if (studentOpen instanceof HTMLElement) {
        const alunoId = String(studentOpen.getAttribute("data-admin-student-open") || "").trim();
        if (alunoId) {
          event.preventDefault();
          openAdminStudentHistoryDrawer({ alunoId });
          return;
        }
      }

      const fileDeleteBtn = target.closest("[data-admin-student-file-delete]");
      if (fileDeleteBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const alunoId = String(fileDeleteBtn.getAttribute("data-admin-student-file-aluno") || "").trim();
        const fileId = String(fileDeleteBtn.getAttribute("data-admin-student-file-delete") || "").trim();
        if (alunoId && fileId) {
          deleteAdminStudentFile({ alunoId, fileId }).catch(() => {});
        }
        return;
      }

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

      const agendaToggle = target.closest("[data-admin-agenda-toggle]");
      if (agendaToggle instanceof HTMLButtonElement) {
        event.preventDefault();
        const id = String(agendaToggle.getAttribute("data-admin-agenda-toggle") || "").trim();
        toggleAdminTeacherAgenda(id);
        return;
      }

      const teacherFilterBtn = target.closest("[data-admin-teacher-filter]");
      if (teacherFilterBtn instanceof HTMLButtonElement) {
        event.preventDefault();
        const next = String(teacherFilterBtn.getAttribute("data-admin-teacher-filter") || "").trim().toLowerCase();
        closeAllAdminActionMenus();
        setTeacherStatusFilter(next);
        return;
      }

      const trigger = target.closest("[data-admin-actions-trigger]");
      if (trigger instanceof HTMLButtonElement) {
        event.preventDefault();
        const row = trigger.closest("[data-admin-user-row]");
        if (!(row instanceof HTMLElement)) return;
        const uid = row.getAttribute("data-admin-user-row") || "";
        const name = row.getAttribute("data-admin-user-name") || "Usuário";
        const email = row.getAttribute("data-admin-user-email") || "";
        const isActive = row.getAttribute("data-admin-user-active") === "1";
        closeAllAdminActionMenus();
        openAdminActionsPopover({ triggerEl: trigger, uid, name, email, isActive });
        return;
      }

      const toggleAction = target.closest("[data-admin-action-toggle]");
      if (toggleAction instanceof HTMLButtonElement) {
        event.preventDefault();
        const row = toggleAction.closest("[data-admin-user-row]");
        const uid = row instanceof HTMLElement ? row.getAttribute("data-admin-user-row") || "" : toggleAction.getAttribute("data-admin-action-uid") || "";
        const name = row instanceof HTMLElement ? row.getAttribute("data-admin-user-name") || "Usuário" : toggleAction.getAttribute("data-admin-action-name") || "Usuário";
        const email = row instanceof HTMLElement ? row.getAttribute("data-admin-user-email") || "" : toggleAction.getAttribute("data-admin-action-email") || "";
        const isActive =
          row instanceof HTMLElement
            ? row.getAttribute("data-admin-user-active") === "1"
            : toggleAction.getAttribute("data-admin-action-active") === "1";
        const activePanel = String(body.dataset.activePanel || "");
        const type = activePanel === "professores" ? "teacher" : activePanel === "growth" ? "growth" : "student";

        closeAllAdminActionMenus();
        closeAdminActionsPopover();

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
        const email = row instanceof HTMLElement ? row.getAttribute("data-admin-user-email") || "" : resetAction.getAttribute("data-admin-action-email") || "";
        const activePanel = String(body.dataset.activePanel || "");
        const type = activePanel === "professores" ? "teacher" : activePanel === "growth" ? "growth" : "student";

        closeAllAdminActionMenus();
        closeAdminActionsPopover();

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
      if (!target.closest("[data-admin-actions]") && !target.closest("[data-admin-actions-popover]")) {
        closeAllAdminActionMenus();
        closeAdminActionsPopover();
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

// Admin > Alunos: student files upload (delegated, so it works after re-render).
document.addEventListener("click", (event) => {
  if (currentRole !== "admin") return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const zone = target.closest("[data-admin-student-files-upload-zone]");
  if (!(zone instanceof HTMLElement)) return;

  const sheetEl = document.querySelector("[data-admin-student-sheet]");
  if (!(sheetEl instanceof HTMLElement)) return;
  const input = sheetEl.querySelector("[data-admin-student-files-input]");
  if (!(input instanceof HTMLInputElement)) return;

  event.preventDefault();
  input.click();
});

document.addEventListener("change", (event) => {
  if (currentRole !== "admin") return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.matches("[data-admin-student-files-input]")) return;

  const alunoId = String(adminStudentsState.history?.alunoId || "").trim();
  const files = Array.from(target.files || []);
  target.value = "";
  if (!alunoId || !files.length) return;

  uploadAdminStudentFiles({ alunoId, files }).catch(() => {});
});

// Admin > Controle Pedagógico: filters update the agenda/list views.
document.addEventListener("change", (event) => {
  if (currentRole !== "admin") return;
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.matches("[data-admin-ped-filter]")) return;

  const key = String(target.getAttribute("data-admin-ped-filter") || "").trim();
  if (!key) return;
  adminPedagogicoState.filters = adminPedagogicoState.filters && typeof adminPedagogicoState.filters === "object" ? { ...adminPedagogicoState.filters } : {};
  adminPedagogicoState.filters[key] = String(target.value || "");

  renderAdminPedagogicoAgenda();
  renderAdminPedagogicoClassesList();
  renderAdminPedagogicoTeachersPanel();
  renderAdminPedagogicoConflicts();
});

// Pedagogico drawer: status switch re-renders the dynamic fields area (no hidden/pre-rendered blocks).
document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.matches("[data-ped-status]")) return;

  // Persist what the user already typed before swapping the dynamic region.
  const current = readPedagogicoDraftFromDom();
  if (current && typeof current === "object") {
    pedagogicoDraft = pedagogicoDraft && typeof pedagogicoDraft === "object" ? { ...pedagogicoDraft, ...current } : { ...current };
  }

  const rawValue = target.value;
  const nextStatus = normalizePedagogicoStatus(rawValue);
  if (pedagogicoDraft && typeof pedagogicoDraft === "object") {
    pedagogicoDraft.statusAula = nextStatus;
  } else {
    pedagogicoDraft = { statusAula: nextStatus };
  }

  // If the multi-select portal is open, close it before swapping DOM.
  closePedAvisosPortal();
  const res = rerenderPedagogicoDynamicFields(nextStatus);
  const dynamicText = res?.dynamic instanceof HTMLElement ? res.dynamic.innerText : "";

  // Debug signal for validation: after switching, the dynamic container must contain the expected labels.
  // Keep this log while we stabilize the feature (it's only emitted on explicit status changes).
  // eslint-disable-next-line no-console
  console.log("[PED STATUS CHANGE CONFIRMADO]", {
    selectedValue: rawValue,
    nextStatus,
    dynamicHtmlLength: res?.dynamic?.innerHTML?.length || 0,
    dynamicText,
  });

  markPedagogicoDirty();
});

// Admin > Alunos: student sheet edit form - toggle "Tempo de contrato (meses)" when Personalizar is selected.
document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.matches('[data-admin-student-edit-field="tempoContrato"]')) return;

  const form = target.closest("[data-admin-student-edit-form]");
  if (!(form instanceof HTMLElement)) return;
  const wrap = form.querySelector("[data-admin-student-edit-contract-custom-wrap]");
  if (!(wrap instanceof HTMLElement)) return;
  const isCustom = String(target.value || "") === "custom";
  wrap.hidden = !isCustom;
});

document.addEventListener("keydown", (event) => {
  if (!(event.target instanceof Element)) return;
  const key = event.key;
  if (key !== "Enter" && key !== " ") return;

  const pedItem = event.target.closest("[data-pedagogico-item]");
  if (!(pedItem instanceof HTMLElement)) return;

  // Espaço normalmente faz scroll; aqui vira "ativar item" quando focado.
  event.preventDefault();
  activatePedagogicoLessonFromEl(event, pedItem);
});

document.addEventListener("keydown", (event) => {
  if (currentRole !== "admin") return;
  if (!(event.target instanceof Element)) return;
  const key = event.key;
  if (key !== "Enter" && key !== " ") return;
  const row = event.target.closest("[data-admin-student-open]");
  if (!(row instanceof HTMLElement)) return;
  const alunoId = String(row.getAttribute("data-admin-student-open") || "").trim();
  if (!alunoId) return;
  event.preventDefault();
  openAdminStudentHistoryDrawer({ alunoId });
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
  let startMin = clampNumber(roundToNearestSlotMin(rawStart), meta.gridStartMin, startMax);

  const windows = getWorkWindowsForGrid({ gridEl, dateKey });
  const window = windows ? getWorkWindowForMinute(startMin, windows) : null;
  if (windows && !window) {
    showTeacherCalWorkHoursTooltip({ x: event.clientX + 12, y: event.clientY + 12 });
    gridEl.style.cursor = "not-allowed";
    return;
  }

  let endMin = clampNumber(
    startMin + TEACHER_CAL_DEFAULT_DURATION_MINUTES,
    startMin + TEACHER_CAL_MIN_DURATION_MINUTES,
    meta.selectableEndMin
  );
  if (window) {
    // Keep the initial selection within the current work window.
    endMin = Math.min(endMin, window.end);
    if (endMin - startMin < TEACHER_CAL_MIN_DURATION_MINUTES) return;
  }

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

  const windows = getWorkWindowsForGrid({ gridEl, dateKey: teacherCalDrag.dateKey });
  const window = windows ? getWorkWindowForMinute(teacherCalDrag.startMin, windows) : null;
  if (window) {
    endMin = Math.min(endMin, window.end);
  }

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
  hideTeacherCalWorkHoursTooltip();
  if (drag?.gridEl instanceof HTMLElement) drag.gridEl.style.cursor = "";

  const startTime = formatHmFromMinutes(drag.startMin);
  const endTime = formatHmFromMinutes(drag.endMin);
  openTeacherCreateEventModalAt({ dateKey: drag.dateKey, startTime, endTime });
});

window.addEventListener("blur", () => {
  if (teacherCalDrag || teacherCalSelection) {
    clearTeacherCalendarSelection();
  }
  hideTeacherCalWorkHoursTooltip();
});

document.addEventListener("mousemove", (event) => {
  if (teacherCalDrag) return;
  if (!isTeacherCalendarGridInteractive()) {
    hideTeacherCalWorkHoursTooltip();
    return;
  }
  if (!(event.target instanceof Element)) return;

  const gridEl = event.target.closest(".teacher-cal-grid");
  if (!(gridEl instanceof HTMLElement)) {
    hideTeacherCalWorkHoursTooltip();
    return;
  }
  if (teacherCalViewport && !teacherCalViewport.contains(gridEl)) {
    hideTeacherCalWorkHoursTooltip();
    return;
  }

  const dateKey = gridEl.getAttribute("data-teacher-cal-grid") || "";
  const rawMin = calcTeacherSlotMinutesFromClientY(gridEl, event.clientY);
  if (rawMin === null) {
    hideTeacherCalWorkHoursTooltip();
    return;
  }
  const minutes = roundToNearestSlotMin(rawMin);
  const windows = getWorkWindowsForGrid({ gridEl, dateKey });
  if (windows && windows.length && !isMinuteWithinWindows(minutes, windows)) {
    showTeacherCalWorkHoursTooltip({ x: event.clientX + 12, y: event.clientY + 12 });
    gridEl.style.cursor = "not-allowed";
    return;
  }

  gridEl.style.cursor = "";
  hideTeacherCalWorkHoursTooltip();
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
  if (!modalBody || modalOverlay?.hidden) return;

  // Event form controls: keep the draft synced even if `input` doesn't fire (notably <select>).
  if (createEventDraft && activeModalKind === "event-form" && !createEventDraft.readOnly) {
    if (target instanceof HTMLSelectElement && (target.matches("[data-ce-admin-student]") || target.matches("[data-ce-admin-teacher]"))) {
      if (target.matches("[data-ce-admin-student]")) createEventDraft.alunoId = target.value;
      if (target.matches("[data-ce-admin-teacher]")) createEventDraft.professorId = target.value;
      validateCreateEventDraft();
      return;
    }
  }

  if (!(target instanceof HTMLInputElement)) return;
  if (!workHoursDraft) return;

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

    // Admin repeat choice labels depend on the date.
    if (currentRole === "admin") {
      const weeklyRadio = modalBody.querySelector('input[data-ce-repeat-type][value="weekly"]');
      const monthlyRadio = modalBody.querySelector('input[data-ce-repeat-type][value="monthly"]');
      if (weeklyRadio instanceof HTMLInputElement && weeklyRadio.parentElement) {
        const weekday = weekdayLongFromDateKey(String(target.value || ""));
        const span = weeklyRadio.parentElement.querySelector("span");
        if (span) span.textContent = weekday ? `Semanalmente em ${weekday.toLowerCase()}` : "Semanalmente";
      }
      if (monthlyRadio instanceof HTMLInputElement && monthlyRadio.parentElement) {
        const day = dayOfMonthFromDateKey(String(target.value || ""));
        const span = monthlyRadio.parentElement.querySelector("span");
        if (span) span.textContent = day ? `Todo dia ${day} de cada mês` : "Todo dia deste mês";
      }

      // Keep derived values up to date.
      if (!createEventDraft.repeat || typeof createEventDraft.repeat !== "object") {
        createEventDraft.repeat = createDefaultRepeatConfig();
      }
      const type = String(createEventDraft.repeat.type || "").trim().toLowerCase();
      if (type === "weekly") createEventDraft.repeat.weekday = weekdayKeyFromDateKey(createEventDraft.dateKey);
      if (type === "monthly") createEventDraft.repeat.dayOfMonth = dayOfMonthFromDateKey(createEventDraft.dateKey);
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

  if (target instanceof HTMLInputElement && target.matches("[data-ce-repeat-start]")) {
    const dayKey = String(target.getAttribute("data-ce-repeat-start") || "").trim();
    if (dayKey) {
      if (!createEventDraft.repeat || typeof createEventDraft.repeat !== "object") {
        createEventDraft.repeat = createDefaultRepeatConfig();
      }
      const days = createEventDraft.repeat.days && typeof createEventDraft.repeat.days === "object" ? createEventDraft.repeat.days : {};
      if (!days[dayKey]) days[dayKey] = { enabled: true, startTime: "", endTime: "" };
      days[dayKey].startTime = target.value;
      createEventDraft.repeat.days = days;
      validateCreateEventDraft();
    }
    return;
  }

  if (target instanceof HTMLInputElement && target.matches("[data-ce-repeat-end]")) {
    const dayKey = String(target.getAttribute("data-ce-repeat-end") || "").trim();
    if (dayKey) {
      if (!createEventDraft.repeat || typeof createEventDraft.repeat !== "object") {
        createEventDraft.repeat = createDefaultRepeatConfig();
      }
      const days = createEventDraft.repeat.days && typeof createEventDraft.repeat.days === "object" ? createEventDraft.repeat.days : {};
      if (!days[dayKey]) days[dayKey] = { enabled: true, startTime: "", endTime: "" };
      days[dayKey].endTime = target.value;
      createEventDraft.repeat.days = days;
      validateCreateEventDraft();
    }
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

  if (target instanceof HTMLInputElement && target.matches("[data-ce-repeat-enabled]")) {
    const enabled = Boolean(target.checked);
    createEventDraft.recorrente = enabled;
    if (!createEventDraft.repeat || typeof createEventDraft.repeat !== "object") {
      createEventDraft.repeat = createDefaultRepeatConfig();
    }
    createEventDraft.repeat.enabled = enabled;

    const cfg = modalBody.querySelector("[data-ce-repeat-config]");
    if (cfg instanceof HTMLElement) cfg.hidden = !enabled;

    if (!enabled) {
      // Clear the selection to keep the UI compact and predictable.
      createEventDraft.repeat.type = "";
      createEventDraft.repeat.weekday = "";
      createEventDraft.repeat.dayOfMonth = null;
      const days = createEventDraft.repeat.days && typeof createEventDraft.repeat.days === "object" ? createEventDraft.repeat.days : {};
      WEEKLY_CUSTOM_DAY_DEFS.forEach((d) => {
        if (!days[d.key]) days[d.key] = { enabled: false, startTime: "", endTime: "" };
        days[d.key].enabled = false;
        days[d.key].startTime = "";
        days[d.key].endTime = "";
        const times = modalBody.querySelector(`[data-ce-repeat-day-times="${CSS.escape(d.key)}"]`);
        if (times instanceof HTMLElement) times.hidden = true;
      });
      createEventDraft.repeat.days = days;

      const custom = modalBody.querySelector("[data-ce-repeat-custom]");
      if (custom instanceof HTMLElement) custom.hidden = true;

      validateCreateEventDraft();
      return;
    }

    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLInputElement && target.matches("[data-ce-repeat-type]")) {
    const value = String(target.value || "").trim().toLowerCase();
    if (!createEventDraft.repeat || typeof createEventDraft.repeat !== "object") {
      createEventDraft.repeat = createDefaultRepeatConfig();
    }
    createEventDraft.repeat.type = value === "monthly" ? "monthly" : value === "weekly_custom" ? "weekly_custom" : value === "weekly" ? "weekly" : "";
    if (createEventDraft.repeat.type === "weekly") {
      createEventDraft.repeat.weekday = weekdayKeyFromDateKey(createEventDraft.dateKey);
    } else if (createEventDraft.repeat.type === "monthly") {
      createEventDraft.repeat.dayOfMonth = dayOfMonthFromDateKey(createEventDraft.dateKey);
    }

    const custom = modalBody.querySelector("[data-ce-repeat-custom]");
    if (custom instanceof HTMLElement) {
      custom.hidden = createEventDraft.repeat.type !== "weekly_custom";
    }

    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLInputElement && target.matches("[data-ce-repeat-day]")) {
    const dayKey = String(target.getAttribute("data-ce-repeat-day") || "").trim();
    if (!dayKey) return;
    if (!createEventDraft.repeat || typeof createEventDraft.repeat !== "object") {
      createEventDraft.repeat = createDefaultRepeatConfig();
    }
    const days = createEventDraft.repeat.days && typeof createEventDraft.repeat.days === "object" ? createEventDraft.repeat.days : {};
    if (!days[dayKey]) days[dayKey] = { enabled: false, startTime: "", endTime: "" };
    days[dayKey].enabled = Boolean(target.checked);
    if (days[dayKey].enabled) {
      // Keep empty by default (the user can define per-day hours).
      const startEl = modalBody.querySelector(`[data-ce-repeat-start="${CSS.escape(dayKey)}"]`);
      const endEl = modalBody.querySelector(`[data-ce-repeat-end="${CSS.escape(dayKey)}"]`);
      if (startEl instanceof HTMLInputElement) startEl.value = days[dayKey].startTime;
      if (endEl instanceof HTMLInputElement) endEl.value = days[dayKey].endTime;
    } else {
      // Clear when disabling.
      days[dayKey].startTime = "";
      days[dayKey].endTime = "";
      const startEl = modalBody.querySelector(`[data-ce-repeat-start="${CSS.escape(dayKey)}"]`);
      const endEl = modalBody.querySelector(`[data-ce-repeat-end="${CSS.escape(dayKey)}"]`);
      if (startEl instanceof HTMLInputElement) startEl.value = "";
      if (endEl instanceof HTMLInputElement) endEl.value = "";
    }
    createEventDraft.repeat.days = days;

    const times = modalBody.querySelector(`[data-ce-repeat-day-times="${CSS.escape(dayKey)}"]`);
    if (times instanceof HTMLElement) times.hidden = !days[dayKey].enabled;

    validateCreateEventDraft();
    return;
  }

  if (target instanceof HTMLSelectElement && target.matches("[data-ce-repeat-mode]")) {
    const value = String(target.value || "").trim().toLowerCase();
    if (value === "none") {
      createEventDraft.recorrente = false;
      // Keep a stable default for the next time the user enables repetition.
      createEventDraft.repeatMode = "weekly";
    } else {
      createEventDraft.recorrente = true;
      createEventDraft.repeatMode = value === "daily" ? "daily" : "weekly";
    }
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
