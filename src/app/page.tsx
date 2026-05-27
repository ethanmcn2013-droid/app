import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TasksHeroTicker } from "@/components/marketing/tasks-hero-ticker";
import { Hero } from "@/components/marketing/hero";
import { Anatomy } from "@/components/marketing/anatomy";
import { CallToAction } from "@/components/marketing/cta";

/**
 * Tasks marketing homepage — structure:
 *   1. TasksHeroTicker  — departure-board animation (flip mechanic → tasks· wordmark)
 *   2. Hero             — product intro text + animated live demo
 *   3. Anatomy          — task card anatomy breakdown
 *   4. CallToAction     — confident close
 */
export default function Home() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <TasksHeroTicker />
        <Hero />
        <Anatomy />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
