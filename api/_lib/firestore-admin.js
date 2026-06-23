const { getGoogleAccessToken } = require("../../_lib/google-service-account");
const {
  FIRESTORE_BASE,
  decodeFields,
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
    params.set("pageSize", String(Math.max(1, Math.min(Number(pageSize) || 1000, 2000))));
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
      all.push({
        id: getDocIdFromName(doc.name),
        ...decodeFields(doc),
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
    body: require("./firestore-rest").encodeFields(data),
  });
  if (!response.ok) {
    const error = new Error("firestore_admin_create_failed");
    error.status = response.status;
    throw error;
  }
  return {
    id: getDocIdFromName(response.data?.name),
    ...decodeFields(response.data),
  };
};

module.exports = { createDocumentAsAdmin, listCollectionAsAdmin };
