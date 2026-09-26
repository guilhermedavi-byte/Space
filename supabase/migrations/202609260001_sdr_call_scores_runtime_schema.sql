-- One-time runtime helpers for SPACE - Telnyx SDR Scoring V0.
-- Production already owns public.sdr_call_scores; keep this migration compatible
-- with the real table and keep DDL out of the recurring n8n workflow.

CREATE INDEX IF NOT EXISTS sdr_call_scores_call_leg_id_idx
  ON public.sdr_call_scores (call_leg_id)
  WHERE call_leg_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sdr_call_scores_call_session_id_idx
  ON public.sdr_call_scores (call_session_id)
  WHERE call_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sdr_call_scores_started_at_idx
  ON public.sdr_call_scores (started_at DESC)
  WHERE started_at IS NOT NULL;

CREATE OR REPLACE VIEW public.sdr_scores_summary AS
SELECT
  sdr,
  COUNT(*) AS analyzed_calls,
  ROUND(AVG(score), 1) AS avg_score_100,
  ROUND((AVG(score) / 10.0), 2) AS avg_score_10,
  ROUND(AVG(duration_seconds), 0) AS avg_duration_seconds,
  MAX(created_at) AS last_analyzed_at
FROM public.sdr_call_scores
GROUP BY sdr;
