import { requireAppAccessTasks } from "@/server/app-access";
import { SignalOnboardingPage } from "@/modules/signal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onboarding · Briefing" };

export default async function BriefingOnboardingRoute() {
  await requireAppAccessTasks();
  return <SignalOnboardingPage />;
}
