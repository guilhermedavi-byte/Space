"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerDatabaseClient } from "@/lib/db/server";
const schema = z.object({ id: z.string().uuid(), status: z.enum(["active", "completed", "dismissed"]) });
export async function updateCoachingStatus(formData: FormData) { const value = schema.parse(Object.fromEntries(formData)); const client = createServerDatabaseClient(); const { error } = await client.rpc("app_set_coaching_status", { p_item_id: value.id, p_status: value.status, p_note: "status changed from platform" }); if (error) throw new Error(`Unable to update coaching item: ${error.message}`, { cause: error }); revalidatePath("/coaching"); }
