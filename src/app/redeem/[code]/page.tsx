import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import {
  redeemCompCodeAction,
  type RedeemResult,
} from "@/server/actions/comp";
import { RedeemResultCard } from "@/components/redeem/redeem-result-card";
import { getCurrentUserOrNull } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";

export const dynamic = "force-dynamic";

export const metadata = { title: "Redeem, Tasks" };

function reviewResult(code: string): RedeemResult {
  switch (code.toUpperCase()) {
    case "REVIEW-SUCCESS":
      return {
        ok: true,
        tier: "wedding",
        expiresAt: "2027-12-31T23:59:59.000Z",
        notes: "Review fixture only. No entitlement or customer record was changed.",
        sponsorSlug: "the-orchard",
      };
    case "REVIEW-EXPIRED":
      return { ok: false, reason: "expired" };
    case "REVIEW-USED":
      return { ok: false, reason: "already-redeemed" };
    default:
      return { ok: false, reason: "not-found" };
  }
}

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Couples arrive here unauthenticated from signalstudio.ie/redeem.
  // Send them through Clerk first; Clerk honors `redirect_url` and
  // returns them to this same path with a session, where the action
  // can resolve them and the welcome short-circuit in /welcome takes
  // over.
  const me = await getCurrentUserOrNull();
  if (!me) {
    const back = `/redeem/${encodeURIComponent(code)}`;
    redirect(`/sign-up?redirect_url=${encodeURIComponent(back)}`);
  }

  const result = isDemoMode()
    ? reviewResult(code)
    : await redeemCompCodeAction(code);
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="px-6 pt-6">
        <Wordmark size="md" />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <RedeemResultCard code={code.toUpperCase()} result={result} />
      </main>
    </div>
  );
}
