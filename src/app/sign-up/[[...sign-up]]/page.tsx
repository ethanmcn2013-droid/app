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
  // somebody is paying for their access, and that is the first thing they
  // should read. The ratified term (R-015) lives in the panel below; the
  // headline never states a duration.
  const headline = sponsor
    ? `${sponsor.name} is covering this.`
    : "Create your Signal Studio account.";

  return (
      <AuthStage headline={headline}>
        {sponsor ? (
          <div className="mb-5 flex w-full flex-col items-center text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-quiet">
              {sponsor.name}
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-ink-soft">
              Almost there. {sponsor.name} is covering it. Eighteen months, or
              three months past your wedding, whichever is later.
            </p>
            <div className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Code
            </div>
            <div className="mt-1 font-mono text-[14px] uppercase tracking-[0.08em] tabular-nums text-ink-quiet">
              {sponsor.code}
            </div>
          </div>
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
