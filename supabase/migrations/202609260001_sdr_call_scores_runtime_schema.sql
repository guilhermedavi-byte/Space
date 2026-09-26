-- One-time schema for SPACE - Telnyx SDR Scoring V0.
-- Keeps DDL out of the recurring n8n runtime workflow.

CREATE TABLE IF NOT EXISTS public.sdr_call_scores (
  recording_id TEXT PRIMARY KEY,
  call_leg_id TEXT,
  call_session_id TEXT,
  connection_id TEXT,
  sdr TEXT NOT NULL,
  from_number TEXT,
  to_number TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds NUMERIC,
  recording_url TEXT,
  transcript TEXT,
  score NUMERIC,
  result TEXT,
  analysis JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sdr_call_scores_status_updated_at_idx
  ON public.sdr_call_scores (status, updated_at DESC);

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
  COUNT(*) FILTER (WHERE status = 'complete') AS analyzed_calls,
  ROUND(AVG(score) FILTER (WHERE status = 'complete'), 1) AS avg_score_100,
  ROUND((AVG(score) FILTER (WHERE status = 'complete') / 10.0), 2) AS avg_score_10,
  ROUND(AVG(duration_seconds) FILTER (WHERE status = 'complete'), 0) AS avg_duration_seconds,
  MAX(updated_at) FILTER (WHERE status = 'complete') AS last_analyzed_at
FROM public.sdr_call_scores
GROUP BY sdr;
