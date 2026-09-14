import "server-only";
import { createServerDatabaseClient } from "@/lib/db/server";
import { parseIntelligenceRows } from "@/lib/validation/intelligence";
import { readNumber, readText } from "@/lib/domain/call-detail";
import type { IntelligenceRow } from "@/types/database";
export { safeRate } from "@/lib/domain/metrics";

export type ObjectionStat = { key: string; objections: number; calls: number; recovered: number; nextSteps: number; sellerCreated: number; knownOutcomes: number; won: number; averageHandlingScore: number | null };
function count(row: IntelligenceRow, ...keys: string[]) { return readNumber(row, ...keys) ?? 0; }
export async function listObjectionStats(): Promise<ObjectionStat[]> {
  const client = createServerDatabaseClient();
  const { data, error } = await client.from("n8n_sales_objection_stats_space").select("*").order("objection_count", { ascending: false });
  if (error) throw new Error(`Unable to list objection stats: ${error.message}`, { cause: error });
  return parseIntelligenceRows(data ?? []).map((row, index) => ({
    key: readText(row, "objection_category", "category", "closer", "strategy") ?? `Grupo ${index + 1}`,
    objections: count(row, "objection_count", "total_objections"), calls: count(row, "calls_count", "call_count"),
    recovered: count(row, "recovered_count"), nextSteps: count(row, "next_step_count"), sellerCreated: count(row, "seller_created_count"),
    knownOutcomes: count(row, "known_outcome_calls"), won: count(row, "won_calls"), averageHandlingScore: readNumber(row, "average_handling_score", "avg_handling_score"),
  }));
}
