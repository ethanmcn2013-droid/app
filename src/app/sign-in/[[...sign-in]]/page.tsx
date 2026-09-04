import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { AuthStage } from "@/components/auth/auth-stage";
import { signalAuthPageAppearance } from "@/components/auth/clerk-appearance";
import { DemoAuthCard } from "@/components/auth/demo-auth-card";
import { isDemoMode } from "@/lib/access-mode";
import { authRouteRobots } from "@/lib/launch";
import { inviteAuthUrl, inviteReturnPath } from "@/lib/auth/invite-intent";

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

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const invitePath = inviteReturnPath((await searchParams).redirect_url);
  if (isDemoMode()) {
    return (
      <AuthStage headline="You’re already signed in here.">
        <DemoAuthCard mode="sign-in" bare />
      </AuthStage>
    );
  }

  return (
    <AuthStage headline="Sign in to Signal Studio.">
      <SignIn
        appearance={signalAuthPageAppearance}
        {...(invitePath ? {
          forceRedirectUrl: invitePath,
          signUpForceRedirectUrl: invitePath,
          signUpUrl: inviteAuthUrl("sign-up", invitePath),
        } : {})}
      />
    </AuthStage>
  );
}
