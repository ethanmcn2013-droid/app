import { permanentRedirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing · Signal Studio",
  description: "Signal Studio pricing now lives at signalstudio.ie/pricing.",
  robots: { index: false },
};

const UMBRELLA_PRICING = "https://signalstudio.ie/pricing";

export default function PricingPage(): never {
  permanentRedirect(UMBRELLA_PRICING);
}
