import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
export const metadata: Metadata = { title: "Playbook" };
export default function Page() { return <PageShell eyebrow="Hipóteses e padrões" title="Playbook" description="Snapshots existentes serão exibidos com confiança e limitações sempre visíveis." />; }
