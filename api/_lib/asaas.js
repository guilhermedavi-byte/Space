const { getAsaasConfig } = require('./finance-integrations');

const BASES = Object.freeze({
  'https://api-sandbox.asaas.com/v3': 'sandbox',
  'https://api.asaas.com/v3': 'production',
});
class AsaasError extends Error {
  constructor(code, status = 0, retryable = false) {
    super(code); this.name = 'AsaasError'; this.code = code;
    this.status = status; this.retryable = retryable;
  }
}
// Never retain response bodies, request headers or provider descriptions in errors.
const safeAsaasError = (error) => ({
  code: error instanceof AsaasError ? error.code : 'asaas_internal_error',
  status: error instanceof AsaasError ? error.status : 0,
  retryable: error instanceof AsaasError ? error.retryable : false,
});
function createAsaasClient({ config = getAsaasConfig, fetchImpl = (...args) => fetch(...args),
  timeoutMs = 10000, onSuccess = async () => {}, readOnly = false } = {}) {
  const getConfig = () => {
    let cfg;
    try { cfg = config(); } catch { throw new AsaasError('asaas_environment_invalid'); }
    if (!cfg.apiKey) throw new AsaasError('asaas_not_configured');
    if (!BASES[cfg.baseUrl]) throw new AsaasError('asaas_base_url_invalid');
    return cfg;
  };
  const request = async (path, { method = 'GET', body } = {}) => {
    const cfg = getConfig();
    const verb = String(method).toUpperCase();
    if (readOnly && verb !== 'GET') throw new AsaasError('asaas_read_only');
    // PUT is Asaas v3's update verb. PATCH is not silently translated.
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(verb)) throw new AsaasError('asaas_method_invalid');
    if (!/^\/[A-Za-z][A-Za-z0-9/_?=&.%\[\]-]*$/.test(path) || path.includes('..') || path.includes('://')) {
      throw new AsaasError('asaas_path_invalid');
    }
    if (verb === 'GET' && body !== undefined) throw new AsaasError('asaas_get_body_forbidden');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1), 30000));
    try {
      const res = await fetchImpl(`${cfg.baseUrl}${path}`, {
        method: verb, redirect: 'error', signal: controller.signal,
        headers: { access_token: cfg.apiKey, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'SpaceFinancialFoundation/1.0' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        const code = res.status === 401 ? 'asaas_unauthorized' : res.status === 403 ? 'asaas_forbidden'
          : res.status === 404 ? 'asaas_not_found' : res.status === 429 ? 'asaas_rate_limited' : 'asaas_remote_error';
        throw new AsaasError(code, res.status, res.status === 429 || res.status >= 500);
      }
      const raw = await res.text();
      let result = null;
      if (raw) { try { result = JSON.parse(raw); } catch { throw new AsaasError('asaas_invalid_response', res.status, true); } }
      await onSuccess(new Date().toISOString());
      return result;
    } catch (error) {
      if (error instanceof AsaasError) throw error;
      throw new AsaasError(controller.signal.aborted ? 'asaas_timeout' : 'asaas_unreachable', 0, true);
    } finally { clearTimeout(timer); }
  };
  const pages = async function* (resource, { filters = {}, offset = 0, limit = 100, maxPages = 10000 } = {}) {
    if (!['payments', 'customers', 'subscriptions'].includes(resource)) throw new AsaasError('asaas_resource_invalid');
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(maxPages) || maxPages < 1) throw new AsaasError('asaas_pagination_invalid');
    for (let page = 0; page < maxPages; page++) {
      const query = new URLSearchParams({ ...filters, offset: String(offset), limit: String(limit) });
      const result = await request(`/${resource}?${query}`);
      if (!result || !Array.isArray(result.data) || typeof result.hasMore !== 'boolean' || result.data.length > limit ||
        (result.hasMore && !result.data.length)) throw new AsaasError('asaas_pagination_invalid');
      const nextOffset = offset + result.data.length;
      yield { data: result.data, offset, nextOffset, hasMore: result.hasMore };
      if (!result.hasMore) return;
      offset = nextOffset;
    }
    throw new AsaasError('asaas_page_limit', 0, true);
  };
  const checkAsaasConnection = async () => {
    const checked_at = new Date().toISOString();
    let cfg;
    try { cfg = getConfig(); } catch (error) {
      return { configured: false, reachable: false, authenticated: false, account_accessible: false,
        environment: null, checked_at, error: safeAsaasError(error) };
    }
    try {
      const account = await request('/myAccount/accountNumber');
      // A 200 with an unrelated body does not prove account access.
      if (!account || !account.account || !account.agency || account.accountDigit == null) {
        throw new AsaasError('asaas_account_response_invalid');
      }
      const account_reference = `${account.agency}:${account.account}:${account.accountDigit}`;
      if (!/^[0-9:-]{3,80}$/.test(account_reference)) throw new AsaasError('asaas_account_response_invalid');
      return { configured: true, reachable: true, authenticated: true, account_accessible: true,
        environment: BASES[cfg.baseUrl], account_reference, checked_at, error: null };
    } catch (error) {
      return { configured: true, reachable: error.status > 0, authenticated: false, account_accessible: false,
        environment: BASES[cfg.baseUrl], checked_at, error: safeAsaasError(error) };
    }
  };
  return { request, pages, checkAsaasConnection, getConfig };
}
const asaasFetch = (path, options) => createAsaasClient().request(path, options);
const checkAsaasConnection = () => createAsaasClient().checkAsaasConnection();
module.exports = { createAsaasClient, asaasFetch, checkAsaasConnection, AsaasError, safeAsaasError, BASES };
