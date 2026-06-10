const { readJsonBody, sendJson } = require("./_lib/http");
const { supabaseFetch } = require("./_lib/supabase-rest");
const { FINANCE_TABLE } = require("./_lib/finance-integrations");

const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const OVERDUE_EVENTS = new Set(["PAYMENT_OVERDUE"]);
const CANCELED_EVENTS = new Set(["PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"]);
const UPDATED_EVENTS = new Set(["PAYMENT_UPDATED"]);

const asaasStatusToFinanceStatus = (status) => {
  const raw = String(status || "").trim().toUpperCase();
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(raw)) return "pago";
  if (raw === "OVERDUE") return "vencido";
  if (["DELETED", "REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(raw)) return "cancelado";
  return "";
};

const buildPatchForEvent = (eventName, payment = {}) => {
  const nowIso = new Date().toISOString();
  if (PAID_EVENTS.has(eventName)) {
    return {
      status: "pago",
      pago_em: payment?.paymentDate || payment?.confirmedDate || payment?.clientPaymentDate || nowIso,
      forma_confirmacao: "ASAAS",
      updated_at: nowIso,
    };
  }
  if (OVERDUE_EVENTS.has(eventName)) {
    return { status: "vencido", updated_at: nowIso };
  }
  if (CANCELED_EVENTS.has(eventName)) {
    return { status: "cancelado", updated_at: nowIso };
  }
  if (UPDATED_EVENTS.has(eventName)) {
    const status = asaasStatusToFinanceStatus(payment?.status);
    const patch = {
      updated_at: nowIso,
      valor: Number.isFinite(Number(payment?.value)) ? Number(payment.value) : undefined,
      vencimento: payment?.dueDate || undefined,
      link_fatura: payment?.invoiceUrl || undefined,
      link_boleto: payment?.bankSlipUrl || undefined,
    };
    if (status) patch.status = status;
    if (status === "pago") {
      patch.pago_em = payment?.paymentDate || payment?.confirmedDate || payment?.clientPaymentDate || nowIso;
      patch.forma_confirmacao = "ASAAS";
    }
    Object.keys(patch).forEach((key) => {
      if (patch[key] == null || patch[key] === "") delete patch[key];
    });
    return patch;
  }
  return null;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const eventName = String(body?.event || "").trim().toUpperCase();
  const payment = body?.payment && typeof body.payment === "object" ? body.payment : {};
  const paymentId = String(payment?.id || body?.paymentId || "").trim();
  const patch = buildPatchForEvent(eventName, payment);

  if (!paymentId || !patch) {
    return sendJson(res, 200, { ok: true, ignored: true });
  }

  try {
    const result = await supabaseFetch(`/${FINANCE_TABLE}?id_cobranca_externa=eq.${encodeURIComponent(paymentId)}`, {
      method: "PATCH",
      body: patch,
    });
    const updated = Array.isArray(result.data) ? result.data.length : 0;
    return sendJson(res, 200, { ok: true, updated });
  } catch (error) {
    if (error?.code === "supabase_not_configured") {
      return sendJson(res, 500, { error: "supabase_not_configured" });
    }
    console.error("[api] asaas webhook failed", error);
    return sendJson(res, 500, { error: "webhook_update_failed" });
  }
};
