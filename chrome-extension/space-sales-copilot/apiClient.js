(function () {
  const DEFAULT_API_BASE = "https://space-three-sand.vercel.app";

  const getConfig = async () => {
    const data = await chrome.storage.sync.get(["spaceApiBaseUrl", "spaceCopilotToken", "spaceCopilotSessionId", "spaceTranscriptionSource", "spaceOwnSpeakerName"]);
    return {
      apiBaseUrl: String(data.spaceApiBaseUrl || DEFAULT_API_BASE).replace(/\/+$/, ""),
      token: String(data.spaceCopilotToken || ""),
      sessionId: String(data.spaceCopilotSessionId || ""),
      transcriptionSource: String(data.spaceTranscriptionSource || "captions"),
      ownSpeakerName: String(data.spaceOwnSpeakerName || ""),
    };
  };

  const saveConfig = async (patch) => chrome.storage.sync.set(patch || {});

  const requestJson = async (path, payload) => {
    const cfg = await getConfig();
    const headers = { "Content-Type": "application/json" };
    if (cfg.token) headers["X-Copilot-Token"] = cfg.token;
    const body = JSON.stringify({ ...(payload || {}), sessionId: cfg.sessionId, source: "chrome_extension" });
    const res = await fetch(`${cfg.apiBaseUrl}${path}`, {
      method: "POST",
      headers,
      credentials: "include",
      body,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error = new Error(data?.error || `space_api_failed_${res.status}`);
      error.status = res.status;
      error.payload = data;
      throw error;
    }
    return data;
  };

  window.SpaceCopilotApi = {
    getConfig,
    saveConfig,
    suggest: (payload) => requestJson("/api/growth/copilot-vendas/suggest", payload),
    summary: (payload) => requestJson("/api/growth/copilot-vendas/summary", payload),
    realtimeToken: (payload) => requestJson("/api/growth/copilot-vendas/realtime-token", payload),
  };
})();
