(async function () {
  const input = document.querySelector("[data-api-base]");
  const token = document.querySelector("[data-copilot-token]");
  const save = document.querySelector("[data-save]");
  const clear = document.querySelector("[data-clear]");
  const status = document.querySelector("[data-status]");
  const data = await chrome.storage.sync.get(["spaceApiBaseUrl", "spaceCopilotToken", "spaceCopilotTokenExpiresAt"]);
  input.value = data.spaceApiBaseUrl || "https://space-three-sand.vercel.app";
  token.value = data.spaceCopilotToken || "";
  const renderStatus = () => {
    const exp = Number(data.spaceCopilotTokenExpiresAt || 0);
    const hasToken = Boolean(token.value.trim());
    if (!status) return;
    status.textContent = hasToken
      ? exp
        ? `Token salvo. Expira em ${new Date(exp * 1000).toLocaleTimeString("pt-BR")}.`
        : "Token salvo."
      : "Sem token. Abra o Growth logado para conectar automaticamente.";
  };
  renderStatus();
  save.addEventListener("click", async () => {
    const patch = {
      spaceApiBaseUrl: input.value.replace(/\/+$/, ""),
      spaceCopilotToken: token.value.trim(),
    };
    await chrome.storage.sync.set({
      ...patch,
    });
    data.spaceApiBaseUrl = patch.spaceApiBaseUrl;
    data.spaceCopilotToken = patch.spaceCopilotToken;
    save.textContent = "Salvo";
    window.setTimeout(() => {
      save.textContent = "Salvar";
    }, 900);
    renderStatus();
  });
  clear.addEventListener("click", async () => {
    token.value = "";
    await chrome.storage.sync.remove(["spaceCopilotToken", "spaceCopilotSessionId", "spaceCopilotTokenExpiresAt"]);
    data.spaceCopilotToken = "";
    data.spaceCopilotTokenExpiresAt = 0;
    renderStatus();
  });
})();
