"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerEnvironment } from "@/lib/env/server";
import { assertRateLimit } from "@/lib/security/rate-limit";

const decisionSchema = z.object({ meeting_id: z.string().min(1), decision: z.enum(["won", "lost", "unknown"]), sale_value: z.coerce.number().min(0).default(0) }).superRefine((value, context) => { if (value.decision === "won" && value.sale_value <= 0) context.addIssue({ code: "custom", path: ["sale_value"], message: "Informe o valor da venda para confirmar WON." }); });
export type ReviewActionState = { ok: boolean; message: string };
export async function reviewOutcome(_state: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Decisão inválida." };
  assertRateLimit(`outcome-review:${parsed.data.meeting_id}`, 5, 60_000);
  const environment = getServerEnvironment();
  const response = await fetch(environment.OUTCOME_REVIEW_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...parsed.data, note: "manual review from platform", source: "space_sales_intelligence_platform" }), cache: "no-store" });
  if (!response.ok) return { ok: false, message: `Webhook recusou a revisão (${response.status}).` };
  revalidatePath("/review"); revalidatePath(`/calls/${parsed.data.meeting_id}`); revalidatePath("/objections");
  return { ok: true, message: "Outcome revisado com sucesso." };
}
