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
if (userNameEl instanceof HTMLElement) {
  const name = typeof session?.name === "string" ? session.name.trim() : "";
  userNameEl.textContent = name ? name : "Growth";
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

const logoutButton = document.querySelector("[data-growth-logout]");
if (logoutButton instanceof HTMLButtonElement) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

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
}

