import Link from "next/link";
import type { CallOverview } from "@/lib/domain/call-overview";
import { formatCurrency, formatDate, formatDuration, formatPercent, formatScore } from "@/lib/formatters";

const outcomeLabel = { won: "Won", lost: "Lost", unknown: "Unknown" } as const;
export function CallCard({ call }: { call: CallOverview }) {
  return <Link href={`/calls/${encodeURIComponent(call.meetingId)}`} className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-violet-400/40">
    <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-violet-950 via-zinc-900 to-black">
      {call.thumbnailUrl ? <img src={call.thumbnailUrl} alt="Frame representativo da call" className="size-full object-cover transition group-hover:scale-[1.02]" /> : <div className="grid size-full place-items-center text-center text-xs text-zinc-600"><span><b className="block text-2xl text-zinc-700">SPACE</b>Thumbnail indisponível</span></div>}
      <span className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2 py-1 text-xs text-white">{formatDuration(call.durationSeconds)}</span>
    </div>
    <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="line-clamp-1 font-medium text-white">{call.lead ?? call.title}</h2><p className="mt-1 text-xs text-zinc-500">{call.closer ?? "Closer não informado"} · {formatDate(call.occurredAt)}</p></div><span className="rounded-full border border-line px-2 py-1 text-[10px] uppercase text-zinc-400">{outcomeLabel[call.outcome]}</span></div>
    {call.outcome === "won" && <p className="mt-3 text-sm font-medium text-emerald-400">{formatCurrency(call.saleValue) ?? "Valor não informado"}</p>}
    <div className="mt-5 grid grid-cols-4 gap-2 border-y border-line py-4 text-center"><Metric label="Overall" value={formatScore(call.overallScore)} /><Metric label="Execução" value={formatScore(call.sellerExecutionScore)} /><Metric label="Lead" value={formatScore(call.leadQualityScore)} /><Metric label="Talk" value={formatPercent(call.sellerTalkRatio)} /></div>
    <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500"><span className="rounded bg-white/5 px-2 py-1">{call.primaryBottleneck ?? "Bottleneck indisponível"}</span><span className="rounded bg-white/5 px-2 py-1">{call.dominantObjection ?? "Sem objeção dominante"}</span>{call.needsReview && <span className="rounded bg-amber-400/10 px-2 py-1 text-amber-300">Needs review</span>}</div></div>
  </Link>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div><strong className="block text-sm text-zinc-200">{value}</strong><span className="text-[10px] text-zinc-600">{label}</span></div>; }
