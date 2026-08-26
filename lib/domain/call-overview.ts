import { normalizeOutcome, toMeetingId, type CallOutcome, type MeetingId } from "@/lib/domain/call";
import type { IntelligenceRow, Json } from "@/types/database";

export type CallOverview = {
  meetingId: MeetingId;
  title: string;
  lead: string | null;
  closer: string | null;
  occurredAt: string | null;
  durationSeconds: number | null;
  outcome: CallOutcome;
  saleValue: number | null;
  overallScore: number | null;
  sellerExecutionScore: number | null;
  leadQualityScore: number | null;
  sellerTalkRatio: number | null;
  primaryBottleneck: string | null;
  dominantObjection: string | null;
  needsReview: boolean;
  thumbnailUrl: string | null;
};

function first(row: IntelligenceRow, keys: readonly string[]): Json | undefined {
  return keys.map((key) => row[key]).find((value) => value !== undefined && value !== null);
}
function text(row: IntelligenceRow, keys: readonly string[]) {
  const value = first(row, keys); return typeof value === "string" && value.trim() ? value : null;
}
function number(row: IntelligenceRow, keys: readonly string[]) {
  const value = first(row, keys); return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Temporary tolerant mapper until generated live-schema types replace raw read models. */
export function toCallOverview(row: IntelligenceRow): CallOverview {
  const id = text(row, ["meeting_id"]);
  if (!id) throw new Error("Calls overview row is missing canonical meeting_id");
  const outcome = normalizeOutcome(first(row, ["outcome", "resolved_outcome", "canonical_outcome"]));
  return {
    meetingId: toMeetingId(id), title: text(row, ["title", "meeting_title"]) ?? "Call sem título",
    lead: text(row, ["lead_name", "lead"]), closer: text(row, ["closer_name", "closer", "seller_name"]),
    occurredAt: text(row, ["meeting_date", "started_at", "created_at"]), durationSeconds: number(row, ["duration_seconds", "duration"]),
    outcome, saleValue: outcome === "won" ? number(row, ["sale_value", "deal_value"]) : null,
    overallScore: number(row, ["overall_score", "call_score"]), sellerExecutionScore: number(row, ["seller_execution_score"]),
    leadQualityScore: number(row, ["lead_quality_score"]), sellerTalkRatio: number(row, ["seller_talk_ratio"]),
    primaryBottleneck: text(row, ["primary_bottleneck", "bottleneck"]), dominantObjection: text(row, ["dominant_objection_category", "dominant_objection"]),
    needsReview: first(row, ["needs_review"]) === true || first(row, ["processing_status"]) === "needs_review",
    thumbnailUrl: text(row, ["thumbnail_url"]),
  };
}
