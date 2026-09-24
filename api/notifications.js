const { sendJson, readJsonBody } = require("./_lib/http");
const { getSessionFromRequest } = require("./_lib/session");
const { commitWritesAsAdmin, getDocumentAsAdmin } = require("./_lib/firestore-admin");
const { FIRESTORE_BASE, encodeFields } = require("./_lib/firestore-rest");
const {
  NOTIFICATIONS_COLLECTION,
  getUnreadCountForUser,
  listNotificationsForUser,
  normalizeNotification,
} = require("./_lib/notification-service");

const safeText = (value) => String(value || "").trim();
const validId = (id) => /^[A-Za-z0-9_-]{1,160}$/.test(String(id || ""));

const canUseNotifications = (session) => {
  const role = safeText(session?.role).toLowerCase();
  return Boolean(session?.sub && ["admin", "teacher", "professor", "growth", "finance", "financeiro"].includes(role));
};

const notificationDocName = (id) => {
  const prefix = FIRESTORE_BASE.split("/v1/")[1];
  return `${prefix}/${NOTIFICATIONS_COLLECTION}/${id}`;
};

const readNotificationForSession = async (id, session) => {
  if (!validId(id)) throw Object.assign(new Error("invalid_notification_id"), { status: 400 });
  const row = await getDocumentAsAdmin(`${NOTIFICATIONS_COLLECTION}/${encodeURIComponent(id)}`).catch((error) => {
    if (error?.status === 404) return null;
    throw error;
  });
  const notification = row ? normalizeNotification(row) : null;
  if (!notification) throw Object.assign(new Error("notification_not_found"), { status: 404 });
  if (notification.recipientUserId !== safeText(session.sub)) throw Object.assign(new Error("notification_forbidden"), { status: 403 });
  return notification;
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) return sendJson(res, 401, { error: "unauthorized" });
  if (!canUseNotifications(session)) return sendJson(res, 403, { error: "forbidden" });
  const currentUserId = safeText(session.sub);
  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/notifications", `https://${host}`);

  if (req.method === "GET") {
    try {
      const unreadCount = await getUnreadCountForUser(currentUserId);
      if (url.searchParams.get("summary") === "1") return sendJson(res, 200, { unreadCount });
      const filter = url.searchParams.get("filter") === "unread" ? "unread" : "all";
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 60, 100));
      const notifications = await listNotificationsForUser({ recipientUserId: currentUserId, filter, limit });
      return sendJson(res, 200, { notifications, unreadCount });
    } catch (error) {
      console.error("[api] notifications list failed", error);
      return sendJson(res, 500, { error: "notifications_list_failed" });
    }
  }

  if (req.method === "PATCH") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: "invalid_json" });
    }
    const action = safeText(body?.action || "read");
    const now = new Date().toISOString();
    try {
      if (action === "read_all") {
        const rows = await listNotificationsForUser({ recipientUserId: currentUserId, filter: "unread", limit: 200 });
        const writes = rows.map((row) => ({
          update: { name: notificationDocName(row.id), ...encodeFields({ readAt: now }) },
          updateMask: { fieldPaths: ["readAt"] },
          currentDocument: { exists: true },
        }));
        const response = await commitWritesAsAdmin({ writes });
        if (!response.ok) throw Object.assign(new Error("notifications_mark_all_failed"), { status: response.status });
        return sendJson(res, 200, { ok: true, unreadCount: 0 });
      }
      const id = safeText(body?.id);
      const notification = await readNotificationForSession(id, session);
      if (notification.readAt) {
        const unreadCount = await getUnreadCountForUser(currentUserId);
        return sendJson(res, 200, { ok: true, notification, unreadCount });
      }
      const response = await commitWritesAsAdmin({
        writes: [{
          update: { name: notificationDocName(notification.id), ...encodeFields({ readAt: now }) },
          updateMask: { fieldPaths: ["readAt"] },
          currentDocument: { exists: true },
        }],
      });
      if (!response.ok) throw Object.assign(new Error("notifications_mark_read_failed"), { status: response.status });
      const unreadCount = await getUnreadCountForUser(currentUserId);
      return sendJson(res, 200, { ok: true, notification: { ...notification, readAt: now }, unreadCount });
    } catch (error) {
      console.error("[api] notifications patch failed", error);
      return sendJson(res, [400, 403, 404].includes(error?.status) ? error.status : 500, { error: error?.message || "notifications_patch_failed" });
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return sendJson(res, 405, { error: "method_not_allowed" });
};
