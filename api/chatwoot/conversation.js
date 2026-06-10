const { sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const {
  canAccessFinance,
  getChatwootConfig,
  normalizeChatwootConversationId,
  buildChatwootConversationUrl,
} = require("../_lib/finance-integrations");

const normalizeMessageType = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "incoming") return "incoming";
  if (raw === "1" || raw === "outgoing") return "outgoing";
  if (raw === "2" || raw === "activity") return "activity";
  if (raw === "3" || raw === "template") return "template";
  return raw || "message";
};

const normalizeMessage = (message) => ({
  id: message?.id || message?.source_id || "",
  content: String(message?.content || "").trim(),
  message_type: normalizeMessageType(message?.message_type),
  private: Boolean(message?.private),
  sender_name:
    String(message?.sender?.name || message?.sender?.available_name || message?.sender?.email || message?.sender_type || "").trim() || "Sistema",
  created_at: message?.created_at || null,
});

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: "unauthorized" });
  if (!canAccessFinance(session)) return sendJson(res, 403, { error: "forbidden" });

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/chatwoot/conversation", `https://${host}`);
  const conversationId = normalizeChatwootConversationId(url.searchParams.get("id") || url.searchParams.get("conversation_id"));
  if (!conversationId) return sendJson(res, 400, { error: "missing_conversation_id" });

  const cfg = getChatwootConfig();
  if (!cfg.token) return sendJson(res, 500, { error: "chatwoot_not_configured" });

  try {
    const apiUrl = `${cfg.baseUrl}/api/v1/accounts/${encodeURIComponent(cfg.accountId)}/conversations/${encodeURIComponent(conversationId)}/messages`;
    const chatRes = await fetch(apiUrl, {
      headers: {
        api_access_token: cfg.token,
        Accept: "application/json",
      },
    });
    const data = await chatRes.json().catch(() => null);
    if (!chatRes.ok) {
      console.error("[api] chatwoot conversation failed", { status: chatRes.status, data });
      return sendJson(res, 502, { error: "chatwoot_request_failed" });
    }

    const rawMessages = Array.isArray(data?.payload) ? data.payload : Array.isArray(data) ? data : [];
    const messages = rawMessages.map(normalizeMessage).filter((m) => m.content || m.id);
    return sendJson(res, 200, {
      conversation_id: conversationId,
      chatwoot_url: buildChatwootConversationUrl(conversationId),
      messages,
    });
  } catch (error) {
    console.error("[api] chatwoot conversation error", error);
    return sendJson(res, 500, { error: "chatwoot_request_failed" });
  }
};
