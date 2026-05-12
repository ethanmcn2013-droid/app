import { permanentRedirect } from "next/navigation";
import { STUDIO_URL } from "@/lib/product-urls";

/**
 * The per-product changelog is retired.
 *
 * The suite-wide changelog lives at signalstudio.ie/changelog —
 * a curated reading surface. The engineering log for Tasks still
 * lives in this repo's CHANGELOG.md.
 */
export default function ChangelogPage() {
  permanentRedirect(`${STUDIO_URL}/changelog`);
}
