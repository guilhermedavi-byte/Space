import type { CallDetail } from "@/lib/domain/call";
import type { IntelligenceRow, Json } from "@/types/database";

export type TimelineEvent = { id: string; type: "objection" | "evidence" | "audio" | "visual" | "price"; timestampSeconds: number | null; title: string; detail: string | null };

export function readValue(row: IntelligenceRow | null, ...keys: string[]): Json | undefined {
  if (!row) return undefined;
  return keys.map((key) => row[key]).find((value) => value !== null && value !== undefined);
}
export function readText(row: IntelligenceRow | null, ...keys: string[]) { const value = readValue(row, ...keys); return typeof value === "string" && value.trim() ? value : null; }
export function readNumber(row: IntelligenceRow | null, ...keys: string[]) { const value = readValue(row, ...keys); return typeof value === "number" && Number.isFinite(value) ? value : null; }

function seconds(row: IntelligenceRow) { return readNumber(row, "timestamp_seconds", "start_seconds", "time_seconds", "timestamp"); }
export function buildTimeline(call: CallDetail): TimelineEvent[] {
  const objections = call.objections.map((row, index): TimelineEvent => ({ id: `objection-${index}`, type: "objection", timestampSeconds: seconds(row), title: readText(row, "category", "objection_category") ?? "Objeção", detail: readText(row, "verbatim_quote", "stated_objection", "quote") }));
  const price = readNumber(call.audio, "price_moment_seconds", "price_timestamp_seconds");
  if (price != null) objections.push({ id: "price", type: "price", timestampSeconds: price, title: "Momento de preço", detail: null });
  return objections.sort((a, b) => (a.timestampSeconds ?? Number.MAX_SAFE_INTEGER) - (b.timestampSeconds ?? Number.MAX_SAFE_INTEGER));
}
export function recordingUrl(call: CallDetail) {
  for (const asset of call.assets) { const type = readText(asset, "asset_type", "type", "kind"); const url = readText(asset, "url", "asset_url", "recording_url", "download_url"); if (url && (!type || /video|recording/i.test(type))) return url; }
  return readText(call.meeting, "recording_url", "video_url") ?? readText(call.call, "recording_url", "video_url");
}
