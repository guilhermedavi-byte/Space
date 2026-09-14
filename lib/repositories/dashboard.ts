import "server-only";
import { createServerDatabaseClient } from "@/lib/db/server";
import { parseIntelligenceRows } from "@/lib/validation/intelligence";
import { readNumber, readText } from "@/lib/domain/call-detail";

export type DashboardKpis = { calls: number; known: number; won: number; lost: number; winRate: number | null; sellerExecution: number | null; leadQuality: number | null; discovery: number | null; objectionHandling: number | null; sellerTalkRatio: number | null; longestMonologue: number | null; needsReview: number };
export async function getDashboardKpis(): Promise<DashboardKpis> {
  const client = createServerDatabaseClient(); const { data, error } = await client.from("v_dashboard_kpis").select("*").maybeSingle();
  if (error) throw new Error(`Unable to load dashboard KPIs: ${error.message}`, { cause: error });
  const row = parseIntelligenceRows(data ? [data] : [])[0] ?? {}; const n = (...keys: string[]) => readNumber(row, ...keys);
  const won = n("won_calls", "won") ?? 0; const lost = n("lost_calls", "lost") ?? 0; const known = won + lost;
  return { calls: n("calls_count", "total_calls") ?? 0, known, won, lost, winRate: known ? won / known : null, sellerExecution: n("average_seller_execution", "avg_seller_execution_score"), leadQuality: n("average_lead_quality", "avg_lead_quality_score"), discovery: n("average_discovery", "avg_discovery_score"), objectionHandling: n("average_objection_handling", "avg_objection_handling_score"), sellerTalkRatio: n("average_seller_talk_ratio", "avg_seller_talk_ratio"), longestMonologue: n("average_longest_seller_monologue", "avg_longest_seller_monologue"), needsReview: n("needs_review_count", "calls_needing_review") ?? 0 };
}
export type DashboardSeriesItem = { label: string; calls: number; won: number; lost: number };
export async function getCallVolumeSeries(): Promise<DashboardSeriesItem[]> {
  const client = createServerDatabaseClient(); const { data, error } = await client.from("v_calls_overview").select("date,outcome").order("date", { ascending: true }).limit(1000);
  if (error) return [];
  const buckets = new Map<string, DashboardSeriesItem>();
  for (const row of parseIntelligenceRows(data ?? [])) { const raw = readText(row, "date"); if (!raw) continue; const label = raw.slice(0, 10); const item = buckets.get(label) ?? { label, calls: 0, won: 0, lost: 0 }; item.calls++; const outcome = readText(row, "outcome"); if (outcome === "won") item.won++; if (outcome === "lost") item.lost++; buckets.set(label, item); }
  return [...buckets.values()].slice(-14);
}
