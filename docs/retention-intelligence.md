# Retention Intelligence V1

Health never writes lifecycle, finance, access, Firestore profiles or activities. The independent daily job runs at 03:20 UTC (00:20 São Paulo). Cron authentication uses the existing CRON_SECRET. Interactive reads and alert updates use the existing admin Retenção view/update permissions.

## Population

Real Firestore student document IDs intersect canonical Supabase students/subscriptions. Administrative historical profiles absent from Firestore do not contribute. Canonical service-day rules are reused; suspensions remain excluded. No fixed population size and no reverse-estimated opening population. Opening denominators require the observed snapshot on day 1; historic months stay unknown.

## Score

Available-dimension weighted mean, rounded to 0–100. Missing dimensions are NULL, with the sum of available weights reported as coverage.

- Engagement 25: days since activity <3=100, <7=85, <14=60, <30=30, otherwise 10. Own-baseline drop of 40%+ caps this at 100 + change%. Source adapter not activated until reliable study telemetry exists.
- Attendance 25: attended / (attended + explicit student absences) in the last 30 days. Two consecutive absences cap at 40. Only explicitly registered class outcomes; unregistered classes are not absences.
- Learning 20: days since verified progress <7=100, <14=80, <30=55, otherwise 25. Source adapter not activated until reliable assessment/progress data exists.
- Financial 15: current/recovered=100; overdue 1–3 days=75, 4–10=55, 11–30=25, >30=0. Uses existing projections and verified customer/student links, requiring a complete reconciliation no older than 48h. A recent individual webhook is not proof of a complete balance. No payment obligations means unknown, not evidence of activity. No direct Asaas requests.
- Relationship 15: 100 minus 30 per overdue support/retention task (cap 60), minus 15 per high-priority support task (cap 30). Only explicit types Suporte, Reclamação, Retenção, Troca de professor, Support and Complaint. Ordinary tasks do not lower the score.

Healthy >=80, Attention >=65, Risk >=45, Critical <45. A high score at low coverage only describes observed dimensions. Deltas require matching coverage on the exact comparison date; missing history stays NULL.

## Persistence and alerts

`student_health_daily`: one row per Firestore student ID/day. `retention_population_snapshots`: one row per business date. `retention_alerts`: stable student/type deduplication key, manual acknowledgements/resolutions preserved while a condition persists. It can reopen only after an observed disappearance followed by recurrence. Unavailable sources never auto-resolve their signals. `retention_health_events`: append-only tier crossings, deduplicated per student/day/from/to. Current-day reruns are serialized and committed atomically by `retention_health_snapshot`.

Operational alerts do not reduce score by themselves: no first contact 2+ calendar days after request, and notice ending in 0–7 days. They never change lifecycle.

## Analytics

Save Rate = saved / (saved + churned), in the selected request-month cohort. Contact time uses real request/contact timestamps and reports coverage. Request→Notice uses the same cohort; Notice→Churn uses notices with known resolution. Logo Churn and Request Rate restrict the numerator to the observed opening population. New financial rates, tenure/survival, inferred churn categories and commercial attribution stay unavailable without reliable sources.

## Validation

10 focused local tests plus a rollback-only production RPC check: weighted scores, tiers, snapshot idempotency, alert deduplication/resolution, unchanged lifecycle, unique MRR, four-tab rendering, existing Student 360, preservation of operational DOM/actions. No historical backfill and no staging.
