const { getFirebaseServerConfig } = require("../../_lib/runtime-env");
const { getGoogleAccessToken } = require("../../_lib/google-service-account");
const { PROJECT_ID, requestJson } = require("./firestore-rest");

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

const createAuthUserWithPassword = async ({ email, password, displayName }) => {
  const { apiKey } = getFirebaseServerConfig();
  if (!apiKey) {
    const error = new Error("missing_firebase_api_key");
    error.code = "missing_firebase_api_key";
    throw error;
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`;
  const response = await requestJson(url, {
    method: "POST",
    body: {
      email,
      password,
      displayName,
      returnSecureToken: true,
    },
  });
  if (!response.ok) {
    const rawMessage = String(response.data?.error?.message || response.text || "auth_create_failed");
    const error = new Error(rawMessage);
    error.code = rawMessage;
    error.status = response.status;
    error.details = response.data || response.text || null;
    throw error;
  }
  const uid = String(response.data?.localId || "").trim();
  if (!uid) {
    const error = new Error("missing_auth_uid");
    error.code = "missing_auth_uid";
    throw error;
  }
  return { uid };
};

const deleteAuthUserBestEffort = async (uid, { logPrefix = "[firebase-auth-admin]" } = {}) => {
  const localId = String(uid || "").trim();
  if (!localId) return;
  try {
    if (!PROJECT_ID) return;
    const token = await getGoogleAccessToken({ scope: CLOUD_PLATFORM_SCOPE });
    const accessToken = String(token?.accessToken || "");
    if (!accessToken) return;
    await requestJson(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/accounts:delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: { localId },
    });
  } catch (error) {
    console.warn(`${logPrefix} auth rollback failed`, { uid: localId, message: error?.message || String(error || "") });
  }
};

module.exports = {
  createAuthUserWithPassword,
  deleteAuthUserBestEffort,
};
