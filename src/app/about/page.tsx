import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { AboutManifesto } from "@/components/marketing/about-manifesto";

export const metadata = {
  title: "About — Tasks",
  description:
    "Project management shouldn't be behind a paywall or a knowledge gap. We cut the jargon and make planning accessible to everyone.",
  openGraph: {
    title: "Project management shouldn't be behind a paywall.",
    description:
      "We strip out sprints, epics, tickets — the whole jargon liturgy — and leave a tool anyone can open.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Project management shouldn't be behind a paywall.",
    description:
      "We strip out sprints, epics, tickets — and leave a tool anyone can open.",
  },
};

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <AboutManifesto />
      </main>
      <SiteFooter />
    </>
  );
}
