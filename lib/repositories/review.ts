import "server-only";
import { createServerDatabaseClient } from "@/lib/db/server";
import { parseIntelligenceRows } from "@/lib/validation/intelligence";
import { readNumber, readText, readValue } from "@/lib/domain/call-detail";

export type ReviewQueueItem = { meetingId: string; meeting: string; lead: string | null; closer: string | null; callDate: string | null; suggestedLead: string | null; leadMatchScore: number | null; suggestedBusiness: string | null; businessStatus: string | null; suggestedOutcome: string | null; confidence: number | null; reason: string | null; candidates: unknown };
export async function listReviewQueue(): Promise<ReviewQueueItem[]> {
  const client = createServerDatabaseClient();
  const { data, error } = await client.from("n8n_sales_call_outcome_enrichment_space").select("*").eq("processing_status", "needs_review").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Unable to load review queue: ${error.message}`, { cause: error });
  return parseIntelligenceRows(data ?? []).flatMap((row) => {
    const meetingId = readText(row, "meeting_id"); if (!meetingId) return [];
    return [{ meetingId, meeting: readText(row, "meeting_title", "title") ?? meetingId, lead: readText(row, "lead_name", "lead"), closer: readText(row, "closer", "closer_name"), callDate: readText(row, "call_date", "meeting_date"), suggestedLead: readText(row, "crm_suggested_lead", "matched_lead_name"), leadMatchScore: readNumber(row, "lead_match_score"), suggestedBusiness: readText(row, "crm_suggested_business", "business_name"), businessStatus: readText(row, "business_status"), suggestedOutcome: readText(row, "resolved_outcome", "suggested_outcome"), confidence: readNumber(row, "match_confidence", "confidence"), reason: readText(row, "resolution_reason"), candidates: readValue(row, "raw_candidate_summary", "candidates") ?? null }];
  });
}
