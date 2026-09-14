-- Application-owned UI state only. Intelligence tables remain immutable.
create table if not exists public.app_coaching_items (
  id uuid primary key default gen_random_uuid(), closer text not null, meeting_id text,
  source text not null, title text not null, description text not null,
  success_metric text, status text not null default 'active' check (status in ('active','completed','dismissed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.app_coaching_item_events (
  id uuid primary key default gen_random_uuid(), coaching_item_id uuid not null references public.app_coaching_items(id) on delete cascade,
  event_type text not null check (event_type in ('created','completed','dismissed','reactivated')),
  note text, created_at timestamptz not null default now()
);
create index if not exists app_coaching_items_closer_status_idx on public.app_coaching_items (closer, status);
create index if not exists app_coaching_item_events_item_idx on public.app_coaching_item_events (coaching_item_id, created_at desc);

create or replace function public.app_set_coaching_status(p_item_id uuid, p_status text, p_note text default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_status not in ('active', 'completed', 'dismissed') then raise exception 'invalid coaching status'; end if;
  update public.app_coaching_items set status = p_status, updated_at = now() where id = p_item_id;
  if not found then raise exception 'coaching item not found'; end if;
  insert into public.app_coaching_item_events(coaching_item_id, event_type, note)
  values (p_item_id, case when p_status = 'active' then 'reactivated' else p_status end, p_note);
end;
$$;
