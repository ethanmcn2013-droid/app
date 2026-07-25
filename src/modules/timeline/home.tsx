import Link from "next/link";
import { PRODUCT_APP_URLS } from "@/lib/product-urls";

/**
 * Timeline module fallback rendered inside the shared Signal Studio chrome.
 */
export function TimelineHome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">
        Timeline
      </h1>
      <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ink-soft">
        Shape the work into a plan people can read, then publish only what you
        mean to share.
      </p>
      <Link
        className="mt-6 inline-flex h-9 items-center rounded-md bg-brand px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand/90"
        href={PRODUCT_APP_URLS.timeline}
      >
        Open Timeline
      </Link>
    </div>
  );
}
