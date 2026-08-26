/**
 * Minimal database surface consumed by M1. Fields remain Json until the live
 * schema can be generated; repositories validate every boundary before use.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type IntelligenceTableName =
  | "n8n_sales_meetings_space"
  | "n8n_sales_meeting_assets_space"
  | "n8n_sales_calls_space"
  | "n8n_sales_call_analysis_space"
  | "n8n_sales_call_media_analysis_space"
  | "n8n_sales_call_audio_analysis_space"
  | "n8n_sales_call_fusion_space"
  | "n8n_sales_call_objection_analysis_space"
  | "n8n_sales_call_objections_space"
  | "n8n_sales_call_outcome_enrichment_space"
  | "n8n_sales_playbook_snapshots_space"
  | "n8n_sales_playbook_patterns_space";

export type IntelligenceRow = Record<string, Json | undefined>;
