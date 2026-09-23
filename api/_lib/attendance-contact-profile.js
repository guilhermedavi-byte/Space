const { getDocumentAsAdmin } = require('./firestore-admin');
const clean = value => typeof value === 'string' ? value.trim() : '';
const safePhoto = value => {
  try { const url = new URL(clean(value)); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
};
const photo = row => safePhoto(row?.photoURL || row?.photoUrl || row?.avatar_url || row?.avatarUrl);
// Resolve only explicit Attendance links, after the conversation's access check.
// Never search the master register by phone or expose entire source documents.
async function contactProfile(payload, read = getDocumentAsAdmin) {
  const contact = payload.contact || {};
  const links = (payload.participants || []).filter(p => p.resolution_state === 'linked' && p.internal_person_id);
  const records = await Promise.all(links.map(async link => {
    const source = clean(link.internal_source);
    const type = clean(link.internal_person_type);
    const collection = type === 'student' && ['firestore', 'users'].includes(source) ? 'users'
      : type === 'lead' && ['firestore', 'crm', 'crmContacts'].includes(source) ? 'crmContacts' : '';
    const id = clean(link.internal_person_id);
    if (!collection || !id || /[/\\]/.test(id)) return null;
    try {
      const row = await read(`${collection}/${encodeURIComponent(id)}`);
      const scope = clean(row.scopeId);
      if (collection === 'crmContacts' && scope && scope !== (process.env.SPACE_CRM_SCOPE_ID || process.env.CRM_SCOPE_ID || 'space-main')) return null;
      return { type, row };
    } catch { return null; }
  }));
  const student = records.find(r => r?.type === 'student')?.row;
  const lead = records.find(r => r?.type === 'lead')?.row;
  const master = student || lead;
  return {
    ...contact,
    name: clean(master?.name || master?.displayName) || contact.name,
    email: clean(student?.email) || clean(lead?.email) || clean(contact.email),
    avatar_url: photo(student) || photo(lead) || photo(contact),
    relationship: links.some(p => p.internal_person_type === 'student') ? 'Aluno'
      : links.some(p => p.internal_person_type === 'lead') ? 'Lead' : 'Contato ainda não vinculado',
    profile_unavailable: links.length > 0 && !master,
  };
}
module.exports = { contactProfile, safePhoto };
