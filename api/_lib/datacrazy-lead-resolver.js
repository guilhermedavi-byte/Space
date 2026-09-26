const clean = value => String(value ?? '').trim();
const digits = value => clean(value).replace(/\D/g, '');
const variants = phone => [...new Set([digits(phone), `+${digits(phone)}`, digits(phone).slice(-10)])].filter(value => digits(value).length >= 8);
const phoneMatches = (stored, wanted) => require('../../src/international-phone/core').phonesMatch(stored, wanted, { defaultCountry: 'US', preferCountry: true });

const phones = lead => [lead?.phone, lead?.rawPhone, ...(lead?.contacts || []).filter(c => /whatsapp/i.test(c.platform || '')).map(c => c.contactId || c.phone)];
const leadMatch = (source, lead, wanted, dealId = '') => lead?.id && phones(lead).some(phone => phoneMatches(phone, wanted)) ? [{ source, datacrazyContactId: clean(lead.id), datacrazyDealId: clean(dealId), phone: clean(lead.phone), name: clean(lead.name) }] : [];
const sources = [
  { table: 'n8n_estado_leads_comercial_space', fields: ['telefone_normalizado'], select: 'telefone_normalizado,nome_lead,datacrazy_contact_id,datacrazy_deal_id', extract: (r, p) => leadMatch('n8n_estado_leads_comercial_space', { id: r.datacrazy_contact_id || r.lead_id, phone: r.telefone_normalizado, name: r.nome_lead }, p, r.datacrazy_deal_id) },
  { table: 'n8n_sales_call_outcome_enrichment_space', fields: ['raw_lead_match->>candidates'], select: 'datacrazy_lead_id,datacrazy_business_id,raw_lead_match', extract: (r, p) => (r.raw_lead_match?.candidates || []).flatMap(lead => leadMatch('n8n_sales_call_outcome_enrichment_space', lead, p, lead.id === r.datacrazy_lead_id ? r.datacrazy_business_id : '')) },
  { table: 'n8n_datacrazy_alunos_space', fields: ['telefone_normalizado', 'telefone', 'raw_payload->lead->>phone'], select: 'telefone,telefone_normalizado,raw_payload', extract: (r, p) => leadMatch('n8n_datacrazy_alunos_space', { ...r.raw_payload?.lead, phone: r.raw_payload?.lead?.phone || r.telefone_normalizado || r.telefone }, p, r.raw_payload?.id) },
  { table: 'datacrazy_businesses', fields: ['payload->lead->>phone'], select: 'payload', extra: '&deleted_at=is.null', extract: (r, p) => leadMatch('datacrazy_businesses', r.payload?.lead, p, r.payload?.id) },
];
const localMatches = async (phone, request) => {
  const suffixPattern = `*${digits(phone).slice(-8).split('').join('*')}*`;
  const results = await Promise.all(sources.map(async source => {
    const filters = source.fields.flatMap(field => [...variants(phone).map(value => `${field}.ilike.*${encodeURIComponent(value)}*`), `${field}.ilike.${suffixPattern}`]);
    try {
      const response = await request(`/${source.table}?select=${source.select}&or=(${filters.join(',')})${source.extra || ''}&limit=101`, { timeoutMs: 12000 });
      if (!Array.isArray(response?.data)) throw Object.assign(new Error('datacrazy_local_response_invalid'), { status: 502 });
      return { matches: response.data.flatMap(row => source.extract(row, phone)), incomplete: response.data.length >= 101 };
    } catch (error) {
      // An absent optional mirror is not a failed search. Infra/auth/query failures must surface.
      if (error?.code === 'PGRST205' || error?.code === '42P01') return { matches: [], incomplete: false };
      throw error;
    }
  }));
  return { matches: results.flatMap(r => r.matches), incomplete: results.some(r => r.incomplete) };
};

// Same read endpoint/search/pagination contract as @growsalesai/n8n-nodes-datacrazy lead.getAll.
const remoteMatches = async (phone, { fetchImpl = fetch, base = process.env.CRM_API_BASE_URL, apiKey = process.env.CRM_API_KEY } = {}) => {
  if (!clean(base) || !clean(apiKey) || base.includes('[SENSITIVE]') || apiKey.includes('[SENSITIVE]')) throw Object.assign(new Error('datacrazy_remote_not_configured'), { status: 503 });
  const origin = new URL(base);
  if (origin.protocol !== 'https:') throw Object.assign(new Error('datacrazy_remote_invalid_url'), { status: 503 });
  const matches = [];
  const deadline = Date.now() + 25000;
  for (const search of variants(phone)) {
    let complete = false;
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({ search, skip: String(page * 100), take: '100' });
      if (Date.now() >= deadline) throw Object.assign(new Error('datacrazy_remote_timeout'), { status: 504 });
      let response;
      try {
        response = await fetchImpl(`${base.replace(/\/+$/, '')}/api/v1/leads?${params}`, { headers: { Authorization: `Bearer ${apiKey.trim()}` }, redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))) });
      } catch { throw Object.assign(new Error('datacrazy_remote_transport_failed'), { status: 502 }); }
      if (!response.ok) throw Object.assign(new Error('datacrazy_remote_lookup_failed'), { status: 502, upstreamStatus: response.status });
      let payload;
      try { payload = await response.json(); } catch { throw Object.assign(new Error('datacrazy_remote_response_invalid'), { status: 502 }); }
      const items = [payload, payload?.items, payload?.data?.items, payload?.data, payload?.leads].find(Array.isArray);
      if (!items) throw Object.assign(new Error('datacrazy_remote_response_invalid'), { status: 502 });
      matches.push(...items.flatMap(lead => leadMatch('datacrazy_api', lead, phone)));
      if (items.length < 100) { complete = true; break; }
    }
    if (!complete) return { matches, incomplete: true };
  }
  return { matches, incomplete: false };
};
module.exports = { localMatches, remoteMatches, variants, phoneMatches };
