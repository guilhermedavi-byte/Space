const { getGoogleAccessToken } = require("../_lib/google-service-account");
const { sendJson, readJsonBody } = require("./_lib/http");
const { getSessionFromRequest } = require("./_lib/session");
const { listCollectionAsAdmin, createDocumentAsAdmin } = require("./_lib/firestore-admin");
const {
  FIRESTORE_BASE,
  decodeFields,
  encodeFields,
  getDocIdFromName,
  requestJson,
} = require("./_lib/firestore-rest");

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const ACTIVITIES_COLLECTION = "activities";
const USERS_COLLECTION = "users";
const ALLOWED_STATUSES = new Set(["Pendente", "Em andamento", "Feito"]);
const ALLOWED_PRIORITIES = new Set(["Alta", "Média", "Baixa"]);

const normalizeRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "admin" || raw === "administrador" || raw === "coord" || raw === "coordenacao") return "admin";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "growth") return "growth";
  return raw;
};

const normalizeUserRole = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (["admin", "administrador"].includes(raw)) return "admin";
  if (["teacher", "professor"].includes(raw)) return "teacher";
  if (raw === "growth") return "growth";
  if (["student", "aluno"].includes(raw)) return "student";
  if (["finance", "financeiro"].includes(raw)) return "FINANCE";
  return raw;
};

const isAccessRole = (role) => ["admin", "teacher", "growth"].includes(normalizeRole(role));
const safeText = (value) => String(value || "").trim();
const normalizeOptionalDate = (value) => {
  const raw = safeText(value);
  if (!raw) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
};

const normalizeActivity = (row = {}) => {
  const status = ALLOWED_STATUSES.has(String(row.status || "").trim()) ? String(row.status).trim() : "Pendente";
  const prioridade = ALLOWED_PRIORITIES.has(String(row.prioridade || "").trim()) ? String(row.prioridade).trim() : "Média";
  const responsavelId = safeText(row.responsavelId);
  const tipo = safeText(row.tipo);
  return {
    id: safeText(row.id),
    titulo: safeText(row.titulo),
    descricao: safeText(row.descricao),
    status,
    responsavelId,
    prazo: normalizeOptionalDate(row.prazo),
    prioridade,
    tipo,
    criadoPor: safeText(row.criadoPor),
    criadoEm: row.criadoEm || null,
    atualizadoEm: row.atualizadoEm || null,
    observacoes: safeText(row.observacoes),
    comentarios: Array.isArray(row.comentarios) ? row.comentarios : [],
  };
};

const canAccessActivity = (session, activity) => {
  const role = normalizeRole(session?.role);
  if (role === "admin") return true;
  const uid = safeText(session?.sub);
  return Boolean(uid && (activity.responsavelId === uid || activity.criadoPor === uid));
};

const canAssignResponsavel = (session, responsavelId) => {
  const role = normalizeRole(session?.role);
  const safeResponsavelId = safeText(responsavelId);
  if (role === "admin" || role === "growth") return true;
  if (!safeResponsavelId) return true;
  return safeResponsavelId === safeText(session?.sub);
};

const sortActivities = (rows) =>
  rows.slice().sort((a, b) => {
    const leftUpdated = a.atualizadoEm ? new Date(a.atualizadoEm).getTime() : 0;
    const rightUpdated = b.atualizadoEm ? new Date(b.atualizadoEm).getTime() : 0;
    if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;
    return String(a.titulo || "").localeCompare(String(b.titulo || ""), "pt-BR");
  });

const listVisibleUsers = (session, rows) => {
  const role = normalizeRole(session?.role);
  const uid = safeText(session?.sub);
  const visibleRoles = role === "teacher" ? new Set(["teacher"]) : new Set(["admin", "growth", "FINANCE"]);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: safeText(row.id),
      nome: safeText(row.nome),
      email: safeText(row.email).toLowerCase(),
      role: normalizeUserRole(row.tipo || row.role),
      ativo: row.ativo !== false,
      photoURL: safeText(row.photoURL),
      telefone: safeText(row.telefone),
    }))
    .filter((row) => row.id && row.nome && row.ativo && visibleRoles.has(row.role))
    .filter((row) => (role === "admin" || role === "growth" ? true : row.id === uid))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

const listActivityDirectoryUsers = (session, rows) => {
  const role = normalizeRole(session?.role);
  const uid = safeText(session?.sub);
  const visibleRoles = role === "teacher" ? new Set(["teacher"]) : new Set(["admin", "growth", "FINANCE"]);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: safeText(row.id),
      nome: safeText(row.nome),
      email: safeText(row.email).toLowerCase(),
      role: normalizeUserRole(row.tipo || row.role),
      ativo: row.ativo !== false,
      photoURL: safeText(row.photoURL),
      telefone: safeText(row.telefone),
    }))
    .filter((row) => row.id && row.nome && row.ativo)
    .filter((row) => visibleRoles.has(row.role))
    .filter((row) => (role === "teacher" ? row.id === uid : true))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

const getAccessToken = async () => {
  const result = await getGoogleAccessToken({ scope: DATASTORE_SCOPE });
  return safeText(result?.accessToken);
};

const patchDocumentAsAdmin = async (collectionPath, id, data) => {
  const token = await getAccessToken();
  const updateMaskPaths = Object.keys(data || {}).filter(Boolean);
  const params = new URLSearchParams();
  updateMaskPaths.forEach((key) => params.append("updateMask.fieldPaths", key));
  const url = `${FIRESTORE_BASE}/${encodeURI(String(collectionPath || "").replace(/^\/+/, ""))}/${encodeURIComponent(String(id || ""))}?${params.toString()}`;
  const response = await requestJson(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: encodeFields(data),
  });
  if (!response.ok) {
    const error = new Error("firestore_admin_patch_failed");
    error.status = response.status;
    throw error;
  }
  return {
    id: getDocIdFromName(response.data?.name),
    ...decodeFields(response.data),
  };
};

const deleteDocumentAsAdmin = async (collectionPath, id) => {
  const token = await getAccessToken();
  const url = `${FIRESTORE_BASE}/${encodeURI(String(collectionPath || "").replace(/^\/+/, ""))}/${encodeURIComponent(String(id || ""))}`;
  const response = await requestJson(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const error = new Error("firestore_admin_delete_failed");
    error.status = response.status;
    throw error;
  }
};

const parseRequest = async (req) => {
  const session = getSessionFromRequest(req);
  if (!session) return { ok: false, status: 401, body: { error: "unauthorized" } };
  const role = normalizeRole(session.role);
  if (!isAccessRole(role)) return { ok: false, status: 403, body: { error: "forbidden" } };
  return { ok: true, session, role };
};

module.exports = async (req, res) => {
  const auth = await parseRequest(req);
  if (!auth.ok) return sendJson(res, auth.status, auth.body);
  const { session, role } = auth;

  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/activities", `https://${host}`);
  const id = safeText(url.searchParams.get("id"));

  if (req.method === "GET") {
    try {
      const [activityRows, userRows] = await Promise.all([
        listCollectionAsAdmin(ACTIVITIES_COLLECTION, { pageSize: 2000 }).catch(() => []),
        listCollectionAsAdmin(USERS_COLLECTION, { pageSize: 1500 }).catch(() => []),
      ]);
      const activities = sortActivities(
        activityRows
          .map(normalizeActivity)
          .filter((row) => row.id && row.titulo)
          .filter((row) => canAccessActivity(session, row))
      );
      return sendJson(res, 200, {
        activities,
        users: listVisibleUsers(session, userRows),
        directoryUsers: listActivityDirectoryUsers(session, userRows),
        permissions: {
          role,
          canViewAll: role === "admin",
          canAssignOthers: role === "admin" || role === "growth",
        },
      });
    } catch (error) {
      console.error("[api] activities list failed", error);
      return sendJson(res, 500, { error: "activities_list_failed" });
    }
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: "invalid_json" });
    }
    const titulo = safeText(body?.titulo);
    if (!titulo) return sendJson(res, 400, { error: "missing_title" });
    const responsavelId = safeText(body?.responsavelId);
    if (!canAssignResponsavel(session, responsavelId)) return sendJson(res, 403, { error: "forbidden_responsavel" });
    const now = new Date();
    const payload = {
      titulo,
      descricao: safeText(body?.descricao),
      status: ALLOWED_STATUSES.has(String(body?.status || "").trim()) ? String(body.status).trim() : "Pendente",
      responsavelId: responsavelId || null,
      prazo: normalizeOptionalDate(body?.prazo) || null,
      prioridade: ALLOWED_PRIORITIES.has(String(body?.prioridade || "").trim()) ? String(body.prioridade).trim() : "Média",
      tipo: safeText(body?.tipo),
      criadoPor: safeText(session.sub),
      criadoEm: now,
      atualizadoEm: now,
      observacoes: safeText(body?.observacoes),
      comentarios: [],
    };
    try {
      const created = normalizeActivity(await createDocumentAsAdmin(ACTIVITIES_COLLECTION, payload));
      return sendJson(res, 201, { activity: created });
    } catch (error) {
      console.error("[api] activities create failed", error);
      return sendJson(res, 500, { error: "activities_create_failed" });
    }
  }

  if (req.method === "PATCH") {
    if (!id) return sendJson(res, 400, { error: "missing_id" });
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: "invalid_json" });
    }
    try {
      const rows = await listCollectionAsAdmin(ACTIVITIES_COLLECTION, { pageSize: 2000 });
      const existing = rows.map(normalizeActivity).find((row) => row.id === id);
      if (!existing) return sendJson(res, 404, { error: "not_found" });
      if (!canAccessActivity(session, existing)) return sendJson(res, 403, { error: "forbidden" });

      const nextResponsavelId = Object.prototype.hasOwnProperty.call(body || {}, "responsavelId")
        ? safeText(body?.responsavelId)
        : existing.responsavelId;
      if (!canAssignResponsavel(session, nextResponsavelId)) return sendJson(res, 403, { error: "forbidden_responsavel" });

      const patch = {
        atualizadoEm: new Date(),
      };
      if (Object.prototype.hasOwnProperty.call(body || {}, "titulo")) patch.titulo = safeText(body?.titulo) || existing.titulo;
      if (Object.prototype.hasOwnProperty.call(body || {}, "descricao")) patch.descricao = safeText(body?.descricao);
      if (Object.prototype.hasOwnProperty.call(body || {}, "status")) {
        patch.status = ALLOWED_STATUSES.has(String(body?.status || "").trim()) ? String(body.status).trim() : existing.status;
      }
      if (Object.prototype.hasOwnProperty.call(body || {}, "responsavelId")) patch.responsavelId = nextResponsavelId || null;
      if (Object.prototype.hasOwnProperty.call(body || {}, "prazo")) patch.prazo = normalizeOptionalDate(body?.prazo) || null;
      if (Object.prototype.hasOwnProperty.call(body || {}, "prioridade")) {
        patch.prioridade = ALLOWED_PRIORITIES.has(String(body?.prioridade || "").trim()) ? String(body.prioridade).trim() : existing.prioridade;
      }
      if (Object.prototype.hasOwnProperty.call(body || {}, "tipo")) patch.tipo = safeText(body?.tipo);
      if (Object.prototype.hasOwnProperty.call(body || {}, "observacoes")) patch.observacoes = safeText(body?.observacoes);
      const updated = normalizeActivity(await patchDocumentAsAdmin(ACTIVITIES_COLLECTION, id, patch));
      return sendJson(res, 200, { activity: updated });
    } catch (error) {
      console.error("[api] activities patch failed", error);
      return sendJson(res, error?.status === 404 ? 404 : 500, { error: "activities_patch_failed" });
    }
  }

  if (req.method === "DELETE") {
    if (!id) return sendJson(res, 400, { error: "missing_id" });
    try {
      const rows = await listCollectionAsAdmin(ACTIVITIES_COLLECTION, { pageSize: 2000 });
      const existing = rows.map(normalizeActivity).find((row) => row.id === id);
      if (!existing) return sendJson(res, 404, { error: "not_found" });
      if (!canAccessActivity(session, existing)) return sendJson(res, 403, { error: "forbidden" });
      await deleteDocumentAsAdmin(ACTIVITIES_COLLECTION, id);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error("[api] activities delete failed", error);
      return sendJson(res, 500, { error: "activities_delete_failed" });
    }
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return sendJson(res, 405, { error: "method_not_allowed" });
};
