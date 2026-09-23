const { randomUUID } = require("node:crypto");
const { planActivityChange, studentOf, EVENTS_COLLECTION } = require("./_lib/activity-events");
const { getGoogleAccessToken } = require("../_lib/google-service-account");
const { sendJson, readJsonBody } = require("./_lib/http");
const { getSessionFromRequest } = require("./_lib/session");
const { listCollectionAsAdmin } = require("./_lib/firestore-admin");
const { requireAdminPermission } = require("./_lib/admin-permissions");
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
    ...row,
    id: safeText(row.id),
    titulo: safeText(row.titulo),
    studentId: studentOf(row),
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

const validId = id => /^[A-Za-z0-9_-]{1,128}$/.test(id);
const readDocument = async (collection, id) => {
  if (!validId(id)) throw Object.assign(new Error('invalid_id'), { status: 400 });
  const response = await requestJson(`${FIRESTORE_BASE}/${collection}/${id}`, { headers: { Authorization: `Bearer ${await getAccessToken()}` } });
  if (response.status === 404) return null;
  if (!response.ok) throw Object.assign(new Error('read_failed'), { status: response.status });
  return { row: { ...decodeFields(response.data), id }, updateTime: response.data.updateTime };
};
const validateStudent = async id => {
  if (!id) return;
  const doc = await readDocument(USERS_COLLECTION, id);
  if (!doc || normalizeUserRole(doc.row.tipo || doc.row.role) !== 'student') throw Object.assign(new Error('invalid_student'), { status: 400 });
};
const commitActivity = async ({ id, document, patch, session, archive = false }) => {
  if (Object.hasOwn(patch, 'studentId')) await validateStudent(patch.studentId);
  const responsibleId = patch.responsavelId ?? document?.row?.responsavelId;
  if (responsibleId) {
    const responsible = await readDocument(USERS_COLLECTION, responsibleId);
    patch.responsavelNome = safeText(responsible?.row?.nome || responsible?.row?.name);
  }
  const { next, events } = planActivityChange({ id, before: document?.row, patch, actor: { id: session.sub, name: session.nome || session.name }, now: new Date().toISOString(), archive });
  const prefix = FIRESTORE_BASE.split('/v1/')[1];
  const writes = [{ update: { name: `${prefix}/activities/${id}`, ...encodeFields(next) }, currentDocument: document ? { updateTime: document.updateTime } : { exists: false } },
    ...events.map(event => ({ update: { name: `${prefix}/${EVENTS_COLLECTION}/${event.id}`, ...encodeFields(event) }, currentDocument: { exists: false } }))];
  const response = await requestJson(`${FIRESTORE_BASE}:commit`, { method: 'POST', headers: { Authorization: `Bearer ${await getAccessToken()}` }, body: { writes } });
  if (!response.ok) throw Object.assign(new Error('activity_commit_failed'), { status: [409, 412].includes(response.status) || response.data?.error?.status === 'FAILED_PRECONDITION' ? 409 : response.status });
  return normalizeActivity(next);
};
const queryStudentEvents = async studentId => {
  const response = await requestJson(`${FIRESTORE_BASE}:runQuery`, { method: 'POST', headers: { Authorization: `Bearer ${await getAccessToken()}` }, body: { structuredQuery: { from: [{ collectionId: EVENTS_COLLECTION }], where: { fieldFilter: { field: { fieldPath: 'studentId' }, op: 'EQUAL', value: { stringValue: studentId } } } } } });
  if (!response.ok) throw new Error('activity_events_read_failed');
  return (response.data || []).filter(row => row.document).map(row => ({ ...decodeFields(row.document), id: getDocIdFromName(row.document.name) }));
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
  const studentId = safeText(url.searchParams.get("studentId"));
  if ((id && !validId(id)) || (studentId && !validId(studentId))) return sendJson(res, 400, { error: "invalid_id" });
  if (role === "admin") {
    const action = req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : req.method === "PATCH" ? "update" : "view";
    const guard = await requireAdminPermission(req, `activities.activity.${action}`);
    if (!guard.ok) return sendJson(res, guard.status, guard.body);
  }

  if (req.method === "GET") {
    try {
      const [activityRows, userRows, eventRows] = await Promise.all([
        listCollectionAsAdmin(ACTIVITIES_COLLECTION, { pageSize: 2000 }),
        listCollectionAsAdmin(USERS_COLLECTION, { pageSize: 1500, decorate: false }),
        studentId ? queryStudentEvents(studentId) : Promise.resolve([]),
      ]);
      const activities = sortActivities(
        activityRows
          .map(row => normalizeActivity({ ...row, id: row.firestoreDocId || row.id }))
          .filter((row) => row.id && row.titulo)
          .filter(row => studentId ? row.studentId === studentId : !row.isArchived)
          .filter((row) => canAccessActivity(session, row))
      );
      return sendJson(res, 200, {
        activities: activities.map(row => ({ ...row, responsavelNome: userRows.find(user => (user.firestoreDocId || user.id) === row.responsavelId)?.nome || row.responsavelNome || '' })),
        events: eventRows.filter(event => canAccessActivity(session, event.snapshot || {})),
        students: userRows.filter(row => normalizeUserRole(row.tipo || row.role) === 'student').map(row => ({ id: row.firestoreDocId || row.id, nome: row.nome || row.nomeCompleto || row.name || '', email: row.email || '' })),
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
      studentId: safeText(body?.studentId),
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
      comentarios: safeText(body?.comment) ? [{ id: randomUUID(), text: safeText(body.comment), authorId: session.sub, authorName: session.nome || session.name || "", createdAt: now.toISOString() }] : [],
    };
    try {
      const created = await commitActivity({ id: randomUUID(), patch: payload, session });
      return sendJson(res, 201, { activity: created });
    } catch (error) {
      console.error("[api] activities create failed", error);
      return sendJson(res, [400, 409].includes(error.status) ? error.status : 500, { error: error.status === 400 ? "invalid_student" : "activities_create_failed" });
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
      const document = await readDocument(ACTIVITIES_COLLECTION, id);
      const existing = document ? normalizeActivity(document.row) : null;
      if (!existing) return sendJson(res, 404, { error: "not_found" });
      if (!canAccessActivity(session, existing)) return sendJson(res, 403, { error: "forbidden" });

      const nextResponsavelId = Object.prototype.hasOwnProperty.call(body || {}, "responsavelId")
        ? safeText(body?.responsavelId)
        : existing.responsavelId;
      if (!canAssignResponsavel(session, nextResponsavelId)) return sendJson(res, 403, { error: "forbidden_responsavel" });

      if (existing.isArchived) return sendJson(res, 409, { error: "activity_archived" });
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
      if (safeText(body?.comment)) patch.comentarios = [...existing.comentarios, { id: randomUUID(), text: safeText(body.comment), authorId: session.sub, authorName: session.nome || session.name || "", createdAt: new Date().toISOString() }];
      if (Object.hasOwn(body || {}, "studentId")) patch.studentId = safeText(body.studentId);
      const updated = await commitActivity({ id, document, patch, session });
      return sendJson(res, 200, { activity: updated });
    } catch (error) {
      console.error("[api] activities patch failed", error);
      return sendJson(res, [400, 404, 409].includes(error?.status) ? error.status : 500, { error: "activities_patch_failed" });
    }
  }

  if (req.method === "DELETE") {
    if (!id) return sendJson(res, 400, { error: "missing_id" });
    try {
      const document = await readDocument(ACTIVITIES_COLLECTION, id);
      const existing = document ? normalizeActivity(document.row) : null;
      if (!existing) return sendJson(res, 404, { error: "not_found" });
      if (!canAccessActivity(session, existing)) return sendJson(res, 403, { error: "forbidden" });
      if (existing.isArchived) return sendJson(res, 200, { ok: true });
      await commitActivity({ id, document, patch: {}, session, archive: true });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error("[api] activities delete failed", error);
      return sendJson(res, 500, { error: "activities_delete_failed" });
    }
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return sendJson(res, 405, { error: "method_not_allowed" });
};
