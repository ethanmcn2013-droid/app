import Link from "next/link";
import { NOTES_URL } from "@/lib/product-urls";

/**
 * Notes module home — placeholder rendered inside the /app chrome while
 * the Notes product migrates into Signal Studio. Matches the app's
 * empty-state patterns: paper white canvas, ink tokens, indigo accent,
 * Geist type.
 */
export function NotesHome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">
        Notes
      </h1>
      <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ink-soft">
        Notes is moving into Signal Studio. Until the move completes, your
        notes live in the current Notes app.
      </p>
      <Link
        className="mt-6 inline-flex h-9 items-center rounded-md bg-brand px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand/90"
        href={`${NOTES_URL}/app`}
      >
        Open Notes
      </Link>
    </div>
  );
}
