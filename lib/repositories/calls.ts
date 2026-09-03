import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toMeetingId, type CallDetail, type MeetingId } from "@/lib/domain/call";
import { createServerDatabaseClient } from "@/lib/db/server";
import { parseIntelligenceRow, parseIntelligenceRows, parseNullableIntelligenceRow } from "@/lib/validation/intelligence";
import type { IntelligenceTableName } from "@/types/database";

type QueryKey = "meeting_id" | "call_id";

async function fetchOne(client: SupabaseClient, table: IntelligenceTableName, key: QueryKey, meetingId: MeetingId) {
  const { data, error } = await client.from(table).select("*").eq(key, meetingId).maybeSingle();
  if (error) throw new Error(`Unable to read ${table}: ${error.message}`, { cause: error });
  return parseNullableIntelligenceRow(data);
}

async function fetchMany(client: SupabaseClient, table: IntelligenceTableName, key: QueryKey, meetingId: MeetingId) {
  const { data, error } = await client.from(table).select("*").eq(key, meetingId);
  if (error) throw new Error(`Unable to read ${table}: ${error.message}`, { cause: error });
  return parseIntelligenceRows(data ?? []);
}

export class CallsRepository {
  constructor(private readonly client: SupabaseClient = createServerDatabaseClient()) {}

  async findByMeetingId(rawMeetingId: string): Promise<CallDetail | null> {
    const meetingId = toMeetingId(rawMeetingId);
    const meetingResult = await fetchOne(this.client, "n8n_sales_meetings_space", "meeting_id", meetingId);
    if (!meetingResult) return null;

    const [call, assets, transcript, audio, visual, fusion, objectionAnalysis, objections, outcomeEnrichment] = await Promise.all([
      fetchOne(this.client, "n8n_sales_calls_space", "meeting_id", meetingId),
      fetchMany(this.client, "n8n_sales_meeting_assets_space", "meeting_id", meetingId),
      fetchOne(this.client, "n8n_sales_call_analysis_space", "call_id", meetingId),
      fetchOne(this.client, "n8n_sales_call_audio_analysis_space", "call_id", meetingId),
      fetchOne(this.client, "n8n_sales_call_media_analysis_space", "call_id", meetingId),
      fetchOne(this.client, "n8n_sales_call_fusion_space", "call_id", meetingId),
      fetchOne(this.client, "n8n_sales_call_objection_analysis_space", "call_id", meetingId),
      fetchMany(this.client, "n8n_sales_call_objections_space", "call_id", meetingId),
      fetchOne(this.client, "n8n_sales_call_outcome_enrichment_space", "meeting_id", meetingId),
    ]);

    return { meetingId, meeting: parseIntelligenceRow(meetingResult), call, assets, transcript, audio, visual, fusion, objectionAnalysis, objections, outcomeEnrichment };
  }
}

export type CallsListFilters = {
  page?: number; pageSize?: number; search?: string; closer?: string;
  outcome?: "won" | "lost" | "unknown"; needsReview?: boolean;
  sort?: "newest" | "oldest" | "execution_desc" | "execution_asc";
};

export async function listCalls(filters: CallsListFilters = {}) {
  const client = createServerDatabaseClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 12));
  const from = (page - 1) * pageSize;
  let query = client.from("v_calls_overview").select("*", { count: "exact" });
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,lead.ilike.%${filters.search}%`);
  if (filters.closer) query = query.eq("closer", filters.closer);
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.needsReview !== undefined) query = query.eq("needs_review", filters.needsReview);
  const sort = filters.sort ?? "newest";
  const sortColumn = sort.startsWith("execution") ? "seller_execution_score" : "date";
  const ascending = sort === "oldest" || sort === "execution_asc";
  const { data, error, count } = await query.order(sortColumn, { ascending, nullsFirst: false }).range(from, from + pageSize - 1);
  if (error) throw new Error(`Unable to list calls: ${error.message}`, { cause: error });
  const rows = parseIntelligenceRows(data ?? []);
  const { toCallOverview } = await import("@/lib/domain/call-overview");
  return { items: rows.map(toCallOverview), page, pageSize, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)) };
}
