// Read-only inventory. Never calls provisioning, imports, business RPCs or webhooks.
// Usage: node --env-file=.env.local scripts/audit-cancellation-lifecycle.js
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { supabaseFetch } = require('../api/_lib/supabase-rest');
const { listCollectionAsAdmin } = require('../api/_lib/firestore-admin');
const anon = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const tables = ['students', 'subscriptions', 'service_periods', 'retention_cases', 'retention_events',
  'subscription_status_history', 'pause_status_history', 'financial_status_history', 'charges', 'payments',
  'outbox_events', 'monthly_base_snapshots', 'kpi_formula_versions', 'kpi_monthly_snapshots',
  'n8n_alunos_financeiro_space', 'n8n_cobrancas_financeiras_space', 'n8n_pagamentos_asaas_space',
  'n8n_aulas_pedagogicas_space', 'n8n_onboarding_alunos_space'];
const safeError = (error) => ({ status: error?.status || null,
  code: /^[\w-]{1,100}$/.test(error?.code || '') ? error.code :
    /^[\w-]{1,100}$/.test(error?.message || '') ? error.message : 'read_failed' });

async function audit({ outputDir = path.resolve(__dirname, '../artifacts/cancellation-audit') } = {}) {
  const report = { observed_at: new Date().toISOString(), mode: 'READ_ONLY',
    endpoint_ref: anon(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'unconfigured'),
    scope: 'Configured environment only; visibility is not proof of production completeness.', tables: [], firestore: null };
  // Single-row bounded schema/visibility probes; no PII is persisted or logged.
  for (const table of tables) {
    try {
      const result = await supabaseFetch(`/${table}?select=*&limit=1`, { method: 'GET' });
      if (!Array.isArray(result.data)) throw new Error('unexpected_response_shape');
      report.tables.push({ table, status: result.status, sampled_rows: result.data.length,
        columns: Object.keys(result.data[0] || {}), completeness: 'NOT_ASSESSED' });
    } catch (error) { report.tables.push({ table, ...safeError(error), completeness: 'BLOCKED' }); }
  }
  const exceptions = { observed_at: report.observed_at, applied: false, completeness: 'NOT_ASSESSED', records: [] };
  try {
    const users = await listCollectionAsAdmin('users');
    const students = users.filter(row => ['student', 'aluno'].includes(String(row.tipo || row.role || '').toLowerCase()));
    report.firestore = { status: 'READ', student_count: students.length, cancellation_count: 0, history_count: 0, inactive_count: 0 };
    for (const row of students) {
      if (row.ativo === false) report.firestore.inactive_count++;
      if (row.cancelamento) report.firestore.cancellation_count++;
      const history = Array.isArray(row.cancelamentosAnteriores) ? row.cancelamentosAnteriores : [];
      report.firestore.history_count += history.length;
      const records = [row.cancelamento, ...history].filter(Boolean);
      records.forEach((record, index) => {
        // No new field or mapping is inferred from an ambiguous legacy record.
        exceptions.records.push({ student_ref: anon(row.firestoreDocId || row.id), record_index: index,
          reason: 'legacy_cancellation_requires_event_and_contract_reconciliation',
          has_request_date: !!record.dataPedido, has_legacy_end: !!record.dataFimAviso,
          has_outcome: !!record.desfecho, has_effective_date: !!record.dataEfetivacao });
      });
      if (row.ativo === false && !records.length) exceptions.records.push({ student_ref: anon(row.firestoreDocId || row.id),
        reason: 'inactive_does_not_prove_churn' });
    }
    exceptions.completeness = 'FIRESTORE_SCAN_ONLY_NO_CROSS_SYSTEM_RECONCILIATION';
  } catch (error) {
    report.firestore = { status: 'BLOCKED', error: safeError(error) };
    exceptions.completeness = 'BLOCKED_FIRESTORE_READ';
  }
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'readonly-inventory.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(outputDir, 'backfill-exceptions.json'), JSON.stringify(exceptions, null, 2) + '\n');
  return { tables_probed: tables.length, firestore_status: report.firestore.status,
    exception_scan: exceptions.completeness, output_dir: outputDir };
}
if (require.main === module) audit().then(result => console.log(JSON.stringify(result))).catch(error => {
  console.error(JSON.stringify(safeError(error))); process.exitCode = 1;
});
module.exports = { audit };
