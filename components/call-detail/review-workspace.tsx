"use client";
import { useRef, useState } from "react";
import type { TimelineEvent } from "@/lib/domain/call-detail";
import { formatDuration } from "@/lib/formatters";

export function ReviewWorkspace({ mediaUrl, timeline }: { mediaUrl: string | null; timeline: TimelineEvent[] }) {
  const player = useRef<HTMLVideoElement>(null); const [time, setTime] = useState(0);
  function seek(timestamp: number | null) { if (timestamp == null || !player.current) return; player.current.currentTime = timestamp; player.current.play().catch(() => undefined); }
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]"><section className="overflow-hidden rounded-2xl border border-line bg-black">
    {mediaUrl ? <video ref={player} src={mediaUrl} controls preload="metadata" className="aspect-video w-full" onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}>Seu navegador não suporta reprodução de vídeo.</video> : <div className="grid aspect-video place-items-center text-center text-sm text-zinc-600"><span><b className="mb-2 block text-zinc-400">Mídia indisponível</b>Use o link da gravação de origem quando disponível.</span></div>}
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-zinc-500"><span>Timestamp atual: {formatDuration(time)}</span>{mediaUrl && <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">Abrir fonte</a>}</div>
  </section><section className="rounded-2xl border border-line bg-panel p-5"><h2 className="font-medium text-white">Timeline unificada</h2><p className="mt-1 text-xs text-zinc-600">Eventos em ordem cronológica</p><div className="mt-5 max-h-[420px] space-y-2 overflow-auto">{timeline.length ? timeline.map((event) => <button key={event.id} onClick={() => seek(event.timestampSeconds)} disabled={event.timestampSeconds == null} className="block w-full rounded-xl border border-line p-3 text-left hover:bg-white/[.03] disabled:cursor-default"><span className="text-[10px] uppercase text-violet-300">{event.type} · {event.timestampSeconds == null ? "sem timestamp" : formatDuration(event.timestampSeconds)}</span><strong className="mt-1 block text-sm text-zinc-200">{event.title}</strong>{event.detail && <span className="mt-1 line-clamp-2 block text-xs text-zinc-500">{event.detail}</span>}</button>) : <p className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-zinc-600">Nenhum evento com evidência disponível.</p>}</div></section></div>;
}
