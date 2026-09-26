const { listCollectionAsAdmin } = require('./firestore-admin');
const { normalizeCommercialRoles, normalizePlatformRole } = require('./commercial-permissions');
const { profileName } = require('./space-phone-sdr-names');
const { isUserActive } = require('../../_lib/user-status');

const clean = value => String(value == null ? '' : value).trim();

const userUid = row => clean(row?.uid || row?.space_user_uid || row?.id || row?.firestoreDocId || row?.sub);

const isOperationalSdrUser = row => {
  if (!row || typeof row !== 'object') return false;
  const role = normalizePlatformRole(row.role || row.tipo || row.type);
  if (role === 'admin') return false;
  if (role !== 'growth') return false;
  if (!isUserActive(row)) return false;
  return normalizeCommercialRoles(row.commercialRoles).includes('sdr');
};

const resolveOperationalSdrs = async ({ listUsers = listCollectionAsAdmin } = {}) => {
  const users = await listUsers('users', { pageSize: 1000, maxPages: 20, decorate: false });
  const seen = new Set();
  return users
    .filter(isOperationalSdrUser)
    .map(row => ({ uid: userUid(row), displayName: profileName(row) || clean(row.email) || 'SDR sem nome cadastrado' }))
    .filter(row => row.uid && !seen.has(row.uid) && seen.add(row.uid))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
};

module.exports = { isOperationalSdrUser, resolveOperationalSdrs, userUid };
