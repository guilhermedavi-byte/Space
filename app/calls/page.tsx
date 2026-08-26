import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
export const metadata: Metadata = { title: "Calls" };
export default function Page() { return <PageShell eyebrow="Biblioteca canônica" title="Calls" description="Todas as calls serão endereçadas exclusivamente por meeting_id. A conexão com os read models pertence ao M1." />; }
