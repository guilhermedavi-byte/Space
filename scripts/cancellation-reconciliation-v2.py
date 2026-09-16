"""Offline evidence reconciliation. Reads private exports; never writes to providers."""
import argparse, collections, csv, datetime, hashlib, json, pathlib

def reference(value):
    return hashlib.sha256(str(value).encode()).hexdigest()[:16]

def classify(user, today):
    cancel = user.get('cancelamento') or {}
    terminal = bool(cancel.get('dataEfetivacao') or cancel.get('desfecho'))
    if terminal:
        category = 'CHURNED'
    elif cancel.get('aulasSuspensas'):
        category = 'OPERATIONAL_SUSPENDED'
    elif cancel.get('origem') == 'abandono_confirmado':
        category = 'UNKNOWN'
    elif cancel.get('dataFimAviso'):
        category = 'OPERATIONAL_NOTICE_PERIOD'
    elif user.get('ativo') is True:
        category = 'OPERATIONAL_ACTIVE'
    else:
        category = 'UNKNOWN'
    reasons = ['contract_link_and_critical_dates_unavailable']
    conflicts = []
    end = str(cancel.get('dataFimAviso') or '')[:10]
    effective = str(cancel.get('dataEfetivacao') or '')[:10]
    if end and end < today and not terminal and user.get('ativo') is True:
        conflicts.append('past_notice_end_without_effectivation_while_active')
    if effective and end and effective < end:
        conflicts.append('legacy_effectivation_precedes_recorded_notice_end')
    if terminal and str(user.get('status') or '').lower() == 'ativo':
        conflicts.append('legacy_status_active_with_terminal_evidence')
    if not str(user.get('plano') or user.get('plan') or '').strip():
        reasons.append('missing_plan')
    if category == 'UNKNOWN':
        reasons.append('operational_eligibility_requires_review')
    return category, 'CONFLICT' if conflicts else 'AMBIGUOUS', reasons + conflicts

def run(private_dir, output_dir, today):
    users = json.loads((private_dir/'firestore-users-decoded.json').read_text())
    source = json.loads((private_dir/'firestore-real-export.json').read_text())
    students = [u for u in users if u.get('tipo') == 'student']
    text = (private_dir/'ui-students-2026-09-15.csv').read_text(encoding='utf-8-sig')
    ui = list(csv.DictReader(text.splitlines(), delimiter=';' if ';' in text.splitlines()[0] else ','))
    ui_ids = {r['alunoId'] for r in ui}
    assert ui_ids == {u['_document_id'] for u in students}, 'UI and Firestore populations differ; stop for review'
    pedagogical = json.loads((private_dir/'pedagogical-links.json').read_text())
    ped_counts = collections.Counter(r['aluno_id'] for r in pedagogical if r.get('aluno_id'))
    finance = json.loads((private_dir/'space_financeiro_cpf_sources-readonly.json').read_text())
    email = lambda r: str(r.get('email') or '').strip().lower()
    uf = collections.Counter(email(r) for r in students)
    ff = collections.Counter(email(r) for r in finance)
    by_email = {email(r):r for r in finance if email(r) and ff[email(r)] == 1 and uf[email(r)] == 1}
    records = []
    for u in sorted(students, key=lambda r:r['_document_id']):
        category, classification, reasons = classify(u, today)
        c = u.get('cancelamento') or {}
        f = by_email.get(email(u))
        records.append({
            'source_id_ref':reference(u['_document_id']), 'canonical_student_id':'',
            'firestore_document_verified':True, 'ui_id_exact_match':True,
            'persisted_uid_equals_doc_id':u.get('uid') == u['_document_id'],
            'persisted_auth_user_id_equals_doc_id':u.get('authUserId') == u['_document_id'],
            'operational_category_observed':category, 'classification':classification,
            'current_status_raw':u.get('status') or '', 'active_flag':u.get('ativo'),
            'current_plan':u.get('plano') or u.get('plan') or '',
            'contract_id':'', 'contract_start':'', 'contract_end':'',
            'duration_reported':u.get('tempoContrato') or '',
            'cancellation_requested_evidence':c.get('dataPedido') or '',
            'notice_end_evidence':c.get('dataFimAviso') or '',
            'effective_exit_evidence':c.get('dataEfetivacao') or '',
            'suspension_evidence':bool(c.get('aulasSuspensas')),
            'pedagogical_rows':ped_counts[u['_document_id']],
            'financial_customer_ref':reference(f['asaas_customer_id']) if f else '',
            'financial_match_evidence':'unique_normalized_email_both_sources' if f else 'no_verified_match',
            'confidence_evidence':'exact_UI_document_id; explicit_student_role',
            'reasons':'|'.join(reasons), 'recommended_action':'Resolve missing contract evidence and listed conflicts; do not backfill',
        })
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir/'canonical-reconciliation-v2.csv'
    with target.open('w') as fh:
        writer = csv.DictWriter(fh, fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
    classes = {k:0 for k in ['SAFE','SAFE_WITH_DEFAULT','AMBIGUOUS','CONFLICT','ORPHAN','INVALID','NOT_ELIGIBLE']}
    classes.update(collections.Counter(r['classification'] for r in records))
    summary = {
        'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'business_date':today,
        'architecture_scope':['Firestore','Supabase'], 'n8n_required':False,
        'firestore_export_complete_for_users':bool(source.get('completed_at')),
        'full_certification_complete':False, 'contract_reconciliation_complete':False,
        'users_documents':len(users), 'student_documents':len(students), 'ui_records':len(ui),
        'exact_ui_firestore_matches':len(records), 'ui_firestore_identity_match_percent':100,
        'auth_account_existence_live_verified':False,
        'operational_categories_observed':dict(collections.Counter(r['operational_category_observed'] for r in records)),
        'categories_note':'Evidence labels from legacy records, not certified canonical state. Suspension takes precedence over notice; terminal evidence takes precedence over legacy status.',
        'canonical_eligible_students':None,
        'denominator_blocker':'10 abandonment records remain UNKNOWN; contractual eligibility and conflicting lifecycle evidence unresolved. Do not silently exclude them.',
        'canonical_subscriptions':0, 'prepared_subscriptions':0, 'canonical_coverage_percent':None,
        'classification_counts':classes, 'without_plan':sum(not r['current_plan'] for r in records),
        'financial_customer_unique_email_matches':sum(bool(r['financial_customer_ref']) for r in records),
        'financial_source_rows':len(finance), 'financial_source_note':'Customer snapshots stored in Supabase, not payment/subscription/contract evidence; no external provider was accessed.',
        'pedagogical_exact_id_matches':sum(r['pedagogical_rows']>0 for r in records),
        'contract_start_verified':0, 'contract_link_verified':0,
        'raw_export_sha256':hashlib.sha256((private_dir/'firestore-real-export.json').read_bytes()).hexdigest(),
        'csv_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'public_pii_policy':'Pseudonymous IDs only; exact IDs, names and emails remain in private input files.',
        'production_writes':0, 'verdict':'DO NOT ENABLE',
    }
    (output_dir/'canonical-reconciliation-v2-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    return summary

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('private_dir',type=pathlib.Path);parser.add_argument('output_dir',type=pathlib.Path);parser.add_argument('--business-date',required=True)
    args=parser.parse_args();print(json.dumps(run(args.private_dir,args.output_dir,args.business_date),indent=2))
