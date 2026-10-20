import { permanentRedirect } from "next/navigation";
import { requireAppAccessTasks } from "@/server/app-access";

export const dynamic = "force-dynamic";

/**
 * Retired: the Full Briefing was retired on 20 October 2026; Home is the
 * front door. The proxy answers first with a 308; this catches any path
 * that bypasses its matcher.
 */
export default async function RetiredBriefingRoute(): Promise<never> {
  await requireAppAccessTasks();
  permanentRedirect("/app/home");
}
