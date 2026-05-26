import { permanentRedirect } from "next/navigation";

export const metadata = {
  title: "Wedding Planning Workspace - Signal Studio",
  description:
    "The canonical self-serve wedding workspace now lives on Signal Studio.",
  alternates: {
    canonical: "https://signalstudio.ie/weddings",
  },
  openGraph: {
    title: "Wedding Planning Workspace - Signal Studio",
    description:
      "Plan one wedding without building a system first.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wedding Planning Workspace - Signal Studio",
    description: "Plan one wedding without building a system first.",
  },
};

export default function ForWeddingsPage() {
  permanentRedirect("https://signalstudio.ie/weddings");
}
