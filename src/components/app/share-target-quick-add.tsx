"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addTaskAction } from "@/server/actions/tasks";

/**
 * Quick-add modal that catches an iOS / Android share-sheet payload.
 *
 * The page server-component reads `?title=...&url=...&text=...` and
 * passes them in raw. We compose them into one editable line —
 * "Title, URL" when both are present, otherwise whichever single
 * field carried something. The user lands one tap away from save.
 */
export function ShareTargetQuickAdd({
  title,
  url,
  text,
}: {
  title: string;
  url: string;
  text: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Compose a clean default. Order: prefer title, then text, then url —
  // joined with an em-dash when more than one piece is present so the
  // result reads like a sentence the user might have typed themselves.
  const initial = useMemo(() => {
    const parts: string[] = [];
    if (title) parts.push(title);
    else if (text) parts.push(text);
    if (url && !parts.includes(url)) parts.push(url);
    return parts.join(", ");
  }, [title, url, text]);

  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  // Name what got captured, in plain prose. No chipper microcopy.
  const captured = useMemo(() => {
    if (title && url) return "A page title and its link.";
    if (title) return "A page title.";
    if (url) return "A link.";
    if (text) return "A snippet of selected text.";
    return "Nothing recognisable came through, type it in.";
  }, [title, url, text]);

  function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Give it a title before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addTaskAction({ title: trimmed });
        router.replace("/app/board?from=share");
      } catch {
        setError("Couldn’t save that. Try again.");
      }
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-line-soft bg-white p-6 shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]">
        <header className="mb-5">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink">
            Save what you saw.
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-quiet">
            {captured}
          </p>
        </header>

        <label
          htmlFor="share-target-input"
          className="block text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint"
        >
          Task
        </label>
        <textarea
          id="share-target-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (
              (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ||
              (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing)
            ) {
              e.preventDefault();
              save();
            }
          }}
          rows={4}
          autoFocus
          spellCheck={false}
          className="mt-2 w-full resize-none rounded-lg border border-line-soft bg-bg-sunken/40 px-3 py-2.5 text-[15px] leading-snug text-ink placeholder:text-ink-faint focus:border-brand focus:bg-white focus:outline-none"
          placeholder="What needs doing?"
        />

        {error ? (
          <p className="mt-2 text-[12px] text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-between">
          <Link
            href="/app/board"
            className="text-[13px] text-ink-quiet underline-offset-4 hover:text-ink hover:underline"
          >
            Discard
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={pending || !value.trim()}
            className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-medium text-white transition-opacity hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-faint">
        Captured from the share sheet. Edit anything before it lands.
      </p>
    </div>
  );
}
