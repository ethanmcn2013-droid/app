import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { CONCEPTS } from "@/components/concepts/registry";
import { orderConcepts } from "@/components/concepts/views";
import { ReviewGallery } from "@/components/concepts/review/review-gallery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Concepts · Signal Studio", robots: { index: false } };

/** Review-only gallery of the concepts for each view, with the concept review built in. */
export default function ConceptsGallery() {
  if (!isDemoMode()) notFound();
  return <ReviewGallery concepts={orderConcepts(CONCEPTS)} />;
}
