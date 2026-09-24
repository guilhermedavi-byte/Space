create extension if not exists pgcrypto;

create table if not exists public.voice_phone_identities (
  space_user_uid text primary key,
  space_user_email text,
  provider text not null default 'telnyx' check (provider in ('telnyx')),
  telnyx_credential_id text not null,
  telnyx_login text,
  caller_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'telnyx' check (provider in ('telnyx')),
  source text not null check (source in ('space_webrtc', 'legacy_sip')),
  direction text not null check (direction in ('outbound', 'inbound')),
  space_user_uid text not null,
  space_user_email text,
  lead_id text,
  opportunity_id text,
  lead_name text,
  from_number text not null,
  to_number text not null,
  telnyx_call_control_id text,
  telnyx_call_leg_id text,
  telnyx_call_session_id text,
  status text not null default 'created' check (status in ('created', 'connecting', 'ringing', 'active', 'ending', 'ended', 'failed')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_calls_user_created_idx on public.voice_calls (space_user_uid, created_at desc);
create index if not exists voice_calls_telnyx_leg_idx on public.voice_calls (telnyx_call_leg_id) where telnyx_call_leg_id is not null;
create index if not exists voice_calls_telnyx_session_idx on public.voice_calls (telnyx_call_session_id) where telnyx_call_session_id is not null;
create unique index if not exists voice_calls_telnyx_leg_unique_idx on public.voice_calls (telnyx_call_leg_id) where telnyx_call_leg_id is not null;
