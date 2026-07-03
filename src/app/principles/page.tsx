import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PrinciplesManifesto } from "@/components/marketing/principles-manifesto";

export const metadata = {
  title: "Principles, Tasks",
  description:
    "The features we won't ship. No per-seat pricing, no Gantt, no AI auto-complete, no push notifications. The refusal list is the brand spine.",
  openGraph: {
    title: "What we'll never build.",
    description:
      "Eight features competitors keep asking for. We keep saying no. Here's why.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "What we'll never build.",
    description:
      "Eight features competitors keep asking for. We keep saying no.",
  },
};

export default function PrinciplesPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <PrinciplesManifesto />
      </main>
      <SiteFooter />
    </>
  );
}
