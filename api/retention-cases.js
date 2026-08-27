const { readJsonBody, sendJson } = require("./_lib/http");
const { resolveAdminRequestAuth } = require("./_lib/admin-request-auth");
const { hasCapability } = require("./_lib/retention-capabilities");
const { isRetentionInvoluntaryChurnEnabled, isRetentionV2Enabled } = require("./_lib/retention-flags");
const { COMMAND_CAPABILITY, buildCommandPayload, needsOverrideJustification } = require("./_lib/retention-domain");
const { applyRetentionCommand, getRetentionCaseTimeline, listRetentionCases, resolveRetentionSubjectByFirestoreStudentId } = require("./_lib/retention-store");

const getUrl = (req) => new URL(req.url || "/api/retention-cases", `https://${String(req.headers.host || "localhost")}`);

const requireAuth = async (req, capability) => {
  const auth = await resolveAdminRequestAuth(req, { logPrefix: "[api] retention auth" });
  if (!auth.ok) return auth;
  if (!hasCapability(auth.session?.role, capability)) {
    return {
      ok: false,
      status: 403,
      body: { error: "forbidden", missingCapability: capability },
    };
  }
  return auth;
};

module.exports = async (req, res) => {
  if (!["GET", "HEAD", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD, POST");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const auth = await requireAuth(req, "retention.view");
    if (!auth.ok) return sendJson(res, auth.status, auth.body);
    const url = getUrl(req);
    try {
      const view = String(url.searchParams.get("view") || "list").trim();
      if (view === "timeline") {
        const caseId = String(url.searchParams.get("caseId") || "").trim();
        if (!caseId) return sendJson(res, 400, { error: "missing_case_id" });
        const timeline = await getRetentionCaseTimeline({ caseId });
        return sendJson(res, 200, { ok: true, timeline });
      }
      const filters = {
        stage: String(url.searchParams.get("stage") || "").trim(),
        owner_uid: String(url.searchParams.get("ownerUid") || "").trim(),
        risk_level: String(url.searchParams.get("riskLevel") || "").trim(),
        month_key: String(url.searchParams.get("month") || "").trim(),
      };
      const result = await listRetentionCases({ filters });
      if (view === "queues") {
        return sendJson(res, 200, {
          ok: true,
          source: isRetentionV2Enabled() ? "retention_v2" : "retention_v2_shadow",
          status: "success",
          loading: false,
          counts: result.counts,
          queues: result.queues,
          rows: result.rows,
        });
      }
      return sendJson(res, 200, {
        ok: true,
        source: isRetentionV2Enabled() ? "retention_v2" : "retention_v2_shadow",
        rows: result.rows,
        counts: result.counts,
      });
    } catch (error) {
      console.error("[retention] list failed", { code: error?.code || "", message: error?.message || "retention_list_failed" });
      return sendJson(res, 500, {
        error: error?.code || "retention_list_failed",
        message: "Não foi possível carregar os casos de retenção agora.",
      });
    }
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  const commandName = String(body?.command || "").trim();
  const capability = COMMAND_CAPABILITY[commandName];
  if (!capability) return sendJson(res, 400, { error: "unsupported_command" });
  const auth = await requireAuth(req, capability);
  if (!auth.ok) return sendJson(res, auth.status, auth.body);

  if (commandName === "effectuate_churn" && body?.payload?.mode === "automatic" && !isRetentionInvoluntaryChurnEnabled()) {
    return sendJson(res, 409, {
      error: "involuntary_churn_disabled",
      message: "Churn involuntário permanece bloqueado por feature flag.",
    });
  }

  if (needsOverrideJustification({ command: commandName, role: auth.session?.role, forceOverride: body?.override === true })) {
    if (!hasCapability(auth.session?.role, "retention.override")) {
      return sendJson(res, 403, { error: "forbidden", missingCapability: "retention.override" });
    }
    if (!String(body?.justification || "").trim()) {
      return sendJson(res, 400, { error: "missing_justification" });
    }
  }

  try {
    const command = buildCommandPayload({
      command: commandName,
      actor: auth.session,
      body,
    });
    if (command.command === "register_formal_request" && !command.payload.requested_at) {
      return sendJson(res, 400, { error: "missing_requested_at" });
    }
    if (!command.case_id && command.firestore_student_id && (!command.student_id || !command.subscription_id)) {
      const resolved = await resolveRetentionSubjectByFirestoreStudentId({ firestoreStudentId: command.firestore_student_id });
      command.student_id = resolved.studentId;
      command.subscription_id = resolved.subscriptionId;
    }
    const result = await applyRetentionCommand({ command });
    return sendJson(res, 200, {
      ok: true,
      result,
    });
  } catch (error) {
    const code = String(error?.message || error?.code || "retention_command_failed");
    const status =
      code === "retention_version_conflict" || code === "idempotency_key_payload_mismatch"
        ? 409
        : code === "invalid_retention_command" || code === "missing_client_action_id" || code === "missing_requested_at" || code === "retention_student_not_found"
          ? 400
          : 500;
    console.error("[retention] command failed", { code });
    return sendJson(res, status, {
      error: code,
      message:
        code === "retention_version_conflict"
          ? "Este caso foi alterado em outro acesso. Atualize antes de tentar novamente."
          : code === "idempotency_key_payload_mismatch"
            ? "A mesma tentativa foi reenviada com dados diferentes. Gere uma nova ação."
          : "Não foi possível salvar a ação de retenção agora.",
    });
  }
};

module.exports._test = {
  getUrl,
  requireAuth,
};
