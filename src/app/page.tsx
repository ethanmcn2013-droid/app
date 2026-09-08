import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Hero } from "@/components/marketing/hero";
import { Anatomy } from "@/components/marketing/anatomy";
import { CallToAction } from "@/components/marketing/cta";
import { SuiteArrows } from "@/components/suite-arrows";

/**
 * Tasks marketing homepage, structure:
 *   1. Hero            , the suite headline + the three product cards
 *                        (a note becomes a task becomes a live date)
 *   2. Anatomy         , task card anatomy breakdown
 *   3. CallToAction    , confident close
 */
export default function Home() {
  return (
    <>
      <SiteNavServer />
      <SuiteArrows current="tasks" />
      <main className="flex-1">
        <Hero />
        <Anatomy />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
