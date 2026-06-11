(async function () {
  const input = document.querySelector("[data-api-base]");
  const token = document.querySelector("[data-copilot-token]");
  const save = document.querySelector("[data-save]");
  const data = await chrome.storage.sync.get(["spaceApiBaseUrl", "spaceCopilotToken"]);
  input.value = data.spaceApiBaseUrl || "https://space-three-sand.vercel.app";
  token.value = data.spaceCopilotToken || "";
  save.addEventListener("click", async () => {
    await chrome.storage.sync.set({
      spaceApiBaseUrl: input.value.replace(/\/+$/, ""),
      spaceCopilotToken: token.value.trim(),
    });
    save.textContent = "Salvo";
    window.setTimeout(() => {
      save.textContent = "Salvar";
    }, 900);
  });
})();
