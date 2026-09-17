const { getDocumentAsAdmin, commitWritesAsAdmin } = require('./firestore-admin');
const { PROJECT_ID, encodeFields } = require('../../_lib/firestore-rest');
const { uuid } = require('./finance-domain');

const COLLECTION = 'financeDashboardSnapshots';
const key = (connectionId, month) => encodeURIComponent(`${uuid(connectionId)}__${String(month || '').slice(0, 7)}`);
const docPath = (connectionId, month) => `${COLLECTION}/${key(connectionId, month)}`;
const docName = (connectionId, month, projectId = PROJECT_ID) => {
  if (!projectId) {
    const error = new Error('missing_firestore_project_id');
    error.code = error.message;
    throw error;
  }
  return `projects/${projectId}/databases/(default)/documents/${docPath(connectionId, month)}`;
};

const readOverviewSnapshot = async (connectionId, month, firestore = { getDocumentAsAdmin }) => {
  try {
    const row = await firestore.getDocumentAsAdmin(docPath(connectionId, month));
    return row && typeof row === 'object' ? row : null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

const writeOverviewSnapshot = async (connectionId, month, payload, firestore = { commitWritesAsAdmin }, projectId = PROJECT_ID) => {
  const snapshot_at = new Date().toISOString();
  const data = {
    id: key(connectionId, month),
    connection_id: uuid(connectionId),
    month: String(month || '').slice(0, 7),
    kind: 'finance_v1_overview',
    snapshot_at,
    payload,
  };
  const result = await firestore.commitWritesAsAdmin({
    writes: [{
      update: { name: docName(connectionId, month, projectId), fields: encodeFields(data).fields },
      updateMask: { fieldPaths: Object.keys(data) },
    }],
  });
  if (!result?.ok) {
    const error = new Error('finance_dashboard_snapshot_write_failed');
    error.status = result?.status;
    throw error;
  }
  return data;
};

module.exports = { readOverviewSnapshot, writeOverviewSnapshot };
