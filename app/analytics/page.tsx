import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
export const metadata: Metadata = { title: "Analytics" };
export default function Page() { return <PageShell eyebrow="Análise gerencial" title="Analytics" description="Comparações entre execução, qualidade do lead e outcomes serão construídas sem inferir causalidade." />; }
