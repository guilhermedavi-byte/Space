const { readJsonBody, sendJson } = require("../../_lib/http");
const { getSessionFromRequest } = require("../../_lib/session");
const { clampInt } = require("../../_lib/scheduling-utils");
const { verifyFirebaseIdToken } = require("../../_lib/firebase-id-token");
const {
  decodeFields,
  firestoreGetDocument,
  firestorePatchDocument,
  getBearerTokenFromRequest,
} = require("../../_lib/firestore-rest");

const DOW_TO_KEY = {
  0: "dom",
  1: "seg",
  2: "ter",
  3: "qua",
  4: "qui",
  5: "sex",
  6: "sab",
};

const defaultWorkHoursDoc = () => {
  // Default: enabled Mon-Sat with a broad window; Sunday off.
  const map = { "0": [] };
  for (let dow = 1; dow <= 6; dow += 1) {
    map[String(dow)] = [{ startMin: 0, endMin: 23 * 60 + 59 }];
  }
  return map;
};

const minutesToHm = (minutes) => {
  const safe = clampInt(minutes, 0, 1440);
  const h = String(Math.floor(safe / 60)).padStart(2, "0");
  const m = String(safe % 60).padStart(2, "0");
  return `${h}:${m}`;
};

const hmToMinutes = (hm) => {
  const raw = String(hm || "").trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const safeH = clampInt(h, 0, 23);
  const safeM = clampInt(m, 0, 59);
  return safeH * 60 + safeM;
};

const normalizeWindows = (raw) => {
  const windows = Array.isArray(raw) ? raw : [];
  return windows
    .map((w) => {
      if (!w || typeof w !== "object") return null;
      const startMin = clampInt(w.startMin, 0, 1440);
      const endMin = clampInt(w.endMin, 0, 1440);
      if (endMin <= startMin) return null;
      return { startMin, endMin };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMin - b.startMin);
};

const validateWorkHours = (workHours) => {
  const errors = [];
  for (let dow = 0; dow <= 6; dow += 1) {
    const dayKey = String(dow);
    const windows = normalizeWindows(workHours[dayKey]);
    for (let i = 1; i < windows.length; i += 1) {
      const prev = windows[i - 1];
      const cur = windows[i];
      if (cur.startMin < prev.endMin) {
        errors.push({ day: dayKey, code: "overlap" });
        break;
      }
    }
  }
  return errors;
};

const normalizeWorkHoursPayload = (value) => {
  const payload = value && typeof value === "object" ? value : {};
  const workHoursRaw = payload.workHours && typeof payload.workHours === "object" ? payload.workHours : {};
  const out = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    const dayKey = String(dow);
    out[dayKey] = normalizeWindows(workHoursRaw[dayKey]);
  }
  return out;
};

const normalizeStoredWorkHours = (raw) => {
  const out = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    out[String(dow)] = [];
  }

  const workHoursRaw = raw && typeof raw === "object" ? raw : {};
  for (let dow = 0; dow <= 6; dow += 1) {
    const dayKey = String(dow);
    out[dayKey] = normalizeWindows(workHoursRaw[dayKey]);
  }

  return out;
};

const decodeFirestoreHorarios = (horarios) => {
  const out = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    out[String(dow)] = [];
  }

  const map = horarios && typeof horarios === "object" ? horarios : {};
  for (let dow = 0; dow <= 6; dow += 1) {
    const key = DOW_TO_KEY[dow];
    const entry = map && typeof map === "object" ? map[key] : null;
    if (!entry || typeof entry !== "object") continue;
    if (entry.ativo === false) {
      out[String(dow)] = [];
      continue;
    }
    const faixas = Array.isArray(entry.faixas) ? entry.faixas : [];
    out[String(dow)] = faixas
      .map((w) => {
        if (!w || typeof w !== "object") return null;
        const startMin = hmToMinutes(w.inicio);
        const endMin = hmToMinutes(w.fim);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
        return { startMin, endMin };
      })
      .filter(Boolean)
      .sort((a, b) => a.startMin - b.startMin);
  }

  return out;
};

const workHoursToFirestoreHorarios = (workHours) => {
  const horarios = {};
  for (let dow = 0; dow <= 6; dow += 1) {
    const key = DOW_TO_KEY[dow];
    const windows = Array.isArray(workHours?.[String(dow)]) ? workHours[String(dow)] : [];
    if (!windows.length) {
      horarios[key] = { ativo: false };
      continue;
    }
    horarios[key] = {
      ativo: true,
      faixas: windows.map((w) => ({
        inicio: minutesToHm(w.startMin),
        fim: minutesToHm(w.endMin),
      })),
    };
  }
  return horarios;
};

module.exports = async (req, res) => {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    if (String(session.role || "") !== "teacher") {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }

    const teacherId = String(session.sub || "");
    if (!teacherId) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const idToken = getBearerTokenFromRequest(req);
    if (!idToken) {
      sendJson(res, 401, { error: "missing_id_token" });
      return;
    }

    let decoded;
    try {
      decoded = await verifyFirebaseIdToken(idToken);
    } catch (error) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }

    if (decoded.uid !== teacherId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      const docPath = `workHours/${encodeURIComponent(teacherId)}`;
      const snap = await firestoreGetDocument({ docPath, idToken });
      if (!snap.ok) {
        if (snap.status === 404) {
          sendJson(res, 200, { workHours: defaultWorkHoursDoc() });
          return;
        }
        throw new Error("firestore_get_failed");
      }

      const fields = decodeFields(snap.data);
      const stored =
        fields?.horarios && typeof fields.horarios === "object"
          ? decodeFirestoreHorarios(fields.horarios)
          : normalizeStoredWorkHours(fields?.workHours);
      const fallback = defaultWorkHoursDoc();
      const merged = {};
      for (let dow = 0; dow <= 6; dow += 1) {
        const key = String(dow);
        merged[key] = Array.isArray(stored[key]) ? stored[key] : fallback[key] || [];
      }
      sendJson(res, 200, { workHours: merged });
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

    const workHours = normalizeWorkHoursPayload(body);
    const errors = validateWorkHours(workHours);
    if (errors.length) {
      sendJson(res, 400, { error: "invalid_work_hours", details: errors });
      return;
    }

    const docPath = `workHours/${encodeURIComponent(teacherId)}`;
    const patch = await firestorePatchDocument({
      docPath,
      idToken,
      data: {
        professorId: teacherId,
        horarios: workHoursToFirestoreHorarios(workHours),
        atualizadoEm: new Date(),
      },
      updateMaskPaths: ["professorId", "horarios", "atualizadoEm"],
    });

    if (!patch.ok) {
      throw new Error("firestore_patch_failed");
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] teacher work-hours failed", error);
    sendJson(res, 500, { error: "internal_error" });
  }
};
