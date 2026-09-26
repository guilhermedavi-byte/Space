const crmService = require('./crm-service');
const { getDocumentAsAdmin, listCollectionAsAdmin } = require('./firestore-admin');
const { normalizeCrmContactIdentity } = require('./crm-identity');
const commercialPermissions = require('./commercial-permissions');

const clean = (value) => String(value || '').trim();
const lower = (value) => clean(value).toLowerCase();
const roleOf = (row = {}) => lower(row.tipo || row.role || row.type);
const isStudent = (row = {}) => ['student', 'aluno'].includes(roleOf(row));
const isResponsible = (row = {}) => ['responsavel', 'responsible', 'parent', 'guardian'].includes(roleOf(row)) || row.isResponsible === true;

const loadCrmSnapshot = async ({ read = listCollectionAsAdmin, user = {} } = {}) => {
  const workspaceTypes = commercialPermissions.visiblePipelineTypesForUser(user);
  if (!workspaceTypes.length) return { contacts: [], opportunities: [], pipelines: [], stages: [] };
  const [contactsRaw, opportunitiesRaw, pipelinesRaw, stagesRaw, usersRaw] = await Promise.all([
    read(crmService.COLLECTIONS.contacts, { maxPages: 50 }).catch(() => []),
    read(crmService.COLLECTIONS.opportunities, { maxPages: 50 }).catch(() => []),
    read(crmService.COLLECTIONS.pipelines, { maxPages: 10 }).catch(() => []),
    read(crmService.COLLECTIONS.stages, { maxPages: 20 }).catch(() => []),
    read(crmService.COLLECTIONS.users, { maxPages: 20, decorate: false }).catch(() => []),
  ]);
  const scope = crmService.CRM_SCOPE_ID;
  const scoped = (row) => clean(row?.scopeId) === scope || !clean(row?.scopeId);
  const pipelines = pipelinesRaw.map(crmService.normalizePipeline).filter((row) => row.id && scoped(row) && workspaceTypes.includes(row.pipelineType));
  const pipelineIds = new Set(pipelines.map((row) => row.id));
  const stages = stagesRaw.map(crmService.normalizeStage).filter((row) => row.id && scoped(row) && pipelineIds.has(row.pipelineId));
  const contacts = contactsRaw.map(crmService.normalizeContact).filter((row) => row.id && scoped(row));
  const contactsById = new Map(contacts.map((row) => [row.id, row]));
  const ownersById = new Map(usersRaw.map((row) => {
    const id = clean(row.uid || row.id || row.firestoreDocId);
    return [id, { id, name: clean(row.nome || row.name || row.displayName || row.email || id), email: clean(row.email) }];
  }).filter(([id]) => id));
  const opportunities = opportunitiesRaw
    .map(crmService.normalizeOpportunity)
    .filter((row) => row.id && scoped(row) && row.status === 'open' && !row.deletedAt && pipelineIds.has(row.pipelineId))
    .map((row) => ({ ...row, contact: contactsById.get(row.contactId) || null, owner: row.ownerId ? ownersById.get(row.ownerId) || null : null }));
  return { contacts, opportunities, pipelines, stages };
};

const phoneVariants = value => {
  const canonical = normalizeCrmContactIdentity({ phone: value }).phone;
  return canonical ? [canonical] : [];
};
const matchesPhone = (row, variants) => [row.phone, row.telefone, row.whatsapp, row.celular, row.mobile, row.searchPhone]
  .some(value => { const canonical = normalizeCrmContactIdentity({ phone: value }).phone; return !!canonical && variants.includes(canonical); });

const publicPerson = (row = {}, source = 'firestore') => {
  const id = clean(row.firestoreDocId || row.id || row.uid);
  return {
    id,
    source,
    type: isStudent(row) ? 'student' : isResponsible(row) ? 'responsible' : roleOf(row) || 'person',
    name: clean(row.nome || row.name || row.displayName || row.email || id),
    phone: clean(row.whatsapp || row.phone || row.telefone || row.celular),
    email: clean(row.email),
    relation: isStudent(row) ? 'Aluno' : isResponsible(row) ? 'Responsavel' : clean(row.tipo || row.role || row.type || 'Pessoa'),
  };
};

const studentPanel = (row = {}) => {
  if (!row || !isStudent(row)) return null;
  const lifecycle = row.lifecycle || row.lifecycleSubscriptions?.[0] || {};
  return {
    student_id: clean(row.firestoreDocId || row.id || row.uid),
    status: row.ativo === false ? 'inativo' : clean(lifecycle.lifecycle_status || row.status || 'ativo'),
    teacher: clean(row.professorNome || row.teacherName || row.professor || row.teacher),
    product: clean(row.plano || row.planName || row.product || lifecycle.plan_name),
    lifecycle: clean(lifecycle.lifecycle_status || row.lifecycle_status || row.lifecycleStatus),
    started_at: clean(lifecycle.started_at || row.createdAt || row.criadoEm),
    last_active_date: clean(lifecycle.last_active_date || row.lifecycleLastActiveDay),
  };
};

const buildCrmPanel = (model, person, phone) => {
  const variants = phoneVariants(phone || person?.phone);
  const email = lower(person?.email);
  const contacts = model.contacts.filter((contact) =>
    (person?.id && contact.id === person.id) ||
    (email && lower(contact.email) === email) ||
    matchesPhone(contact, variants)
  );
  const contactIds = new Set(contacts.map((row) => row.id));
  const opportunities = model.opportunities
    .filter((opp) => opp.status === 'open' && (contactIds.has(opp.contactId) || matchesPhone(opp.contact || {}, variants) || (email && lower(opp.contact?.email) === email)))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const opp = opportunities[0] || null;
  if (!opp) return contacts[0] ? { contact: contacts[0], has_open_opportunity: false } : null;
  const pipeline = model.pipelines.find((row) => row.id === opp.pipelineId) || null;
  const stage = model.stages.find((row) => row.id === opp.stageId) || null;
  return {
    contact: opp.contact || contacts[0] || null,
    opportunity: {
      id: opp.id,
      title: opp.title,
      pipeline: pipeline?.name || opp.pipelineId,
      stage: stage?.name || opp.stageId,
      owner: opp.owner?.name || opp.ownerId || '',
      value: opp.value,
      currency: opp.currency || 'BRL',
      last_activity_at: opp.updatedAt || opp.createdAt || '',
      next_activity: opp.nextActivityId ? {
        id: opp.nextActivityId,
        title: opp.nextActivityTitle || opp.nextActivityType || 'Proxima atividade',
        type: opp.nextActivityType || '',
        due_at: opp.nextActivityAt || '',
      } : null,
    },
    has_open_opportunity: true,
  };
};

const resolveAttendanceContext = async ({ detail = {}, actor = {}, userLoader = listCollectionAsAdmin, crmLoader = loadCrmSnapshot, getUser = getDocumentAsAdmin } = {}) => {
  const contactPhone = clean(detail?.contact?.phone);
  const participants = Array.isArray(detail?.participants) ? detail.participants : [];
  const linked = participants.find((p) => clean(p.internal_person_id));
  const variants = phoneVariants(contactPhone);
  const [usersRaw, actorUser] = await Promise.all([
    userLoader('users', { pageSize: 1500 }).catch(() => []),
    actor?.uid ? getUser(`users/${encodeURIComponent(actor.uid)}`).catch(() => null) : null,
  ]);
  const candidates = usersRaw
    .filter((row) => matchesPhone(row, variants))
    .map((row) => publicPerson(row))
    .filter((row) => row.id);
  const uniqueCandidates = Array.from(new Map(candidates.map((row) => [row.id, row])).values());
  const linkedPerson = linked ? uniqueCandidates.find((row) => row.id === linked.internal_person_id) || publicPerson({ id: linked.internal_person_id, tipo: linked.internal_person_type }) : null;
  const inferredPerson = linkedPerson || (uniqueCandidates.length === 1 ? uniqueCandidates[0] : null);
  const matchedUser = inferredPerson ? usersRaw.find((row) => clean(row.firestoreDocId || row.id || row.uid) === inferredPerson.id) : null;
  const crmUser = actorUser ? { role: actor.role, commercialRoles: actorUser.commercialRoles || [] } : { role: actor.role, commercialRoles: [] };
  const canReadCrm = actor.role === 'admin' || commercialPermissions.getCommercialPermissions(crmUser).hasCommercialAccess;
  const crmModel = canReadCrm ? await crmLoader({ user: crmUser }).catch(() => null) : null;
  const crm = crmModel ? buildCrmPanel(crmModel, inferredPerson, contactPhone) : null;
  return {
    identity: {
      state: linked ? 'linked' : uniqueCandidates.length > 1 ? 'ambiguous' : uniqueCandidates.length === 1 ? 'match_found' : 'unidentified',
      linked: Boolean(linked),
      source: linked?.internal_source || null,
      person_type: linked?.internal_person_type || inferredPerson?.type || null,
      person_id: linked?.internal_person_id || inferredPerson?.id || null,
      auto_link_candidate: !linked && uniqueCandidates.length === 1 ? uniqueCandidates[0] : null,
      candidates: linked ? [] : uniqueCandidates.slice(0, 5),
    },
    person: inferredPerson,
    crm,
    student: matchedUser ? studentPanel(matchedUser) : null,
    actions: {
      open_person_url: inferredPerson ? `/app/admin?panel=admin-controle-pedagogico-pessoas&person=${encodeURIComponent(inferredPerson.id)}` : '',
      open_student_url: inferredPerson?.type === 'student' ? `/app/admin?panel=admin-controle-pedagogico-pessoas&student=${encodeURIComponent(inferredPerson.id)}` : '',
      open_crm_url: crm?.opportunity?.id ? `/app/admin?panel=native-crm&opportunity=${encodeURIComponent(crm.opportunity.id)}` : '',
      can_create_opportunity: canReadCrm && !crm?.has_open_opportunity,
      can_link_person: !linked && uniqueCandidates.length > 0,
      can_unlink_person: Boolean(linked),
    },
    sources: {
      contact_identity: 'attendance.contact_identities',
      people: 'firestore.users',
      crm: 'firestore.crmContacts/crmOpportunities/crmActivities',
      student: 'firestore.users + retention lifecycle projection',
    },
  };
};

module.exports = { loadCrmSnapshot, phoneVariants, resolveAttendanceContext };
