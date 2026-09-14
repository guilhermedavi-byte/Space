import Link from "next/link";
import { Activity, BadgeCheck, BarChart3, BookOpen, BrainCircuit, ChartNoAxesCombined, LayoutDashboard, ListVideo, MessageSquareWarning, UsersRound } from "lucide-react";

const items = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["Calls", "/calls", ListVideo],
  ["Objeções", "/objections", MessageSquareWarning], ["Coaching", "/coaching", BrainCircuit],
  ["Closers", "/closers", UsersRound], ["Analytics", "/analytics", ChartNoAxesCombined],
  ["Playbook", "/playbook", BookOpen], ["Review Queue", "/review", BarChart3],
  ["Calibration", "/calibration", BadgeCheck],
] as const;

export function Navigation() {
  return <aside className="border-b border-line bg-panel/70 p-5 backdrop-blur lg:fixed lg:inset-y-0 lg:w-64 lg:border-b-0 lg:border-r">
    <Link href="/dashboard" className="flex items-center gap-3 text-sm font-semibold tracking-wide text-white">
      <span className="grid size-9 place-items-center rounded-xl bg-violet-500 text-white"><Activity className="size-5" /></span>
      <span>SPACE <span className="block text-xs font-normal text-zinc-500">Sales Intelligence</span></span>
    </Link>
    <nav className="mt-6 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1" aria-label="Navegação principal">
      {items.map(([label, href, Icon]) => <Link key={href} href={href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"><Icon className="size-4" />{label}</Link>)}
    </nav>
    <div className="mt-8 hidden rounded-xl border border-line bg-black/20 p-3 text-xs text-zinc-500 lg:block"><span className="mb-2 block size-2 rounded-full bg-emerald-400" />Foundation · M0</div>
  </aside>;
}
