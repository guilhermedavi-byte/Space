import type { IntelligenceRow } from "@/types/database";

/** Branded canonical identity: application code must never synthesize a call id. */
export type MeetingId = string & { readonly __brand: "MeetingId" };
export type CallOutcome = "won" | "lost" | "unknown";

export type CallDetail = {
  meetingId: MeetingId;
  meeting: IntelligenceRow;
  call: IntelligenceRow | null;
  assets: IntelligenceRow[];
  transcript: IntelligenceRow | null;
  audio: IntelligenceRow | null;
  visual: IntelligenceRow | null;
  fusion: IntelligenceRow | null;
  objectionAnalysis: IntelligenceRow | null;
  objections: IntelligenceRow[];
  outcomeEnrichment: IntelligenceRow | null;
};

export function toMeetingId(value: string): MeetingId {
  const normalized = value.trim();
  if (!normalized) throw new Error("meeting_id is required");
  return normalized as MeetingId;
}

export function normalizeOutcome(value: unknown): CallOutcome {
  return value === "won" || value === "lost" ? value : "unknown";
}

/** Unknown outcomes are deliberately excluded, never folded into losses. */
export function knownOutcomeCounts(outcomes: readonly CallOutcome[]) {
  const won = outcomes.filter((outcome) => outcome === "won").length;
  const lost = outcomes.filter((outcome) => outcome === "lost").length;
  return { won, lost, known: won + lost };
}
