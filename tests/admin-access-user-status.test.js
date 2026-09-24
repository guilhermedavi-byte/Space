const assert = require("node:assert/strict");
const test = require("node:test");

const { isUserActive, normalizeUserStatus } = require("../_lib/user-status");
const {
  buildAdminProfileUpdatePatch,
  buildAdminStatusPatch,
  sanitizeUserPatch,
} = require("../api/admin-users")._test;

test("admin user status accepts legacy active fields and inactive aliases", () => {
  assert.equal(normalizeUserStatus({}), "active");
  assert.equal(normalizeUserStatus({ ativo: false }), "inactive");
  assert.equal(normalizeUserStatus({ active: false }), "inactive");
  assert.equal(normalizeUserStatus({ disabled: true }), "inactive");
  assert.equal(normalizeUserStatus({ status: "inativo" }), "inactive");
  assert.equal(isUserActive({ status: "active", ativo: true }), true);
});

test("admin profile update only writes safe editable fields", () => {
  const change = buildAdminProfileUpdatePatch({
    target: { nome: "Ana", telefone: "1199", email: "ana@space.test", adminPermissions: ["settings.profile.view"] },
    body: { nome: "Ana Maria", telefone: "1188", email: "other@space.test", adminPermissions: [] },
    actorId: "super",
  });
  assert.equal(change.event, "admin_user_updated");
  assert.deepEqual(change.before, { nome: "Ana", telefone: "1199" });
  assert.deepEqual(change.after, { nome: "Ana Maria", telefone: "1188" });
  assert.equal(change.patch.email, undefined);
  assert.equal(change.patch.adminPermissions, undefined);
});

test("admin status patch preserves permissions and toggles logical access only", () => {
  const change = buildAdminStatusPatch({
    target: { ativo: true, active: true, status: "active", adminPermissions: ["settings.accesses.view"] },
    status: "inactive",
    actorId: "super",
  });
  assert.equal(change.event, "admin_user_deactivated");
  assert.equal(change.patch.ativo, false);
  assert.equal(change.patch.active, false);
  assert.equal(change.patch.disabled, true);
  assert.equal(change.patch.status, "inactive");
  assert.equal(change.patch.adminPermissions, undefined);
  assert.equal(change.patch.permissions, undefined);
});

test("admin status patch rejects ambiguous status and generic patch still blocks sensitive permissions", () => {
  assert.throws(() => buildAdminStatusPatch({ target: {}, status: "" }), /invalid_status/);
  assert.throws(() => sanitizeUserPatch({ adminPermissions: ["settings.accesses.view"] }), /sensitive_admin_field_forbidden/);
});
