import { requireAppAccess } from "@/server/require-app-access";
import { SignalOnboardingPage } from "@/modules/signal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onboarding · Signal" };

export default async function SignalOnboardingRoute() {
  await requireAppAccess();
  return <SignalOnboardingPage />;
}
