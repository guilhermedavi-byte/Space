(async function () {
  const API_BASE = "https://space-three-sand.vercel.app";

  const saveToken = async () => {
    try {
      if (!/\/(app\/growth|app\/admin\/growth|growth)\b/.test(window.location.pathname)) return;
      const res = await fetch(`${API_BASE}/api/growth/copilot-vendas/realtime-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "chrome_extension_platform_bridge" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) {
        console.warn("[Space Copilot] token bridge rejected", data?.error || res.status);
        return;
      }
      await chrome.storage.sync.set({
        spaceApiBaseUrl: data.apiBaseUrl || API_BASE,
        spaceCopilotToken: data.token,
        spaceCopilotSessionId: data.sessionId || "",
        spaceCopilotTokenExpiresAt: data.expiresAt || 0,
      });
      window.dispatchEvent(new CustomEvent("space-copilot-token-ready", { detail: { expiresAt: data.expiresAt || 0 } }));
    } catch (error) {
      console.warn("[Space Copilot] token bridge failed", error);
    }
  };

  await saveToken();
  window.setInterval(saveToken, 10 * 60 * 1000);
})();
