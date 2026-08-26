import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
export const metadata: Metadata = { title: "Dashboard" };
export default function Page() { return <PageShell eyebrow="Visão operacional" title="Dashboard" description="A fundação do cockpit comercial está pronta. KPIs e visualizações entram somente nos milestones definidos." />; }
