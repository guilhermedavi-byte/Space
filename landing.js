const loginMenu = document.querySelector("[data-login-menu]");
const loginTrigger = document.querySelector("[data-login-menu-trigger]");
const loginDropdown = document.querySelector("[data-login-menu-dropdown]");
const nav = document.querySelector("[data-lp-nav]");

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
