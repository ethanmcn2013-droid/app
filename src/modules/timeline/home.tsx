import Link from "next/link";
import { TIMELINE_URL } from "@/lib/product-urls";

/**
 * Timeline module home — placeholder rendered inside the /app chrome while
 * the Timeline product migrates into Signal Studio. Matches the app's
 * empty-state patterns: paper white canvas, ink tokens, indigo accent,
 * Geist type.
 */
export function TimelineHome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">
        Timeline
      </h1>
      <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ink-soft">
        Timeline is moving into Signal Studio. Until the move completes, your
        timeline lives in the current Timeline app.
      </p>
      <Link
        className="mt-6 inline-flex h-9 items-center rounded-md bg-brand px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand/90"
        href={`${TIMELINE_URL}/app`}
      >
        Open Timeline
      </Link>
    </div>
  );
}
