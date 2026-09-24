alter table if exists public.voice_calls
  add column if not exists notes text,
  add column if not exists outcome text,
  add column if not exists callback_at timestamptz,
  add column if not exists ended_reason text;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'voice_calls'
  ) and not exists (
    select 1 from pg_constraint where conname = 'voice_calls_outcome_chk'
  ) then
    alter table public.voice_calls
      add constraint voice_calls_outcome_chk
      check (
        outcome is null or outcome in (
          'nao_atendeu',
          'ocupado',
          'numero_invalido',
          'caixa_postal',
          'sem_interesse',
          'retornar_depois',
          'interessado',
          'agendado'
        )
      );
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'voice_calls'
  ) then
    create index if not exists voice_calls_sdr_started_idx
      on public.voice_calls (sdr_uid, started_at desc)
      where started_at is not null;

    create index if not exists voice_calls_callback_idx
      on public.voice_calls (callback_at)
      where callback_at is not null;
  end if;
end $$;
