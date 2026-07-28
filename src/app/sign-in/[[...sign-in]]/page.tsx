import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthStage } from "@/components/auth/auth-stage";
import { signalAuthPageAppearance } from "@/components/auth/clerk-appearance";
import { DemoAuthCard } from "@/components/auth/demo-auth-card";
import { isDemoMode } from "@/lib/access-mode";
import { authRouteRobots } from "@/lib/launch";

/**
 * The route stays live and working before launch. It is unlinked and
 * noindexed, not switched off: the allowlist (the founder, pilot accounts)
 * signs in here while the public sees the waitlist, and requireAppAccess()
 * bounces anyone else off /app. Taking the route down would lock the
 * operator out of their own product. See src/lib/launch.ts.
 */
export const metadata: Metadata = {
  title: "Sign in · Signal Studio",
  robots: authRouteRobots(),
};

export default function SignInPage() {
  if (isDemoMode()) {
    return (
      <AuthStage headline="You are already signed in here.">
        <DemoAuthCard mode="sign-in" bare />
      </AuthStage>
    );
  }

  return (
    <AuthStage headline="Sign in to Signal Studio.">
      <SignIn appearance={signalAuthPageAppearance} />
    </AuthStage>
  );
}
