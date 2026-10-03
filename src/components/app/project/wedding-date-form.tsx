"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSponsoredWeddingDate } from "@/server/actions/sponsored-wedding-date";
import { WEDDING_DATE_ERRORS, type SponsoredWeddingDate } from "@/lib/sponsored-wedding-date";
import { COUPLE_ACCESS_TERM_SENTENCE } from "@/lib/venue-access-term";

function dateLabel(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function WeddingDateForm({ initial, previousTarget, headingLevel = 2 }: { initial: SponsoredWeddingDate; previousTarget: string | null; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const inputId = useId();
  const router = useRouter();
  const [saveReadback, setSaveReadback] = useState<{ from: SponsoredWeddingDate; data: SponsoredWeddingDate } | null>(null);
  // A save reply is current until fresh server props arrive. Keep that readback
  // separate from the unsaved draft so grant-only refreshes do not erase edits.
  const saved = saveReadback?.from === initial ? saveReadback.data : initial;
  // Access props can refresh while a save is pending. Its confirmed revision
  // still belongs to the next mutation, even when its access copy is superseded.
  const confirmedRevision = Math.max(initial.revision, saveReadback?.data.revision ?? initial.revision);
  const [draft, setDraft] = useState(initial.weddingDate ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveSponsoredWeddingDate({ projectId: saved.projectId, expectedRevision: confirmedRevision, weddingDate: draft || null });
        if (!result.ok) {
          setFailed(true);
          setMessage(WEDDING_DATE_ERRORS[result.reason]);
          return;
        }
        setSaveReadback({ from: initial, data: result.data });
        setDraft(result.data.weddingDate ?? "");
        setFailed(false);
        setMessage(result.data.weddingDate ? "Wedding date saved." : "Wedding date cleared. Access already granted is unchanged.");
        router.refresh();
      } catch {
        setFailed(true);
        setMessage(WEDDING_DATE_ERRORS.failed);
      }
    });
  }

  return (
    <section id="wedding-date" aria-labelledby={`${inputId}-heading`} className="rounded-[var(--v3-radius-lg)] border border-[color:var(--v3-border)] bg-[var(--v3-surface)] p-4 [box-shadow:var(--v3-shadow-1)]">
      <Heading id={`${inputId}-heading`} className="text-[14px] font-semibold text-[color:var(--v3-text)]">Wedding date</Heading>
      <p id={`${inputId}-help`} className="mt-1.5 max-w-[65ch] text-[13px] leading-relaxed text-[color:var(--v3-text-2)]">
        Add your date when you know it. You can update it here if plans change. Existing task dates stay as you set them.
      </p>
      {saved.canManage ? (
        <form onSubmit={submit} className="mt-4">
          <label htmlFor={inputId} className="block text-[12.5px] font-medium text-[color:var(--v3-text)]">Your wedding date</label>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <input id={inputId} type="date" value={draft} onChange={event => setDraft(event.target.value)} disabled={pending} aria-describedby={`${inputId}-help ${inputId}-unknown`} className="min-h-[44px] min-w-0 rounded-[var(--v3-radius)] border border-[color:var(--v3-border-strong)] bg-[var(--v3-canvas)] px-3 text-[14px] text-[color:var(--v3-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--v3-accent)]" />
            <button type="submit" disabled={pending} className="min-h-[44px] rounded-[var(--v3-radius)] bg-[var(--v3-accent)] px-4 text-[13px] font-medium text-[color:var(--v3-on-accent)] transition-colors hover:bg-[var(--v3-accent-hover)] disabled:opacity-60">{pending ? "Saving…" : "Save wedding date"}</button>
            {draft ? <button type="button" disabled={pending} onClick={() => setDraft("")} className="min-h-[44px] text-[13px] text-[color:var(--v3-text-2)] underline underline-offset-2 hover:text-[color:var(--v3-text)]">Clear date</button> : null}
          </div>
          <p id={`${inputId}-unknown`} className="mt-2 max-w-[65ch] text-[12px] leading-relaxed text-[color:var(--v3-text-3)]">Not set yet? Leave the date blank. Sponsored access starts with at least 548 days from redemption when no wedding date is known. You can add it here later.</p>
        </form>
      ) : (
        <div className="mt-4 text-[13px] text-[color:var(--v3-text)]">
          <p>{saved.weddingDate ? dateLabel(saved.weddingDate) : "No wedding date set yet."}</p>
          <p className="mt-1 text-[color:var(--v3-text-2)]">Someone who can manage this project can update its wedding date.</p>
        </div>
      )}
      {message ? <p role={failed ? "alert" : "status"} className={`mt-3 text-[13px] ${failed ? "text-[color:var(--v3-danger)]" : "text-[color:var(--v3-text)]"}`}>{message}</p> : null}
      <div className="mt-4 border-t border-[color:var(--v3-border)] pt-3.5 text-[13px] leading-relaxed text-[color:var(--v3-text-2)]">
        {saved.access.status === "active" ? <p className="font-medium text-[color:var(--v3-text)]">{saved.access.expiresAt ? `Your sponsored access is available until ${dateLabel(saved.access.expiresAt)}.` : "Your sponsored access has no scheduled end date."}</p> : null}
        {saved.access.status === "expired" ? <p className="font-medium text-[color:var(--v3-text)]">Your sponsored access ended on {dateLabel(saved.access.expiresAt!)}. Saving a later wedding date may extend it.</p> : null}
        {saved.access.status === "revoked" ? <p className="font-medium text-[color:var(--v3-text)]">Your sponsored access was revoked. Changing the wedding date will not restore it.</p> : null}
        {saved.access.status === "none" ? <p>No sponsored access is recorded for your account in this project. Saving the date updates eligible sponsored access for its members.</p> : null}
        {saved.access.status !== "revoked" ? <p className="mt-1">{COUPLE_ACCESS_TERM_SENTENCE} Moving the date earlier or clearing it does not shorten access already granted.</p> : null}
      </div>
      {previousTarget ? <p className="mt-3 text-[12px] leading-relaxed text-[color:var(--v3-text-3)]">Previous project target: {dateLabel(previousTarget)}. This is separate from your wedding date and is not used for sponsored access.</p> : null}
    </section>
  );
}
