import type { RedeemResult } from "@/server/actions/comp";

export const REDEEM_FAILURE_COPY: Record<
  Exclude<RedeemResult, { ok: true }>["reason"],
  { headline: string; body: string }
> = {
  "not-found": {
    headline: "We don't recognize that code.",
    body: "Check the original link for missing letters or dashes. If it still doesn't work, email Signal Studio for help.",
  },
  exhausted: {
    headline: "All redemptions on this code are used up.",
    body: "If you've used this code before, sign in with that account and try the same code. Otherwise, contact Signal Studio before trying another code.",
  },
  expired: {
    headline: "This access is no longer available.",
    body: "The code or the access it granted has ended. Contact Signal Studio support if you expected it to remain active.",
  },
  "already-redeemed": {
    headline: "We couldn't confirm this redemption.",
    body: "Sign in with the account you first used and try the same code. If you still cannot open the workspace, contact Signal Studio before trying another code.",
  },
  "still-provisioning": {
    headline: "We couldn't apply this code to a project.",
    body: "Check that you're signed into the right account and can manage the intended project, then try the same code again. If it still won't open, email Signal Studio for help.",
  },
  "rate-limited": {
    headline: "Too many tries in a short window.",
    body: "Wait ten minutes, then try the same code with the same account. If it still won't open, email Signal Studio for help.",
  },
};

export const REDEEM_TIER_LABELS: Record<Extract<RedeemResult, { ok: true }>["tier"], string> = {
  free: "Free",
  event: "Event",
  wedding: "Wedding suite",
  workspace: "Pro",
  studio: "Studio",
} as const;
