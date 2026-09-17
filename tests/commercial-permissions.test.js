const test = require("node:test");
const assert = require("node:assert/strict");

const permissions = require("../api/_lib/commercial-permissions");

const growth = (commercialRoles = []) => ({ role: "growth", commercialRoles });
const admin = () => ({ role: "admin" });

test("commercial roles are normalized independently from platform role", () => {
  assert.deepEqual(permissions.normalizeCommercialRoles(["SDR", "closer", "sdr", "admin"]), ["sdr", "closer"]);
  assert.deepEqual(permissions.normalizeCommercialRoles("sdr closer"), ["sdr", "closer"]);
  assert.equal(permissions.getCommercialPermissions(growth(["sdr"])).isAdmin, false);
});

test("workspace visibility follows commercial roles for Growth and ignores general pipelines", () => {
  assert.deepEqual(permissions.visiblePipelineTypesForUser(growth(["sdr"])), ["sdr"]);
  assert.deepEqual(permissions.visiblePipelineTypesForUser(growth(["closer"])), ["closer"]);
  assert.deepEqual(permissions.visiblePipelineTypesForUser(growth(["sdr", "closer"])), ["sdr", "closer"]);
  assert.deepEqual(permissions.visiblePipelineTypesForUser(growth([])), []);
  assert.deepEqual(permissions.visiblePipelineTypesForUser(admin()), ["sdr", "closer"]);
});

test("SDR can create, qualify and handoff only inside the SDR pipeline", () => {
  assert.equal(permissions.canPerformCrmAction({ user: growth(["sdr"]), action: "create_opportunity", pipelineType: "sdr" }), true);
  assert.equal(permissions.canPerformCrmAction({ user: growth(["sdr"]), action: "complete_qualification", pipelineType: "sdr" }), true);
  assert.equal(permissions.canPerformCrmAction({ user: growth(["sdr"]), action: "handoff_opportunity", pipelineType: "sdr" }), true);
  assert.equal(permissions.canPerformCrmAction({ user: growth(["sdr"]), action: "create_opportunity", pipelineType: "closer" }), false);
  assert.equal(permissions.canPerformCrmAction({ user: growth(["sdr"]), action: "complete_closer_review", pipelineType: "closer" }), false);
});

test("Closer can operate closer work but cannot mutate SDR qualification or create top-of-funnel leads", () => {
  assert.equal(permissions.canPerformCrmAction({ user: growth(["closer"]), action: "set_meeting_outcome", pipelineType: "closer" }), true);
  assert.equal(permissions.canPerformCrmAction({ user: growth(["closer"]), action: "complete_closer_review", pipelineType: "closer" }), true);
  assert.equal(permissions.canPerformCrmAction({ user: growth(["closer"]), action: "mark_opportunity_won", pipelineType: "closer" }), true);
  assert.equal(permissions.canPerformCrmAction({ user: growth(["closer"]), action: "create_opportunity", pipelineType: "closer" }), false);
  assert.equal(permissions.canPerformCrmAction({ user: growth(["closer"]), action: "complete_qualification", pipelineType: "sdr" }), false);
});

test("Admin can alternate between SDR and Closer workspaces", () => {
  assert.equal(permissions.canAccessCommercialWorkspace(admin(), "sdr"), true);
  assert.equal(permissions.canAccessCommercialWorkspace(admin(), "closer"), true);
  assert.equal(permissions.canPerformCrmAction({ user: admin(), action: "mark_opportunity_lost", pipelineType: "closer" }), true);
  assert.equal(permissions.canPerformCrmAction({ user: admin(), action: "complete_qualification", pipelineType: "sdr" }), true);
});
