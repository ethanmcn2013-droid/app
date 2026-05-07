import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { EmbedGuide } from "@/components/marketing/embed-guide";

export const metadata = {
  title: "Embed elsewhere — Tasks",
  description:
    "Drop a published Tasks workspace into Google Sites, Notion, an indie blog, a Substack, anywhere that takes an iframe or a script tag.",
  openGraph: {
    title: "Embed a Tasks workspace anywhere.",
    description:
      "iframe + script-tag patterns for Google Sites, Notion, Substack, blogs.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Embed a Tasks workspace anywhere.",
    description:
      "iframe + script-tag patterns. No OAuth. No Google plugin.",
  },
};

export default function EmbedGuidePage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <EmbedGuide />
      </main>
      <SiteFooter />
    </>
  );
}
