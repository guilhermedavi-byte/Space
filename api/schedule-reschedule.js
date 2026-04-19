const crypto = require("crypto");

const { readJsonBody, sendJson } = require("../_lib/http");
const { getSessionFromRequest } = require("../_lib/session");
const { verifyFirebaseIdToken } = require("../_lib/firebase-id-token");
const { DEFAULT_CONFIG } = require("../_lib/scheduling-firestore");
const {
  clampInt,
  getDayOfWeekFromDateKey,
  isValidDateKey,
  minutesToTime,
  timeToMinutes,
  toUtcMsForDateKeyAndMinutes,
} = require("../_lib/scheduling-utils");
const {
  decodeFields,
  firestoreGetDocument,
  firestoreListDocuments,
  firestorePatchDocument,
  getBearerTokenFromRequest,
  getDocIdFromName,
} = require("../_lib/firestore-rest");

const normalizeRole = (role) => {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "student" || raw === "aluno") return "student";
  return "";
};

const buildId = () => {
  const rand = crypto.randomBytes(6).toString("hex");
  return `reag_${Date.now()}_${rand}`;
};

const decodeAulaSnapshot = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = decodeFields(doc);
  const professorId = typeof fields.professorId === "string" ? fields.professorId : "";
  const alunoId = typeof fields.alunoId === "string" ? fields.alunoId : "";
  const dateKey = typeof fields.dateKey === "string" ? fields.dateKey : "";
  const horaInicio = typeof fields.horaInicio === "string" ? fields.horaInicio : "";
  const horaFim = typeof fields.horaFim === "string" ? fields.horaFim : "";
  const status = String(fields.status || "").trim().toLowerCase() || "agendada";
  const professorNome = typeof fields.professorNome === "string" ? fields.professorNome.trim() : "";
  const alunoNome = typeof fields.alunoNome === "string" ? fields.alunoNome.trim() : "";

  if (!professorId || !alunoId || !dateKey) return null;
  return {
    id,
    professorId,
    alunoId,
    dateKey,
    horaInicio,
    horaFim,
    status,
    professorNome: professorNome || null,
    alunoNome: alunoNome || null,
  };
};

const parseMinutes = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return clampInt(value, 0, 1440);
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) return null;
  const parsed = timeToMinutes(str);
  return Number.isFinite(parsed) ? clampInt(parsed, 0, 1440) : null;
};

const DOW_TO_KEY = {
  0: "dom",
  1: "seg",
  2: "ter",
  3: "qua",
  4: "qui",
  5: "sex",
  6: "sab",
};

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  const role = normalizeRole(session.role);
  const requesterId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!requesterId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken);
    if (decoded.uid !== requesterId) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }
  } catch (error) {
    sendJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: "invalid_json" });
      return;
    }

    const acao = String(body?.acao || "").trim().toLowerCase();
    const resolveId = String(body?.id || body?.requestId || body?.resolveId || "").trim();
    const isResolve = resolveId && (acao === "aprovar" || acao === "recusar");

    if (isResolve) {
      if (role !== "admin") {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }

      const motivoResposta = String(body?.motivo || "").trim();

      const requestPath = `reagendamentos/${encodeURIComponent(resolveId)}`;
      let reqFields;
      try {
        const snap = await firestoreGetDocument({ docPath: requestPath, idToken });
        if (!snap.ok) {
          sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
          return;
        }
        reqFields = decodeFields(snap.data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[api] reschedule resolve load failed", error);
        sendJson(res, 500, { error: "internal_error" });
        return;
      }

      const currentStatus = String(reqFields?.status || "").trim().toLowerCase() || "pendente";
      if (currentStatus !== "pendente") {
        sendJson(res, 400, { error: "already_resolved" });
        return;
      }

      const aulaId = typeof reqFields?.aulaId === "string" ? reqFields.aulaId : "";
      if (!aulaId) {
        sendJson(res, 400, { error: "aula_required" });
        return;
      }

      const aulaPath = `aulas/${encodeURIComponent(aulaId)}`;

      const patchReq = {
        status: acao === "aprovar" ? "aprovado" : "recusado",
        resolvidoEm: new Date(),
        resolvidoPor: requesterId,
        motivoResposta: motivoResposta || null,
      };

      try {
        if (acao === "aprovar") {
          const dateKey = String(body?.dateKey || body?.novaDataKey || "").trim();
          const startMin = parseMinutes(body?.startMin ?? body?.horaInicio ?? body?.novaHoraInicio ?? body?.startTime);
          const endMin = parseMinutes(body?.endMin ?? body?.horaFim ?? body?.novaHoraFim ?? body?.endTime);

          if (dateKey && isValidDateKey(dateKey) && Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) {
            const startMs = toUtcMsForDateKeyAndMinutes(dateKey, startMin, { tzOffsetMinutes: DEFAULT_CONFIG.tzOffsetMinutes });
            const dow = getDayOfWeekFromDateKey(dateKey);
            const diaSemana = dow == null ? "" : DOW_TO_KEY[dow] || "";
            const data = startMs ? new Date(startMs) : new Date();

            await firestorePatchDocument({
              docPath: aulaPath,
              idToken,
              data: {
                dateKey,
                startMin,
                endMin,
                data,
                diaSemana,
                horaInicio: minutesToTime(startMin),
                horaFim: minutesToTime(endMin),
                status: "agendada",
                atualizadoEm: new Date(),
              },
              updateMaskPaths: [
                "dateKey",
                "startMin",
                "endMin",
                "data",
                "diaSemana",
                "horaInicio",
                "horaFim",
                "status",
                "atualizadoEm",
              ],
            });

            patchReq.novoDateKey = dateKey;
            patchReq.novaHoraInicio = minutesToTime(startMin);
            patchReq.novaHoraFim = minutesToTime(endMin);
          } else {
            await firestorePatchDocument({
              docPath: aulaPath,
              idToken,
              data: { status: "agendada", atualizadoEm: new Date() },
              updateMaskPaths: ["status", "atualizadoEm"],
            }).catch(() => null);
          }
        } else {
          await firestorePatchDocument({
            docPath: aulaPath,
            idToken,
            data: { status: "agendada", atualizadoEm: new Date() },
            updateMaskPaths: ["status", "atualizadoEm"],
          }).catch(() => null);
        }

        const patch = await firestorePatchDocument({
          docPath: requestPath,
          idToken,
          data: patchReq,
          updateMaskPaths: Object.keys(patchReq),
        });
        if (!patch.ok) throw new Error("firestore_patch_failed");

        sendJson(res, 200, { ok: true, status: patchReq.status });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[api] reschedule resolve failed", error);
        sendJson(res, 500, { error: "internal_error" });
      }
      return;
    }

    // Create request (student)
    if (role !== "student") {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }

    const aulaId = String(body?.aulaId || "").trim();
    const motivo = String(body?.motivo || "").trim();
    if (!aulaId) {
      sendJson(res, 400, { error: "aula_required" });
      return;
    }
    if (!motivo) {
      sendJson(res, 400, { error: "motivo_required" });
      return;
    }

    const aulaPath = `aulas/${encodeURIComponent(aulaId)}`;
    let aulaSnap;
    try {
      const snap = await firestoreGetDocument({ docPath: aulaPath, idToken });
      if (!snap.ok) {
        sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
        return;
      }
      aulaSnap = decodeAulaSnapshot(snap.data);
      if (!aulaSnap || aulaSnap.alunoId !== requesterId) {
        sendJson(res, 403, { error: "forbidden" });
        return;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] reschedule load aula failed", error);
      sendJson(res, 500, { error: "internal_error" });
      return;
    }

    const id = buildId();
    const docPath = `reagendamentos/${encodeURIComponent(id)}`;
    const payload = {
      alunoId: requesterId,
      aulaId,
      motivo,
      status: "pendente",
      criadoEm: new Date(),
      // denormalized snapshot for admin UI
      professorId: aulaSnap.professorId,
      professorNome: aulaSnap.professorNome,
      alunoNome: aulaSnap.alunoNome,
      dateKey: aulaSnap.dateKey,
      horaInicio: aulaSnap.horaInicio,
      horaFim: aulaSnap.horaFim,
    };

    try {
      const patch = await firestorePatchDocument({
        docPath,
        idToken,
        data: payload,
        updateMaskPaths: Object.keys(payload),
      });
      if (!patch.ok) throw new Error("firestore_patch_failed");

      await firestorePatchDocument({
        docPath: aulaPath,
        idToken,
        data: { status: "reagendamento_solicitado", atualizadoEm: new Date() },
        updateMaskPaths: ["status", "atualizadoEm"],
      }).catch(() => null);

      sendJson(res, 200, { ok: true, id, status: "pendente" });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] reschedule create failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    if (role !== "admin") {
      sendJson(res, 403, { error: "forbidden" });
      return;
    }

    try {
      const resList = await firestoreListDocuments({ collectionPath: "reagendamentos", idToken, pageSize: 2000 });
      if (!resList.ok) throw new Error("firestore_list_failed");
      const docs = Array.isArray(resList.documents)
        ? resList.documents
        : Array.isArray(resList.data?.documents)
          ? resList.data.documents
          : [];

      const pending = docs
        .map((doc) => {
          if (!doc || typeof doc !== "object") return null;
          const id = getDocIdFromName(doc.name);
          if (!id) return null;
          const fields = decodeFields(doc);
          const status = String(fields.status || "").trim().toLowerCase() || "pendente";
          if (status !== "pendente") return null;
          const aulaId = typeof fields.aulaId === "string" ? fields.aulaId : "";
          const alunoId = typeof fields.alunoId === "string" ? fields.alunoId : "";
          const motivo = typeof fields.motivo === "string" ? fields.motivo : "";
          const criadoEm = fields.criadoEm instanceof Date ? fields.criadoEm.toISOString() : "";

          const professorNome = typeof fields.professorNome === "string" ? fields.professorNome : "";
          const alunoNome = typeof fields.alunoNome === "string" ? fields.alunoNome : "";
          const dateKey = typeof fields.dateKey === "string" ? fields.dateKey : "";
          const horaInicio = typeof fields.horaInicio === "string" ? fields.horaInicio : "";
          const horaFim = typeof fields.horaFim === "string" ? fields.horaFim : "";

          if (!aulaId || !alunoId) return null;
          return {
            id,
            aulaId,
            alunoId,
            motivo,
            status,
            criadoEm,
            aula: {
              id: aulaId,
              dateKey,
              horaInicio,
              horaFim,
              professorNome: professorNome || null,
              alunoNome: alunoNome || null,
            },
            aluno: {
              id: alunoId,
              nome: alunoNome || null,
            },
          };
        })
        .filter(Boolean)
        .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

      sendJson(res, 200, { requests: pending });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] reschedule list failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
    return;
  }

  res.setHeader("Allow", "GET, HEAD, POST");
  sendJson(res, 405, { error: "method_not_allowed" });
};
