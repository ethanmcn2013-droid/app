import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TasksHeroLoader } from "@/components/marketing/tasks-hero-loader";
import { Hero } from "@/components/marketing/hero";
import { Anatomy } from "@/components/marketing/anatomy";
import { CallToAction } from "@/components/marketing/cta";

/**
 * Tasks marketing homepage — structure:
 *   1. TasksHeroLoader  — animated identity card (strike-through + live-queue)
 *   2. Hero             — product intro text + animated live demo
 *   3. Anatomy          — task card anatomy breakdown
 *   4. CallToAction     — confident close
 */
export default function Home() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <TasksHeroLoader />
        <Hero />
        <Anatomy />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
