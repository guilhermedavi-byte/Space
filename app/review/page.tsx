import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
export const metadata: Metadata = { title: "Review Queue" };
export default function Page() { return <PageShell eyebrow="Validação humana" title="Review Queue" description="Outcomes ambíguos serão revisados por uma integração server-side com o webhook existente." />; }
