const loginMenu = document.querySelector("[data-login-menu]");
const loginTrigger = document.querySelector("[data-login-menu-trigger]");
const loginDropdown = document.querySelector("[data-login-menu-dropdown]");

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

