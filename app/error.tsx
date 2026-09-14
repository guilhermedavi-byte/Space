"use client";
import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="grid min-h-screen place-items-center p-6 lg:ml-64"><div className="max-w-md text-center"><p className="text-sm font-medium text-violet-300">Algo saiu do fluxo</p><h1 className="mt-3 text-3xl font-semibold text-white">Não foi possível carregar esta página.</h1><p className="mt-3 text-sm text-zinc-400">A falha foi isolada. Tente novamente sem perder o restante da navegação.</p><button onClick={reset} className="mt-6 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Tentar novamente</button></div></main>;
}
