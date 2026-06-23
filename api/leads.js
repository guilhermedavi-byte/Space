const { readJsonBody, sendJson } = require("../_lib/http");
const { createDocumentAsAdmin } = require("./_lib/firestore-admin");

const attempts = new Map();

const rateLimited = (req) => {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 5;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }
  if (rateLimited(req)) return sendJson(res, 429, { error: "too_many_attempts" });

  const body = await readJsonBody(req).catch(() => null);
  const nome = String(body?.nome || "").trim().slice(0, 120);
  const email = String(body?.email || "").trim().toLowerCase().slice(0, 160);
  const whatsapp = String(body?.whatsapp || "").replace(/[^\d+]/g, "").slice(0, 20);
  if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?\d{10,15}$/.test(whatsapp)) {
    return sendJson(res, 400, { error: "invalid_lead" });
  }

  try {
    const lead = await createDocumentAsAdmin("leads", {
      nome,
      email,
      whatsapp,
      origem: "landing_page",
      criadoEm: new Date(),
    });
    return sendJson(res, 201, { ok: true, id: lead.id });
  } catch (error) {
    console.error("[api] lead create failed", error);
    return sendJson(res, error?.message === "missing_service_account" ? 503 : 500, {
      error: error?.message === "missing_service_account" ? "service_account_not_configured" : "lead_create_failed",
    });
  }
};
