import type { IntelligenceRow } from "@/types/database";

export function IntelligencePanel({ title, data, empty }: { title: string; data: IntelligenceRow | null; empty: string }) {
  if (!data) return <section className="rounded-2xl border border-dashed border-line p-6"><h2 className="font-medium text-zinc-300">{title}</h2><p className="mt-3 text-sm text-zinc-600">{empty}</p></section>;
  const entries = Object.entries(data).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 12);
  return <section className="rounded-2xl border border-line bg-panel p-6"><h2 className="font-medium text-white">{title}</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2">{entries.map(([key, value]) => <div key={key} className="border-l border-line pl-3"><dt className="text-[10px] uppercase tracking-wide text-zinc-600">{key.replaceAll("_", " ")}</dt><dd className="mt-1 text-sm text-zinc-300">{String(value)}</dd></div>)}</dl><details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-xs text-zinc-500">Evidência bruta validada</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-zinc-600">{JSON.stringify(data, null, 2)}</pre></details></section>;
}
