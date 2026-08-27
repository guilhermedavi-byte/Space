const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

test("Central de retenção consulta a API nova quando a flag está ativa", () => {
  assert.match(script, /const isRetentionV2FeatureEnabled = \(\) => Boolean\(getRuntimeFeatureFlags\(\)\.retentionV2Enabled\)/);
  assert.match(script, /fetchWithAuth\(`\/api\/retention-cases\?\$\{params\.toString\(\)\}`/);
});

test("modais de retenção mantêm o legado, mas redirecionam pela flag", () => {
  assert.match(script, /if \(isRetentionV2FeatureEnabled\(\)\) \{\s+await submitRetentionV2Command\(\{\s+command: "register_formal_request"/);
  assert.match(script, /command: "effectuate_churn"/);
  assert.match(script, /command: "reactivate_subscription"/);
});

test("drawer do aluno carrega e renderiza timeline canônica quando a flag v2 está ativa", () => {
  assert.match(script, /const loadAdminStudentRetentionTimeline = async \(\{ alunoId, force = false \} = \{\}\) =>/);
  assert.match(script, /fetchWithAuth\(`\/api\/retention-cases\?\$\{params\.toString\(\)\}`,\s*\{ method: "GET" \}\)/);
  assert.match(script, /<div class="admin-student-panel-title">Timeline de retenção<\/div>/);
  assert.match(script, /await loadAdminStudentRetentionTimeline\(\{ alunoId, force: true \}\)\.catch\(\(\) => null\)/);
});
