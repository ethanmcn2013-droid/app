import { requireAppAccess } from "@/server/require-app-access";
import { SignalOnboardingPage } from "@/modules/signal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Onboarding · Signal",
};

/**
 * /app/brief/onboarding — Signal module onboarding (Phase 6 port).
 *
 * S1: was /app/onboarding in signal.git; repathed to /app/brief/onboarding.
 * Defence-in-depth: requireAppAccess() called even though /app layout enforces it.
 */
export default async function BriefOnboardingPage() {
  await requireAppAccess();
  return <SignalOnboardingPage />;
}
