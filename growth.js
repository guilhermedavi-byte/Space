const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD0qyhYh6MWRPMRDN_SYqdDEeogS3thQPE",
  authDomain: "plataforma-space.firebaseapp.com",
  projectId: "plataforma-space",
  storageBucket: "plataforma-space.firebasestorage.app",
  messagingSenderId: "984031970274",
  appId: "1:984031970274:web:fff5da2fe5e318b04aefbb",
  measurementId: "G-X28MKDJPKE",
};

const session = window.__SPACE_SESSION__ && typeof window.__SPACE_SESSION__ === "object" ? window.__SPACE_SESSION__ : null;

const userNameEl = document.querySelector("[data-growth-user-name]");
const userAvatarEl = document.querySelector("[data-growth-avatar]");
const monthLabelEl = document.querySelector("[data-growth-month]");

const getInitials = (rawName) => {
  const name = String(rawName || "").trim();
  if (!name) return "GR";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const capitalizeFirst = (value) => {
  const str = String(value || "").trim();
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

if (userNameEl instanceof HTMLElement) {
  const name = typeof session?.name === "string" ? session.name.trim() : "";
  userNameEl.textContent = name ? name : "Growth";
}

if (userAvatarEl instanceof HTMLElement) {
  userAvatarEl.textContent = getInitials(session?.name);
}

if (monthLabelEl instanceof HTMLElement) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    month: "long",
    year: "numeric",
  });
  const formatted = capitalizeFirst(formatter.format(now));
  monthLabelEl.textContent = `Gestão à vista do mês · ${formatted}`;
}

const sidebarToggle = document.querySelector("[data-sidebar-toggle]");

let sidebarExpanded = false;

const setSidebarExpanded = (next) => {
  const expanded = Boolean(next);
  sidebarExpanded = expanded;
  document.body.dataset.sidebarExpanded = expanded ? "true" : "false";
  if (sidebarToggle instanceof HTMLButtonElement) {
    sidebarToggle.setAttribute("aria-expanded", String(expanded));
    sidebarToggle.setAttribute("aria-label", expanded ? "Fechar barra lateral" : "Abrir barra lateral");
  }
};

setSidebarExpanded(false);

if (sidebarToggle instanceof HTMLButtonElement) {
  sidebarToggle.addEventListener("click", () => {
    setSidebarExpanded(!sidebarExpanded);
  });
}

let firebaseAuthPromise = null;

const loadFirebaseAuth = () => {
  if (firebaseAuthPromise) return firebaseAuthPromise;

  firebaseAuthPromise = Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
  ]).then(([appMod, authMod]) => {
    const getOrInitApp = () => {
      try {
        return appMod.getApp();
      } catch (error) {
        return appMod.initializeApp(FIREBASE_CONFIG);
      }
    };

    const app = getOrInitApp();
    const auth = authMod.getAuth(app);

    return { auth, signOut: authMod.signOut };
  });

  return firebaseAuthPromise;
};

const logoutButtons = Array.from(document.querySelectorAll("[data-growth-logout]")).filter(
  (el) => el instanceof HTMLButtonElement
);

const setLogoutButtonsDisabled = (isDisabled) => {
  logoutButtons.forEach((btn) => {
    btn.disabled = Boolean(isDisabled);
  });
};

logoutButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    setLogoutButtonsDisabled(true);

    try {
      const api = await loadFirebaseAuth();
      await api.signOut(api.auth);
    } catch (error) {
      // Best-effort: if Firebase isn't available, still clear the session cookie below.
    }

    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      // ignore
    }

    window.location.replace("/");
  });
});
