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

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD0qyhYh6MWRPMRDN_SYqdDEeogS3thQPE",
  authDomain: "plataforma-space.firebaseapp.com",
  projectId: "plataforma-space",
  storageBucket: "plataforma-space.firebasestorage.app",
  messagingSenderId: "984031970274",
  appId: "1:984031970274:web:fff5da2fe5e318b04aefbb",
  measurementId: "G-X28MKDJPKE",
};

let firebaseAuthApiPromise = null;

const loadFirebaseAuthApi = () => {
  if (firebaseAuthApiPromise) return firebaseAuthApiPromise;

  firebaseAuthApiPromise = Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
  ]).then(([appMod, authMod]) => {
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);
    return {
      auth,
      sendPasswordResetEmail: authMod.sendPasswordResetEmail,
      signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
    };
  });

  return firebaseAuthApiPromise;
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
  const forgotLink = document.querySelector("[data-login-forgot]");
  const formShell = form.closest(".auth-login-form-shell");

  let inFlight = false;

  const clearFormError = () => {
    if (formError instanceof HTMLElement) formError.hidden = true;
  };

  const mountResetForm = () => {
    if (!(formShell instanceof HTMLElement)) return null;
    const existing = formShell.querySelector("[data-reset-form]");
    if (existing instanceof HTMLFormElement) return existing;

    const reset = document.createElement("form");
    reset.className = "auth-form auth-form-reset";
    reset.noValidate = true;
    reset.hidden = true;
    reset.setAttribute("data-reset-form", "");
    reset.innerHTML = `
      <button class="auth-back auth-reset-back" type="button" data-reset-back>← Voltar ao login</button>
      <div class="auth-reset-head">
        <strong class="auth-reset-title">Recuperar senha</strong>
        <p class="auth-reset-sub">Envie um link de redefinição para o seu e-mail.</p>
      </div>
      <label class="auth-field">
        <span>E-mail</span>
        <input class="auth-input" type="email" autocomplete="email" data-reset-email />
        <div class="auth-inline-error" data-reset-email-error hidden>E-mail inválido</div>
      </label>
      <button class="auth-submit" type="submit" data-reset-submit>
        <span data-reset-submit-label>Enviar link de redefinição</span>
        <span class="auth-spinner" data-reset-spinner hidden aria-hidden="true"></span>
      </button>
      <div class="auth-form-success" data-reset-success hidden>E-mail de redefinição enviado! Verifique sua caixa de entrada.</div>
      <div class="auth-form-error" data-reset-error hidden>Erro ao enviar. Tente novamente.</div>
    `;

    formShell.appendChild(reset);
    return reset;
  };

  const setResetLoading = (resetForm, isLoading) => {
    if (!(resetForm instanceof HTMLFormElement)) return;
    const submit = resetForm.querySelector("[data-reset-submit]");
    const spinner = resetForm.querySelector("[data-reset-spinner]");
    const label = resetForm.querySelector("[data-reset-submit-label]");
    const loading = Boolean(isLoading);
    if (submit instanceof HTMLButtonElement) submit.disabled = loading;
    if (spinner instanceof HTMLElement) spinner.hidden = !loading;
    if (label instanceof HTMLElement) label.hidden = loading;
  };

  const openResetView = () => {
    const resetForm = mountResetForm();
    if (!(resetForm instanceof HTMLFormElement)) return;
    resetForm.hidden = false;
    form.hidden = true;
    clearFormError();

    const resetEmail = resetForm.querySelector("[data-reset-email]");
    const resetEmailError = resetForm.querySelector("[data-reset-email-error]");
    const resetError = resetForm.querySelector("[data-reset-error]");
    const resetSuccess = resetForm.querySelector("[data-reset-success]");

    if (resetError instanceof HTMLElement) resetError.hidden = true;
    if (resetSuccess instanceof HTMLElement) resetSuccess.hidden = true;
    if (resetEmailError instanceof HTMLElement) resetEmailError.hidden = true;

    const currentEmail = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
    if (resetEmail instanceof HTMLInputElement && isValidEmail(currentEmail)) {
      resetEmail.value = currentEmail;
    }

    if (resetEmail instanceof HTMLInputElement) {
      resetEmail.classList.remove("is-error");
      resetEmail.focus();
    }

    const back = resetForm.querySelector("[data-reset-back]");
    if (back instanceof HTMLButtonElement) {
      back.onclick = () => {
        resetForm.hidden = true;
        form.hidden = false;
      };
    }

    resetForm.onsubmit = async (event) => {
      event.preventDefault();
      const email = resetEmail instanceof HTMLInputElement ? resetEmail.value.trim() : "";
      const emailOk = isValidEmail(email);

      if (resetEmailError instanceof HTMLElement) resetEmailError.hidden = emailOk;
      if (resetEmail instanceof HTMLElement) resetEmail.classList.toggle("is-error", !emailOk);
      if (resetError instanceof HTMLElement) resetError.hidden = true;
      if (resetSuccess instanceof HTMLElement) resetSuccess.hidden = true;

      if (!emailOk) return;

      setResetLoading(resetForm, true);
      try {
        const api = await loadFirebaseAuthApi();
        await api.sendPasswordResetEmail(api.auth, email);
        if (resetSuccess instanceof HTMLElement) resetSuccess.hidden = false;
      } catch (err) {
        const code = typeof err?.code === "string" ? err.code : "";
        let message = "Erro ao enviar. Tente novamente.";
        if (code === "auth/user-not-found") message = "Nenhuma conta encontrada com este e-mail.";
        if (code === "auth/invalid-email") message = "E-mail inválido.";
        if (resetError instanceof HTMLElement) {
          resetError.textContent = message;
          resetError.hidden = false;
        }
      } finally {
        setResetLoading(resetForm, false);
      }
    };
  };

  if (forgotLink instanceof HTMLAnchorElement) {
    forgotLink.addEventListener("click", (event) => {
      event.preventDefault();
      openResetView();
    });
  }

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

    Promise.resolve()
      .then(async () => {
        const api = await loadFirebaseAuthApi();
        const credential = await api.signInWithEmailAndPassword(api.auth, email, password);
        const idToken = typeof credential?.user?.getIdToken === "function" ? await credential.user.getIdToken() : "";
        if (!idToken) throw new Error("missing_id_token");

        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: normalizeRole(role), idToken }),
        });

        if (!res.ok) {
          throw new Error("backend_login_failed");
        }

        const data = await res.json().catch(() => null);
        const user = sanitizeSessionUser(data?.user);
        if (!user) throw new Error("invalid_response");
        window.location.replace(roleBasePath(user.role));
      })
      .catch((err) => {
        const code = typeof err?.code === "string" ? err.code : "";
        let message = "E-mail ou senha incorretos";
        if (code === "auth/wrong-password") message = "Senha incorreta";
        if (code === "auth/user-not-found") message = "Nenhuma conta encontrada com este e-mail";
        if (code === "auth/too-many-requests") message = "Muitas tentativas. Tente novamente mais tarde";

        if (formError instanceof HTMLElement) {
          formError.textContent = message;
          formError.hidden = false;
        }
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
