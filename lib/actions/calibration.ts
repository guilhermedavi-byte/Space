"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerDatabaseClient } from "@/lib/db/server";
const check = z.enum(["pass", "fail", "unknown"]); const schema = z.object({ meeting_id: z.string().min(1), reviewer: z.string().min(2), speaker_mapping: check, talk_ratio: check, objections: check, timeline_alignment: check, crm_outcome: check, thumbnail_quality: check, notes: z.string().max(4000).optional() });
export async function createCalibrationAudit(formData: FormData) { const audit = schema.parse(Object.fromEntries(formData)); const client = createServerDatabaseClient(); const { error } = await client.from("app_call_calibration_audits").insert(audit); if (error) throw new Error(`Unable to save calibration audit: ${error.message}`, { cause: error }); revalidatePath("/calibration"); }
