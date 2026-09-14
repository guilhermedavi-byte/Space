const { getGoogleAccessToken } = require('../../_lib/google-service-account');
const { getFirestoreRuntime, encodeFields, decodeFields } = require('../../_lib/firestore-rest');
const { failure } = require('./datacrazy-ingestion');
// Firestore commit is atomic; updateTime preconditions fence expired workers.
const createFirestoreStore = () => {
  const call = async (suffix, options = {}) => {
    const { baseUrl } = getFirestoreRuntime();
    const { accessToken } = await getGoogleAccessToken({ scope: 'https://www.googleapis.com/auth/datastore' });
    const res = await fetch(baseUrl + suffix, { ...options, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => null);
    if (!res.ok && res.status !== 404) throw failure('snapshot_store_error', { status: ['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'ABORTED'].includes(body?.error?.status) ? 409 : res.status });
    return { res, body };
  };
  return {
    async read(path) {
      const { res, body } = await call('/' + path);
      return res.status === 404 ? null : { data: decodeFields(body), version: body.updateTime };
    },
    async commit(entries) {
      const { baseUrl } = getFirestoreRuntime();
      const name = baseUrl.replace('https://firestore.googleapis.com/v1/', '');
      const writes = entries.map(({ path, data, version }) => ({
        update: { name: `${name}/${path}`, fields: encodeFields(data).fields },
        ...(version === undefined ? {} : { currentDocument: version === null ? { exists: false } : { updateTime: version } }),
      }));
      const { res, body } = await call(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
      if (!res.ok) throw failure('snapshot_store_error', { status: ['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'ABORTED'].includes(body?.error?.status) ? 409 : res.status });
      return body.writeResults.map(row => row.updateTime);
    },
  };
};
module.exports = { createFirestoreStore };
