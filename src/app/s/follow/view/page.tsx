import { notFound } from "next/navigation";
import { resolveGuestSubscriber } from "@/modules/timeline/server/guest-http";
import { createGuestSubscriberLinks, guestEmailHint, verifyGuestSubscriberProof } from "@/modules/timeline/server/guest-services";
import { SharedTimelineArtifact } from "@/modules/timeline/app/audience/shared-timeline-artifact";
import { TIMELINE_PUBLIC_ORIGIN } from "@/lib/product-urls";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function Page({ searchParams }: {
  searchParams: Promise<{ proof?: string }>;
}) {
  const { proof } = await searchParams;
  if (!proof) notFound();
  const current = await resolveGuestSubscriber(proof, "view");
  const verified = verifyGuestSubscriberProof(proof, process.env.TIMELINE_FOLLOW_SIGNING_SECRET, "view");
  if (!current || !verified) notFound();
  const unsubscribe = createGuestSubscriberLinks({
    secret: process.env.TIMELINE_FOLLOW_SIGNING_SECRET, origin: TIMELINE_PUBLIC_ORIGIN,
  }).deliveryLink({ subscriptionId: current.subscription.id, purpose: "unsubscribe", expiresAt: verified.expiresAt });
  const unsubscribeProof = new URL(unsubscribe).searchParams.get("proof");
  if (!unsubscribeProof) notFound();
  return <SharedTimelineArtifact timeline={current.dto} subscriber={{
    emailHint: guestEmailHint(current.subscription.email), unsubscribeProof,
  }} />;
}
