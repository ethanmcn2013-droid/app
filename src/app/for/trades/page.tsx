import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForTrades } from "@/components/marketing/for-trades";

export const metadata = {
  title: "Tasks for Trades — Calls, Jobs, Invoices, One Binder",
  description:
    "A workspace for electricians, carpenters, plumbers, contractors. Calls, parts, permits, invoices — one place, no per-seat tax, no software vocabulary.",
  openGraph: {
    title: "Calls, jobs, invoices — one binder.",
    description:
      "Built for the trades. Free tier covers a one-truck route. No per-seat tax. No sprint vocabulary.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Calls, jobs, invoices — one binder.",
    description: "Free for a one-truck route. No per-seat tax.",
  },
};

export default function ForTradesPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <ForTrades />
      </main>
      <SiteFooter />
    </>
  );
}
