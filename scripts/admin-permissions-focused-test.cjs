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
assert.ok(ADMIN_PERMISSION_REGISTRY.financeiro.children.overview, "registry includes financeiro.overview");
assert.ok(ADMIN_PERMISSION_REGISTRY.settings.children.accesses, "registry includes settings.accesses");

const flat = flattenRegistry();
assert.ok(flat.length > 20, "registry flattens module/submodule permissions");
assert.strictEqual(new Set(ALL_ADMIN_PERMISSION_KEYS).size, ALL_ADMIN_PERMISSION_KEYS.length, "permission keys are unique");

assert.deepStrictEqual(normalizeAdminPermissions(["dashboard", "nope", "comercial.crm", "comercial.crm"]), ["dashboard", "comercial.crm"]);

const superAdmin = { role: "admin", isSuperAdmin: true, adminPermissions: [] };
assert.strictEqual(canAdminAccess(superAdmin, "financeiro.closing"), true, "super admin bypasses matrix");

const fullAdmin = { role: "admin" };
assert.strictEqual(adminAccessPayloadForUser(fullAdmin).adminPermissions.length, ALL_ADMIN_PERMISSION_KEYS.length, "missing permissions fallback preserves existing admins");

const limitedAdmin = { role: "admin", adminPermissions: ["comercial.overview", "comercial.crm"] };
assert.strictEqual(canAdminAccess(limitedAdmin, "comercial.crm"), true, "limited admin can access granted permission");
assert.strictEqual(canAdminAccess(limitedAdmin, "comercial.goals"), false, "limited admin cannot access missing permission");
assert.strictEqual(canAdminAccess(limitedAdmin, "financeiro.overview"), false, "limited admin cannot access missing module");

assert.strictEqual(permissionForAdminPanel("native-crm"), "comercial.crm");
assert.strictEqual(permissionForAdminPanel("admin-comercial-metas"), "comercial.goals");
assert.strictEqual(permissionForAdminPanel("financeiro", { financeTab: "recebiveis" }), "financeiro.receivables");
assert.strictEqual(permissionForAdminPanel("configuracoes-admin", { settingsSection: "acessos" }), "settings.accesses");
assert.strictEqual(permissionForAdminPanel("admin-controle-pedagogico", { pedagogicoTab: "pessoas" }), "pedagogico.users");

const patch = buildAdminPermissionPatchWrites({
  targetUser: limitedAdmin,
  targetUid: "target-admin",
  permissions: ["dashboard", "activities"],
  actorUserId: "super-admin",
});
assert.deepStrictEqual(patch.before, ["comercial.overview", "comercial.crm"]);
assert.deepStrictEqual(patch.after, ["dashboard", "activities"]);
assert.strictEqual(patch.writes.length, 2, "permission save writes user patch and audit event");

console.log("admin permissions focused tests passed");
