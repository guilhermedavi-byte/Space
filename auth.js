const AUTH_PROFILE_DEFS = {
  student: {
    label: "Aluno",
    phrase: "Seu próximo nível começa aqui.",
    sub: "Entre com suas credenciais para continuar.",
    role: "student",
  },
  teacher: {
    label: "Professor",
    phrase: "Sua turma está esperando.",
    sub: "Entre com suas credenciais para continuar.",
    role: "teacher",
  },
  admin: {
    label: "Administrador",
    phrase: "Tudo sob controle, de um só lugar.",
    sub: "Entre com suas credenciais para continuar.",
    role: "admin",
  },
};

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "student" || raw === "aluno") return "student";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "admin" || raw === "administrador") return "admin";
  return "";
};

const roleBasePath = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === "teacher") return "/app/professor";
  if (normalized === "admin") return "/app/admin";
  return "/app/aluno";
};

const isValidEmail = (raw) => {
  const email = String(raw || "").trim();
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

const fetchSession = async () => {
  const res = await fetch("/api/me", { credentials: "include" }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  return sanitizeSessionUser(data?.user);
};

const setLoginLoading = (isLoading) => {
  const submit = document.querySelector("[data-login-submit]");
  const spinner = document.querySelector("[data-login-spinner]");
  const label = document.querySelector("[data-login-submit-label]");
  const loading = Boolean(isLoading);

  if (submit instanceof HTMLButtonElement) submit.disabled = loading;
  if (spinner instanceof HTMLElement) spinner.hidden = !loading;
  if (label instanceof HTMLElement) label.hidden = loading;
};

const setLoginProfileUI = (role) => {
  const normalized = normalizeRole(role);
  const def = AUTH_PROFILE_DEFS[normalized] || AUTH_PROFILE_DEFS.student;

  const badge = document.querySelector("[data-login-badge]");
  const phrase = document.querySelector("[data-login-phrase]");
  const sub = document.querySelector("[data-login-sub]");

  if (badge instanceof HTMLElement) badge.textContent = `Entrando como ${def.label}`;
  if (phrase instanceof HTMLElement) phrase.textContent = def.phrase;
  if (sub instanceof HTMLElement) sub.textContent = def.sub;
};

const initPasswordEye = () => {
  const eye = document.querySelector("[data-login-eye]");
  const input = document.querySelector("[data-login-password]");
  if (!(eye instanceof HTMLButtonElement) || !(input instanceof HTMLInputElement)) return;

  eye.addEventListener("click", () => {
    const nextType = input.type === "password" ? "text" : "password";
    input.type = nextType;
    eye.setAttribute("aria-label", nextType === "password" ? "Mostrar senha" : "Ocultar senha");
  });
};

const initLoginForm = (role) => {
  const form = document.querySelector("[data-login-form]");
  if (!(form instanceof HTMLFormElement)) return;

  const emailInput = document.querySelector("[data-login-email]");
  const passInput = document.querySelector("[data-login-password]");
  const emailError = document.querySelector("[data-login-email-error]");
  const passError = document.querySelector("[data-login-password-error]");
  const formError = document.querySelector("[data-login-error]");

  let inFlight = false;

  const clearFormError = () => {
    if (formError instanceof HTMLElement) formError.hidden = true;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (inFlight) return;

    const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    const password = passInput instanceof HTMLInputElement ? passInput.value : "";

    const emailOk = isValidEmail(email);
    const passOk = Boolean(password);

    if (emailError instanceof HTMLElement) emailError.hidden = emailOk;
    if (passError instanceof HTMLElement) passError.hidden = passOk;
    if (emailInput instanceof HTMLElement) emailInput.classList.toggle("is-error", !emailOk);
    if (passInput instanceof HTMLElement) passInput.classList.toggle("is-error", !passOk);
    clearFormError();

    if (!emailOk || !passOk) return;

    inFlight = true;
    setLoginLoading(true);

    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: normalizeRole(role), email, password }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("invalid_credentials");
        const data = await res.json().catch(() => null);
        const user = sanitizeSessionUser(data?.user);
        if (!user) throw new Error("invalid_response");
        window.location.replace(roleBasePath(user.role));
      })
      .catch(() => {
        if (formError instanceof HTMLElement) formError.hidden = false;
      })
      .finally(() => {
        setLoginLoading(false);
        inFlight = false;
      });
  });
};

const detectRoleForLoginPage = () => {
  const bodyRole = document.body?.dataset?.loginRole;
  if (bodyRole) return normalizeRole(bodyRole);

  const parts = String(window.location.pathname || "").split("/").filter(Boolean);
  // /login/<slug>
  const slug = parts[1] || "";
  if (slug === "aluno") return "student";
  if (slug === "professor") return "teacher";
  if (slug === "admin") return "admin";
  return "student";
};

const initAuthPages = async () => {
  const page = String(document.body?.dataset?.page || "");

  // Public auth routes must always be reachable. Visiting `/entrar` clears any previous session
  // so the user can pick a profile and log in again without getting auto-redirected.
  if (page === "entrar") {
    fetch("/api/logout", { method: "POST", credentials: "include", keepalive: true }).catch(() => {});
    return;
  }

  if (page !== "login") return;
  const role = detectRoleForLoginPage();
  setLoginProfileUI(role);
  initPasswordEye();
  initLoginForm(role);
};

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const forgot = target.closest("[data-login-forgot]");
  if (forgot instanceof HTMLAnchorElement) {
    event.preventDefault();
  }

  const support = target.closest("[data-login-support]");
  if (support instanceof HTMLAnchorElement) {
    event.preventDefault();
  }
});

initAuthPages();
