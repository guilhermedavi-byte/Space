-- M9 manual audit evidence. Does not mutate intelligence outputs.
create table if not exists public.app_call_calibration_audits (
  id uuid primary key default gen_random_uuid(), meeting_id text not null,
  reviewer text not null, speaker_mapping text not null check (speaker_mapping in ('pass','fail','unknown')),
  talk_ratio text not null check (talk_ratio in ('pass','fail','unknown')),
  objections text not null check (objections in ('pass','fail','unknown')),
  timeline_alignment text not null check (timeline_alignment in ('pass','fail','unknown')),
  crm_outcome text not null check (crm_outcome in ('pass','fail','unknown')),
  thumbnail_quality text not null check (thumbnail_quality in ('pass','fail','unknown')),
  notes text, created_at timestamptz not null default now()
);
create index if not exists app_call_calibration_meeting_idx on public.app_call_calibration_audits (meeting_id, created_at desc);
