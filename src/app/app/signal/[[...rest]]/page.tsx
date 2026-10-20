import { permanentRedirect } from "next/navigation";
import { requireAppAccessTasks } from "@/server/app-access";

export const dynamic = "force-dynamic";

/**
 * Retired: /app/signal led to the Full Briefing, which was retired on
 * 20 October 2026. The proxy answers first with a 308; this catches any
 * path that bypasses its matcher.
 */
export default async function RetiredSignalRoute(): Promise<never> {
  await requireAppAccessTasks();
  permanentRedirect("/app/home");
}
