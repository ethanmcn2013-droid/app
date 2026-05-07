import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForFreelancers } from "@/components/marketing/for-freelancers";

export const metadata = {
  title: "Tasks for Freelancers — Five Clients, One Inbox",
  description:
    "One workspace per client, $4.99/mo for unlimited workspaces, no per-seat tax. Templates for tax season and new client onboarding.",
  openGraph: {
    title: "Five clients, one inbox.",
    description:
      "One workspace per client. $4.99/mo Pro. No per-seat tax. Three editing guests free.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Five clients, one inbox.",
    description: "$4.99/mo Pro, unlimited workspaces, no per-seat tax.",
  },
};

export default function ForFreelancersPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <ForFreelancers />
      </main>
      <SiteFooter />
    </>
  );
}
