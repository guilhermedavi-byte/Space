export function formatScore(value: number | null) { return value == null ? "—" : Math.round(value).toString(); }
export function formatPercent(value: number | null) { if (value == null) return "—"; return `${Math.round(value <= 1 ? value * 100 : value)}%`; }
export function formatDuration(seconds: number | null) { if (seconds == null) return "—"; const minutes = Math.floor(seconds / 60); return `${minutes}m ${Math.round(seconds % 60)}s`; }
export function formatDate(value: string | null) { if (!value) return "Data indisponível"; const date = new Date(value); return Number.isNaN(date.valueOf()) ? "Data indisponível" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date); }
export function formatCurrency(value: number | null) { return value == null ? null : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
