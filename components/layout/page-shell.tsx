import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type PageShellProps = { title: string; eyebrow: string; description: string };

export function PageShell({ title, eyebrow, description }: PageShellProps) {
  return <main className="min-h-screen px-5 py-8 sm:px-8 lg:ml-64 lg:px-12 lg:py-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col justify-between gap-5 border-b border-line pb-8 sm:flex-row sm:items-end">
        <div><Badge>{eyebrow}</Badge><h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p></div>
        <div className="flex items-center gap-2 text-xs text-zinc-500"><span className="size-2 rounded-full bg-amber-400" />Aguardando conexão de dados · M1</div>
      </header>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {["Estrutura pronta", "Server-first", "Sem dados de produção"].map((item, index) => <Card key={item} className="p-5"><span className="text-xs text-zinc-600">0{index + 1}</span><h2 className="mt-8 font-medium text-zinc-200">{item}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Este espaço está preparado para receber a implementação do próximo milestone.</p></Card>)}
      </section>
    </div>
  </main>;
}
