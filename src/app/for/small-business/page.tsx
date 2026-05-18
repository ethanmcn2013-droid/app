import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForSmallBusiness } from "@/components/marketing/for-small-business";

export const metadata = {
  title: "Tasks for small business — The shop, the books, the people, one place.",
  description:
    "A workspace for restaurants, shops, clinics, studios. Operations, payroll, marketing, supplier orders — without a status meeting or a manager to surface what's slipping.",
  openGraph: {
    title: "The shop, the books, the people — one place.",
    description:
      "Built for small business. Free tier covers the operator. No per-seat tax. No project-manager vocabulary.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The shop, the books, the people — one place.",
    description: "Free for the operator. No per-seat tax.",
  },
};

export default function ForSmallBusinessPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <ForSmallBusiness />
      </main>
      <SiteFooter />
    </>
  );
}
