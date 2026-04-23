const { getSessionFromRequest } = require("../_lib/session");
const { readJsonBody, sendJson } = require("../_lib/http");
const { getGoogleAccessToken } = require("../_lib/google-service-account");
const { calculateGrowthForecast3Parts, getDealValue: getDealValueForecast, normalizeKey: normalizeKeyForecast } = require("../_lib/forecast-service");
const {
  decodeFields,
  encodeFields,
  firestoreDeleteDocument,
  firestoreGetDocument,
  firestoreListDocuments,
  firestorePatchDocument,
  getBearerTokenFromRequest,
  getDocIdFromName,
  requestJson,
  FIRESTORE_BASE,
  API_KEY,
} = require("../_lib/firestore-rest");
const crypto = require("crypto");

const sendRedirect = (res, location) => {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end("");
};

const GOALS_COLLECTION = "growthGoals";

const safeJsonForHtml = (value) => {
  // Prevent `</script>` injection when embedding JSON in HTML.
  return JSON.stringify(value ?? {}).replace(/</g, "\\u003c");
};

const roleToBasePath = (role) => {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "growth") return "/growth/dashboard";
  if (raw === "teacher") return "/app/professor";
  if (raw === "admin") return "/app/admin";
  return "/app/aluno";
};

const normalizeRole = (role) => {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "growth") return "growth";
  if (raw === "teacher" || raw === "professor") return "teacher";
  if (raw === "admin" || raw === "administrador") return "admin";
  if (raw === "student" || raw === "aluno") return "student";
  return "";
};

const buildId = (prefix) => {
  const rand = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${Date.now()}_${rand}`;
};

const parseNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return NaN;
  const sanitized = raw.replace(/[^\d.,-]/g, "");
  let normalized = sanitized;
  if (normalized.includes(",")) {
    // pt-BR: "." milhares, "," decimal
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (normalized.includes(".")) {
    const parts = normalized.split(".");
    const last = parts[parts.length - 1] || "";
    // Heuristic: "80.000" => 80000 (milhares), "80.00" => 80.00 (decimal)
    if (parts.length > 2 || last.length === 3) {
      normalized = parts.join("");
    }
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};

const digitsOnly = (value) => String(value || "").replace(/\D+/g, "");

const formatWhatsapp = (value) => {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
};

const isValidEmail = (value) => {
  const email = String(value || "").trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const dateToPtBr = (date) => {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  } catch (error) {
    return "";
  }
};

const currencyPtBr = (value) => {
  try {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  } catch (error) {
    return "";
  }
};

const templateEnvForContrato = (contrato) => {
  const key = String(contrato || "").trim().toLowerCase();
  if (key === "diamond") return "ZAPSIGN_TEMPLATE_TOKEN_DIAMOND";
  if (key === "gold") return "ZAPSIGN_TEMPLATE_TOKEN_GOLD";
  if (key === "turma") return "ZAPSIGN_TEMPLATE_TOKEN_TURMA";
  return "";
};

const getZapSignTemplateToken = (contrato) => {
  const envName = templateEnvForContrato(contrato);
  if (!envName) return { ok: false, error: "invalid_contrato", envName: "" };
  const token = String(process.env[envName] || "").trim();
  if (!token) return { ok: false, error: "missing_template_token", envName };
  return { ok: true, token, envName };
};

const requestJsonRaw = async (url, { method = "GET", headers, body } = {}) => {
  const safeHeaders = headers && typeof headers === "object" ? headers : {};
  const upper = String(method || "GET").toUpperCase();
  return requestJson(url, { method: upper, headers: safeHeaders, body });
};

const ADMIN_SHEETS_SPREADSHEET_ID = "1BMG0XxVHOfrZHE7Zc1QsvgCFA8UOUhIAsKHwMsbMgeI";
const ADMIN_SHEETS_SHEET_NAME = "BASE DE DADOS";
const ADMIN_SHEETS_RANGE = `'${ADMIN_SHEETS_SHEET_NAME}'!A:Z`;

const getSaoPauloYearMonth = () => {
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const year = Number(parts.find((p) => p.type === "year")?.value || 0);
    const month = Number(parts.find((p) => p.type === "month")?.value || 0); // 1-12
    const day = Number(parts.find((p) => p.type === "day")?.value || 0);
    if (!year || !month || !day) {
      const d = new Date();
      return { year: d.getFullYear(), monthIndex: d.getMonth() };
    }
    return { year, monthIndex: month - 1 };
  } catch {
    const d = new Date();
    return { year: d.getFullYear(), monthIndex: d.getMonth() };
  }
};

const parsePtBrDate = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return null;
  // Accept dd/mm/yyyy or dd-mm-yyyy (ignore time suffix).
  const m = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) {
    const d = new Date(value);
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (!day || !month || !year) return null;
  // Use UTC noon to avoid timezone boundary issues when checking month.
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
};

const monthKeyAbrPtBr = ({ year, monthIndex }) => {
  const months = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
  const abbr = months[monthIndex] || "";
  if (!abbr || !year) return "";
  return `${abbr}/${year}`;
};

const normalizeChurnMonthKey = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");
};

const firestoreListDocumentsWithAccessToken = async ({ collectionPath, accessToken, pageSize = 1000 } = {}) => {
  const path = String(collectionPath || "").replace(/^\/+/, "");
  const token = String(accessToken || "").trim();
  if (!path) throw new Error("missing_collection");
  const safeSize = Math.max(1, Math.min(Number(pageSize) || 1000, 2000));

  const all = [];
  let pageToken = "";
  let safety = 0;

  while (safety < 20) {
    safety += 1;
    const params = new URLSearchParams();
    params.set("key", API_KEY);
    params.set("pageSize", String(safeSize));
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${FIRESTORE_BASE}/${encodeURI(path)}?${params.toString()}`;
    const res = await requestJsonRaw(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) return res;
    const docs = Array.isArray(res.data?.documents) ? res.data.documents : [];
    docs.forEach((doc) => all.push(doc));
    pageToken = typeof res.data?.nextPageToken === "string" ? res.data.nextPageToken : "";
    if (!pageToken) return { ...res, documents: all };
  }

  return { ok: true, status: 200, data: null, text: "", documents: all };
};

const firestorePatchDocumentWithAccessToken = async ({ docPath, accessToken, data, updateMaskPaths } = {}) => {
  const path = String(docPath || "").replace(/^\/+/, "");
  if (!path) throw new Error("missing_doc");
  const token = String(accessToken || "").trim();

  const params = new URLSearchParams();
  params.set("key", API_KEY);
  const mask = Array.isArray(updateMaskPaths) ? updateMaskPaths.filter((p) => typeof p === "string" && p) : [];
  mask.forEach((fieldPath) => {
    params.append("updateMask.fieldPaths", fieldPath);
  });

  const url = `${FIRESTORE_BASE}/${encodeURI(path)}?${params.toString()}`;
  return requestJsonRaw(url, {
    method: "PATCH",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: encodeFields(data),
  });
};

const requireGrowthAuth = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }

  const role = normalizeRole(session.role);
  if (role !== "growth") {
    sendJson(res, 403, { error: "forbidden" });
    return null;
  }

  const requesterId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!requesterId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }

  return { session, requesterId, idToken };
};

const requireInternalAuth = (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }

  const role = normalizeRole(session.role);
  if (role !== "growth" && role !== "admin") {
    sendJson(res, 403, { error: "forbidden" });
    return null;
  }

  return {
    id: String(session.sub || ""),
    role,
    name: String(session.name || ""),
    email: String(session.email || ""),
  };
};

const requireRoleAuthWithFirebaseToken = async (req, res, allowedRoles) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }

  const role = normalizeRole(session.role);
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [];
  if (!allowed.includes(role)) {
    sendJson(res, 403, { error: "forbidden" });
    return null;
  }

  const requesterId = String(session.sub || "");
  const idToken = getBearerTokenFromRequest(req);
  if (!requesterId || !idToken) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }

  return {
    id: requesterId,
    role,
    name: String(session.name || ""),
    email: String(session.email || ""),
    idToken,
  };
};

const normalizeKey = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Make comparisons tolerant to case and diacritics: "Conversão" vs "conversao".
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

const normalizeStageName = (value) => String(value || "").trim();
const normalizePipelineName = (value) => String(value || "").trim();

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const percent = (num, den) => {
  const n = safeNumber(num);
  const d = safeNumber(den);
  if (d <= 0) return 0;
  return (n / d) * 100;
};

const mapPlano = (rawProductName) => {
  const name = String(rawProductName || "").trim().toLowerCase();
  if (name.includes("diamond")) return "diamond";
  if (name.includes("gold")) return "gold";
  if (name.includes("turma")) return "turma";
  return "semPlano";
};

const relativeTimePtBr = (isoDate) => {
  const d = isoDate ? new Date(String(isoDate)) : null;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const min = Math.floor(abs / 60000);
  const hr = Math.floor(abs / 3600000);
  const day = Math.floor(abs / 86400000);

  const suffix = diff >= 0 ? "há" : "em";
  if (min < 1) return diff >= 0 ? "agora" : "em instantes";
  if (min < 60) return `${suffix} ${min} minuto${min === 1 ? "" : "s"}`;
  if (hr < 24) return `${suffix} ${hr} hora${hr === 1 ? "" : "s"}`;
  return `${suffix} ${day} dia${day === 1 ? "" : "s"}`;
};

const extractBusinessesArray = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.businesses)) return payload.businesses;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && Array.isArray(payload.data.businesses)) return payload.data.businesses;
  return [];
};

const isValidCompetencia = (value) => {
  const raw = String(value || "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return false;
  return true;
};

const getCurrentCompetenciaKeySaoPaulo = () => getMonthKeySaoPaulo(new Date());

const competenciaStatus = (competenciaKey, currentKey) => {
  const c = String(competenciaKey || "").trim();
  const cur = String(currentKey || "").trim();
  if (!c || !cur) return "unknown";
  if (c === cur) return "atual";
  return c > cur ? "futura" : "passada";
};

const firestoreGetDocumentWithAccessToken = async ({ docPath, accessToken } = {}) => {
  const path = String(docPath || "").replace(/^\/+/, "");
  if (!path) throw new Error("missing_doc");
  const token = String(accessToken || "").trim();

  const params = new URLSearchParams();
  params.set("key", API_KEY);
  const url = `${FIRESTORE_BASE}/${encodeURI(path)}?${params.toString()}`;

  return requestJsonRaw(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
};

const getMonthKeySaoPaulo = (date) => {
  try {
    const d = date instanceof Date ? date : new Date(String(date || ""));
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(d);
    const year = parts.find((p) => p.type === "year")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    if (!year || !month) return "";
    return `${year}-${month}`;
  } catch (error) {
    return "";
  }
};

const getBusinessWonLostDate = (business) => {
  // Best approximation for "Data de Ganho/Perdido" used by the CRM UI.
  // If DataCrazy adds an explicit field (ex: `wonAt`), we can switch here without touching the rest of the metrics.
  const b = business && typeof business === "object" ? business : {};
  const candidates = [
    "wonAt",
    "wonDate",
    "gainedAt",
    "gainAt",
    "closedAt",
    "finishedAt",
    "statusChangedAt",
    "stageChangedAt",
    "lastMovedAt",
  ];

  for (const field of candidates) {
    const raw = b[field];
    if (!raw) continue;
    const d = new Date(String(raw));
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
    return { date: d, field };
  }

  return { date: null, field: "" };
};

const getBusinessId = (business) => {
  const b = business && typeof business === "object" ? business : {};
  const raw =
    typeof b.id === "string"
      ? b.id
      : typeof b.id === "number"
        ? String(b.id)
        : typeof b._id === "string"
          ? b._id
          : typeof b.uuid === "string"
            ? b.uuid
            : typeof b.businessId === "string"
              ? b.businessId
              : "";
  return String(raw || "").trim();
};

const pickBusinessDebugFields = (business, { statusChangedField } = {}) => {
  const b = business && typeof business === "object" ? business : {};
  const stageName = b?.stage?.name != null ? String(b.stage.name) : "";
  const status = b?.status != null ? String(b.status) : "";
  const planName = b?.products?.[0]?.product?.name != null ? String(b.products[0].product.name) : "";
  const attendantName = b?.attendant?.name != null ? String(b.attendant.name) : "";
  const leadName = b?.lead?.name != null ? String(b.lead.name) : "";
  const code = b?.code != null ? String(b.code) : "";

  const createdAt = b?.createdAt != null ? String(b.createdAt) : "";
  const lastMovedAt = b?.lastMovedAt != null ? String(b.lastMovedAt) : "";

  const field = typeof statusChangedField === "string" ? statusChangedField : "";
  const statusChangedAt =
    field && b[field] != null
      ? String(b[field])
      : b?.statusChangedAt != null
        ? String(b.statusChangedAt)
        : b?.stageChangedAt != null
          ? String(b.stageChangedAt)
          : "";

  return {
    id: getBusinessId(b),
    code,
    leadName,
    stageName,
    status,
    total: safeNumber(b?.total),
    attendantName,
    planName,
    createdAt,
    lastMovedAt,
    statusChangedAt,
    statusChangedField: field || "",
  };
};

const fetchCrmBusinessesPage = async ({ base, apiKey, skip, take } = {}) => {
  const safeSkip = Math.max(0, Number(skip) || 0);
  const safeTake = Math.max(1, Math.min(Number(take) || 200, 500));

  const params = new URLSearchParams();
  params.set("skip", String(safeSkip));
  params.set("take", String(safeTake));

  const url = `${base}/api/v1/businesses?${params.toString()}`;
  const res = await requestJsonRaw(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    return {
      ok: false,
      status: res.status || 500,
      error: "crm_error",
      data: res.data ?? null,
      text: res.data == null ? (res.text || null) : null,
    };
  }

  const items = extractBusinessesArray(res.data);
  const total =
    typeof res.data?.total === "number"
      ? res.data.total
      : typeof res.data?.count === "number"
        ? res.data.count
        : typeof res.data?.meta?.total === "number"
          ? res.data.meta.total
          : null;

  return { ok: true, status: res.status || 200, items, total };
};

const fetchAllCrmBusinesses = async () => {
  const apiKey = String(process.env.CRM_API_KEY || "").trim();
  const base = String(process.env.CRM_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!apiKey || !base) {
    return {
      ok: false,
      status: 500,
      error: "missing_env",
      missing: [
        ...(!apiKey ? ["CRM_API_KEY"] : []),
        ...(!base ? ["CRM_API_BASE_URL"] : []),
      ],
    };
  }

  const take = 200;
  let skip = 0;
  let pages = 0;
  let totalFetched = 0;
  let expectedTotal = null;
  const all = [];

  // DataCrazy supports pagination with skip/take.
  // Keep fetching until we reach the last page (items < take), or until we hit the reported `total` (when available).
  while (pages < 200) {
    // Safety cap to avoid infinite loops if the CRM misbehaves.
    const page = await fetchCrmBusinessesPage({ base, apiKey, skip, take });
    if (!page.ok) return page;

    pages += 1;
    const items = Array.isArray(page.items) ? page.items : [];
    all.push(...items);
    totalFetched += items.length;

    if (typeof page.total === "number" && Number.isFinite(page.total) && page.total >= 0) {
      expectedTotal = page.total;
    }

    // Stop conditions.
    if (items.length < take) break;
    if (expectedTotal != null && totalFetched >= expectedTotal) break;

    skip += take;
  }

  return {
    ok: true,
    status: 200,
    businesses: all,
    pagination: {
      pages,
      take,
      totalFetched,
      expectedTotal,
    },
  };
};

const decodeGoalDoc = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = decodeFields(doc);

  const competencia = typeof fields.competencia === "string" ? fields.competencia.trim() : id;
  const valorMeta = Number.isFinite(Number(fields.valorMeta)) ? Number(fields.valorMeta) : null;
  const createdAt = fields.createdAt instanceof Date ? fields.createdAt : null;
  const updatedAt = fields.updatedAt instanceof Date ? fields.updatedAt : null;
  const createdBy = typeof fields.createdBy === "string" ? fields.createdBy : "";
  const updatedBy = typeof fields.updatedBy === "string" ? fields.updatedBy : "";
  const createdByName = typeof fields.createdByName === "string" ? fields.createdByName : "";
  const updatedByName = typeof fields.updatedByName === "string" ? fields.updatedByName : "";

  if (!isValidCompetencia(competencia)) return null;

  return {
    id,
    competencia,
    valorMeta,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
    createdBy: createdBy || null,
    updatedBy: updatedBy || null,
    createdByName: createdByName || null,
    updatedByName: updatedByName || null,
  };
};

const handleGrowthGoalsApi = async (req, res, url) => {
  const mode = String(url.searchParams.get("mode") || "").trim().toLowerCase();

  if (req.method === "GET" || req.method === "HEAD") {
    const auth = await requireRoleAuthWithFirebaseToken(req, res, ["admin", "growth"]);
    if (!auth) return;

    const currentKey = getCurrentCompetenciaKeySaoPaulo();
    const requestedCompetencia = String(url.searchParams.get("competencia") || "").trim();
    const competencia = mode === "current" ? currentKey : requestedCompetencia;

    // Single goal (current or explicit competence)
    if (competencia) {
      if (!isValidCompetencia(competencia)) {
        sendJson(res, 400, { error: "invalid_competencia" });
        return;
      }

      try {
        const docPath = `${GOALS_COLLECTION}/${encodeURIComponent(competencia)}`;
        const snap = await firestoreGetDocument({ docPath, idToken: auth.idToken });

        if (!snap.ok) {
          if (snap.status === 404) {
            sendJson(res, 200, { competencia, goal: null });
            return;
          }
          throw new Error("firestore_get_failed");
        }

        const goal = decodeGoalDoc(snap.data);
        sendJson(res, 200, { competencia, goal });
        return;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[api] growth-goals get failed", error);
        sendJson(res, 500, { error: "internal_error" });
        return;
      }
    }

    // List goals
    try {
      const resList = await firestoreListDocuments({ collectionPath: GOALS_COLLECTION, idToken: auth.idToken, pageSize: 2000 });

      if (!resList.ok) {
        // eslint-disable-next-line no-console
        console.error("[api] growth-goals firestore list failed", {
          status: resList.status,
          data: resList.data ?? null,
          text: resList.text ?? null,
          uid: auth.id,
        });
        throw new Error("firestore_list_failed");
      }
      const docs = Array.isArray(resList.documents)
        ? resList.documents
        : Array.isArray(resList.data?.documents)
          ? resList.data.documents
          : [];

      const goals = docs
        .map((doc) => decodeGoalDoc(doc))
        .filter(Boolean)
        .sort((a, b) => String(b.competencia || "").localeCompare(String(a.competencia || "")))
        .map((g) => ({
          ...g,
          status: competenciaStatus(g.competencia, currentKey),
        }));

      sendJson(res, 200, { currentCompetencia: currentKey, goals });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] growth-goals list failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  // eslint-disable-next-line no-console
  console.log("[growth-goals] auth header:", req?.headers?.authorization ? "present" : "missing");

  const auth = await requireRoleAuthWithFirebaseToken(req, res, ["admin"]);
  if (!auth) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  const competencia = String(body?.competencia || "").trim();
  const valorMeta = parseNumber(body?.valorMeta);
  if (!isValidCompetencia(competencia)) {
    sendJson(res, 400, { error: "invalid_competencia" });
    return;
  }
  if (!Number.isFinite(valorMeta) || valorMeta <= 0) {
    sendJson(res, 400, { error: "invalid_valor" });
    return;
  }

  const currentKey = getCurrentCompetenciaKeySaoPaulo();
  if (competencia < currentKey) {
    sendJson(res, 400, { error: "past_competencia_not_allowed" });
    return;
  }

  const docPath = `${GOALS_COLLECTION}/${encodeURIComponent(competencia)}`;
  const now = new Date();

  let exists = false;
  try {
    const snap = await firestoreGetDocument({ docPath, idToken: auth.idToken });
    exists = snap.ok;
  } catch (error) {
    exists = false;
  }

  const base = {
    competencia,
    valorMeta,
    updatedAt: now,
    updatedBy: auth.id,
    updatedByName: auth.name || null,
  };
  const data = exists
    ? base
    : {
        ...base,
        createdAt: now,
        createdBy: auth.id,
        createdByName: auth.name || null,
      };

  try {
    const patch = await firestorePatchDocument({
      docPath,
      idToken: auth.idToken,
      data,
      updateMaskPaths: Object.keys(data),
    });

    if (!patch.ok) {
      // eslint-disable-next-line no-console
      console.error("[api] growth-goals firestore write failed", {
        status: patch.status,
        data: patch.data ?? null,
        text: patch.text ?? null,
        docPath,
        uid: auth.id,
        competencia,
      });
      // eslint-disable-next-line no-console
      console.log("[growth-goals] error:", JSON.stringify(patch));
      sendJson(res, patch.status || 500, {
        error: "firestore_write_failed",
        firestoreStatus: patch.status || null,
        firestorePayload: patch.data ?? patch.text ?? null,
      });
      return;
    }

    sendJson(res, 200, { ok: true, competencia, action: exists ? "updated" : "created" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] growth-goals upsert failed", error);
    // eslint-disable-next-line no-console
    console.log("[growth-goals] error:", JSON.stringify(error));
    sendJson(res, 500, { error: "internal_error" });
  }
};

const handleGrowthMetricsApi = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const auth = requireInternalAuth(req, res);
  if (!auth) return;

  // In-memory cache (best-effort) to reduce CRM load. TTL: 60 seconds.
  const nowMs = Date.now();
  if (globalThis.__growthMetricsCache && globalThis.__growthMetricsCache.expiresAt > nowMs) {
    sendJson(res, 200, { ...globalThis.__growthMetricsCache.payload, cached: true });
    return;
  }

  const crm = await fetchAllCrmBusinesses();
  const businesses = Array.isArray(crm?.businesses) ? crm.businesses : [];
  // eslint-disable-next-line no-console
  console.log("[CRM FETCH]", {
    businessesCount: businesses.length,
    error: crm?.ok ? null : crm?.error || crm?.text || "crm_failed",
  });
  if (!crm || !crm.ok) {
    sendJson(res, crm?.status || 500, crm || { error: "crm_failed" });
    return;
  }

  const idToken = getBearerTokenFromRequest(req);
  const nowMonthKey = getMonthKeySaoPaulo(new Date());

  // Load Growth goal (meta do mês) from Firestore (REST) if the client provided a Firebase idToken.
  let metaDoMes = null;
  try {
    if (idToken) {
      const snap = await firestoreGetDocument({ docPath: `${GOALS_COLLECTION}/${encodeURIComponent(nowMonthKey)}`, idToken });
      if (snap.ok) {
        const goal = decodeGoalDoc(snap.data);
        const v = Number(goal?.valorMeta);
        if (Number.isFinite(v) && v > 0) metaDoMes = v;
      }
    }
  } catch {
    metaDoMes = null;
  }

  // Prefer the main pipeline name used by the commercial team. Fall back to the old "Conversão" pipeline if needed.
  const pipelinePreferred = normalizeKey("Funil principal");
  const preferredDeals = businesses.filter((b) => normalizeKey(b?.stage?.pipeline?.name) === pipelinePreferred);
  const pipelineTarget = preferredDeals.length ? pipelinePreferred : normalizeKey("Conversão");

  const filtered = businesses.filter((b) => normalizeKey(b?.stage?.pipeline?.name) === pipelineTarget);

  // Temporary debug: inspect fields for a deal in "Em fechamento" to identify lost flags/status fields.
  try {
    const sampleDeal = filtered.find((b) => {
      const stageKey = normalizeKey(b?.stage?.name);
      if (stageKey !== normalizeKey("Em fechamento")) return false;
      const createdAt = b?.createdAt || b?.created_at || null;
      return createdAt ? getMonthKeySaoPaulo(createdAt) === getMonthKeySaoPaulo(new Date()) : true;
    });
    if (sampleDeal) {
      // eslint-disable-next-line no-console
      console.log("[DEAL FIELDS]", JSON.stringify(Object.keys(sampleDeal)));
      // eslint-disable-next-line no-console
      console.log("[DEAL SAMPLE]", JSON.stringify(sampleDeal));
    }
  } catch {
    // ignore debug failures
  }

  const stageCounts = new Map();
  const stageTotals = new Map();
  const stageCountsMonth = new Map();
  const stageTotalsMonth = new Map();

  const closedDeals = [];
  let totalPipelineMonth = 0;

  filtered.forEach((b) => {
    const stageName = normalizeKey(b?.stage?.name);
    const total = safeNumber(b?.total);
    stageCounts.set(stageName, (stageCounts.get(stageName) || 0) + 1);
    stageTotals.set(stageName, (stageTotals.get(stageName) || 0) + total);

    const createdAt = b?.createdAt || b?.created_at || null;
    const isMonth = createdAt ? getMonthKeySaoPaulo(createdAt) === nowMonthKey : false;
    if (isMonth) {
      totalPipelineMonth += 1;
      stageCountsMonth.set(stageName, (stageCountsMonth.get(stageName) || 0) + 1);
      stageTotalsMonth.set(stageName, (stageTotalsMonth.get(stageName) || 0) + total);
    }
    if (stageName === "fechado") closedDeals.push(b);
  });

  const totalPipeline = filtered.length;

  const agendamentoStages = new Set([
    normalizeKey("Agendado"),
    normalizeKey("No-show"),
    normalizeKey("Reunião Reagendada"),
    normalizeKey("Reunião feita (Follow-up)"),
    normalizeKey("Hot Lead"),
    normalizeKey("Em fechamento"),
    normalizeKey("Fechado"),
  ]);

  const agendamentos =
    Array.from(agendamentoStages).reduce((sum, name) => sum + (stageCounts.get(name) || 0), 0);
  const fechados = stageCounts.get(normalizeKey("Fechado")) || 0;
  const noShow = stageCounts.get(normalizeKey("No-show")) || 0;

  const baseConversao =
    (stageCounts.get(normalizeKey("Reunião feita (Follow-up)")) || 0) +
    (stageCounts.get(normalizeKey("Hot Lead")) || 0) +
    (stageCounts.get(normalizeKey("Em fechamento")) || 0) +
    (stageCounts.get(normalizeKey("Fechado")) || 0);

  const agendamentosMonth =
    Array.from(agendamentoStages).reduce((sum, name) => sum + (stageCountsMonth.get(name) || 0), 0);
  const fechadosMonth = stageCountsMonth.get(normalizeKey("Fechado")) || 0;
  const noShowMonth = stageCountsMonth.get(normalizeKey("No-show")) || 0;

  const baseConversaoMonth =
    (stageCountsMonth.get(normalizeKey("Reunião feita (Follow-up)")) || 0) +
    (stageCountsMonth.get(normalizeKey("Hot Lead")) || 0) +
    (stageCountsMonth.get(normalizeKey("Em fechamento")) || 0) +
    (stageCountsMonth.get(normalizeKey("Fechado")) || 0);

  const dateFieldCounts = new Map();

  const closedDealsMonth = closedDeals.filter((b) => {
    const info = getBusinessWonLostDate(b);
    const field = info.field || "unknown";
    dateFieldCounts.set(field, (dateFieldCounts.get(field) || 0) + 1);
    const key = info.date ? getMonthKeySaoPaulo(info.date) : "";
    return key && nowMonthKey ? key === nowMonthKey : false;
  });

  const dateFieldUsed =
    Array.from(dateFieldCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  const totalFechadoStage = closedDeals.length;

  const closedDealsMonthIds = new Set(closedDealsMonth.map((b) => getBusinessId(b)).filter(Boolean));
  const closedDealsStageOutsideMonth = closedDeals.filter((b) => {
    const id = getBusinessId(b);
    if (!id) return true;
    return !closedDealsMonthIds.has(id);
  });

  const realizado = closedDealsMonth.reduce((sum, b) => sum + getDealValueForecast(b), 0);
  const totalVendas = closedDealsMonth.length;
  const ticketMedio = totalVendas > 0 ? realizado / totalVendas : 0;

  const conversao = percent(fechadosMonth, baseConversaoMonth);
  const taxaAgendamento = percent(agendamentosMonth, totalPipelineMonth);
  const taxaFunil = percent(fechadosMonth, totalPipelineMonth);
  const noShowPercent = percent(noShowMonth, agendamentosMonth);

  // metaDoMes is fetched in parallel with the CRM call (see computeFreshPayload).

  // Forecast (3 partes): fechado + pipeline (3 etapas) + projeção de novos leads.
  // Para a parte 3, contamos apenas dias úteis (seg-sex) restantes no mês na timezone de SP.
  const getSaoPauloNow = () => {
    try {
      const parts = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const year = Number(parts.find((p) => p.type === "year")?.value || 0);
      const month = Number(parts.find((p) => p.type === "month")?.value || 0); // 1-12
      const day = Number(parts.find((p) => p.type === "day")?.value || 0);
      if (!year || !month || !day) return new Date();
      // Use UTC noon to avoid timezone boundary issues when computing weekdays.
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    } catch {
      return new Date();
    }
  };

  const getWorkdaysRemaining = () => {
    const now = getSaoPauloNow();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth(); // 0-11
    const today = now.getUTCDate();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    let count = 0;
    for (let d = today + 1; d <= lastDay; d++) {
      const weekday = new Date(Date.UTC(year, month, d)).getUTCDay(); // 0=Sun .. 6=Sat
      if (weekday !== 0 && weekday !== 6) count++;
    }
    return count;
  };

  const spNow = getSaoPauloNow();
  const diasPassados = spNow.getUTCDate();
  const diasRestantes = getWorkdaysRemaining(); // ex: hoje dia 22 -> 6 dias úteis restantes

  // Ritmo necessário (seg-sáb): time comercial trabalha sábado, exclui apenas domingo.
  const getDiasUteisRestantesSegSab = () => {
    const now = getSaoPauloNow();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const today = now.getUTCDate();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    let count = 0;
    // Inclui o dia de hoje no "restante" (se não for domingo), já que o time ainda pode executar no dia atual.
    for (let d = today; d <= lastDay; d++) {
      const weekday = new Date(Date.UTC(year, month, d)).getUTCDay();
      if (weekday !== 0) count++; // exclui apenas domingo
    }
    return count;
  };

  const diasUteisRestantes = getDiasUteisRestantesSegSab();
  const faltaParaMeta = Number.isFinite(metaDoMes) && metaDoMes > 0 ? Math.max(0, metaDoMes - realizado) : 0;
  const ticketBase = Number.isFinite(ticketMedio) && ticketMedio > 0 ? ticketMedio : 1057;
  const taxaAgendamentoFrac = Math.max(0, Math.min(1, safeNumber(taxaAgendamento) / 100));
  const taxaNoShowFrac = Math.max(0, Math.min(1, safeNumber(noShowPercent) / 100));
  const taxaConversaoFrac = Math.max(0, Math.min(1, safeNumber(conversao) / 100));

  const vendasNecessariasDia =
    diasUteisRestantes > 0 && ticketBase > 0 ? faltaParaMeta / (ticketBase * diasUteisRestantes) : 0;
  const receitaNecessariaDia = diasUteisRestantes > 0 ? Math.ceil(faltaParaMeta / diasUteisRestantes) : 0;

  const showsNecessariosDia = taxaConversaoFrac > 0 ? vendasNecessariasDia / taxaConversaoFrac : 0;
  const agendamentosNecessariosDia = 1 - taxaNoShowFrac > 0 ? showsNecessariosDia / (1 - taxaNoShowFrac) : 0;
  const agendamentosDia = Math.max(0, Math.ceil(agendamentosNecessariosDia));
  const prospeccoesDia = taxaAgendamentoFrac > 0 ? Math.max(0, Math.ceil(agendamentosNecessariosDia / taxaAgendamentoFrac)) : 0;

  const ritmoNecessario = {
    diasUteisRestantes,
    receitaNecessariaDia,
    agendamentosDia,
    prospeccoesDia,
    critical: {
      dias: diasUteisRestantes <= 3,
      receitaDia: receitaNecessariaDia > 3000,
      agendamentosDia: agendamentosDia > 8,
      prospeccoesDia: prospeccoesDia > 20,
    },
  };

  const forecastBreakdown = calculateGrowthForecast3Parts({
    deals: filtered,
    nowMonthKey,
    getMonthKey: getMonthKeySaoPaulo,
    getClosedDate: (deal) => getBusinessWonLostDate(deal).date || null,
    daysPassed: Math.max(1, Number(diasPassados) || 1),
    daysRemaining: diasRestantes,
    rates: {
      taxaAgendamento: Number.isFinite(taxaAgendamento) ? Math.max(0, Math.min(1, taxaAgendamento / 100)) : undefined,
      taxaNoShow: Number.isFinite(noShowPercent) ? Math.max(0, Math.min(1, noShowPercent / 100)) : undefined,
      taxaConversao: Number.isFinite(conversao) ? Math.max(0, Math.min(1, conversao / 100)) : undefined,
      ticketMedio: Number.isFinite(ticketMedio) && ticketMedio > 0 ? ticketMedio : undefined,
    },
  });

  // Garantir que Parte 1 bata com o card "Realizado".
  forecastBreakdown.parte1_fechado = realizado;
  const forecast = Math.max(0, realizado + safeNumber(forecastBreakdown.parte2_pipeline) + safeNumber(forecastBreakdown.parte3_novosLeads));
  forecastBreakdown.total = forecast;

  try {
    const dbg = forecastBreakdown.debug && typeof forecastBreakdown.debug === "object" ? forecastBreakdown.debug : {};
    // eslint-disable-next-line no-console
    console.log("[FORECAST DEBUG]", {
      parte1_fechado: realizado,
      parte2_pipeline: safeNumber(forecastBreakdown.parte2_pipeline),
      parte3_novosLeads: safeNumber(forecastBreakdown.parte3_novosLeads),
      forecast_total: forecast,
      diasPassados: Number(dbg.diasPassados) || Math.max(1, Number(diasPassados) || 1),
      diasRestantes: Number(dbg.diasRestantes) || diasRestantes,
      mediaDiariaLeads: Number(dbg.mediaDiariaLeads) || 0,
      novosLeadsEsperados: Number(dbg.novosLeadsEsperados) || 0,
      dealsPipeline_count: Number(dbg.deals_parte2) || 0,
    });
  } catch {
    // ignore logging failures
  }

  const planosVendidos = { diamond: 0, gold: 0, turma: 0, semPlano: 0 };
  const rankingMap = new Map();

  closedDealsMonth.forEach((b) => {
    // TEMP DEBUG: entender como o DataCrazy está preenchendo produto/plano nos negócios fechados.
    try {
      // eslint-disable-next-line no-console
      console.log("[PLANO DEBUG]", {
        id: b?.id,
        products: b?.products,
        planName: b?.products?.[0]?.product?.name,
        total: b?.total,
        planoKey: mapPlano(b?.products?.[0]?.product?.name),
      });
    } catch {
      // ignore debug failures
    }

    const planName = b?.products?.[0]?.product?.name;
    const planoKey = mapPlano(planName);
    planosVendidos[planoKey] = (planosVendidos[planoKey] || 0) + 1;

    const vendor = b?.attendant?.name ? String(b.attendant.name).trim() : "Sem vendedor";
    const entry = rankingMap.get(vendor) || { nome: vendor, vendas: 0, valor: 0 };
    entry.vendas += 1;
    entry.valor += getDealValueForecast(b);
    rankingMap.set(vendor, entry);
  });

  const rankingTime = Array.from(rankingMap.values()).sort((a, b) => b.valor - a.valor);

  const latest = closedDealsMonth
    .slice()
    .sort((a, b) => {
      const daInfo = getBusinessWonLostDate(a);
      const dbInfo = getBusinessWonLostDate(b);
      const da = daInfo.date ? daInfo.date.getTime() : 0;
      const db = dbInfo.date ? dbInfo.date.getTime() : 0;
      return db - da;
    })[0];

  const ultimaVenda = latest
    ? {
        lead: latest?.lead?.name ? String(latest.lead.name).trim() : "",
        plano: latest?.products?.[0]?.product?.name ? String(latest.products[0].product.name).trim() : "",
        valor: getDealValueForecast(latest),
        lastMovedAt: latest?.lastMovedAt ? String(latest.lastMovedAt) : "",
        relativeTime: relativeTimePtBr(getBusinessWonLostDate(latest).date || latest?.lastMovedAt || latest?.createdAt),
      }
    : { lead: "", plano: "", valor: 0, lastMovedAt: "", relativeTime: "" };

  const payload = {
    summary: {
      realizado,
      totalVendas,
      conversao,
      ticketMedio,
      forecast,
      taxaAgendamento,
      taxaFunil,
      noShowPercent,
    },
    ritmoNecessario,
    planosVendidos,
    rankingTime,
    ultimaVenda,
    forecastBreakdown,
    debug: {
      totalFetched: Number(crm?.pagination?.totalFetched) || businesses.length,
      paginationPages: Number(crm?.pagination?.pages) || 1,
      totalPipelineConversao: totalPipeline,
      totalFechadoStage,
      totalFechadoMes: totalVendas,
      somaFechadoMes: realizado,
      dateFieldUsed,
      first10FechadoStage: closedDeals
        .slice()
        .sort((a, b) => {
          const daInfo = getBusinessWonLostDate(a);
          const dbInfo = getBusinessWonLostDate(b);
          const da = daInfo.date ? daInfo.date.getTime() : 0;
          const db = dbInfo.date ? dbInfo.date.getTime() : 0;
          return db - da;
        })
        .slice(0, 10)
        .map((b) => {
          const info = getBusinessWonLostDate(b);
          return pickBusinessDebugFields(b, { statusChangedField: info.field || "" });
        }),
      first10FechadoMes: closedDealsMonth
        .slice()
        .sort((a, b) => {
          const daInfo = getBusinessWonLostDate(a);
          const dbInfo = getBusinessWonLostDate(b);
          const da = daInfo.date ? daInfo.date.getTime() : 0;
          const db = dbInfo.date ? dbInfo.date.getTime() : 0;
          return db - da;
        })
        .slice(0, 10)
        .map((b) => {
          const info = getBusinessWonLostDate(b);
          return pickBusinessDebugFields(b, { statusChangedField: info.field || "" });
        }),
      first10FechadoStageForaMes: closedDealsStageOutsideMonth
        .slice()
        .sort((a, b) => {
          const daInfo = getBusinessWonLostDate(a);
          const dbInfo = getBusinessWonLostDate(b);
          const da = daInfo.date ? daInfo.date.getTime() : 0;
          const db = dbInfo.date ? dbInfo.date.getTime() : 0;
          return db - da;
        })
        .slice(0, 10)
        .map((b) => {
          const info = getBusinessWonLostDate(b);
          return pickBusinessDebugFields(b, { statusChangedField: info.field || "" });
        }),
      agendamentos,
      fechados,
      noShow,
      baseConversao,
    },
  };

  globalThis.__growthMetricsCache = { payload, expiresAt: Date.now() + 60 * 1000 };
  sendJson(res, 200, payload);
};

const decodeContratoDoc = (doc) => {
  if (!doc || typeof doc !== "object") return null;
  const id = getDocIdFromName(doc.name);
  if (!id) return null;
  const fields = decodeFields(doc);

  const nomeCompleto = typeof fields.nomeCompleto === "string" ? fields.nomeCompleto.trim() : "";
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const whatsapp = typeof fields.whatsapp === "string" ? digitsOnly(fields.whatsapp) : "";
  const telefoneCountry = typeof fields.telefoneCountry === "string" ? digitsOnly(fields.telefoneCountry) : "";
  const contrato = typeof fields.contrato === "string" ? fields.contrato.trim().toLowerCase() : "";
  const cpf = typeof fields.cpf === "string" ? digitsOnly(fields.cpf) : "";
  const endereco = typeof fields.endereco === "string" ? fields.endereco.trim() : "";
  const status = String(fields.status || "").trim().toLowerCase() || "rascunho";

  const criadoPor = typeof fields.criadoPor === "string" ? fields.criadoPor : "";
  const criadoEm = fields.criadoEm instanceof Date ? fields.criadoEm : null;
  const enviadoEm = fields.enviadoEm instanceof Date ? fields.enviadoEm : null;
  const assinadoEm = fields.assinadoEm instanceof Date ? fields.assinadoEm : null;

  const zapsignToken = typeof fields.zapsignToken === "string" ? fields.zapsignToken : "";
  const zapsignSignUrl = typeof fields.zapsignSignUrl === "string" ? fields.zapsignSignUrl : "";
  const documentoAssinado = typeof fields.documentoAssinado === "string" ? fields.documentoAssinado : "";

  const valorOriginal = Number.isFinite(Number(fields.valorOriginal)) ? Number(fields.valorOriginal) : null;
  const valorDesconto = Number.isFinite(Number(fields.valorDesconto)) ? Number(fields.valorDesconto) : null;
  const data = typeof fields.data === "string" ? fields.data.trim() : "";

  return {
    id,
    nomeCompleto,
    email: email || null,
    whatsapp: whatsapp || null,
    telefoneCountry: telefoneCountry || "55",
    contrato: contrato || null,
    cpf,
    endereco,
    valorOriginal,
    valorDesconto,
    data,
    status,
    criadoPor: criadoPor || null,
    criadoEm: criadoEm ? criadoEm.toISOString() : null,
    enviadoEm: enviadoEm ? enviadoEm.toISOString() : null,
    assinadoEm: assinadoEm ? assinadoEm.toISOString() : null,
    zapsignToken: zapsignToken || null,
    zapsignSignUrl: zapsignSignUrl || null,
    documentoAssinado: documentoAssinado || null,
  };
};

const callZapSignCreateDoc = async ({
  nomeCompleto,
  cpf,
  endereco,
  valorOriginal,
  valorDesconto,
  dataPt,
  email,
  telefone,
  telefoneCountry,
  contrato,
} = {}) => {
  // Env vars required on Vercel:
  // - ZAPSIGN_API_TOKEN
  // - ZAPSIGN_TEMPLATE_TOKEN_DIAMOND / _GOLD / _TURMA
  const apiToken = String(process.env.ZAPSIGN_API_TOKEN || "").trim();
  if (!apiToken) {
    const error = new Error("missing_env_ZAPSIGN_API_TOKEN");
    error.code = "missing_env";
    throw error;
  }

  const template = getZapSignTemplateToken(contrato);
  if (!template.ok) {
    const error = new Error(template.error);
    error.code = template.error;
    error.envName = template.envName || "";
    throw error;
  }

  const url = "https://api.zapsign.com.br/api/v1/models/create-doc/";
  const emailValue = String(email || "").trim();
  const country = digitsOnly(telefoneCountry) || "55";
  const telefoneDigits = digitsOnly(telefone);
  const telefoneValue = telefoneDigits ? `+${country} ${telefoneDigits}` : "";
  const payload = {
    // ZapSign expects `template_id` (token shown in the template URL /conta/modelos/<TEMPLATE_ID>).
    template_id: template.token,
    signer_name: String(nomeCompleto || "").trim(),
    signer_email: emailValue,
    signer_phone_country: country,
    signer_phone_number: telefoneDigits,
    data: [
      { de: "{{NOME_COMPLETO}}", para: String(nomeCompleto || "").trim() },
      { de: "{{EMAIL}}", para: emailValue },
      { de: "{{TELEFONE}}", para: telefoneValue || telefoneDigits },
      { de: "{{CPF}}", para: String(cpf || "").trim() },
      { de: "{{ENDERECO}}", para: String(endereco || "").trim() },
      { de: "{{VALOR_ORIGINAL}}", para: currencyPtBr(valorOriginal) },
      { de: "{{VALOR_DESCONTO}}", para: currencyPtBr(valorDesconto) },
      { de: "{{DATA}}", para: String(dataPt || "").trim() },
    ],
  };

  const res = await requestJsonRaw(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: payload,
  });

  if (!res.ok) {
    const error = new Error("zapsign_failed");
    error.status = res.status;
    error.payload = res.data || res.text || null;
    throw error;
  }

  const data = res.data && typeof res.data === "object" ? res.data : {};
  const token =
    typeof data.token === "string"
      ? data.token
      : typeof data.doc_token === "string"
        ? data.doc_token
        : typeof data.document_token === "string"
          ? data.document_token
          : "";

  const signUrl =
    typeof data.sign_url === "string"
      ? data.sign_url
      : typeof data.signUrl === "string"
        ? data.signUrl
        : Array.isArray(data.signers) && typeof data.signers?.[0]?.sign_url === "string"
          ? data.signers[0].sign_url
          : "";

  return { token: token || null, signUrl: signUrl || null, raw: data };
};

const handleGrowthContractsApi = async (req, res, url) => {
  const auth = await requireGrowthAuth(req, res);
  if (!auth) return;

  const { requesterId, idToken } = auth;

  if (req.method === "GET" || req.method === "HEAD") {
    const statusFilter = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const q = String(url.searchParams.get("q") || "").trim();
    const qLower = q.toLowerCase();
    const qDigits = digitsOnly(q);

    let docs = [];
    try {
      const resList = await firestoreListDocuments({ collectionPath: "contratos", idToken, pageSize: 2000 });
      if (!resList.ok) throw new Error("firestore_list_failed");
      docs = Array.isArray(resList.documents)
        ? resList.documents
        : Array.isArray(resList.data?.documents)
          ? resList.data.documents
          : [];
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] growth contratos list failed", error);
      sendJson(res, 500, { error: "internal_error" });
      return;
    }

    const contracts = docs
      .map((doc) => decodeContratoDoc(doc))
      .filter(Boolean)
      .filter((c) => {
        if (statusFilter && statusFilter !== "todos" && statusFilter !== "all") {
          if (c.status !== statusFilter) return false;
        }
        if (qLower) {
          const name = String(c.nomeCompleto || "").toLowerCase();
          const cpf = String(c.cpf || "");
          const hitName = name.includes(qLower);
          const hitCpf = qDigits ? cpf.includes(qDigits) : false;
          if (!hitName && !hitCpf) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

    sendJson(res, 200, { contracts });
    return;
  }

  if (req.method === "DELETE") {
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) {
      sendJson(res, 400, { error: "invalid_request" });
      return;
    }

    try {
      const del = await firestoreDeleteDocument({ docPath: `contratos/${encodeURIComponent(id)}`, idToken });
      if (!del.ok && del.status !== 404) throw new Error("firestore_delete_failed");
      sendJson(res, 200, { ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] growth contratos delete failed", error);
      sendJson(res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST, DELETE");
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

  const action = String(body?.action || "create").trim().toLowerCase();

  if (action === "send" || action === "reenviar" || action === "resend") {
    const id = String(body?.id || "").trim();
    if (!id) {
      sendJson(res, 400, { error: "invalid_request" });
      return;
    }

    let snap;
    try {
      snap = await firestoreGetDocument({ docPath: `contratos/${encodeURIComponent(id)}`, idToken });
      if (!snap.ok) {
        sendJson(res, snap.status === 404 ? 404 : 500, { error: snap.status === 404 ? "not_found" : "internal_error" });
        return;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] growth contratos send load failed", error);
      sendJson(res, 500, { error: "internal_error" });
      return;
    }

    const contrato = decodeContratoDoc(snap.data);
    if (!contrato) {
      sendJson(res, 400, { error: "invalid_contract" });
      return;
    }

	    try {
    const z = await callZapSignCreateDoc({
      nomeCompleto: contrato.nomeCompleto,
      email: contrato.email,
      telefone: contrato.whatsapp,
      telefoneCountry: contrato.telefoneCountry,
      contrato: contrato.contrato,
      cpf: contrato.cpf,
      endereco: contrato.endereco,
      valorOriginal: contrato.valorOriginal,
      valorDesconto: contrato.valorDesconto,
      dataPt: contrato.data || dateToPtBr(new Date()),
	      });

      const patchData = {
        status: "enviado",
        enviadoEm: new Date(),
        zapsignToken: z.token,
        zapsignSignUrl: z.signUrl,
      };

      const patch = await firestorePatchDocument({
        docPath: `contratos/${encodeURIComponent(id)}`,
        idToken,
        data: patchData,
        updateMaskPaths: Object.keys(patchData),
      });
      if (!patch.ok) throw new Error("firestore_patch_failed");

      sendJson(res, 200, { ok: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[api] growth contratos send failed", error);
      sendJson(res, 500, {
        error: "zapsign_failed",
        zapsignStatus: Number(error?.status) || null,
        zapsignPayload: error?.payload || null,
        zapsignCode: typeof error?.code === "string" ? error.code : null,
        zapsignMissingEnv: typeof error?.envName === "string" && error.envName ? error.envName : null,
      });
    }
    return;
  }

  // Create
  const nomeCompleto = String(body?.nomeCompleto || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const telefoneCountry = digitsOnly(body?.telefoneCountry || "55").slice(0, 4) || "55";
  const whatsappDigits = digitsOnly(body?.whatsapp);
  const contrato = String(body?.contrato || "").trim().toLowerCase();
  const cpfDigits = digitsOnly(body?.cpf);
  const endereco = String(body?.endereco || "").trim();
  const valorOriginal = parseNumber(body?.valorOriginal);
  const valorDescontoRaw = body?.valorDesconto;
  const valorDesconto = valorDescontoRaw == null || String(valorDescontoRaw).trim() === "" ? valorOriginal : parseNumber(valorDescontoRaw);
  const dataRaw = body?.data;
  const dataDate = dataRaw ? new Date(String(dataRaw)) : new Date();
  const dataPt = dateToPtBr(dataDate);

  const sendNow = Boolean(body?.sendNow || body?.enviarAgora);

  if (!nomeCompleto || !email || !whatsappDigits || !cpfDigits || !endereco || !Number.isFinite(valorOriginal) || !contrato) {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }
  if (!["diamond", "gold", "turma"].includes(contrato)) {
    sendJson(res, 400, { error: "invalid_contrato" });
    return;
  }
  if (!isValidEmail(email)) {
    sendJson(res, 400, { error: "invalid_email" });
    return;
  }
  if (whatsappDigits.length < 6 || whatsappDigits.length > 15) {
    sendJson(res, 400, { error: "invalid_whatsapp" });
    return;
  }
  if (cpfDigits.length !== 11) {
    sendJson(res, 400, { error: "invalid_cpf" });
    return;
  }
  if (!Number.isFinite(valorDesconto)) {
    sendJson(res, 400, { error: "invalid_request" });
    return;
  }
  if (valorDesconto > valorOriginal) {
    sendJson(res, 400, { error: "invalid_discount" });
    return;
  }

  const id = buildId("contr");
  const baseData = {
    nomeCompleto,
    email,
    whatsapp: whatsappDigits,
    telefoneCountry,
    contrato,
    cpf: cpfDigits,
    endereco,
    valorOriginal,
    valorDesconto,
    data: dataPt,
    status: "rascunho",
    criadoPor: requesterId,
    criadoEm: new Date(),
    enviadoEm: null,
    assinadoEm: null,
    zapsignToken: null,
    zapsignSignUrl: null,
    documentoAssinado: null,
  };

  try {
    const patch = await firestorePatchDocument({
      docPath: `contratos/${encodeURIComponent(id)}`,
      idToken,
      data: baseData,
      updateMaskPaths: Object.keys(baseData),
    });
    if (!patch.ok) throw new Error("firestore_patch_failed");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] growth contratos create failed", error);
    sendJson(res, 500, { error: "internal_error" });
    return;
  }

  if (!sendNow) {
    sendJson(res, 200, { ok: true, id });
    return;
  }

	  try {
    const z = await callZapSignCreateDoc({
      nomeCompleto,
      email,
      telefone: whatsappDigits,
      telefoneCountry,
      contrato,
      cpf: cpfDigits,
      endereco,
      valorOriginal,
      valorDesconto,
      dataPt,
    });

    const patchData = {
      status: "enviado",
      enviadoEm: new Date(),
      zapsignToken: z.token,
      zapsignSignUrl: z.signUrl,
    };

    const patch = await firestorePatchDocument({
      docPath: `contratos/${encodeURIComponent(id)}`,
      idToken,
      data: patchData,
      updateMaskPaths: Object.keys(patchData),
    });
    if (!patch.ok) throw new Error("firestore_patch_failed");

    sendJson(res, 200, { ok: true, id });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] growth contratos create+send failed", error);
    sendJson(res, 500, {
      error: "zapsign_failed",
      id,
      zapsignStatus: Number(error?.status) || null,
      zapsignPayload: error?.payload || null,
      zapsignCode: typeof error?.code === "string" ? error.code : null,
      zapsignMissingEnv: typeof error?.envName === "string" && error.envName ? error.envName : null,
    });
  }
};

const handleZapSignWebhook = async (req, res) => {
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

  const eventType = String(body?.event || body?.type || body?.event_type || "").trim().toLowerCase();
  if (eventType && !eventType.includes("signed")) {
    sendJson(res, 200, { ok: true });
    return;
  }

  const token =
    String(body?.doc_token || body?.token || body?.document_token || body?.documentToken || body?.document?.token || "")
      .trim()
      .toString() || "";

  const signedUrl =
    String(body?.signed_file_url || body?.signedUrl || body?.documentoAssinado || body?.document?.signed_file_url || "")
      .trim()
      .toString() || "";

  if (!token) {
    sendJson(res, 400, { error: "missing_token" });
    return;
  }

  let accessToken = "";
  try {
    const t = await getGoogleAccessToken({ scope: "https://www.googleapis.com/auth/datastore" });
    accessToken = String(t?.accessToken || "").trim();
  } catch (error) {
    accessToken = "";
  }

  // As a fallback, attempt unauthenticated access (useful while Firestore rules are permissive in development).
  let docs = [];
  try {
    const resList = await firestoreListDocumentsWithAccessToken({ collectionPath: "contratos", accessToken, pageSize: 2000 });
    if (!resList.ok) {
      if (!accessToken && (resList.status === 401 || resList.status === 403)) {
        sendJson(res, 500, { error: "missing_service_account" });
        return;
      }
      throw new Error("firestore_list_failed");
    }
    docs = Array.isArray(resList.documents)
      ? resList.documents
      : Array.isArray(resList.data?.documents)
        ? resList.data.documents
        : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] zapsign webhook list failed", error);
    sendJson(res, 500, { error: "firestore_unavailable" });
    return;
  }

  const match = docs
    .map((doc) => {
      if (!doc || typeof doc !== "object") return null;
      const id = getDocIdFromName(doc.name);
      if (!id) return null;
      const fields = decodeFields(doc);
      const stored = typeof fields.zapsignToken === "string" ? fields.zapsignToken : "";
      return stored === token ? id : null;
    })
    .filter(Boolean)[0];

  if (!match) {
    sendJson(res, 200, { ok: true, ignored: true });
    return;
  }

  const patchData = {
    status: "assinado",
    assinadoEm: new Date(),
    documentoAssinado: signedUrl || null,
  };

  try {
    const patch = await firestorePatchDocumentWithAccessToken({
      docPath: `contratos/${encodeURIComponent(match)}`,
      accessToken,
      data: patchData,
      updateMaskPaths: Object.keys(patchData),
    });
    if (!patch.ok) {
      if (!accessToken && (patch.status === 401 || patch.status === 403)) {
        sendJson(res, 500, { error: "missing_service_account" });
        return;
      }
      throw new Error("firestore_patch_failed");
    }
    sendJson(res, 200, { ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] zapsign webhook patch failed", error);
    sendJson(res, 500, { error: "internal_error" });
  }
};

const handleAdminSheetsMetricsApi = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const auth = await requireRoleAuthWithFirebaseToken(req, res, ["admin"]);
  if (!auth) return;

  const nowMs = Date.now();
  const ttlMs = 5 * 60 * 1000;
  if (globalThis.__adminSheetsMetricsCache && globalThis.__adminSheetsMetricsCache.expiresAt > nowMs) {
    res.setHeader("Cache-Control", "public, s-maxage=300");
    sendJson(res, 200, { ...globalThis.__adminSheetsMetricsCache.payload, cached: true });
    return;
  }

  // Ensure we can mint a Google OAuth access token via service account.
  const email = String(process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const key = String(process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY || "").trim();
  if (!email || !key) {
    sendJson(res, 500, {
      error: "missing_env",
      missing: [...(!email ? ["GOOGLE_CLIENT_EMAIL"] : []), ...(!key ? ["GOOGLE_PRIVATE_KEY"] : [])],
    });
    return;
  }

  const { year, monthIndex } = getSaoPauloYearMonth();
  const churnKey = monthKeyAbrPtBr({ year, monthIndex });
  const churnKeyNorm = normalizeChurnMonthKey(churnKey);

  let rows = [];
  try {
    const accessToken = await getGoogleAccessToken({ scope: "https://www.googleapis.com/auth/spreadsheets.readonly" });
    const rangeEnc = encodeURIComponent(ADMIN_SHEETS_RANGE);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ADMIN_SHEETS_SPREADSHEET_ID}/values/${rangeEnc}?majorDimension=ROWS`;
    const sheetRes = await requestJsonRaw(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!sheetRes.ok) {
      // eslint-disable-next-line no-console
      console.error("[api] admin-sheets-metrics sheets error", { status: sheetRes.status, data: sheetRes.data ?? null, text: sheetRes.text ?? null });
      sendJson(res, sheetRes.status || 500, { error: "sheets_fetch_failed" });
      return;
    }
    rows = Array.isArray(sheetRes.data?.values) ? sheetRes.data.values : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] admin-sheets-metrics fetch failed", error);
    sendJson(res, 500, { error: "sheets_fetch_failed" });
    return;
  }

  // Columns: A Nome, B Data de entrada, C Data de saída, D Status, R Plano Contratado, S Ticket mensal, X LTV, Z Mês do churn
  // Indexes: A=0, B=1, C=2, D=3, R=17, S=18, X=23, Z=25
  const startIdx = rows.length && String(rows[0]?.[0] || "").trim().toLowerCase() === "nome" ? 1 : 0;

  let alunosAtivos = 0;
  let alunosNovosMes = 0;
  let churnMes = 0;
  let ltvSum = 0;
  let ltvCount = 0;
  let permanenciaSumMeses = 0;
  let permanenciaCount = 0;

  for (let i = startIdx; i < rows.length; i += 1) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    const statusRaw = String(row[3] || "").trim();
    const statusNorm = normalizeKey(statusRaw);
    const entrada = parsePtBrDate(row[1]);
    const saida = parsePtBrDate(row[2]);
    const churnRaw = String(row[25] || "").trim();
    const churnNorm = normalizeChurnMonthKey(churnRaw);

    if (statusNorm === normalizeKey("Ativo")) alunosAtivos += 1;

    if (entrada) {
      const y = entrada.getUTCFullYear();
      const m = entrada.getUTCMonth();
      if (y === year && m === monthIndex) alunosNovosMes += 1;
    }

    if (churnNorm && churnKeyNorm && churnNorm === churnKeyNorm) churnMes += 1;

    const ltv = parseNumber(row[23]);
    if (Number.isFinite(ltv)) {
      ltvSum += ltv;
      ltvCount += 1;
    }

    if (statusNorm === normalizeKey("Cancelado") && entrada && saida) {
      const diffMs = saida.getTime() - entrada.getTime();
      if (diffMs > 0) {
        const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
        if (Number.isFinite(months)) {
          permanenciaSumMeses += months;
          permanenciaCount += 1;
        }
      }
    }
  }

  const churnPercentual = alunosAtivos > 0 ? (churnMes / alunosAtivos) * 100 : 0;
  const ltvMedio = ltvCount > 0 ? ltvSum / ltvCount : 0;
  const tempMedioMeses = permanenciaCount > 0 ? permanenciaSumMeses / permanenciaCount : 0;

  const payload = {
    alunosAtivos,
    alunosNovosMes,
    churnMes,
    churnPercentual,
    ltvMedio,
    tempMedioMeses,
  };

  globalThis.__adminSheetsMetricsCache = {
    expiresAt: nowMs + ttlMs,
    payload,
  };

  res.setHeader("Cache-Control", "public, s-maxage=300");
  sendJson(res, 200, { ...payload, cached: false });
};

const handleCrmTestApi = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  const auth = requireInternalAuth(req, res);
  if (!auth) return;

  const apiKey = String(process.env.CRM_API_KEY || "").trim();
  const base = String(process.env.CRM_API_BASE_URL || "").trim().replace(/\/+$/, "");

  if (!apiKey || !base) {
    sendJson(res, 500, {
      error: "missing_env",
      missing: [
        ...(!apiKey ? ["CRM_API_KEY"] : []),
        ...(!base ? ["CRM_API_BASE_URL"] : []),
      ],
    });
    return;
  }

  const url = `${base}/api/v1/businesses`;
  try {
    const crmRes = await requestJsonRaw(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // Mirror the CRM response status to make debugging easier.
    sendJson(res, crmRes.status || 500, {
      status: crmRes.status || 500,
      ok: Boolean(crmRes.ok),
      data: crmRes.data ?? null,
      text: crmRes.data == null ? (crmRes.text || null) : null,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api] crm-test failed", error);
    sendJson(res, 500, { error: "internal_error" });
  }
};

module.exports = async (req, res) => {
  const host = String(req.headers.host || "localhost");
  const url = new URL(req.url || "/api/growth-dashboard", `https://${host}`);
  const api = String(url.searchParams.get("api") || "").trim().toLowerCase();

  if (api === "crm-test") {
    await handleCrmTestApi(req, res);
    return;
  }

  if (api === "admin-sheets-metrics") {
    await handleAdminSheetsMetricsApi(req, res);
    return;
  }

  if (api === "growth-metrics") {
    await handleGrowthMetricsApi(req, res);
    return;
  }

  if (api === "growth-goals") {
    await handleGrowthGoalsApi(req, res, url);
    return;
  }

  if (api === "growth-contratos") {
    await handleGrowthContractsApi(req, res, url);
    return;
  }

  if (api === "zapsign-webhook") {
    await handleZapSignWebhook(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendRedirect(res, "/");
    return;
  }

  const user = {
    id: String(session.sub || ""),
    role: String(session.role || ""),
    name: String(session.name || ""),
    email: String(session.email || ""),
  };

  if (String(user.role || "").trim().toLowerCase() !== "growth") {
    sendRedirect(res, roleToBasePath(user.role));
    return;
  }

  const sessionJson = safeJsonForHtml(user);

  const page = String(url.searchParams.get("page") || "").trim().toLowerCase();
  const isContracts = page === "contracts" || page === "contratos";

  const navDashboardClass = isContracts ? "sidebar-link" : "sidebar-link is-active";
  const navContractsClass = isContracts ? "sidebar-link is-active" : "sidebar-link";
  const pageTitle = isContracts ? "Space | Contratos" : "Space | Growth";

  const mainHtml = isContracts
    ? `
        <div class="growth-v2 growth-contracts" data-growth-view="contracts">
          <header class="growth-v2-header growth-contracts-header" aria-label="Cabeçalho de contratos">
            <div class="growth-v2-head-left">
              <div class="growth-v2-eyebrow">GROWTH</div>
              <div class="growth-v2-title">Contratos</div>
            </div>

            <div class="growth-v2-head-right growth-contracts-head-right" aria-label="Ações">
              <button class="growth-contracts-new" type="button" data-contract-new>+ Novo contrato</button>
              <div class="growth-v2-usercard">
                <div class="growth-v2-user-name" data-growth-user-name></div>
                <div class="growth-v2-user-role">Acesso Growth</div>
              </div>
              <div class="growth-v2-avatar" data-growth-avatar aria-label="Avatar do usuário">GR</div>
            </div>
          </header>

          <div class="growth-contracts-searchbar" aria-label="Buscar contratos">
            <input
              class="growth-contracts-search"
              type="text"
              inputmode="search"
              placeholder="Buscar por nome ou CPF"
              data-contract-search
            />
          </div>

          <div class="growth-contracts-tabs" role="tablist" aria-label="Filtro de status">
            <button class="growth-contracts-tab is-active" type="button" data-contract-status="all" role="tab">Todos</button>
            <button class="growth-contracts-tab" type="button" data-contract-status="rascunho" role="tab">Rascunho</button>
            <button class="growth-contracts-tab" type="button" data-contract-status="enviado" role="tab">Enviado</button>
            <button class="growth-contracts-tab" type="button" data-contract-status="assinado" role="tab">Assinado</button>
          </div>

          <section class="growth-contracts-table-card" aria-label="Lista de contratos">
            <div class="growth-contracts-table" role="table">
              <div class="growth-contracts-row growth-contracts-head" role="row">
                <span role="columnheader">Nome completo</span>
                <span role="columnheader">CPF</span>
                <span role="columnheader">Valor</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Data de criação</span>
                <span role="columnheader"></span>
              </div>
              <div class="growth-contracts-body" data-contract-list></div>
            </div>
            <div class="growth-contracts-empty" data-contract-empty hidden>
              <div class="growth-contracts-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M8 7h8"></path>
                  <path d="M8 11h8"></path>
                  <path d="M8 15h6"></path>
                  <path d="M7 3.5h7l3 3V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"></path>
                </svg>
              </div>
              <strong>Nenhum contrato encontrado</strong>
            </div>
          </section>
        </div>
      `
    : `
	        <div class="growth-v2" data-growth-dashboard data-growth-view="dashboard">
	          <header class="growth-v2-header" aria-label="Cabeçalho do dashboard Growth">
            <div class="growth-v2-head-left">
              <div class="growth-v2-eyebrow">GROWTH</div>
              <div class="growth-v2-title">Dashboard Comercial</div>
              <div class="growth-v2-subtitle" data-growth-month>Gestão à vista do mês · Abril 2026</div>
            </div>

            <div class="growth-v2-head-right" aria-label="Usuário logado">
              <div class="growth-v2-usercard">
                <div class="growth-v2-user-name" data-growth-user-name></div>
                <div class="growth-v2-user-role">Acesso Growth</div>
              </div>
              <div class="growth-v2-avatar" data-growth-avatar aria-label="Avatar do usuário">GR</div>
            </div>
          </header>

          <section class="growth-v2-section" aria-label="Resultado do mês">
            <div class="growth-v2-section-label">RESULTADO DO MÊS</div>

	            <div class="growth-v2-grid growth-v2-grid-4">
	              <article class="growth-v2-card">
                <div class="growth-v2-icon is-blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 13.5h3l2.2-6.2 3.2 12.7 2.4-6.5H20"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Meta do mês</div>
                <div class="growth-v2-card-value" data-growth-kpi="meta">R$ 80.000</div>
              </article>

              <article class="growth-v2-card is-realizado">
                <div class="growth-v2-icon is-coral" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 18V9"></path>
                    <path d="M10 18V6"></path>
                    <path d="M15 18v-7"></path>
                    <path d="M20 18V4"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label is-coral">Realizado</div>
                <div class="growth-v2-card-value is-coral" data-growth-kpi="realizado">R$ 52.400</div>
              </article>

	              <article class="growth-v2-card">
                <div class="growth-v2-icon is-yellow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="8"></circle>
                    <path d="M12 7v5l3 2"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">% de atingimento</div>
                <div class="growth-v2-card-value" data-growth-kpi="atingimento">65,5%</div>
                <div class="growth-v2-progress" aria-hidden="true">
                  <span class="growth-v2-progress-fill" style="width: 65.5%"></span>
                </div>
	              </article>

	              <article class="growth-v2-card growth-v2-card-plans" aria-label="Planos vendidos no mês">
	                <div class="growth-v2-icon is-green" aria-hidden="true">
	                  <svg viewBox="0 0 24 24" fill="none">
	                    <path d="M8 7h8"></path>
	                    <path d="M8 11h8"></path>
	                    <path d="M8 15h6"></path>
	                    <path d="M7 3.5h7l3 3V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"></path>
	                  </svg>
	                </div>
	                <div class="growth-v2-card-label is-green">Planos vendidos</div>
	                <div class="growth-v2-plans">
	                  <div class="growth-v2-pie" aria-hidden="true" data-growth-plans-pie></div>
	                  <div class="growth-v2-plans-legend" aria-label="Distribuição de planos vendidos no mês">
	                    <div class="growth-v2-plans-item">
	                      <span class="growth-v2-dot is-turma" aria-hidden="true"></span>
	                      <span>Turma</span>
	                      <strong data-growth-plan="turma">6</strong>
	                    </div>
	                    <div class="growth-v2-plans-item">
	                      <span class="growth-v2-dot is-gold" aria-hidden="true"></span>
	                      <span>Gold</span>
	                      <strong data-growth-plan="gold">20</strong>
	                    </div>
	                    <div class="growth-v2-plans-item">
	                      <span class="growth-v2-dot is-diamond" aria-hidden="true"></span>
	                      <span>Diamond</span>
	                      <strong data-growth-plan="diamond">12</strong>
	                    </div>
	                  </div>
	                </div>
	              </article>
	            </div>
	          </section>

	          <section class="growth-v2-section" aria-label="Indicadores comerciais">
	            <div class="growth-v2-section-label">INDICADORES COMERCIAIS</div>

	            <div class="growth-v2-grid growth-v2-grid-4">
              <article class="growth-v2-card">
                <div class="growth-v2-icon is-blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="4.5" y="6.5" width="15" height="13" rx="2"></rect>
                    <path d="M7.5 10h9"></path>
                    <path d="M7.5 13.5h6.5"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Total de vendas</div>
                <div class="growth-v2-card-value" data-growth-indicator="vendas">38</div>
                <div class="growth-v2-card-sub is-green">+12 vs mês anterior</div>
              </article>

              <article class="growth-v2-card">
                <div class="growth-v2-icon is-green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 14.5 11 10.5l3 3 5-5"></path>
                    <path d="M19 14.5v5H4.5V5h5"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Conversão</div>
                <div class="growth-v2-card-value" data-growth-indicator="conversao">27%</div>
                <div class="growth-v2-card-sub is-green">+3% vs mês anterior</div>
              </article>

              <article class="growth-v2-card">
                <div class="growth-v2-icon is-yellow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M8 8h8"></path>
                    <path d="M8 12h8"></path>
                    <path d="M8 16h6"></path>
                    <path d="M6 4.5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"></path>
                  </svg>
                </div>
                <div class="growth-v2-card-label">Ticket médio</div>
                <div class="growth-v2-card-value" data-growth-indicator="ticket">R$ 1.379</div>
                <div class="growth-v2-card-sub">Plano médio: Gold</div>
              </article>

	              <article class="growth-v2-card">
	                <div class="growth-v2-icon is-yellow" aria-hidden="true">
	                  <svg viewBox="0 0 24 24" fill="none">
	                    <path d="M4.5 18.5V6.5"></path>
	                    <path d="M4.5 6.5h15"></path>
	                    <path d="M7.5 16 11 12.5l3 3 4-4"></path>
	                  </svg>
	                </div>
	                <div class="growth-v2-card-label">Forecast</div>
	                <div class="growth-v2-card-value" data-growth-indicator="forecast">—</div>
	                <div class="growth-v2-card-sub is-yellow">Projeção de fechamento</div>
	              </article>
	            </div>

	            <div class="growth-v2-grid growth-v2-grid-3" aria-label="Qualidade e conversão">
	              <article class="growth-v2-card">
	                <div class="growth-v2-icon is-coral" aria-hidden="true">
	                  <svg viewBox="0 0 24 24" fill="none">
	                    <path d="M12 8v4"></path>
	                    <path d="M12 16h.01"></path>
	                    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
	                  </svg>
	                </div>
	                <div class="growth-v2-card-label">% No Show</div>
	                <div class="growth-v2-card-value" data-growth-rate="noshow">6%</div>
	              </article>

	              <article class="growth-v2-card">
	                <div class="growth-v2-icon is-green" aria-hidden="true">
	                  <svg viewBox="0 0 24 24" fill="none">
	                    <path d="M6 12.5 10 16.5 18 8.5"></path>
	                    <path d="M12 21a9 9 0 1 0-9-9"></path>
	                  </svg>
	                </div>
	                <div class="growth-v2-card-label">% Agendamento</div>
	                <div class="growth-v2-card-value" data-growth-rate="agendamento">78%</div>
	              </article>

	              <article class="growth-v2-card">
	                <div class="growth-v2-icon is-blue" aria-hidden="true">
	                  <svg viewBox="0 0 24 24" fill="none">
	                    <path d="M5 4h14l-5 8v6l-4 2v-8L5 4Z"></path>
	                  </svg>
	                </div>
	                <div class="growth-v2-card-label">% Funil</div>
	                <div class="growth-v2-card-value" data-growth-rate="funil">42%</div>
	              </article>
	            </div>
	          </section>

          <section class="growth-v2-section" aria-label="Ranking e execução">
            <div class="growth-v2-two-col">
              <article class="growth-v2-card growth-v2-card-ranking" aria-label="Ranking do time">
                <div class="growth-v2-card-head">
                  <div class="growth-v2-card-title">Ranking do time</div>
                  <div class="growth-v2-pill is-coral">Mês atual</div>
                </div>

                <div class="growth-v2-table-head" aria-hidden="true">
                  <span>#</span>
                  <span>VENDEDOR</span>
                  <span>VENDAS</span>
                  <span>VALOR</span>
                </div>

                <div class="growth-v2-rank-list" data-growth-ranking>
                  <div class="growth-v2-rank-row is-top">
                    <div class="growth-v2-rank-pos">1</div>
                    <div class="growth-v2-rank-vendor">
                      <span class="growth-v2-rank-avatar is-coral" aria-hidden="true">GD</span>
                      <span class="growth-v2-rank-name">Guilherme</span>
                    </div>
                    <div class="growth-v2-rank-sales">14</div>
                    <div class="growth-v2-rank-value">R$ 19.800</div>
                    <div class="growth-v2-rank-bar" aria-hidden="true"><span style="width: 100%"></span></div>
                  </div>

                  <div class="growth-v2-rank-row">
                    <div class="growth-v2-rank-pos">2</div>
                    <div class="growth-v2-rank-vendor">
                      <span class="growth-v2-rank-avatar is-blue" aria-hidden="true">MT</span>
                      <span class="growth-v2-rank-name">Matheus</span>
                    </div>
                    <div class="growth-v2-rank-sales">10</div>
                    <div class="growth-v2-rank-value">R$ 14.300</div>
                    <div class="growth-v2-rank-bar" aria-hidden="true"><span class="is-blue" style="width: 72%"></span></div>
                  </div>

                  <div class="growth-v2-rank-row">
                    <div class="growth-v2-rank-pos">3</div>
                    <div class="growth-v2-rank-vendor">
                      <span class="growth-v2-rank-avatar is-green" aria-hidden="true">AN</span>
                      <span class="growth-v2-rank-name">Ana</span>
                    </div>
                    <div class="growth-v2-rank-sales">8</div>
                    <div class="growth-v2-rank-value">R$ 10.900</div>
                    <div class="growth-v2-rank-bar" aria-hidden="true"><span class="is-green" style="width: 55%"></span></div>
                  </div>

                  <div class="growth-v2-rank-row">
                    <div class="growth-v2-rank-pos">4</div>
                    <div class="growth-v2-rank-vendor">
                      <span class="growth-v2-rank-avatar is-yellow" aria-hidden="true">GI</span>
                      <span class="growth-v2-rank-name">Giovana</span>
                    </div>
                    <div class="growth-v2-rank-sales">6</div>
                    <div class="growth-v2-rank-value">R$ 7.400</div>
                    <div class="growth-v2-rank-bar" aria-hidden="true"><span class="is-yellow" style="width: 37%"></span></div>
                  </div>
                </div>
              </article>

	              <div class="growth-v2-stack">
	                <article class="growth-v2-card" aria-label="Execução do dia">
	                  <div class="growth-v2-card-head">
	                    <div class="growth-v2-card-title">Execução do dia</div>
	                  </div>
	
	                  <div class="growth-v2-last-sale">
	                    <div class="growth-v2-mini-label">ÚLTIMA VENDA</div>
	                    <div class="growth-v2-last-value" data-growth-last-time>—</div>
	                    <div class="growth-v2-last-sub" data-growth-last-sub>—</div>
	                  </div>
	                </article>
	
	                <article class="growth-v2-card" aria-label="Ritmo necessário">
	                  <div class="growth-v2-card-head">
	                    <div class="growth-v2-card-title">Ritmo necessário</div>
	                  </div>
	
	                  <div class="growth-v2-pace-grid">
	                    <div class="growth-v2-mini-card" data-growth-pace-card="dias">
	                      <div class="growth-v2-mini-label">DIAS ÚTEIS RESTANTES</div>
	                      <div class="growth-v2-mini-value" data-growth-pace="dias">—</div>
	                    </div>
	                    <div class="growth-v2-mini-card" data-growth-pace-card="receita">
	                      <div class="growth-v2-mini-label">RECEITA NECESSÁRIA/DIA</div>
	                      <div class="growth-v2-mini-value" data-growth-pace="receitaDia">—</div>
	                    </div>
	                    <div class="growth-v2-mini-card" data-growth-pace-card="agendamentos">
	                      <div class="growth-v2-mini-label">AGENDAMENTOS/DIA</div>
	                      <div class="growth-v2-mini-value" data-growth-pace="agendamentosDia">—</div>
	                    </div>
	                    <div class="growth-v2-mini-card" data-growth-pace-card="prospeccoes">
	                      <div class="growth-v2-mini-label">PROSPECÇÕES/DIA</div>
	                      <div class="growth-v2-mini-value" data-growth-pace="prospeccoesDia">—</div>
	                    </div>
	                  </div>
	                </article>
	              </div>
            </div>
          </section>
        </div>
      `;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle}</title>
    <meta name="robots" content="noindex, nofollow" />
    <base href="/" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body data-view="interno" data-page="growth" data-sidebar-expanded="false">
    <div class="page-glow page-glow-left" aria-hidden="true"></div>
    <div class="page-glow page-glow-right" aria-hidden="true"></div>
    <script>
      window.__SPACE_SESSION__ = ${sessionJson};
    </script>

    <div class="platform-shell" data-view="interno">
      <div class="platform-backdrop" aria-hidden="true"></div>
      <aside class="platform-sidebar" aria-label="Navegação">
        <div class="sidebar-topbar">
          <button
            class="sidebar-toggle"
            type="button"
            data-sidebar-toggle
            aria-expanded="false"
            aria-label="Abrir barra lateral"
          >
            <span class="sidebar-toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="m14.5 5.5-6 6 6 6"></path>
              </svg>
            </span>
          </button>
        </div>

        <div class="sidebar-brand">
          <img src="/assets/space-symbol.png" alt="Símbolo da Space" />
          <div class="sidebar-brand-copy">
            <strong>Space</strong>
            <span>Growth Console</span>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Seções Growth">
          <a class="${navDashboardClass}" href="/growth/dashboard" title="Dashboard">
            <span class="sidebar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"></rect>
                <rect x="13.5" y="3.5" width="7" height="7" rx="1.5"></rect>
                <rect x="3.5" y="13.5" width="7" height="7" rx="1.5"></rect>
                <rect x="13.5" y="13.5" width="7" height="7" rx="1.5"></rect>
              </svg>
            </span>
            <span class="sidebar-text">Dashboard</span>
          </a>

          <a class="${navContractsClass}" href="/growth/contratos" title="Contratos">
            <span class="sidebar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M8 7h8"></path>
                <path d="M8 11h8"></path>
                <path d="M8 15h6"></path>
                <path d="M7 3.5h7l3 3V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z"></path>
              </svg>
            </span>
            <span class="sidebar-text">Contratos</span>
          </a>

          <button class="sidebar-link" type="button" data-growth-logout title="Sair">
            <span class="sidebar-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M10 7.5H6.8c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2H10"></path>
                <path d="M15 16.5 19 12l-4-4.5"></path>
                <path d="M19 12H10"></path>
              </svg>
            </span>
            <span class="sidebar-text">Sair</span>
          </button>
        </nav>
      </aside>

      <main class="platform-main" aria-label="Painel Growth">
        ${mainHtml}
      </main>
    </div>

    <div class="modal-overlay" hidden data-contract-create-overlay>
      <div class="modal-dialog growth-contract-modal">
        <div class="modal-header">
          <h3 class="modal-title">Novo contrato</h3>
          <button class="modal-close" type="button" data-contract-create-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12"></path>
              <path d="M18 6 6 18"></path>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <form class="modal-form" data-contract-create-form>
            <label class="modal-field">
              <span>NOME COMPLETO</span>
              <input class="modal-input" type="text" placeholder="Nome completo do aluno" data-contract-field="nomeCompleto" />
              <div class="modal-inline-error" data-contract-error="nomeCompleto" hidden>Informe o nome completo.</div>
            </label>

            <label class="modal-field">
              <span>E-MAIL</span>
              <input class="modal-input" type="email" placeholder="seu@email.com" autocomplete="email" data-contract-field="email" />
              <div class="modal-inline-error" data-contract-error="email" hidden>E-mail inválido.</div>
            </label>

            <label class="modal-field">
              <span>WHATSAPP</span>
              <div class="growth-contract-phone">
                <select class="modal-input growth-contract-country" data-contract-field="telefoneCountry" aria-label="Codigo do pais">
                  <option value="55">+55 Brasil</option>
                  <option value="1">+1 EUA/Canada</option>
                  <option value="351">+351 Portugal</option>
                  <option value="44">+44 Reino Unido</option>
                  <option value="34">+34 Espanha</option>
                  <option value="49">+49 Alemanha</option>
                  <option value="33">+33 Franca</option>
                  <option value="39">+39 Italia</option>
                  <option value="54">+54 Argentina</option>
                  <option value="56">+56 Chile</option>
                  <option value="57">+57 Colombia</option>
                  <option value="52">+52 Mexico</option>
                </select>
                <input
                  class="modal-input"
                  type="tel"
                  inputmode="numeric"
                  placeholder="Numero de WhatsApp"
                  autocomplete="tel"
                  data-contract-field="whatsapp"
                />
              </div>
              <div class="modal-inline-error" data-contract-error="whatsapp" hidden>Informe um WhatsApp válido.</div>
            </label>

            <label class="modal-field">
              <span>CONTRATO</span>
              <select class="modal-input" data-contract-field="contrato" aria-label="Contrato">
                <option value="">Selecione</option>
                <option value="diamond">Diamond</option>
                <option value="gold">Gold</option>
                <option value="turma">Turma</option>
              </select>
              <div class="modal-inline-error" data-contract-error="contrato" hidden>Selecione um contrato.</div>
            </label>

            <label class="modal-field">
              <span>CPF</span>
              <input class="modal-input" type="text" inputmode="numeric" placeholder="000.000.000-00" data-contract-field="cpf" />
              <div class="modal-inline-error" data-contract-error="cpf" hidden>CPF inválido</div>
            </label>

            <label class="modal-field">
              <span>ENDEREÇO</span>
              <input class="modal-input" type="text" placeholder="Endereço completo" data-contract-field="endereco" />
              <div class="modal-inline-error" data-contract-error="endereco" hidden>Informe o endereço.</div>
            </label>

            <div class="growth-contract-money-row">
              <label class="modal-field">
                <span>VALOR ORIGINAL</span>
                <div class="growth-contract-money">
                  <span>R$</span>
                  <input
                    class="modal-input"
                    type="text"
                    inputmode="decimal"
                    placeholder="0,00"
                    autocomplete="off"
                    data-contract-field="valorOriginal"
                  />
                </div>
                <div class="modal-inline-error" data-contract-error="valorOriginal" hidden>Informe o valor original.</div>
              </label>

              <label class="modal-field">
                <span>VALOR COM DESCONTO</span>
                <div class="growth-contract-money">
                  <span>R$</span>
                  <input
                    class="modal-input"
                    type="text"
                    inputmode="decimal"
                    placeholder="0,00"
                    autocomplete="off"
                    data-contract-field="valorDesconto"
                  />
                </div>
                <div class="modal-inline-error" data-contract-error="valorDesconto" hidden>O desconto não pode ser maior que o valor original.</div>
              </label>
            </div>

            <label class="modal-field">
              <span>DATA</span>
              <input class="modal-input" type="date" data-contract-field="data" />
            </label>
          </form>

          <div class="growth-contract-feedback" data-contract-create-feedback hidden></div>
        </div>

        <div class="modal-actions">
          <button class="growth-contract-btn is-outline" type="button" data-contract-create-cancel>Cancelar</button>
          <button class="growth-contract-btn is-blue" type="button" data-contract-create-draft>Salvar como rascunho</button>
          <button class="growth-contract-btn is-coral" type="button" data-contract-create-send>Salvar e enviar para assinatura</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" hidden data-contract-details-overlay>
      <div class="modal-dialog growth-contract-modal">
        <div class="modal-header">
          <h3 class="modal-title">Detalhes do contrato</h3>
          <button class="modal-close" type="button" data-contract-details-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12"></path>
              <path d="M18 6 6 18"></path>
            </svg>
          </button>
        </div>

        <div class="modal-body" data-contract-details-body></div>

        <div class="modal-actions">
          <button class="growth-contract-btn is-outline" type="button" data-contract-details-ok>Fechar</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" hidden data-contract-confirm-overlay>
      <div class="modal-dialog growth-contract-modal">
        <div class="modal-header">
          <h3 class="modal-title">Confirmar</h3>
          <button class="modal-close" type="button" data-contract-confirm-close aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12"></path>
              <path d="M18 6 6 18"></path>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="growth-contract-confirm-text" data-contract-confirm-text></div>
        </div>

        <div class="modal-actions">
          <button class="growth-contract-btn is-outline" type="button" data-contract-confirm-cancel>Cancelar</button>
          <button class="growth-contract-btn is-coral" type="button" data-contract-confirm-ok>Excluir</button>
        </div>
      </div>
    </div>

    <script src="/growth.js" defer></script>
  </body>
</html>`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
};
