import { permanentRedirect } from "next/navigation";
import { STUDIO_URL } from "@/lib/product-urls";

/**
 * The press kit is now suite-wide on the umbrella.
 * Tasks's /press route 308s to signalstudio.ie/press.
 */
export default function PressPage() {
  permanentRedirect(`${STUDIO_URL}/press`);
}
