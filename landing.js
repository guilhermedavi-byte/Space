const loginMenu = document.querySelector("[data-login-menu]");
const loginTrigger = document.querySelector("[data-login-menu-trigger]");
const loginDropdown = document.querySelector("[data-login-menu-dropdown]");
const nav = document.querySelector("[data-lp-nav]");
const navToggle = document.querySelector("[data-lp-nav-toggle]");
const mobileMenu = document.querySelector("[data-lp-mobile-menu]");
const leadForm = document.querySelector("[data-lead-form]");

if (loginMenu instanceof HTMLElement && loginTrigger instanceof HTMLButtonElement && loginDropdown instanceof HTMLElement) {
  let isOpen = false;

  const setOpen = (next) => {
    const open = Boolean(next);
    isOpen = open;
    loginMenu.classList.toggle("is-open", open);
    loginTrigger.setAttribute("aria-expanded", String(open));
  };

  loginTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!isOpen);
  });

  // Close when clicking anywhere outside of the menu.
  document.addEventListener("click", (event) => {
    if (!isOpen) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (loginMenu.contains(target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      setOpen(false);
    }
  });
}

// Navbar background on scroll (transparent -> solid).
if (nav instanceof HTMLElement) {
  const update = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}

// Mobile nav toggle (hamburger).
if (nav instanceof HTMLElement && navToggle instanceof HTMLButtonElement && mobileMenu instanceof HTMLElement) {
  let isOpen = false;

  const setOpen = (next) => {
    const open = Boolean(next);
    isOpen = open;
    mobileMenu.hidden = !open;
    navToggle.setAttribute("aria-expanded", String(open));
  };

  navToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!isOpen);
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("click", (event) => {
    if (!isOpen) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (nav.contains(target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") setOpen(false);
  });
}

// Subtle reveal animations on scroll.
const revealEls = Array.from(document.querySelectorAll("[data-reveal]"));
if (revealEls.length) {
  const reveal = (el) => el.classList.add("is-revealed");

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (!(el instanceof HTMLElement)) return;
          reveal(el);
          io.unobserve(el);
        });
      },
      { threshold: 0.16 }
    );

    revealEls.forEach((el) => {
      if (el instanceof HTMLElement) io.observe(el);
    });
  } else {
    // Fallback: reveal everything.
    revealEls.forEach((el) => {
      if (el instanceof HTMLElement) reveal(el);
    });
  }
}

const isValidEmail = (raw) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw || "").trim());

const digitsOnly = (raw) => String(raw || "").replace(/\D/g, "");

let firebaseLeadApiPromise = null;

const loadFirebaseLeadApi = () => {
  if (firebaseLeadApiPromise) return firebaseLeadApiPromise;

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyD0qyhYh6MWRPMRDN_SYqdDEeogS3thQPE",
    authDomain: "plataforma-space.firebaseapp.com",
    projectId: "plataforma-space",
    storageBucket: "plataforma-space.firebasestorage.app",
    messagingSenderId: "984031970274",
    appId: "1:984031970274:web:fff5da2fe5e318b04aefbb",
    measurementId: "G-X28MKDJPKE",
  };

  firebaseLeadApiPromise = Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
  ]).then(([appMod, fsMod]) => {
    const getOrInitApp = () => {
      try {
        return appMod.getApp();
      } catch (error) {
        return appMod.initializeApp(FIREBASE_CONFIG);
      }
    };
    const app = getOrInitApp();
    const db = fsMod.getFirestore(app);

    return {
      db,
      addDoc: fsMod.addDoc,
      collection: fsMod.collection,
      serverTimestamp: fsMod.serverTimestamp,
    };
  });

  return firebaseLeadApiPromise;
};

const setLeadLoading = (form, isLoading) => {
  if (!(form instanceof HTMLFormElement)) return;
  const submit = form.querySelector("[data-lead-submit]");
  const spinner = form.querySelector("[data-lead-spinner]");
  const label = form.querySelector("[data-lead-submit-label]");
  const loading = Boolean(isLoading);

  if (submit instanceof HTMLButtonElement) submit.disabled = loading;
  if (spinner instanceof HTMLElement) spinner.hidden = !loading;
  if (label instanceof HTMLElement) label.hidden = loading;
};

if (leadForm instanceof HTMLFormElement) {
  const nameEl = leadForm.querySelector("[data-lead-name]");
  const emailEl = leadForm.querySelector("[data-lead-email]");
  const whatsappEl = leadForm.querySelector("[data-lead-whatsapp]");
  const whatsappWrap = leadForm.querySelector(".lp-whatsapp");

  const nameErr = leadForm.querySelector("[data-lead-name-error]");
  const emailErr = leadForm.querySelector("[data-lead-email-error]");
  const whatsappErr = leadForm.querySelector("[data-lead-whatsapp-error]");
  const successEl = leadForm.querySelector("[data-lead-success]");
  const errorEl = leadForm.querySelector("[data-lead-error]");

  const clearFeedback = () => {
    if (successEl instanceof HTMLElement) successEl.hidden = true;
    if (errorEl instanceof HTMLElement) errorEl.hidden = true;
  };

  [nameEl, emailEl, whatsappEl].forEach((el) => {
    if (!(el instanceof HTMLInputElement)) return;
    el.addEventListener("input", () => {
      clearFeedback();
      el.classList.remove("is-error");
      if (el === nameEl && nameErr instanceof HTMLElement) nameErr.hidden = true;
      if (el === emailEl && emailErr instanceof HTMLElement) emailErr.hidden = true;
      if (el === whatsappEl && whatsappErr instanceof HTMLElement) whatsappErr.hidden = true;
      if (el === whatsappEl && whatsappWrap instanceof HTMLElement) whatsappWrap.classList.remove("is-error");
    });
  });

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFeedback();

    const name = nameEl instanceof HTMLInputElement ? nameEl.value.trim() : "";
    const email = emailEl instanceof HTMLInputElement ? emailEl.value.trim().toLowerCase() : "";
    const whatsappRaw = whatsappEl instanceof HTMLInputElement ? whatsappEl.value : "";
    const whatsappDigits = digitsOnly(whatsappRaw);

    const nameOk = Boolean(name);
    const emailOk = isValidEmail(email);
    const whatsappOk = whatsappDigits.length >= 10;

    if (nameErr instanceof HTMLElement) nameErr.hidden = nameOk;
    if (emailErr instanceof HTMLElement) emailErr.hidden = emailOk;
    if (whatsappErr instanceof HTMLElement) {
      whatsappErr.textContent = whatsappRaw ? "WhatsApp inválido." : "WhatsApp obrigatório.";
      whatsappErr.hidden = whatsappOk;
    }

    if (nameEl instanceof HTMLInputElement) nameEl.classList.toggle("is-error", !nameOk);
    if (emailEl instanceof HTMLInputElement) emailEl.classList.toggle("is-error", !emailOk);
    if (whatsappEl instanceof HTMLInputElement) whatsappEl.classList.toggle("is-error", !whatsappOk);
    if (whatsappWrap instanceof HTMLElement) whatsappWrap.classList.toggle("is-error", !whatsappOk);

    if (!nameOk || !emailOk || !whatsappOk) return;

    setLeadLoading(leadForm, true);
    try {
      const api = await loadFirebaseLeadApi();
      await api.addDoc(api.collection(api.db, "leads"), {
        nome: name,
        email,
        whatsapp: `+55${whatsappDigits}`,
        criadoEm: api.serverTimestamp(),
      });

      if (successEl instanceof HTMLElement) successEl.hidden = false;
      if (nameEl instanceof HTMLInputElement) nameEl.value = "";
      if (emailEl instanceof HTMLInputElement) emailEl.value = "";
      if (whatsappEl instanceof HTMLInputElement) whatsappEl.value = "";
    } catch (error) {
      console.error("[landing] lead submit failed:", error);
      if (errorEl instanceof HTMLElement) errorEl.hidden = false;
    } finally {
      setLeadLoading(leadForm, false);
    }
  });
}
