import { notFound } from "next/navigation";
import { SnapshotView } from "@/components/playbook/snapshot-view";
import { getPlaybookSnapshot } from "@/lib/repositories/playbook";
type Props = { params: Promise<{ snapshotId: string }> };
export default async function HistoricalSnapshotPage({ params }: Props) { const { snapshotId } = await params; const snapshot = await getPlaybookSnapshot(decodeURIComponent(snapshotId)); if (!snapshot) return notFound(); return <main className="min-h-screen px-5 py-8 lg:ml-64 lg:px-10"><div className="mx-auto max-w-7xl"><SnapshotView snapshot={snapshot} /></div></main>; }
