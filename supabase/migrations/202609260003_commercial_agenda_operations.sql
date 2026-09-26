-- Operational agenda management. Source of truth remains commercial_bookings.
alter table public.commercial_bookings
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by text,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text,
  add column if not exists rescheduled_at timestamptz,
  add column if not exists rescheduled_by text,
  add column if not exists previous_start_at timestamptz,
  add column if not exists previous_end_at timestamptz,
  add column if not exists calendar_sync_status text not null default 'not_applicable'
    check (calendar_sync_status in ('not_applicable','pending','synced','failed')),
  add column if not exists calendar_sync_error text,
  add column if not exists notification_5min_sent_at timestamptz;

create index if not exists commercial_bookings_status_start_idx
  on public.commercial_bookings(status,start_at);
create index if not exists commercial_bookings_premeeting_idx
  on public.commercial_bookings(sdr_uid,start_at)
  where notification_5min_sent_at is null and status in ('confirmed','pending');

create table if not exists public.commercial_booking_audit_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.commercial_bookings(id),
  action text not null check (action in ('confirm','reschedule','cancel')),
  actor_uid text not null,
  state_before jsonb not null default '{}'::jsonb,
  state_after jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists commercial_booking_audit_booking_idx
  on public.commercial_booking_audit_events(booking_id,created_at desc);
alter table public.commercial_booking_audit_events enable row level security;
revoke all on public.commercial_booking_audit_events from anon,authenticated;
grant select,insert on public.commercial_booking_audit_events to service_role;

notify pgrst, 'reload schema';
