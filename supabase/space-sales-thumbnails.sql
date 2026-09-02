-- Application-owned thumbnail metadata; source intelligence tables remain immutable.
create table if not exists public.app_call_thumbnails (
  meeting_id text primary key,
  thumbnail_url text,
  thumbnail_timestamp_seconds numeric check (thumbnail_timestamp_seconds is null or thumbnail_timestamp_seconds >= 0),
  status text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_call_thumbnails_status_idx on public.app_call_thumbnails (status, updated_at);
