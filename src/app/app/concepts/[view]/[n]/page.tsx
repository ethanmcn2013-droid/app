import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { CONCEPT_LOADERS, CONCEPTS } from "@/components/concepts/registry";

export const dynamic = "force-dynamic";

/**
 * One design concept from the Overview / Projects / Files concept sprint.
 * Review and demo only: concepts are front-end explorations on sample data
 * and never render in production.
 */
export default async function ConceptPage({ params }: { params: Promise<{ view: string; n: string }> }) {
  if (!isDemoMode()) notFound();
  const { view, n } = await params;
  const load = CONCEPT_LOADERS[`${view}/${n}`];
  if (!load) notFound();
  const { default: Concept } = await load();
  return <Concept />;
}

export async function generateMetadata({ params }: { params: Promise<{ view: string; n: string }> }) {
  const { view, n } = await params;
  const meta = CONCEPTS.find((entry) => entry.view === view && String(entry.n) === n);
  return { title: meta ? `${meta.title} · Concepts` : "Concepts", robots: { index: false } };
}
