import { z } from "zod";
import type { IntelligenceRow } from "@/types/database";

const intelligenceRowSchema = z.record(z.string(), z.json().optional());

export function parseIntelligenceRow(value: unknown): IntelligenceRow {
  return intelligenceRowSchema.parse(value) as IntelligenceRow;
}

export function parseNullableIntelligenceRow(value: unknown): IntelligenceRow | null {
  return value == null ? null : parseIntelligenceRow(value);
}

export function parseIntelligenceRows(value: unknown): IntelligenceRow[] {
  return z.array(intelligenceRowSchema).parse(value) as IntelligenceRow[];
}
