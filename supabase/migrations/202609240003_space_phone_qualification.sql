create table if not exists public.voice_call_qualifications (
  id uuid primary key default gen_random_uuid(),
  voice_call_id uuid not null references public.voice_calls(id) on delete cascade,
  space_user_uid text not null,
  context text,
  pain_goal text,
  experience text,
  urgency text,
  decision_investment text,
  key_point text,
  ai_context text,
  ai_pain_goal text,
  ai_experience text,
  ai_urgency text,
  ai_decision_investment text,
  ai_key_point text,
  final_summary text,
  status text not null default 'draft' check (status in ('draft','ai_processing','review_required','complete','sent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  datacrazy_lead_id text,
  datacrazy_note_id text,
  datacrazy_synced_at timestamptz,
  datacrazy_sync_status text,
  datacrazy_sync_error text,
  unique (voice_call_id)
);

alter table public.voice_call_qualifications enable row level security;

create index if not exists voice_call_qualifications_user_idx on public.voice_call_qualifications (space_user_uid, updated_at desc);
create index if not exists voice_call_qualifications_status_idx on public.voice_call_qualifications (status, updated_at desc);
create index if not exists voice_call_qualifications_datacrazy_idx on public.voice_call_qualifications (datacrazy_sync_status, updated_at desc) where datacrazy_sync_status is not null;
