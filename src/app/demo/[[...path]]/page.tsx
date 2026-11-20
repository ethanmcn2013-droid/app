import { notFound } from "next/navigation";
import { DemoShell } from "@/components/concepts/demo/shell";
import { resolveSurface, surfaceTitle } from "@/components/concepts/demo/surfaces";
import { isDemoMode } from "@/lib/access-mode";

export const dynamic = "force-dynamic";

export default async function DemoPage({ params }: { params: Promise<{ path?: string[] }> }) {
  if (!isDemoMode()) notFound();
  const { path = [] } = await params;
  const hit = resolveSurface(path);
  if (!hit) notFound();
  const { default: Surface } = await hit.entry.load();
  return (
    <DemoShell surface={hit.entry.surface} sub={hit.sub}>
      <Surface sub={hit.sub} />
    </DemoShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const hit = resolveSurface(path);
  return { title: hit ? `${surfaceTitle(hit.entry, hit.sub)} · Signal Studio` : "Signal Studio", robots: { index: false } };
}
