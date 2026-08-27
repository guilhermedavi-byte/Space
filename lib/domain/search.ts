/** Removes PostgREST filter grammar characters before interpolation in an `or` expression. */
export function sanitizePostgrestSearch(value: string): string {
  return value.trim().replace(/[,%().]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function optionalFiniteNumber(value: string | undefined): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
