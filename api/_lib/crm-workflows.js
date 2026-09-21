const VALID_WORKSPACE_TYPES = new Set(["sdr", "closer"]);
const VALID_ACTIVITY_TYPES = new Set(["task", "call", "meeting", "follow_up"]);
const VALID_DELAY_UNITS = new Set(["immediate", "hours", "days"]);

const clean = (value) => String(value || "").trim();
const toIso = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeWorkflow = (row = {}, scopeId = "space-main") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || scopeId,
  name: clean(row.name),
  pipelineId: clean(row.pipelineId),
  triggerStageId: clean(row.triggerStageId),
  workspaceType: VALID_WORKSPACE_TYPES.has(clean(row.workspaceType)) ? clean(row.workspaceType) : "sdr",
  isActive: row.isActive === true,
  activeVersionId: clean(row.activeVersionId) || null,
  version: Number(row.version) || 0,
  createdBy: clean(row.createdBy) || null,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeWorkflowVersion = (row = {}, scopeId = "space-main") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || scopeId,
  workflowId: clean(row.workflowId),
  versionNumber: Number(row.versionNumber) || 1,
  status: ["draft", "published", "archived"].includes(clean(row.status)) ? clean(row.status) : "draft",
  publishedAt: toIso(row.publishedAt),
  createdBy: clean(row.createdBy) || null,
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const normalizeWorkflowStep = (row = {}, scopeId = "space-main") => {
  const unit = clean(row.delayUnit);
  return {
    id: clean(row.id || row.firestoreDocId),
    scopeId: clean(row.scopeId) || scopeId,
    workflowId: clean(row.workflowId),
    versionId: clean(row.versionId),
    position: Number(row.position) || 1,
    activityType: VALID_ACTIVITY_TYPES.has(clean(row.activityType)) ? clean(row.activityType) : "task",
    title: clean(row.title),
    description: clean(row.description) || null,
    delayAmount: Math.max(0, Number(row.delayAmount) || 0),
    delayUnit: VALID_DELAY_UNITS.has(unit) ? unit : "immediate",
    assignedRole: clean(row.assignedRole) || "owner",
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
};

const normalizeWorkflowRun = (row = {}, scopeId = "space-main") => ({
  id: clean(row.id || row.firestoreDocId),
  scopeId: clean(row.scopeId) || scopeId,
  workflowId: clean(row.workflowId),
  workflowVersionId: clean(row.workflowVersionId),
  workflowVersion: Number(row.workflowVersion) || 1,
  opportunityId: clean(row.opportunityId),
  triggerStageId: clean(row.triggerStageId),
  status: ["active", "completed", "cancelled"].includes(clean(row.status)) ? clean(row.status) : "active",
  idempotencyKey: clean(row.idempotencyKey),
  startedAt: toIso(row.startedAt),
  completedAt: toIso(row.completedAt),
  cancelledAt: toIso(row.cancelledAt),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const workflowDraftFromPayload = ({ body = {}, existingWorkflow = {}, stamp, actor }) => ({
  name: clean(body.name || existingWorkflow.name),
  pipelineId: clean(body.pipelineId || existingWorkflow.pipelineId),
  triggerStageId: clean(body.triggerStageId || existingWorkflow.triggerStageId),
  workspaceType: VALID_WORKSPACE_TYPES.has(clean(body.workspaceType || existingWorkflow.workspaceType)) ? clean(body.workspaceType || existingWorkflow.workspaceType) : "sdr",
  isActive: body.isActive === undefined ? existingWorkflow.isActive === true : body.isActive === true,
  updatedAt: stamp,
  createdBy: clean(existingWorkflow.createdBy || actor) || null,
});

const stepsFromPayload = ({ body = {}, workflowId, versionId, stamp, newId, scopeId }) => {
  const rows = Array.isArray(body.steps) ? body.steps : [];
  return rows.map((step, index) => {
    const normalized = normalizeWorkflowStep({
      ...step,
      id: clean(step.id) || newId("wfstep"),
      workflowId,
      versionId,
      position: index + 1,
      delayUnit: clean(step.delayUnit) === "minutes" ? "hours" : step.delayUnit,
      assignedRole: "owner",
      createdAt: step.createdAt || stamp,
      updatedAt: stamp,
    }, scopeId);
    return normalized;
  });
};

const validateWorkflowDraft = ({ workflow, steps, stages = [], pipelines = [] }) => {
  const errors = [];
  if (!clean(workflow.name)) errors.push("workflow_name_required");
  const pipeline = pipelines.find((row) => row.id === workflow.pipelineId);
  if (!pipeline) errors.push("workflow_pipeline_required");
  const stage = stages.find((row) => row.id === workflow.triggerStageId);
  if (!stage || stage.pipelineId !== workflow.pipelineId) errors.push("workflow_trigger_stage_required");
  if (!steps.length) errors.push("workflow_steps_required");
  steps.forEach((step, index) => {
    if (!VALID_ACTIVITY_TYPES.has(step.activityType)) errors.push(`step_${index + 1}_activity_type_required`);
    if (!clean(step.title)) errors.push(`step_${index + 1}_title_required`);
    if (!VALID_DELAY_UNITS.has(step.delayUnit)) errors.push(`step_${index + 1}_delay_unit_required`);
  });
  return { ok: errors.length === 0, errors };
};

const dueAtForStep = (baseDate, step) => {
  const date = new Date(baseDate.getTime());
  const amount = Math.max(0, Number(step.delayAmount) || 0);
  if (step.delayUnit === "hours") date.setHours(date.getHours() + amount);
  if (step.delayUnit === "days") date.setDate(date.getDate() + amount);
  return date.toISOString();
};

const activeWorkflowsForStage = ({ workflows = [], versions = [], pipelineId, stageId }) => {
  const versionById = new Map(versions.map((row) => [row.id, row]));
  return workflows
    .filter((workflow) => workflow.isActive && workflow.pipelineId === pipelineId && workflow.triggerStageId === stageId && workflow.activeVersionId)
    .map((workflow) => ({ workflow, version: versionById.get(workflow.activeVersionId) }))
    .filter((entry) => entry.version?.status === "published");
};

module.exports = {
  activeWorkflowsForStage,
  dueAtForStep,
  normalizeWorkflow,
  normalizeWorkflowRun,
  normalizeWorkflowStep,
  normalizeWorkflowVersion,
  stepsFromPayload,
  validateWorkflowDraft,
  workflowDraftFromPayload,
};
