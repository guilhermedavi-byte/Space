const assert = require("assert");

process.env.APP_ENV = process.env.APP_ENV || "local";

const {
  ALL_ADMIN_PERMISSION_KEYS,
  ADMIN_PERMISSION_REGISTRY,
  adminAccessPayloadForUser,
  buildAdminPermissionPatchWrites,
  canAdminAccess,
  flattenRegistry,
  normalizeAdminPermissions,
  permissionForAdminPanel,
} = require("../api/_lib/admin-permissions");

assert.ok(ADMIN_PERMISSION_REGISTRY.comercial.children.crm, "registry includes comercial.crm");
assert.ok(!ADMIN_PERMISSION_REGISTRY.comercial.children.growth, "registry does not expose Growth in admin access");
assert.ok(ADMIN_PERMISSION_REGISTRY.financeiro.children.overview, "registry includes financeiro.overview");
assert.ok(ADMIN_PERMISSION_REGISTRY.settings.children.accesses, "registry includes settings.accesses");
assert.ok(ADMIN_PERMISSION_REGISTRY.settings.children.status, "registry includes settings.status");
assert.ok(!ADMIN_PERMISSION_REGISTRY.status, "status is not a top-level module");
assert.ok(!ADMIN_PERMISSION_REGISTRY.guide, "guide module was removed from the admin registry");

const flat = flattenRegistry();
assert.ok(flat.length >= 40 && flat.length <= 80, "registry keeps useful enterprise granularity");
assert.strictEqual(new Set(ALL_ADMIN_PERMISSION_KEYS).size, ALL_ADMIN_PERMISSION_KEYS.length, "permission keys are unique");

assert.deepStrictEqual(normalizeAdminPermissions(["dashboard", "nope", "comercial.crm", "comercial.crm"]), [
  "dashboard.overview.view",
  "comercial.crm.view",
  "comercial.crm.create",
  "comercial.crm.update",
  "comercial.crm.delete",
]);
assert.deepStrictEqual(normalizeAdminPermissions(["status"]), ["settings.status.view"], "legacy status grants settings.status.view");
assert.deepStrictEqual(normalizeAdminPermissions(["guide"]), [], "removed guide permissions are not normalized");
assert.deepStrictEqual(normalizeAdminPermissions(["growth", "comercial.growth.view"]), [], "Growth permissions are removed from admin access");

const superAdmin = { role: "admin", isSuperAdmin: true, adminPermissions: [] };
assert.strictEqual(canAdminAccess(superAdmin, "financeiro.closing.view"), true, "super admin bypasses matrix");

const fullAdmin = { role: "admin" };
assert.strictEqual(adminAccessPayloadForUser(fullAdmin).adminPermissions.length, ALL_ADMIN_PERMISSION_KEYS.length, "missing permissions fallback preserves existing admins");

const limitedAdmin = { role: "admin", adminPermissions: ["comercial.overview.view", "comercial.crm.view", "comercial.crm.update"] };
assert.strictEqual(canAdminAccess(limitedAdmin, "comercial.crm.view"), true, "limited admin can access granted permission");
assert.strictEqual(canAdminAccess(limitedAdmin, "comercial.crm.delete"), false, "limited admin cannot delete without delete permission");
assert.strictEqual(canAdminAccess(limitedAdmin, "comercial.goals.view"), false, "limited admin cannot access missing permission");
assert.strictEqual(canAdminAccess(limitedAdmin, "financeiro.overview.view"), false, "limited admin cannot access missing module");
assert.strictEqual(canAdminAccess({ role: "student", tipo: "admin" }, "dashboard.overview.view"), true, "tipo is the canonical role field for legacy admin users");

assert.strictEqual(permissionForAdminPanel("native-crm"), "comercial.crm.view");
assert.strictEqual(permissionForAdminPanel("admin-comercial-metas"), "comercial.goals.view");
assert.strictEqual(permissionForAdminPanel("growth"), "");
assert.strictEqual(permissionForAdminPanel("financeiro", { financeTab: "recebiveis" }), "financeiro.receivables.view");
assert.strictEqual(permissionForAdminPanel("configuracoes-admin", { settingsSection: "acessos" }), "settings.accesses.view");
assert.strictEqual(permissionForAdminPanel("configuracoes-admin", { settingsSection: "status" }), "settings.status.view");
assert.strictEqual(permissionForAdminPanel("status-plataforma"), "settings.status.view");
assert.strictEqual(permissionForAdminPanel("guia-colaboradores"), "");
assert.strictEqual(permissionForAdminPanel("admin-controle-pedagogico", { pedagogicoTab: "pessoas" }), "pedagogico.users.view");

const patch = buildAdminPermissionPatchWrites({
  targetUser: limitedAdmin,
  targetUid: "target-admin",
  permissions: ["dashboard", "activities"],
  actorUserId: "super-admin",
});
assert.deepStrictEqual(patch.before, ["comercial.overview.view", "comercial.crm.view", "comercial.crm.update"]);
assert.ok(patch.after.includes("dashboard.overview.view"));
assert.ok(patch.after.includes("activities.activity.delete"));
assert.strictEqual(patch.writes.length, 2, "permission save writes user patch and audit event");

console.log("admin permissions focused tests passed");
