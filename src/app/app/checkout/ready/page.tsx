import Link from "next/link";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { getPlanSummary } from "@/server/db/plan-summary";

export const dynamic = "force-dynamic";

type CheckoutTier = "workspace" | "event" | "studio" | "wedding";
type CheckoutInterval = "monthly" | "annual";

type SearchParams = Promise<{
  tier?: string;
  interval?: string;
  session?: string;
  dev?: string;
}>;

const TIER_COPY: Record<
  CheckoutTier,
  {
    title: string;
    body: string;
    facts: [string, string, string];
    next: [string, string, string];
  }
> = {
  workspace: {
    title: "Pro is ready.",
    body: "All four products are open on this workspace. The price covers every guest; it does not move when the work gets busy.",
    facts: ["Unlimited workspaces", "Unlimited guests", "All four products"],
    next: [
      "Create the next workspace before the next project starts.",
      "Invite the people who need the plan, not a seat count.",
      "Open Timeline when the work needs a public shape.",
    ],
  },
  event: {
    title: "Your event workspace is ready.",
    body: "One workspace for the work with a finish line. Plan intensely, invite the right people, then keep the record readable.",
    facts: ["One event workspace", "18 months editing", "Readable after"],
    next: [
      "Name the event so everyone sees the same plan.",
      "Load a starter pack if the board is still blank.",
      "Invite the people who need to move the work.",
    ],
  },
  studio: {
    title: "Studio is ready.",
    body: "Every workspace you own now reads as part of the same operating system. One bill, not one decision per project.",
    facts: ["Every owned workspace", "All four products", "One billing surface"],
    next: [
      "Open the workspace that needs attention first.",
      "Create separate workspaces for separate clients.",
      "Use Signal Studio as the calm layer across the work.",
    ],
  },
  wedding: {
    title: "Your wedding workspace is ready.",
    body: "One place for the plan, the decisions, and the people helping carry them. The workspace stays readable after the day passes.",
    facts: ["One wedding workspace", "Planner-ready", "Readable after"],
    next: [
      "Add the date and venue first.",
      "Invite your planner or the person carrying the list.",
      "Keep decisions in the workspace instead of the group chat.",
    ],
  },
};

function tierFromParam(value: string | undefined): CheckoutTier {
  if (
    value === "workspace" ||
    value === "event" ||
    value === "studio" ||
    value === "wedding"
  ) {
    return value;
  }
  return "workspace";
}

function intervalFromParam(value: string | undefined): CheckoutInterval {
  return value === "annual" ? "annual" : "monthly";
}

function isExpectedTierLive(
  expected: CheckoutTier,
  actual: Awaited<ReturnType<typeof getPlanSummary>>["tier"],
): boolean {
  if (expected === "workspace") {
    return actual === "workspace" || actual === "studio";
  }
  return actual === expected;
}

export default async function CheckoutReadyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tier = tierFromParam(params.tier);
  const interval = intervalFromParam(params.interval);
  const copy = TIER_COPY[tier];

  const [me, ws] = await Promise.all([getCurrentUser(), getActiveWorkspace()]);
  const summary = await getPlanSummary(me, ws);
  const accessLive = isExpectedTierLive(tier, summary.tier);
  const sessionTail = params.session?.slice(-8) ?? null;

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10">
      <section className="mx-auto grid w-full max-w-[960px] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-line-soft bg-bg-elevated p-6 shadow-[0_24px_70px_-40px_rgba(20,21,26,0.24)] md:p-8">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
            Payment received
          </div>
          <h1 className="mt-3 max-w-[14ch] text-balance text-[clamp(2rem,1.3rem+2.6vw,3.35rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.65] text-ink-soft md:text-[16px]">
            {copy.body}
          </p>

          {!accessLive ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-[1.55] text-amber-900">
              Payment is complete. Access is still syncing from Stripe. If the
              board still looks free, wait a few seconds and refresh.
            </div>
          ) : null}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app/board"
              className="inline-flex items-center justify-center rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-ink-soft"
            >
              Open the board
            </Link>
            <Link
              href="/settings/plan"
              className="inline-flex items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              Review your plan
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {copy.facts.map((fact) => (
              <div
                key={fact}
                className="rounded-xl border border-line-soft bg-bg-sunken/60 px-4 py-3"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
                  Included
                </div>
                <div className="mt-1 text-[13.5px] font-medium text-ink">
                  {fact}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-line-soft bg-white p-5 shadow-[0_20px_60px_-42px_rgba(20,21,26,0.22)]">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
            Next
          </div>
          <ol className="mt-4 space-y-4">
            {copy.next.map((item, index) => (
              <li key={item} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">
                  {index + 1}
                </span>
                <span className="text-[13px] leading-[1.55] text-ink-soft">
                  {item}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-6 border-t border-line-soft pt-4 text-[12px] leading-[1.55] text-ink-quiet">
            Stripe will email the receipt to the address used at checkout.
            {sessionTail ? (
              <span className="mt-1 block font-mono tabular-nums">
                Session {sessionTail}
              </span>
            ) : null}
            <span className="mt-1 block">
              Billing window: {interval === "annual" ? "yearly" : "monthly"}.
            </span>
          </div>
        </aside>
      </section>
    </main>
  );
}
