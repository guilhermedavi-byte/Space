import "server-only";
const attempts = new Map<string, number[]>();
export function assertRateLimit(key: string, limit = 10, windowMs = 60_000) { const now = Date.now(); const recent = (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs); if (recent.length >= limit) throw new Error("Muitas tentativas. Aguarde antes de tentar novamente."); recent.push(now); attempts.set(key, recent); }
