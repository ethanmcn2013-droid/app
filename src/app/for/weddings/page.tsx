import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForWeddings } from "@/components/marketing/for-weddings";

export const metadata = {
  title: "Tasks for Weddings — Plan the Whole Day in One Workspace",
  description:
    "Vendors, RSVPs, run-of-show, vows, marriage license — one workspace, $79 once. Three editing guests free. No per-seat tax.",
  openGraph: {
    title: "Plan the wedding in one place.",
    description:
      "One workspace, $79 once. Vendors, RSVPs, run-of-show, vows. Three editing guests free.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plan the wedding in one place.",
    description: "$79 once. Three editing guests free. No per-seat tax.",
  },
};

export default function ForWeddingsPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <ForWeddings />
      </main>
      <SiteFooter />
    </>
  );
}
