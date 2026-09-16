const legacy = require('./_lib/asaas-webhook-legacy');
const { createFinanceFoundation } = require('./_lib/finance-foundation');
const { FinanceError } = require('./_lib/finance-domain');
const { safeFinanceError } = require('./_lib/finance-store');
const { timingSafeTextEqual, validateWebhookSecret } = require('./_lib/security');
const { sendJson } = require('./_lib/http');

// A bounded parser keeps untrusted input from accumulating after the limit is exceeded.
function readWebhookBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '', bytes = 0, rejected = false;
    req.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 262144) { if (!rejected) reject(new FinanceError('finance_payload_too_large', false, 413)); rejected = true; raw = ''; return; }
      if (!rejected) raw += chunk;
    });
    req.on('end', () => { if (rejected) return; try { resolve(JSON.parse(raw)); } catch { reject(new FinanceError('finance_payload_invalid')); } });
    req.on('error', () => reject(new FinanceError('finance_payload_invalid')));
    req.on('aborted', () => reject(new FinanceError('finance_payload_invalid')));
  });
}
function createHandler({ service = () => createFinanceFoundation(), env = process.env, legacyHandler = legacy } = {}) {
  return async (req, res) => {
    const enabled=env.FINANCE_FOUNDATION_ENABLED==='true';
    if(!enabled&&env.FINANCE_WEBHOOK_INGEST_ENABLED!=='true')return legacyHandler(req,res);
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { error: 'method_not_allowed' }); }
    const expected = String(env.ASAAS_WEBHOOK_TOKEN || '').trim();
    if (!expected) return sendJson(res, 503, { error: 'finance_webhook_secret_not_configured' });
    const supplied = typeof req.headers?.['asaas-access-token'] === 'string' ? req.headers['asaas-access-token'] : '';
    if (!supplied || !timingSafeTextEqual(supplied, expected)) {
      const legacySecret=env.FINANCE_LEGACY_WEBHOOK_TOKEN||env.ASAAS_WEBHOOK_SECRET||env.N8N_WEBHOOK_SECRET;
      if(env.FINANCE_LEGACY_WEBHOOK_COMPAT==='true'&&legacySecret&&legacySecret!==expected&&validateWebhookSecret(req,legacySecret).ok)return legacyHandler(req,res);
      return sendJson(res,401,{error:'invalid_webhook_secret'});
    }
    try {
      const body = await readWebhookBody(req);
      const foundation = service();
      const receipt = await foundation.ingestWebhook(body);
      if (receipt.conflict) return sendJson(res, 409, { error: 'finance_idempotency_conflict', event_id: receipt.event_id });
      // Awaited and bounded; no fire-and-forget serverless promise. A durable queue remains
      // if the process dies, the provider is down, or processing is intentionally disabled.
      let processing = null;
      if (enabled && env.FINANCE_WEBHOOK_PROCESS_INLINE === 'true') {
        try { processing = await foundation.processWebhookEvent(receipt.event_id); }
        catch (error) { processing = { error: safeFinanceError(error).code }; }
      }
      return sendJson(res, 200, { ok: true, ...receipt, processing });
    } catch (error) {
      const safe = safeFinanceError(error);
      return sendJson(res, safe.status || 503, { error: safe.code });
    }
  };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
