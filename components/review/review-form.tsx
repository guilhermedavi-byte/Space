"use client";
import { useActionState } from "react";
import { reviewOutcome, type ReviewActionState } from "@/lib/actions/review-outcome";
const initialState: ReviewActionState = { ok: false, message: "" };
export function ReviewForm({ meetingId }: { meetingId: string }) {
  const [state, action, pending] = useActionState(reviewOutcome, initialState);
  return <form action={action} className="mt-5 border-t border-line pt-5"><input type="hidden" name="meeting_id" value={meetingId} /><label className="text-xs text-zinc-500">Valor da venda (obrigatório para WON)<input name="sale_value" type="number" min="0" step="0.01" defaultValue="0" className="mt-2 block w-full rounded-lg border border-line bg-black/30 px-3 py-2 text-sm text-white" /></label><div className="mt-4 grid grid-cols-3 gap-2"><button disabled={pending} name="decision" value="won" className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-300 disabled:opacity-40">Confirmar WON</button><button disabled={pending} name="decision" value="lost" className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-300 disabled:opacity-40">Confirmar LOST</button><button disabled={pending} name="decision" value="unknown" className="rounded-lg bg-zinc-500/15 px-3 py-2 text-xs font-medium text-zinc-300 disabled:opacity-40">Manter UNKNOWN</button></div>{state.message && <p role="status" className={`mt-3 text-xs ${state.ok ? "text-emerald-400" : "text-amber-300"}`}>{state.message}</p>}</form>;
}
