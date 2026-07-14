const { getGoogleAccessToken } = require("../../_lib/google-service-account");
const {
  FIRESTORE_BASE,
  decodeFields,
  encodeFields,
  getDocIdFromName,
  requestJson,
} = require("./firestore-rest");

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

const getAccessToken = async () => {
  const result = await getGoogleAccessToken({ scope: DATASTORE_SCOPE });
  return String(result?.accessToken || "");
};

const listCollectionAsAdmin = async (collectionPath, { pageSize = 1000 } = {}) => {
  const path = String(collectionPath || "").replace(/^\/+/, "");
  if (!path) throw new Error("missing_collection");
  const accessToken = await getAccessToken();
  const all = [];
  let pageToken = "";

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams();
    params.set("pageSize", String(Math.max(1, Math.min(Number(pageSize) || 1000, 1000))));
    if (pageToken) params.set("pageToken", pageToken);
    const response = await requestJson(`${FIRESTORE_BASE}/${encodeURI(path)}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const error = new Error("firestore_admin_list_failed");
      error.status = response.status;
      throw error;
    }
    const docs = Array.isArray(response.data?.documents) ? response.data.documents : [];
    docs.forEach((doc) => {
      const firestoreDocId = getDocIdFromName(doc.name);
      const fields = decodeFields(doc);
      all.push({
        ...fields,
        id: typeof fields?.id === "string" && fields.id.trim() ? fields.id : firestoreDocId,
        firestoreDocId,
      });
    });
    pageToken = String(response.data?.nextPageToken || "");
    if (!pageToken) break;
  }
  return all;
};

const createDocumentAsAdmin = async (collectionPath, data) => {
  const path = String(collectionPath || "").replace(/^\/+/, "");
  if (!path) throw new Error("missing_collection");
  const accessToken = await getAccessToken();
  const response = await requestJson(`${FIRESTORE_BASE}/${encodeURI(path)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: encodeFields(data),
  });
  if (!response.ok) {
    const error = new Error("firestore_admin_create_failed");
    error.status = response.status;
    throw error;
  }
  return {
    ...decodeFields(response.data),
    id:
      typeof decodeFields(response.data)?.id === "string" && decodeFields(response.data).id.trim()
        ? decodeFields(response.data).id
        : getDocIdFromName(response.data?.name),
    firestoreDocId: getDocIdFromName(response.data?.name),
  };
};

const commitWritesAsAdmin = async ({ writes } = {}) => {
  const arr = Array.isArray(writes) ? writes.filter(Boolean) : [];
  if (!arr.length) return { ok: true, status: 200, data: { writeResults: [] }, text: "" };
  const accessToken = await getAccessToken();
  return requestJson(`${FIRESTORE_BASE}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { writes: arr },
  });
};

module.exports = { commitWritesAsAdmin, createDocumentAsAdmin, listCollectionAsAdmin };
