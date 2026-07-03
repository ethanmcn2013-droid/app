import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForCommunity } from "@/components/marketing/for-community";

export const metadata = {
  title: "Tasks for community coordinators · Coordinating people who don't work for you",
  description:
    "A workspace for teachers, school admins, coaches, parish coordinators, community organisers. Visibility into other people's commitments, without making volunteers learn software.",
  openGraph: {
    title: "Coordinating people who don't work for you.",
    description:
      "Built for teachers, coaches, parish coordinators, community organisers. Free tier covers the coordinator. No per-seat tax.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coordinating people who don't work for you.",
    description: "Free for the coordinator. No per-seat tax.",
  },
};

export default function ForCommunityPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <ForCommunity />
      </main>
      <SiteFooter />
    </>
  );
}
