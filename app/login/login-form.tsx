"use client";
import { useActionState } from "react";
import { login, type LoginState } from "@/lib/actions/auth";
const initial: LoginState = { error: "" };
export function LoginForm() { const [state, action, pending] = useActionState(login, initial); return <form action={action} className="mt-7"><label className="text-xs text-zinc-500">Token de acesso<input required type="password" name="access_token" autoComplete="current-password" className="mt-2 block w-full rounded-lg border border-line bg-black/30 px-3 py-3 text-white outline-none focus:border-violet-500" /></label><button disabled={pending} className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "Validando…" : "Entrar"}</button>{state.error && <p className="mt-3 text-sm text-rose-300" role="alert">{state.error}</p>}</form>; }
