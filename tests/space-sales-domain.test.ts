import assert from "node:assert/strict";
import test from "node:test";
import { knownOutcomeCounts, normalizeOutcome, toMeetingId } from "../lib/domain/call.ts";
import { formatCurrency, formatDuration, formatPercent, formatScore } from "../lib/formatters.ts";
import { safeRate } from "../lib/domain/metrics.ts";


test("meeting_id is required and preserved as the canonical call identity", () => {
  assert.equal(toMeetingId(" meet_123 "), "meet_123");
  assert.throws(() => toMeetingId("  "), /meeting_id is required/);
});

test("unknown outcomes are never counted as losses", () => {
  const outcomes = [normalizeOutcome("won"), normalizeOutcome("lost"), normalizeOutcome("unknown"), normalizeOutcome(null), normalizeOutcome("invalid")];
  assert.deepEqual(outcomes, ["won", "lost", "unknown", "unknown", "unknown"]);
  assert.deepEqual(knownOutcomeCounts(outcomes), { won: 1, lost: 1, known: 2 });
});

test("rates with no known denominator remain unavailable", () => {
  assert.equal(safeRate(0, 0), null);
  assert.equal(safeRate(2, 4), 0.5);
});

test("formatters degrade safely for missing metrics", () => {
  assert.equal(formatScore(null), "—");
  assert.equal(formatPercent(null), "—");
  assert.equal(formatPercent(0.42), "42%");
  assert.equal(formatDuration(125), "2m 5s");
  assert.match(formatCurrency(1000) ?? "", /1\.000,00/);
});

import { optionalFiniteNumber, sanitizePostgrestSearch } from "../lib/domain/search.ts";

test("call search strips PostgREST grammar before filter interpolation", () => {
  assert.equal(sanitizePostgrestSearch(" Maria,(lead).% "), "Maria lead");
  assert.equal(sanitizePostgrestSearch("x".repeat(200)).length, 120);
});

test("numeric filter parsing rejects missing and non-finite values", () => {
  assert.equal(optionalFiniteNumber(undefined), undefined);
  assert.equal(optionalFiniteNumber(""), undefined);
  assert.equal(optionalFiniteNumber("abc"), undefined);
  assert.equal(optionalFiniteNumber("42.5"), 42.5);
});
