import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForFreelancers } from "@/components/marketing/for-freelancers";

export const metadata = {
  title: "Tasks for freelancers · Five clients, one inbox",
  description:
    "One workspace per client, €12/mo for unlimited workspaces, no per-seat tax. Templates for tax season and new client onboarding.",
  openGraph: {
    title: "Five clients, one inbox.",
    description:
      "One workspace per client. €12/mo, unlimited workspaces. No per-seat tax.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Five clients, one inbox.",
    description: "€12/mo, unlimited workspaces, no per-seat tax.",
  },
};

export default function ForFreelancersPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <ForFreelancers />
      </main>
      <SiteFooter />
    </>
  );
}
