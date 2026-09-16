-- Narrow automation read model for Attendance context.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.automation_get_attendance_message_context(
  p_message_id uuid,
  p_conversation_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  m public.messages;
  c public.conversations;
  ct public.contacts;
  ci public.contact_identities;
begin
  select * into m
  from public.messages
  where message_id = p_message_id
    and (p_conversation_id is null or conversation_id = p_conversation_id)
  limit 1;

  if not found then
    return jsonb_build_object('attendance', jsonb_build_object());
  end if;

  select * into c
  from public.conversations
  where conversation_id = coalesce(p_conversation_id, m.conversation_id)
  limit 1;

  if found and c.contact_id is not null then
    select * into ct
    from public.contacts
    where contact_id = c.contact_id
    limit 1;

    select * into ci
    from public.contact_identities
    where contact_id = c.contact_id
    order by (normalized_phone is null), created_at asc
    limit 1;
  end if;

  return jsonb_build_object(
    'attendance', jsonb_build_object(
      'message', jsonb_build_object(
        'message_id', m.message_id,
        'conversation_id', m.conversation_id,
        'direction', m.direction,
        'kind', m.kind,
        'received_at', m.received_at,
        'provider_timestamp', m.provider_timestamp,
        'external_message_id', m.external_message_id
      ),
      'conversation', case when c.conversation_id is null then null else jsonb_build_object(
        'conversation_id', c.conversation_id,
        'contact_id', c.contact_id,
        'team_id', c.team_id,
        'channel_id', c.channel_id,
        'status', c.status
      ) end,
      'contact', case when ct.contact_id is null then null else jsonb_build_object(
        'contact_id', ct.contact_id,
        'display_name', ct.display_name
      ) end,
      'identity', case when ci.contact_identity_id is null then null else jsonb_build_object(
        'contact_identity_id', ci.contact_identity_id,
        'identifier_type', ci.identifier_type,
        'external_identifier', ci.external_identifier,
        'phone_raw', ci.phone_raw,
        'normalized_phone', ci.normalized_phone,
        'phone_normalization_state', ci.phone_normalization_state
      ) end
    )
  );
end $$;

revoke execute on function public.automation_get_attendance_message_context(uuid, uuid) from public, anon, authenticated;
grant execute on function public.automation_get_attendance_message_context(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
