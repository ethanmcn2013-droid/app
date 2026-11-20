import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { TimelineStates } from "./states";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timeline states · Signal Studio", robots: { index: false } };

/** Review-only: the shared timeline in every state it has to handle. */
export default async function TimelineStatesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (!isDemoMode()) notFound();
  const { state } = await searchParams;
  return <TimelineStates state={state ?? null} />;
}
