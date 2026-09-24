# Retention Intelligence — Admin V0

This evolves the existing Health engine, daily snapshots, alerts, Command Center and Student 360. It is expert-informed, not an empirically validated predictive model. Lifecycle, access, Asaas and cancellation commands are unchanged.

## Model

Original weights: Presence 30, Teacher Pulse 30, Experience 25, Financial 15. Teacher Pulse is always UNKNOWN. Divide by available weights; coverage retains the original weights (maximum V0 70%). Missing is never zero or healthy. Persist raw score/tier separately from the operational effective tier and its hard-rule reasons. Thresholds are 80/65/45.

Presence uses explicit student outcomes only. Student absences score 100/90/55/25/10 for none/isolated/two/three/four-plus; 3 absences in the last 5 observed classes cap at 50. Cancelled/rescheduled/unrecorded classes do not count. The current sequence spans all observed lessons, even across a month boundary. Numeric presence requires at least one explicit result in the last 30 days; older unresolved sequences retain their hard signal.

Experience uses canonical occurrences (worst open severity 100/90/70/40/15; second same-category episode in 90 days minus 10, third-plus minus 20). An activity/comment pair uniquely identifies an episode. Recent Quality Pulse uses 35/30/20/15 general/progress/teacher/schedule weights and 1–5 maps to 10/35/65/85/100. Voice can only lower friction; days 31–60 halve the negative difference, older data is historical. NPS is display only. No login, study telemetry, MRR or plan prices enter Health.

Financial uses verified customer/student IDs and a full reconciliation within 48 hours. Current=100; overdue 1–3=80, 4–10=60, 11–30=30, 31+=10. No charges or stale/unavailable data = UNKNOWN.

Hard rules: four absences => Critical; considering_exit => at least Risk; wants_to_cancel => Critical; open critical occurrence => at least Attention; critical occurrence plus independent negative presence/Voice/severe-finance signal => Critical. These never change the mathematical score or lifecycle.

## Durable cases and actions

`retention_risk_cases` is separate from lifecycle `retention_cases`. Sequence keys use the first explicit absence; SQL serializes updates and enforces one open absence case. Return attendance moves the case to monitoring; it retains its history.

Second absence claims a single WhatsApp action and creates an existing Firestore Activity “Conferir resposta” due the next day. Third creates a high-priority call Activity and completes a pending response-check as no_response when the Inbox confirms no inbound reply since the contact. Unknown/failed contact is not evidence of no reply. Fourth-plus does not duplicate actions. If the first job observation is already the third/fourth absence, it creates the call without a retrospective second-absence message.

The shared `attendance-send-text` service is used by both Inbox and the job. It keeps the current provider and channel restrictions. Automation requires a canonical profile phone, exactly one safely linked active Inbox conversation, and an enabled existing admin team member. Missing/ambiguous conversation, phone mismatch, unavailable operator/channel or provider rejection is recorded; no new contact integration or security bypass is created. The template is configurable in Health using the existing Retenção update permission.

Unique SQL action claims prevent concurrent/repeated sends. A send claim is never automatically reclaimed after a timeout/crash, because provider delivery may have occurred. Uncertain sends remain explicitly unknown/claimed for operator review. Deterministic Activity IDs plus the existing CAS/event writer make failed Activity creation safely retryable. All outcomes and errors remain visible on the case in Student 360.

## Activity Workspace

Retention completion requires an outcome: resolved, contacted, no_response, needs_followup, student_recovered, escalated. Completion does not close the durable risk case. “Ligação de qualidade” completion requires the structured pulse. Its summary can reference an existing normal comment. The immutable completed Activity is the durable pulse source; an idempotent Supabase projection is retried by the daily collector if interrupted.

“Marcar como ocorrência” references the existing comment and asks only category/severity. Unique episode keys prevent double penalties. The Student 360 can resolve an occurrence using the existing Retenção update permission. No AI classifies comments.

## Persistence and access

Migration `20260924143218_health_admin_v0.sql` adds generated canonical V0 columns to `student_health_daily`, plus risk cases/actions, occurrences, quality pulses and settings. RLS blocks direct anonymous/authenticated access; only privileged backend operations are granted. APIs preserve their existing authentication/permissions. No new endpoint is required.

Daily job `/api/retention-health-job` stays at 00:20 São Paulo, using CRON_SECRET. Snapshots are daily/current-date only, preserve prior days and model version, and support future 7/14/30-day pre-churn calibration. Deltas require identical model and coverage. No automatic calibration or historical backfill. Recent occurrence/pulse records are displayed alongside the explicitly dated daily score.

The operational roster intersects real Firestore student document IDs with canonical subscriptions. Analytics opening denominators still require an actual snapshot on day 1; no reverse estimates.

## Focused verification

`node --test tests/health-admin-v0.test.js`: ten requested scoring/automation/idempotency/lifecycle scenarios with fake provider calls. Existing Activity persistence/Student 360 tests and the single shared Inbox send-path test verify integration. Production SQL case/action check runs inside a rolled-back transaction; production validation reads aggregates and runs the authenticated daily job. No test messages to real students, staging or full suite.
