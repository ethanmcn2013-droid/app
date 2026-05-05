import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Anatomy } from "@/components/marketing/anatomy";
import { CallToAction } from "@/components/marketing/cta";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <Features />
        <Anatomy />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
