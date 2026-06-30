import Link from "next/link";
import { STUDIO_URL } from "@/lib/product-urls";

type SearchParams = Promise<{
  tier?: string;
  interval?: string;
}>;

function checkoutHref(tier: string | undefined, interval: string | undefined) {
  if (
    tier !== "workspace" &&
    tier !== "event" &&
    tier !== "studio" &&
    tier !== "wedding"
  ) {
    return null;
  }
  const params = new URLSearchParams({ tier });
  if (interval === "annual") params.set("interval", "annual");
  return `/api/checkout?${params.toString()}`;
}

export default async function CheckoutCanceledPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const retryHref = checkoutHref(params.tier, params.interval);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <section className="w-full max-w-[520px] rounded-2xl border border-line-soft bg-bg-elevated p-7 shadow-[0_24px_70px_-42px_rgba(20,21,26,0.22)]">
        <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
          Checkout closed
        </div>
        <h1 className="mt-3 text-balance text-[28px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
          Nothing was charged.
        </h1>
        <p className="mt-4 max-w-[44ch] text-[14.5px] leading-[1.65] text-ink-soft">
          The payment window closed before checkout finished. Your workspace is
          unchanged. Keep Free, pick another access shape, or try the same
          checkout again.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`${STUDIO_URL}/pricing`}
            className="inline-flex items-center justify-center rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-ink-soft"
          >
            Return to pricing
          </Link>
          {retryHref ? (
            <Link
              href={retryHref}
              className="inline-flex items-center justify-center rounded-md border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              Try checkout again
            </Link>
          ) : null}
        </div>
        <p className="mt-6 border-t border-line-soft pt-4 text-[12.5px] leading-[1.55] text-ink-quiet">
          Questions about billing go to{" "}
          <a
            href="mailto:hello@signalstudio.ie"
            className="font-medium text-ink underline decoration-ink-quiet/40 underline-offset-[3px] hover:decoration-ink"
          >
            hello@signalstudio.ie
          </a>
          .
        </p>
      </section>
    </main>
  );
}
