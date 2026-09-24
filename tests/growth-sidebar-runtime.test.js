const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync('script.js', 'utf8');

const extractConstFunction = (name) => {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} exists`);
  const arrow = source.indexOf('=>', start);
  const bodyStart = source.indexOf('{', arrow);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 2);
  }
  throw new Error(`could not extract ${name}`);
};

const normalizeRole = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'student' || raw === 'aluno') return 'student';
  if (raw === 'teacher' || raw === 'professor') return 'teacher';
  if (raw === 'admin' || raw === 'administrador') return 'admin';
  if (raw === 'growth') return 'growth';
  if (raw === 'finance' || raw === 'financeiro') return 'FINANCE';
  return '';
};

const sanitizeSessionUser = new Function('normalizeRole', `${extractConstFunction('sanitizeSessionUser')}\nreturn sanitizeSessionUser;`)(normalizeRole);

const createSyncRoleUI = ({ document, currentRole, sessionUser }) => new Function(
  'document',
  'currentRole',
  'sessionUser',
  'HTMLElement',
  `
  const ROLE_DEFS = { growth: {}, admin: {}, student: {} };
  const roleEyebrow = null;
  const roleSidebarSubtitle = null;
  const greetingElement = null;
  const planWidgets = [];
  const roleTopbars = [];
  const dashboardTeacher = null;
  const dashboardStudent = null;
  const dashboardAdmin = null;
  const liveTeacherRoot = null;
  const liveStudentRoot = null;
  const isFinanceAccessRole = () => false;
  const canAdmin = () => true;
  const permissionForPanel = () => 'allowed';
  const getVisibleAdminSettingsSections = () => ['meu-perfil'];
  const financeState = { activeTab: 'overview' };
  const adminPedagogicoState = { activeTab: 'overview' };
  const adminSettingsState = { activeSection: 'meu-perfil' };
  ${extractConstFunction('syncRoleUI')}
  return syncRoleUI;
  `
)(document, currentRole, sessionUser, document.defaultView.HTMLElement);

const sidebarDom = () => new JSDOM(`
  <button data-panel-target="attendance-inbox" hidden>Caixa de entrada</button>
  <button data-panel-target="attendance-connections" hidden>Conexões</button>
  <button data-panel-target="native-crm" hidden>CRM</button>
  <button data-panel-target="space-phone" hidden>Ligações</button>
  <button data-admin-only data-panel-target="admin-sdr">Admin SDR</button>
  <button data-growth-only data-panel-target="admin-sdr" hidden>Growth SDR</button>
  <button data-growth-dashboard-link data-panel-target="growth"><span class="sidebar-text"></span></button>
`);

test('sanitizeSessionUser preserves normalized commercial roles', () => {
  const user = sanitizeSessionUser({
    id: 'matheus',
    role: 'growth',
    name: 'Matheus',
    email: 'matheus@example.com',
    commercialRoles: ['closer', 'SDR', 'admin', 'sdr'],
  });
  assert.deepEqual(user.commercialRoles, ['closer', 'sdr']);
});

test('Growth with closer plus SDR shows phone and Growth SDR panel only', () => {
  const dom = sidebarDom();
  createSyncRoleUI({ document: dom.window.document, currentRole: 'growth', sessionUser: { role: 'growth', name: 'Matheus', commercialRoles: ['closer', 'sdr'] } })();
  assert.equal(dom.window.document.querySelector('[data-panel-target="space-phone"]').hidden, false);
  assert.equal(dom.window.document.querySelector('[data-growth-only][data-panel-target="admin-sdr"]').hidden, false);
  assert.equal(dom.window.document.querySelector('[data-admin-only][data-panel-target="admin-sdr"]').hidden, true);
});

test('Growth closer-only keeps phone and Growth SDR panel hidden', () => {
  const dom = sidebarDom();
  createSyncRoleUI({ document: dom.window.document, currentRole: 'growth', sessionUser: { role: 'growth', name: 'Closer', commercialRoles: ['closer'] } })();
  assert.equal(dom.window.document.querySelector('[data-panel-target="space-phone"]').hidden, true);
  assert.equal(dom.window.document.querySelector('[data-growth-only][data-panel-target="admin-sdr"]').hidden, true);
});

test('Admin still shows admin SDR panel and hides Growth-only duplicate', () => {
  const dom = sidebarDom();
  createSyncRoleUI({ document: dom.window.document, currentRole: 'admin', sessionUser: { role: 'admin', name: 'Admin', commercialRoles: [] } })();
  assert.equal(dom.window.document.querySelector('[data-admin-only][data-panel-target="admin-sdr"]').hidden, false);
  assert.equal(dom.window.document.querySelector('[data-growth-only][data-panel-target="admin-sdr"]').hidden, true);
});
