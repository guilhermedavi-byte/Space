import { notFound } from "next/navigation";
import { CallsRepository } from "@/lib/repositories/calls";

type DebugCallPageProps = { params: Promise<{ meetingId: string }> };

export default async function DebugCallPage({ params }: DebugCallPageProps) {
  const { meetingId } = await params;
  const call = await new CallsRepository().findByMeetingId(meetingId);
  if (!call) return notFound();

  const modalityStatus = [
    ["Transcript", call.transcript], ["Audio", call.audio], ["Visual", call.visual],
    ["Fusion", call.fusion], ["Objection analysis", call.objectionAnalysis],
  ] as const;

  return <main className="min-h-screen p-8 lg:ml-64 lg:p-12"><div className="mx-auto max-w-4xl"><p className="text-xs uppercase tracking-widest text-violet-300">M1 · server-side debug</p><h1 className="mt-3 break-all text-3xl font-semibold text-white">{call.meetingId}</h1><p className="mt-2 text-sm text-zinc-500">Identidade canônica preservada; nenhuma credencial é enviada ao browser.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{modalityStatus.map(([label, value]) => <div className="rounded-xl border border-line bg-panel p-4" key={label}><span className="text-sm text-zinc-300">{label}</span><strong className={value ? "float-right text-emerald-400" : "float-right text-zinc-600"}>{value ? "available" : "missing"}</strong></div>)}</div><details className="mt-8 rounded-xl border border-line bg-panel p-5"><summary className="cursor-pointer text-sm text-zinc-300">Raw validated server result</summary><pre className="mt-5 overflow-auto whitespace-pre-wrap text-xs text-zinc-500">{JSON.stringify(call, null, 2)}</pre></details></div></main>;
}
