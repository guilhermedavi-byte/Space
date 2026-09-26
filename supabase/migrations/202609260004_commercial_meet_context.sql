-- Space Sales + Google Meet context. commercial_bookings remains the source of truth.
alter table public.commercial_bookings
  add column if not exists meeting_provider text check (meeting_provider is null or meeting_provider in ('google_meet')),
  add column if not exists meeting_url text,
  add column if not exists meeting_code text,
  add column if not exists meeting_notes text,
  add column if not exists meeting_notes_updated_at timestamptz,
  add column if not exists meeting_notes_updated_by text;

create index if not exists commercial_bookings_meeting_code_idx
  on public.commercial_bookings(meeting_code)
  where meeting_code is not null;
create index if not exists commercial_bookings_meeting_url_idx
  on public.commercial_bookings(meeting_url)
  where meeting_url is not null;

alter table public.commercial_booking_audit_events
  drop constraint if exists commercial_booking_audit_events_action_check;
alter table public.commercial_booking_audit_events
  add constraint commercial_booking_audit_events_action_check
  check (action in ('confirm','reschedule','cancel','notes'));
