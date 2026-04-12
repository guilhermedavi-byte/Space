const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { mutateStore } = require("../_lib/scheduling-store");

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  return "";
};

const defaultTeacherWorkHours = () => {
  const byDay = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    byDay[String(dow)] = dow === 0 ? [] : [{ startMin: 8 * 60, endMin: 20 * 60 }];
  }
  return byDay;
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

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

  const uid = String(body?.uid || "").trim();
  const name = String(body?.name || "").trim();
  const role = normalizeRole(body?.role);
  const hasActive = typeof body?.active === "boolean";
  const nextActive = hasActive ? Boolean(body.active) : null;

  if (!uid || !name || !role) {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }

  await mutateStore((store) => {
    if (role === "teacher") {
      store.teachers = Array.isArray(store.teachers) ? store.teachers : [];
      const idx = store.teachers.findIndex((t) => t && t.id === uid);
      if (idx < 0) {
        store.teachers.push({
          id: uid,
          name,
          active: nextActive == null ? true : nextActive,
          workHours: defaultTeacherWorkHours(),
        });
      } else {
        const prev = store.teachers[idx] || {};
        store.teachers[idx] = {
          ...prev,
          name,
          ...(nextActive == null ? {} : { active: nextActive }),
        };
      }

      const order = Array.isArray(store?.ranking?.order) ? store.ranking.order : [];
      const shouldInclude = nextActive == null ? true : nextActive;
      store.ranking = { order: shouldInclude && !order.includes(uid) ? [...order, uid] : order };
      return store;
    }

    store.students = Array.isArray(store.students) ? store.students : [];
    const idx = store.students.findIndex((s) => s && s.id === uid);
    if (idx < 0) {
      store.students.push({ id: uid, name });
    } else {
      store.students[idx] = { ...store.students[idx], name };
    }
    return store;
  });

  sendJson(res, 200, { ok: true });
};
