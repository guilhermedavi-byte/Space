/** Returns null when a rate has no valid denominator; never presents absent evidence as 0%. */
export function safeRate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
