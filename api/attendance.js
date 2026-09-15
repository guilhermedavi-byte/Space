const { readJsonBody, sendJson } = require('../_lib/http');
const { requireAttendanceAuth, requireAssignableAttendanceUser } = require('./_lib/attendance-auth');
const { assertAttendanceEnvironment, fail, only } = require('./_lib/attendance-domain');
const store = require('./_lib/attendance-store');

const publicError = (error) => {
  const codes = { '42501': 403, '23505': 409, PT409: 409, '40001': 409, '23503': 422, '23514': 422, '23502': 422, '22023': 422, '22P02': 422, '22007': 422, '22008': 422 };
  const status = codes[error?.code] || (Number(error?.status) >= 400 && Number(error?.status) < 500 ? error.status : 503);
  const message = String(error?.message || '');
  const safe = /^(attendance_[a-z_]+|unauthenticated)$/.test(message) ? message : 'attendance_request_failed';
  return { status, body: { error: safe } };
};

const createHandler = ({ authenticate = requireAttendanceAuth, validateAssignee = requireAssignableAttendanceUser, repository = store, checkEnvironment = assertAttendanceEnvironment } = {}) => async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST'); return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  try {
    checkEnvironment();
    if (req.method === 'GET') {
      const actor = await authenticate(req, 'attendance.view');
      const url = new URL(req.url || '/api/attendance', 'https://space.invalid');
      const id = url.searchParams.get('conversation_id');
      const result = id
        ? await repository.getConversation({ actorUid: actor.uid, conversationId: id, view: url.searchParams.get('view') || 'detail',
          after: Number(url.searchParams.get('after') || 0), limit: Number(url.searchParams.get('limit') || 50) })
        : await repository.listConversations({ actorUid: actor.uid,
          filters: Object.fromEntries([...url.searchParams].map(([k, v]) => [k, k === 'limit' ? Number(v) : v])) });
      return sendJson(res, 200, result);
    }
    const actor = await authenticate(req, 'attendance.manage');
    const body = await readJsonBody(req).catch(() => fail('attendance_invalid_json', 400));
    only(body, ['action', 'conversation_id', 'message', 'command', 'sequence']);
    const args = { actorUid: actor.uid, conversationId: body.conversation_id };
    if (body.action === 'message') {
      const result = await repository.appendMessage({ ...args, message: body.message });
      // pending only; this foundation never dispatches to any external provider.
      return sendJson(res, 202, result);
    }
    if (body.action === 'update') {
      if (body.command?.action === 'assignment' && body.command.assigned_user_uid) {
        // First prove access to the conversation, then read the target Firestore user.
        const current = await repository.getConversation(args);
        if (current.permissions?.can_assign !== true) fail('attendance_forbidden', 403);
        await validateAssignee(body.command.assigned_user_uid);
      }
      return sendJson(res, 200, await repository.updateConversation({ ...args, command: body.command }));
    }
    if (body.action === 'read') return sendJson(res, 200, await repository.markRead({ ...args, sequence: body.sequence }));
    fail('attendance_invalid_action', 422);
  } catch (error) {
    const safe = publicError(error);
    return sendJson(res, safe.status, safe.body);
  }
};

module.exports = createHandler();
module.exports.createHandler = createHandler;
