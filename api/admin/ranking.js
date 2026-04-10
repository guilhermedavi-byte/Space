const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { mutateStore, readStore } = require("../_lib/scheduling-store");

const listTeachers = (store) => {
  const teachers = Array.isArray(store.teachers) ? store.teachers : [];
  return teachers
    .filter((t) => t && typeof t === "object" && typeof t.id === "string" && typeof t.name === "string")
    .map((t) => ({ id: t.id, name: t.name }));
};

const validateOrder = (teacherIds, order) => {
  if (!Array.isArray(order)) return { ok: false, error: "invalid_order" };
  const ids = order.filter((id) => typeof id === "string");
  if (ids.length !== order.length) return { ok: false, error: "invalid_order" };
  const set = new Set(ids);
  if (set.size !== ids.length) return { ok: false, error: "duplicate_ids" };
  const missing = teacherIds.filter((id) => !set.has(id));
  const unknown = ids.filter((id) => !teacherIds.includes(id));
  if (missing.length || unknown.length) return { ok: false, error: "order_mismatch" };
  return { ok: true, order: ids };
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (String(session.role || "") !== "admin") {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const store = readStore();
    const teachers = listTeachers(store);
    const order = Array.isArray(store.ranking?.order) ? store.ranking.order : teachers.map((t) => t.id);
    sendJson(res, 200, { teachers, order });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const store = readStore();
  const teachers = listTeachers(store);
  const teacherIds = teachers.map((t) => t.id);
  const validated = validateOrder(teacherIds, body?.order);
  if (!validated.ok) {
    sendJson(res, 400, { error: validated.error });
    return;
  }

  await mutateStore((next) => {
    next.ranking = { order: validated.order };
    return next;
  });

  sendJson(res, 200, { ok: true });
};

