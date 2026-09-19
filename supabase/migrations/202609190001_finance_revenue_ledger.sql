begin;
create table if not exists public.finance_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.finance_connection_state(connection_id),
  economic_event_id text not null,
  asaas_payment_id text,
  customer_id text,
  student_id text,
  source_type text not null,
  economic_nature text not null check (economic_nature in ('CUSTOMER_PAYMENT','CUSTOMER_PAYMENT_EXTERNAL','CUSTOMER_PAYMENT_UNALLOCATED','TREASURY_TRANSFER','OWNER_REIMBURSEMENT','CAPITAL_CONTRIBUTION','OWNER_LOAN','INTERNAL_TRANSFER','REFUND','NON_REVENUE','UNCLASSIFIED')),
  amount numeric not null check (amount >= 0 or economic_nature='REFUND'),
  competence_date date,
  revenue_recognized boolean not null default false,
  cash_status text not null,
  reconciliation_status text not null,
  classification_source text,
  audit_reference text,
  reason text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id,economic_event_id)
);
create index if not exists finance_revenue_ledger_competence_idx on public.finance_revenue_ledger(connection_id,competence_date);
create index if not exists finance_revenue_ledger_revenue_idx on public.finance_revenue_ledger(connection_id,revenue_recognized,competence_date);
create index if not exists finance_revenue_ledger_cash_idx on public.finance_revenue_ledger(connection_id,cash_status,competence_date);
create index if not exists finance_revenue_ledger_event_idx on public.finance_revenue_ledger(connection_id,economic_event_id);
create index if not exists finance_revenue_ledger_payment_idx on public.finance_revenue_ledger(connection_id,asaas_payment_id);

create table if not exists public.finance_revenue_ledger_audit (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null,
  economic_event_id text not null,
  before_state jsonb,
  after_state jsonb,
  actor text not null default 'system',
  reason text,
  source text not null,
  created_at timestamptz not null default now()
);
create index if not exists finance_revenue_ledger_audit_event_idx on public.finance_revenue_ledger_audit(connection_id,economic_event_id,created_at desc);

alter table public.finance_revenue_ledger enable row level security;
alter table public.finance_revenue_ledger_audit enable row level security;
revoke all on public.finance_revenue_ledger from public;
revoke all on public.finance_revenue_ledger_audit from public;
do $$ declare r text; begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if exists(select 1 from pg_roles where rolname=r) then
      execute format('revoke all on public.finance_revenue_ledger from %I',r);
      execute format('revoke all on public.finance_revenue_ledger_audit from %I',r);
    end if;
  end loop;
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant select,insert,update on public.finance_revenue_ledger to service_role;
    grant select,insert on public.finance_revenue_ledger_audit to service_role;
  end if;
end $$;
commit;
