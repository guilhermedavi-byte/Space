"use server";
import { redirect } from "next/navigation";
import { createAdminSession, validateAccessToken } from "@/lib/auth/session";
export type LoginState = { error: string };
export async function login(_state: LoginState, formData: FormData): Promise<LoginState> { const token = String(formData.get("access_token") ?? ""); if (!validateAccessToken(token)) return { error: "Acesso inválido." }; await createAdminSession(); redirect("/dashboard"); return { error: "" }; }
