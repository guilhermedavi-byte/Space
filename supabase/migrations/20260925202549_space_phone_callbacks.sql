-- Reuse the original call as the unique callback identity; no duplicate reminder rows.
alter table public.voice_calls
  add column if not exists callback_status text not null default 'scheduled'
    check (callback_status in ('scheduled','snoozed','completed','cancelled')),
  add column if not exists callback_source_call_id uuid references public.voice_calls(id);
create index if not exists voice_calls_pending_callbacks_idx
  on public.voice_calls (space_user_uid, callback_at, id)
  where callback_at is not null and callback_status in ('scheduled','snoozed');
-- due/overdue are derived from callback_at, so no cron mutation is required.
