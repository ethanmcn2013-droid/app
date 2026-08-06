import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { requireAppAccess } from "@/server/require-app-access";
import { requireSignalUser } from "@/modules/signal/home";
import { HomeNewUser, HomeView } from "@/components/app/home/home-view";
import { loadHomeData } from "./home-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home · Signal Studio" };

/**
 * /app/home — the authenticated front door (Signal → Home
 * consolidation, D1). Today's Signal is the dominant module; the Full
 * Briefing sits one level deeper at /app/home/briefing.
 */
export default async function HomePage() {
  await requireAppAccess();

  const demo = isDemoMode();
  const userId = demo ? null : await requireSignalUser();
  if (!demo && !userId) redirect("/sign-in");

  const data = await loadHomeData({ clerkId: userId ?? "demo-user" });
  if (data.kind === "new-user") return <HomeNewUser />;
  return <HomeView data={data} />;
}
