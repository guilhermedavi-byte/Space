const { createHash } = require('crypto');
const lifecycle = require('../../assets/student-lifecycle');
const stableAnonId = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const isLegacyStudent = row => ['student','aluno'].includes(String(row.tipo || row.role || row.type || row.perfil || '').toLowerCase()) || !!(row.professorId || row.teacherId || row.cancelamento || Array.isArray(row.cancelamentosAnteriores));
const normalizeLegacyCancellationRecord = value => value && typeof value === 'object' ? {
  ...value, dataPedido: value.dataPedido || value.data_pedido || null,
  dataFimAviso: value.dataFimAviso || value.dataFimPrevista || value.data_fim_aviso || null,
  eventos: Array.isArray(value.eventos) ? value.eventos : Array.isArray(value.historico) ? value.historico : [],
} : null;
const validInstant = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
function classify(record) {
  const ordered = record.eventos.filter(e => validInstant(e.data || e.createdAt)).slice().sort((a,b) => Date.parse(a.data || a.createdAt) - Date.parse(b.data || b.createdAt));
  const terminal = ordered.filter(e => /revert|retra|churn|efetiva/i.test(e.acao || e.event_type || ''));
  const last = terminal.at(-1);
  const outcome = String(record.desfecho?.tipo || record.desfecho || '').toLowerCase();
  const reversed = /revert|saved/.test(outcome) || /revert|retra/i.test(last?.acao || last?.event_type || '');
  if (reversed && last && /churn|efetiva/i.test(last.acao || last.event_type || '')) return { error: 'conflicting_terminal_events' };
  const requested = validInstant(record.dataPedido);
  if (!requested) return { error: 'missing_request_date' };
  if (reversed) {
    const reverted = validInstant(record.dataReversao || record.dataEfetivacao || last?.data || last?.createdAt);
    if (!reverted || reverted < requested) return { error: 'missing_or_invalid_reversal_date' };
    return { status: 'active', stage: 'saved', requested, reverted };
  }
  const start = validInstant(record.notice_started_at || record.dataInicioAviso);
  if (!start) {
    if (record.dataEfetivacao || record.desfecho) return { error: 'terminal_record_without_explicit_notice' };
    return { status: 'cancellation_requested', stage: 'open', requested, warning: record.dataFimAviso ? 'legacy_end_does_not_prove_notice' : null };
  }
  if (start < requested) return { error: 'notice_before_request' };
  const dates = lifecycle.noticeDates(start);
  if (record.dataFimAviso && lifecycle.dateKey(record.dataFimAviso) !== dates.last_active_date) return { error: 'conflicting_last_active_date' };
  const effective = validInstant(record.dataEfetivacao);
  if (effective && lifecycle.dateKey(effective) !== dates.churn_at) return { error: 'ambiguous_effective_churn_date' };
  return { status: effective ? 'churned' : 'cancellation_scheduled', stage: effective ? 'lost' : 'scheduled', requested, effective, ...dates };
}
function buildLegacyRetentionImportSnapshot({ users = [], dryRun = true, importedAt = new Date().toISOString() } = {}) {
  const payload = { dry_run: !!dryRun, students: [], subscriptions: [], cases: [], events: [] };
  const report = { dryRun: !!dryRun, scannedUsers: users.length, importedStudents: 0, openCases: 0, closedCases: 0, importedEvents: 0, anonymizedStudents: [], exceptions: [] };
  for (const row of users) {
    if (!isLegacyStudent(row)) continue;
    const id = String(row.firestoreDocId || row.id || '').trim();
    if (!id) continue;
    const records = [...(Array.isArray(row.cancelamentosAnteriores) ? row.cancelamentosAnteriores : []), row.cancelamento].map(normalizeLegacyCancellationRecord).filter(Boolean);
    const classified = records.map(record => { try { return { record, state: classify(record) }; } catch { return { record, state: { error: 'invalid_contract_date' } }; } });
    for (const { record, state } of classified) if (state.error || state.warning) report.exceptions.push({ identifier: stableAnonId(id), record_ref: stableAnonId(JSON.stringify(record)), reason: state.error || state.warning,
      conflicting_data: { requested_at: record.dataPedido || null, legacy_end: record.dataFimAviso || null, effective_at: record.dataEfetivacao || null }, manual_action: 'Reconcile dated retention events and contract; do not infer a notice or churn date.' });
    const current = classified.find(x => x.record === row.cancelamento) || (row.cancelamento ? classified.at(-1) : null);
    if (current?.state.error || (row.ativo === false && !current?.state.effective)) {
      if (!current?.state.error) report.exceptions.push({ identifier: stableAnonId(id), reason: 'inactive_does_not_prove_churn', conflicting_data: { active: false }, manual_action: 'Identify administrative deactivation versus effective contract churn.' });
      continue;
    }
    const status = current?.state.status || 'active';
    const student = { firestore_student_id: id, full_name: String(row.nome || row.name || 'Aluno'), email: row.email || null, phone: row.telefone || null,
      lifecycle_status: status, pause_status: row.pause_status || 'none', source_system: 'legacy_import', legacy_source: { legacy_doc: id, imported_at: importedAt }, legacy_confidence: 'medium' };
    payload.students.push(student);
    const state = current?.state || {};
    payload.subscriptions.push({ firestore_student_id: id, external_subscription_key: `firestore:${id}`, plan_name: row.plano || row.plan || null,
      billing_cycle: 'monthly', lifecycle_status: status, pause_status: student.pause_status, financial_status: row.financial_status || 'unknown',
      started_at: validInstant(row.createdAt || row.dataCadastro), cancellation_requested_at: state.requested || null, notice_started_at: state.notice_started_at || null,
      last_active_date: state.last_active_date || null, churn_at: state.churn_at || null, ended_at: state.effective || null, source_system: 'legacy_import' });
    report.importedStudents++;
    report.anonymizedStudents.push({ studentRef: stableAnonId(id), lifecycleStatus: status, pauseStatus: student.pause_status });
    for (const { record, state: s } of classified) {
      if (s.error) continue;
      const source_ref = `legacy:${id}:${stableAnonId(JSON.stringify(record))}`;
      const item = { firestore_student_id: id, external_subscription_key: `firestore:${id}`, source_ref, case_kind: 'legacy_import', stage: s.stage,
        lifecycle_status: s.status, pause_status: student.pause_status, financial_status: student.financial_status || 'unknown',
        cancellation_requested_at: s.requested, saved_at: s.reverted || null, notice_started_at: s.notice_started_at || null, last_active_date: s.last_active_date || null,
        churn_at: s.churn_at || null, churned_at: s.effective || null, created_at: s.requested, closed_at: s.reverted || s.effective || null,
        scheduled_service_end_at: s.last_active_date ? `${s.last_active_date}T12:00:00-03:00` : null,
        close_reason: s.reverted ? 'saved' : s.effective ? 'churned' : null, source_system: 'legacy_import', legacy_source: { imported_from: 'users.cancelamento', original_record: record }, legacy_confidence: 'high' };
      payload.cases.push(item);
      if (item.closed_at) report.closedCases++; else report.openCases++;
      const facts = [{ type: 'register_formal_request', at: s.requested }];
      if (s.reverted) facts.push({ type: 'retract_cancellation', at: s.reverted });
      if (s.notice_started_at) facts.push({ type: 'confirm_cancellation_continuity', at: s.notice_started_at });
      if (s.effective) facts.push({ type: 'cancellation_effective', at: s.effective });
      for (const fact of facts) payload.events.push({ firestore_student_id: id, external_subscription_key: `firestore:${id}`, source_ref,
        event_type: fact.type, occurred_at: fact.at, client_action_id: `${source_ref}:${fact.type}`, idempotency_key: `${source_ref}:${fact.type}`,
        payload: { reason: record.motivo || '', notice_started_at: s.notice_started_at || null, original_record: record }, source_system: 'legacy_import', source_confidence: 'high' });
    }
  }
  report.importedEvents = payload.events.length;
  return { payload, report };
}
module.exports = { isLegacyStudent, normalizeLegacyCancellationRecord, buildLegacyRetentionImportSnapshot, classify };
