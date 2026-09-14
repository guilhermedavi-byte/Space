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
function nestedRows(row: IntelligenceRow | null, ...keys: string[]): IntelligenceRow[] {
  const value = readValue(row, ...keys);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is IntelligenceRow => typeof item === "object" && item !== null && !Array.isArray(item));
}
function events(rows: IntelligenceRow[], type: TimelineEvent["type"], fallback: string, prefix: string): TimelineEvent[] {
  return rows.map((row, index) => ({ id: `${prefix}-${index}`, type, timestampSeconds: seconds(row), title: readText(row, "title", "category", "event_type", "finding_type") ?? fallback, detail: readText(row, "detail", "description", "evidence", "quote", "summary") }));
}
export function buildTimeline(call: CallDetail): TimelineEvent[] {
  const timeline: TimelineEvent[] = [
    ...events(call.objections, "objection", "Objeção", "objection"),
    ...events(nestedRows(call.transcript, "evidence", "evidence_items", "timeline_events"), "evidence", "Evidência de transcript", "evidence"),
    ...events(nestedRows(call.audio, "notable_events", "audio_events"), "audio", "Evento de áudio", "audio"),
    ...events(nestedRows(call.visual, "critical_findings", "visual_findings"), "visual", "Achado visual observável", "visual"),
  ];
  const price = readNumber(call.audio, "price_moment_seconds", "price_timestamp_seconds");
  if (price != null) timeline.push({ id: "price", type: "price", timestampSeconds: price, title: "Momento de preço", detail: null });
  return timeline.sort((a, b) => (a.timestampSeconds ?? Number.MAX_SAFE_INTEGER) - (b.timestampSeconds ?? Number.MAX_SAFE_INTEGER));
}
export function recordingUrl(call: CallDetail) {
  for (const asset of call.assets) { const type = readText(asset, "asset_type", "type", "kind"); const url = readText(asset, "url", "asset_url", "recording_url", "download_url"); if (url && (!type || /video|recording/i.test(type))) return url; }
  return readText(call.meeting, "recording_url", "video_url") ?? readText(call.call, "recording_url", "video_url");
}
