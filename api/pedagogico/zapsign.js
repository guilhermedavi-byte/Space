const { readJsonBody, sendJson } = require("../_lib/http");
const { triggerContractSignedOnboarding } = require("../_lib/pedagogico-n8n");
const { validateWebhookSecret } = require("../_lib/security");

const pick = (...values) => values.map((v) => String(v || "").trim()).find(Boolean) || "";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const auth = validateWebhookSecret(
    req,
    process.env.ZAPSIGN_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET
  );
  if (!auth.ok) {
    sendJson(res, auth.status, { error: auth.error });
    return;
  }

  const body = await readJsonBody(req).catch(() => null);
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const eventType = pick(body.event_type, body.event, body.type, body.status, body.document?.status).toLowerCase();
  if (eventType && !eventType.includes("signed") && !eventType.includes("assinado")) {
    sendJson(res, 200, { ok: true, ignored: true });
    return;
  }

  const document = body.document && typeof body.document === "object" ? body.document : {};
  const signer = Array.isArray(body.signers) ? body.signers[0] || {} : body.signer || {};
  const payload = {
    event: "contract_signed",
    source: "zapsign",
    student_id: pick(body.student_id, body.external_id, document.external_id, signer.external_id, signer.email),
    contract_id: pick(body.contract_id, body.doc_token, body.token, document.token, document.open_id, body.document_token),
    aluno_nome: pick(body.aluno_nome, body.nome, signer.name, signer.nome, document.name),
    telefone: pick(body.telefone, body.whatsapp, signer.phone_number, signer.phone),
    email: pick(body.email, signer.email),
    plano: pick(body.plano, body.contrato, document.template_name),
    valor: body.valor ?? body.value ?? null,
    status_contrato: "assinado",
    assinou_em: pick(body.assinou_em, body.signed_at, document.signed_at, signer.signed_at) || new Date().toISOString(),
    pagamento_status: pick(body.pagamento_status, body.payment_status),
    metadata: body,
  };

  try {
    const result = await triggerContractSignedOnboarding(payload, { source: "zapsign" });
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error("[pedagogico] zapsign onboarding failed", error);
    sendJson(res, 500, { error: error?.code || "zapsign_onboarding_failed" });
  }
};
