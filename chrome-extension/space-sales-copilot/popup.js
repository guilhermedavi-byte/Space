(async function () {
  const input = document.querySelector("[data-api-base]");
  const save = document.querySelector("[data-save]");
  const data = await chrome.storage.sync.get(["spaceApiBaseUrl"]);
  input.value = data.spaceApiBaseUrl || "https://space-three-sand.vercel.app";
  save.addEventListener("click", async () => {
    await chrome.storage.sync.set({ spaceApiBaseUrl: input.value.replace(/\/+$/, "") });
    save.textContent = "Salvo";
    window.setTimeout(() => {
      save.textContent = "Salvar";
    }, 900);
  });
})();
