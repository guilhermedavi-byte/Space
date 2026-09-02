import { notFound } from "next/navigation";
import { IntelligencePanel } from "@/components/call-detail/intelligence-panel";
import { ReviewWorkspace } from "@/components/call-detail/review-workspace";
import { buildTimeline, readNumber, readText, recordingUrl } from "@/lib/domain/call-detail";
import { normalizeOutcome } from "@/lib/domain/call";
import { formatCurrency, formatDate, formatDuration, formatPercent, formatScore } from "@/lib/formatters";
import { CallsRepository } from "@/lib/repositories/calls";

type CallPageProps = { params: Promise<{ meetingId: string }> };
export default async function CallPage({ params }: CallPageProps) {
  const { meetingId } = await params; const call = await new CallsRepository().findByMeetingId(meetingId); if (!call) return notFound();
  const outcome = normalizeOutcome(readText(call.outcomeEnrichment, "resolved_outcome", "outcome") ?? readText(call.call, "outcome"));
  const title = readText(call.meeting, "lead_name", "lead", "title") ?? call.meetingId;
  const saleValue = outcome === "won" ? readNumber(call.outcomeEnrichment, "sale_value") ?? readNumber(call.call, "sale_value") : null;
  const summary = readText(call.fusion, "executive_summary", "summary") ?? readText(call.transcript, "executive_summary", "summary");
  return <main className="min-h-screen px-5 py-8 lg:ml-64 lg:px-10"><div className="mx-auto max-w-7xl"><header className="border-b border-line pb-7"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full border border-line px-2 py-1 uppercase text-zinc-400">{outcome}</span>{call.outcomeEnrichment?.processing_status === "needs_review" && <span className="rounded-full bg-amber-400/10 px-2 py-1 text-amber-300">Needs review</span>}</div><h1 className="mt-4 text-3xl font-semibold text-white">{String(title)}</h1><p className="mt-2 break-all text-xs text-zinc-600">meeting_id: {call.meetingId}</p><div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6"><Metric label="Closer" value={readText(call.meeting, "closer", "closer_name") ?? "—"} /><Metric label="Data" value={formatDate(readText(call.meeting, "meeting_date", "started_at"))} /><Metric label="Duração" value={formatDuration(readNumber(call.call, "duration_seconds"))} /><Metric label="Overall" value={formatScore(readNumber(call.fusion, "overall_score"))} /><Metric label="Execução" value={formatScore(readNumber(call.fusion, "seller_execution_score"))} /><Metric label="Lead" value={formatScore(readNumber(call.fusion, "lead_quality_score"))} /></div>{saleValue != null && <p className="mt-5 text-sm font-medium text-emerald-400">Venda: {formatCurrency(saleValue)}</p>}</header>
    <div className="mt-8"><ReviewWorkspace mediaUrl={recordingUrl(call)} timeline={buildTimeline(call)} /></div>
    <section className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-400/[.04] p-6"><p className="text-xs uppercase tracking-wide text-violet-300">Intelligence summary</p><p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-300">{summary ?? "Resumo executivo ainda não disponível para esta call."}</p><div className="mt-4 text-xs text-zinc-500">Talk ratio do seller: {formatPercent(readNumber(call.audio, "seller_talk_ratio"))} · Bottleneck: {readText(call.fusion, "primary_bottleneck") ?? "indisponível"}</div></section>
    <div className="mt-6 grid gap-5 lg:grid-cols-2"><IntelligencePanel title="Fusion e scores" data={call.fusion} empty="Fusion ainda não processada." /><IntelligencePanel title="Áudio" data={call.audio} empty="Análise de áudio ausente." /><IntelligencePanel title="Visual observável" data={call.visual} empty="Análise visual ausente." /><IntelligencePanel title="Transcript intelligence" data={call.transcript} empty="Transcript intelligence ausente." /><IntelligencePanel title="Objection intelligence" data={call.objectionAnalysis} empty="Análise de objeções ausente." /></div>
  </div></main>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div><span className="text-[10px] uppercase text-zinc-600">{label}</span><strong className="mt-1 block text-sm font-medium text-zinc-300">{value}</strong></div>; }
