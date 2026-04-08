const body = document.body;
const openPlatformButtons = document.querySelectorAll("[data-open-platform]");
const closePlatformButton = document.querySelector("[data-close-platform]");
const sidebarLinks = document.querySelectorAll("[data-panel-target]");
const panels = document.querySelectorAll("[data-panel]");
const slotButtons = document.querySelectorAll("[data-slot]");
const bookingFeedback = document.querySelector("[data-booking-feedback]");

const setView = (view) => {
  body.dataset.view = view;
  window.scrollTo({ top: 0, behavior: "smooth" });
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
};

openPlatformButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setView("interno");
    showPanel("dashboard");
  });
});

if (closePlatformButton) {
  closePlatformButton.addEventListener("click", () => {
    setView("publico");
  });
}

sidebarLinks.forEach((link) => {
  link.addEventListener("click", () => {
    showPanel(link.dataset.panelTarget);
  });
});

slotButtons.forEach((button) => {
  button.addEventListener("click", () => {
    slotButtons.forEach((slot) => slot.classList.remove("is-selected"));
    button.classList.add("is-selected");

    if (bookingFeedback) {
      bookingFeedback.textContent = `Aula reservada para ${button.dataset.slot}.`;
    }
  });
});

showPanel("dashboard");
setView("publico");
