import Link from "next/link";
import { CallCard } from "@/components/calls/call-card";
import { listCalls } from "@/lib/repositories/calls";

type CallsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;

export default async function CallsPage({ searchParams }: CallsPageProps) {
  const params = await searchParams;
  const page = Number(one(params.page)) || 1;
  let result: Awaited<ReturnType<typeof listCalls>> | null = null;
  let errorMessage: string | null = null;
  try { result = await listCalls({ page, search: one(params.search), closer: one(params.closer), outcome: one(params.outcome) as "won" | "lost" | "unknown" | undefined, needsReview: one(params.review) === "true" ? true : undefined, sort: one(params.sort) as "newest" | "oldest" | "execution_desc" | "execution_asc" | undefined }); }
  catch (error) { errorMessage = error instanceof Error ? error.message : "Falha desconhecida"; }

  return <main className="min-h-screen px-5 py-8 lg:ml-64 lg:px-10"><div className="mx-auto max-w-7xl"><header><p className="text-xs uppercase tracking-widest text-violet-300">Biblioteca canônica</p><h1 className="mt-2 text-3xl font-semibold text-white">Calls</h1><p className="mt-2 text-sm text-zinc-500">Busca e paginação executadas no servidor. Cada call usa meeting_id.</p></header>
    <form className="mt-8 grid gap-3 rounded-2xl border border-line bg-panel p-4 md:grid-cols-5"><input name="search" defaultValue={one(params.search)} placeholder="Lead ou título" className="rounded-lg border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-500" /><input name="closer" defaultValue={one(params.closer)} placeholder="Closer" className="rounded-lg border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-500" /><select name="outcome" defaultValue={one(params.outcome) ?? ""} className="rounded-lg border border-line bg-black/30 px-3 py-2 text-sm"><option value="">Todos outcomes</option><option value="won">Won</option><option value="lost">Lost</option><option value="unknown">Unknown</option></select><select name="sort" defaultValue={one(params.sort) ?? "newest"} className="rounded-lg border border-line bg-black/30 px-3 py-2 text-sm"><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option><option value="execution_desc">Maior execução</option><option value="execution_asc">Menor execução</option></select><button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white">Filtrar</button><label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" name="review" value="true" defaultChecked={one(params.review) === "true" />Needs review</label></form>
    {errorMessage && <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6"><h2 className="font-medium text-amber-300">Dados ainda indisponíveis</h2><p className="mt-2 text-sm text-zinc-500">{errorMessage}</p></div>}
    {result?.items.length === 0 && <div className="mt-8 rounded-2xl border border-dashed border-line p-16 text-center text-sm text-zinc-500">Nenhuma call encontrada para estes filtros.</div>}
    {result && result.items.length > 0 && <><div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{result.items.map((call) => <CallCard key={call.meetingId} call={call} />)}</div><nav className="mt-8 flex items-center justify-between text-sm text-zinc-500"><span>{result.total} calls · página {result.page} de {result.totalPages}</span><div className="flex gap-2">{result.page > 1 && <Link className="rounded-lg border border-line px-3 py-2" href={{ query: { ...params, page: result.page - 1 } }}>Anterior</Link>}{result.page < result.totalPages && <Link className="rounded-lg border border-line px-3 py-2" href={{ query: { ...params, page: result.page + 1 } }}>Próxima</Link>}</div></nav></>}
  </div></main>;
}
