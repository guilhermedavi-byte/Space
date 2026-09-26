const { listCollectionAsAdmin } = require('./firestore-admin');
const { normalizeCommercialRoles, normalizePlatformRole } = require('./commercial-permissions');
const { profileName } = require('./space-phone-sdr-names');
const { isUserActive } = require('../../_lib/user-status');

const clean = value => String(value == null ? '' : value).trim();

const userUid = row => clean(row?.uid || row?.space_user_uid || row?.id || row?.firestoreDocId || row?.sub);

const roleFields = row => [row?.role, row?.tipo, row?.type, row?.perfil, row?.profile, row?.cargo, row?.platformRole, row?.appRole, row?.accessRole];

const hasAdminMarker = row => {
  if (!row || typeof row !== 'object') return false;
  if (roleFields(row).some(value => normalizePlatformRole(value) === 'admin')) return true;
  if (row.isSuperAdmin === true || row.isAdmin === true || row.admin === true) return true;
  if (Array.isArray(row.adminPermissions) && row.adminPermissions.length > 0) return true;
  if (Number(row.adminPermissionsVersion || 0) > 0) return true;
  return false;
};

const isOperationalSdrUser = row => {
  if (!row || typeof row !== 'object') return false;
  if (hasAdminMarker(row)) return false;
  const role = normalizePlatformRole(row.role || row.tipo || row.type);
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

module.exports = { hasAdminMarker, isOperationalSdrUser, resolveOperationalSdrs, userUid };
