import { permanentRedirect } from "next/navigation";
import { STUDIO_URL } from "@/lib/product-urls";

/**
 * The per-product changelog route 308s to the suite dispatch at
 * signalstudio.ie/dispatch — one reading surface for the suite, in
 * operator voice (Studio BRAND.md §6.5). The engineering log for
 * Tasks still lives in this repo's CHANGELOG.md.
 */
export default function ChangelogPage() {
  permanentRedirect(`${STUDIO_URL}/dispatch`);
}
