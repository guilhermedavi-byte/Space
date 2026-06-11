(async function () {
  const input = document.querySelector("[data-api-base]");
  const token = document.querySelector("[data-copilot-token]");
  const source = document.querySelector("[data-transcription-source]");
  const ownName = document.querySelector("[data-own-speaker-name]");
  const save = document.querySelector("[data-save]");
  const clear = document.querySelector("[data-clear]");
  const status = document.querySelector("[data-status]");
  const data = await chrome.storage.sync.get(["spaceApiBaseUrl", "spaceCopilotToken", "spaceCopilotTokenExpiresAt", "spaceTranscriptionSource", "spaceOwnSpeakerName"]);
  input.value = data.spaceApiBaseUrl || "https://space-three-sand.vercel.app";
  token.value = data.spaceCopilotToken || "";
  source.value = data.spaceTranscriptionSource || "captions";
  ownName.value = data.spaceOwnSpeakerName || "";
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
      spaceTranscriptionSource: source.value || "captions",
      spaceOwnSpeakerName: ownName.value.trim(),
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
