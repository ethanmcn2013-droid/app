import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { AuthStage } from "@/components/auth/auth-stage";
import { signalAuthPageAppearance } from "@/components/auth/clerk-appearance";
import { DemoAuthCard } from "@/components/auth/demo-auth-card";
import { lookupSponsorByCode } from "@/server/db/venue-welcome";
import { isDemoMode } from "@/lib/access-mode";
import { authRouteRobots } from "@/lib/launch";
import {
  buildWelcomeUrl,
  getSegment,
  segmentFromParam,
} from "@/lib/onboarding/segments";

/** Same posture as /sign-in: live, unlinked, noindexed until launch. */
export const metadata: Metadata = {
  title: "Sign up · Signal Studio",
  robots: authRouteRobots(),
};

const REDEEM_PATH = /^\/redeem\/([A-Za-z0-9-]+)\/?$/;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string; use?: string }>;
}) {
  const sp = await searchParams;
  const demoMode = isDemoMode();

  let sponsor: { name: string; code: string } | null = null;
  if (!demoMode && sp.redirect_url) {
    const match = REDEEM_PATH.exec(sp.redirect_url);
    if (match) {
      const code = match[1].toUpperCase();
      const info = await lookupSponsorByCode(code);
      if (info) sponsor = { name: info.sponsorName, code };
    }
  }

  const preselected = segmentFromParam(sp.use);
  const welcomeUrl = buildWelcomeUrl(preselected);
  const segmentLabel = preselected ? getSegment(preselected).label : null;

  if (demoMode) {
    return (
      <AuthStage headline="No account is needed here.">
        <DemoAuthCard mode="sign-up" bare />
      </AuthStage>
    );
  }

  // A sponsored signup keeps its own headline: the person arrived because
  // somebody paid for their year, and that is the first thing they should
  // read. The code stays directly under it.
  const headline = sponsor
    ? `${sponsor.name} is covering your year.`
    : "Create your Signal Studio account.";

  return (
    <AuthStage headline={headline}>
      {sponsor ? (
        <p className="mb-5 text-[13.5px] leading-[1.55] text-ink-soft">
          Almost there. Your code{" "}
          <span className="font-mono uppercase tracking-[0.06em] text-ink">
            {sponsor.code}
          </span>{" "}
          is applied once you finish.
        </p>
      ) : segmentLabel ? (
        <p className="mb-5 text-[13.5px] leading-[1.55] text-ink-soft">
          Setting up for{" "}
          <span className="font-medium text-ink">{segmentLabel}</span>.
        </p>
      ) : null}
      <SignUp
        appearance={signalAuthPageAppearance}
        fallbackRedirectUrl={welcomeUrl}
        forceRedirectUrl={welcomeUrl}
      />
    </AuthStage>
  );
}
