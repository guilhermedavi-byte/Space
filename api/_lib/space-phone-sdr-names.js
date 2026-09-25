const { getGoogleAccessToken } = require('../../_lib/google-service-account');
const { PROJECT_ID, FIRESTORE_BASE, decodeFields } = require('./firestore-rest');
const cache = new Map();
const clean = value => String(value || '').trim();
const profileName = profile => clean(profile?.nome || profile?.nomeCompleto || profile?.name || profile?.displayName);

const readProfiles = async uids => {
  const { accessToken } = await getGoogleAccessToken({ scope: 'https://www.googleapis.com/auth/datastore' });
  const response = await fetch(`${FIRESTORE_BASE}:batchGet`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(4000),
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents: uids.map(uid => `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`), mask: { fieldPaths: ['nome', 'nomeCompleto', 'name', 'displayName'] } }),
  });
  if (!response.ok) throw new Error('sdr_names_unavailable');
  const results = await response.json();
  return new Map(results.filter(item => item.found).map(item => [item.found.name.split('/').pop(), profileName(decodeFields(item.found))]));
};

const resolveSdrNames = async (rows, user = {}, { batchRead = readProfiles, now = Date.now() } = {}) => {
  const uids = [...new Set(rows.map(row => clean(row.space_user_uid)).filter(uid => uid && !uid.includes('/')))];
  const names = new Map();
  const missing = [];
  for (const uid of uids) {
    const item = cache.get(uid);
    if (item && item.expires > now) names.set(uid, item.name);
    else missing.push(uid);
  }
  if (missing.length) {
    try {
      const profiles = await batchRead(missing);
      if (cache.size > 2000) cache.clear();
      for (const uid of missing) {
        const name = clean(profiles.get(uid));
        names.set(uid, name); cache.set(uid, { name, expires: now + 60000 });
      }
    } catch { /* Names are optional; call history must remain available. */ }
  }
  for (const uid of uids) if (!names.get(uid) && uid === clean(user.sub)) names.set(uid, profileName(user));
  return names;
};
module.exports = { resolveSdrNames, profileName };
