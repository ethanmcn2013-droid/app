import Link from "next/link";
import { SIGNAL_URL } from "@/lib/product-urls";

/**
 * Signal module home — placeholder rendered inside the /app chrome while
 * the Signal product migrates into Signal Studio. Matches the app's
 * empty-state patterns: paper white canvas, ink tokens, indigo accent,
 * Geist type.
 */
export function SignalHome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">
        Signal
      </h1>
      <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ink-soft">
        Signal is moving into Signal Studio. Until the move completes, your
        briefing lives in the current Signal app.
      </p>
      <Link
        className="mt-6 inline-flex h-9 items-center rounded-md bg-brand px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand/90"
        href={`${SIGNAL_URL}/app/brief`}
      >
        Open Signal
      </Link>
    </div>
  );
}
