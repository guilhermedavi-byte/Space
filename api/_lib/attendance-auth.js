const { resolveAdminRequestAuth } = require('./admin-request-auth');
const { fail } = require('./attendance-domain');
const { getDocumentAsAdmin } = require('./firestore-admin');
const { getSessionFromRequest } = require('../../_lib/session');
const { normalizeRole } = require('../../_lib/users');

// Global roles only establish eligibility. Every RPC also requires team membership,
// including for admins. No role grants global access to the new domain.
const ROLE_CAPABILITIES = Object.fromEntries(['admin', 'growth', 'financeiro', 'teacher'].map((role) => [role,
  new Set(['attendance.view', 'attendance.reply', 'attendance.manage'])]));

const requireAttendanceAuth = async (req, capability, resolveAuth = resolveAdminRequestAuth) => {
  const session = getSessionFromRequest(req);
  const sessionRole = normalizeRole(session?.role);
  const sessionUid = String(session?.sub || '').trim();
  if (sessionUid && (capability === 'attendance.view' || ROLE_CAPABILITIES[sessionRole]?.has(capability))) return { uid: sessionUid, role: sessionRole };

  const auth = await resolveAuth(req, { logPrefix: '[attendance]' });
  if (!auth?.ok) fail('unauthenticated', 401);
  if (auth.profile?.active !== true) fail('attendance_forbidden', 403);
  if (capability !== 'attendance.view' && !ROLE_CAPABILITIES[auth.session?.role]?.has(capability)) fail('attendance_forbidden', 403);
  const uid = auth.decoded?.uid;
  if (!uid || uid !== auth.session?.sub || uid !== auth.profile?.user?.id) fail('unauthenticated', 401);
  return { uid, role: auth.session.role };
};

const requireAssignableAttendanceUser = async (uid, getUser = getDocumentAsAdmin) => {
  const user = await getUser(`users/${encodeURIComponent(uid)}`);
  const role = normalizeRole(user?.tipo || user?.role || user?.type);
  if (!user || user.ativo === false || !['admin', 'growth', 'teacher', 'FINANCE'].includes(role)) fail('attendance_invalid_assignee', 422);
};

module.exports = { requireAttendanceAuth, requireAssignableAttendanceUser, ROLE_CAPABILITIES };
