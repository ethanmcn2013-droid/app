import { notFound, redirect } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { requireAppAccessTasks } from "@/server/app-access";
import { parseBriefingReadScopeHint, planningPeriodsEnabled, requireSignalUser } from "@/modules/signal/home";
import { HomeNewUser, HomeView } from "@/components/app/home/home-view";
import { loadHomeData } from "./home-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home · Signal Studio" };

/**
 * /app/home — the authenticated front door (Signal → Home
 * consolidation, D1). Today's Signal is the dominant module; the Full
 * Briefing sits one level deeper at /app/home/briefing.
 */
export default async function HomePage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await requireAppAccessTasks();

  const demo = isDemoMode();
  const userId = demo ? null : await requireSignalUser();
  if (!demo && !userId) redirect("/sign-in");

  const hint = parseBriefingReadScopeHint(await searchParams ?? {}, planningPeriodsEnabled());
  if (hint.kind === "invalid") notFound();
  const data = await loadHomeData({
    clerkId: userId ?? "demo-user",
    ...(hint.kind === "scope" ? { scope: hint.scope } : {}),
  });
  if (data.kind === "new-user") {
    if (hint.kind === "scope") notFound();
    return <HomeNewUser />;
  }
  return <HomeView data={data} />;
}
