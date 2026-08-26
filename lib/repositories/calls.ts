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
