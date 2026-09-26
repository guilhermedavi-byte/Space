const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('script.js', 'utf8');
const start = source.indexOf('const parseAppRoute =');
const end = source.indexOf('\nconst ', start + 1);
const context = vm.createContext({ URL, window: { location: { origin: 'https://space.example' } }, currentRole: 'admin', normalizePathname: p => p.replace(/\/$/, '') });
vm.runInContext(source.slice(start, end) + '\nthis.parse = parseAppRoute;', context);
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
for (const role of ['admin', 'growth']) {
  for (const suffix of ['sdr', 'comercial/painel-sdr', 'comercial/pre-vendas/painel-sdr']) {
    test(`retired ${role}/${suffix} redirects to its existing Comercial parent`, () => {
      const path = `/app/${role}/${suffix}`;
      const target = `/app/${role}/comercial`;
      assert.equal(context.parse(path).redirectTo, target);
      assert.equal(context.parse(target).redirectTo, undefined);
      assert.equal(config.redirects.find(r => r.source === path).destination, target);
    });
  }
}
test('retired UI is absent while existing commercial modules remain', () => {
  const html = fs.readFileSync('api/_templates/app.html', 'utf8');
  assert.doesNotMatch(html, /admin-sdr|data-sdr-panel|Painel SDR/);
  assert.doesNotMatch(source, /SpaceAdminSdr|sdrPanelState|loadSdrPanelData|postSdrAction/);
  assert.equal(fs.existsSync('admin-sdr.js'), false);
  for (const panel of ['native-crm', 'space-phone', 'space-agenda', 'admin-comercial-atividade-sdr', 'admin-comercial-metas', 'admin-comercial-usuarios', 'attendance-inbox']) {
    assert.ok(html.includes(`data-panel="${panel}"`), panel);
  }
});
test('shared historical authorization survives without a retired UI route', () => {
  const { ADMIN_PERMISSION_REGISTRY, VALID_ADMIN_PERMISSION_KEYS } = require('../api/_lib/admin-permissions');
  assert.equal(VALID_ADMIN_PERMISSION_KEYS.has('comercial.sdrPanel.view'), true);
  assert.equal(ADMIN_PERMISSION_REGISTRY.comercial.children.sdrPanel.panel, undefined);
  assert.deepEqual(ADMIN_PERMISSION_REGISTRY.comercial.children.sdrPanel.routes, []);
});
