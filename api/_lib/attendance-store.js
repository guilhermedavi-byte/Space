const { supabaseFetch } = require('./supabase-rest');
const { assertAttendanceEnvironment, uuid, text, integer, only, validateInbound, validateMessage, validateCommand } = require('./attendance-domain');

const createAttendanceStore = ({ request = supabaseFetch, checkEnvironment = assertAttendanceEnvironment } = {}) => {
  const rpc = async (name, body) => {
    checkEnvironment();
    const response = await request(`/rpc/${name}`, { method: 'POST', body });
    return response.data;
  };
  return {
    // Internal adapter contract, deliberately not reachable through the browser API.
    ingestMessage: (event) => rpc('attendance_ingest_message', { p_event: validateInbound(event) }),
    appendMessage: ({ actorUid, conversationId, message }) => rpc('attendance_append_message', {
      p_actor_uid: text(actorUid), p_conversation_id: uuid(conversationId), p_message: validateMessage(message),
    }),
    updateConversation: ({ actorUid, conversationId, command, allowIdentity = false }) => rpc('attendance_update_conversation', {
      p_actor_uid: text(actorUid), p_conversation_id: uuid(conversationId), p_command: validateCommand(command, { allowIdentity }),
    }),
    markRead: ({ actorUid, conversationId, sequence }) => rpc('attendance_mark_read', {
      p_actor_uid: text(actorUid), p_conversation_id: uuid(conversationId), p_sequence: integer(sequence, 0, Number.MAX_SAFE_INTEGER),
    }),
    getConversation: ({ actorUid, conversationId, view = 'detail', after = 0, limit = 50 }) => {
      if (!['detail', 'messages'].includes(view)) throw Object.assign(new Error('attendance_invalid_view'), { status: 422 });
      return rpc('attendance_get_conversation', { p_actor_uid: text(actorUid), p_conversation_id: uuid(conversationId),
        p_view: view, p_after: integer(after, 0, Number.MAX_SAFE_INTEGER), p_limit: integer(limit, 1, 100) });
    },
    listConversations: ({ actorUid, filters = {} }) => {
      only(filters, ['team_id', 'assigned_user_uid', 'status', 'before_time', 'before_id', 'limit']);
      if (filters.team_id != null) uuid(filters.team_id);
      if (filters.before_id != null) uuid(filters.before_id);
      integer(filters.limit ?? 50, 1, 100);
      return rpc('attendance_list_conversations', { p_actor_uid: text(actorUid), p_filters: filters });
    },
  };
};

module.exports = { createAttendanceStore, ...createAttendanceStore() };
