import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
export const metadata: Metadata = { title: "Closers" };
export default function Page() { return <PageShell eyebrow="Desempenho com contexto" title="Closers" description="Métricas individuais serão acompanhadas por tamanho de amostra e avisos de confiança." />; }
