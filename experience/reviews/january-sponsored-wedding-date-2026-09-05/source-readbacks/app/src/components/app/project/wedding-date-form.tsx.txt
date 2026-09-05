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

export function WeddingDateForm({ initial, previousTarget }: { initial: SponsoredWeddingDate; previousTarget: string | null }) {
  const inputId = useId();
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial.weddingDate ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await saveSponsoredWeddingDate({ projectId: saved.projectId, expectedRevision: saved.revision, weddingDate: draft || null });
        if (!result.ok) {
          setFailed(true);
          setMessage(WEDDING_DATE_ERRORS[result.reason]);
          return;
        }
        setSaved(result.data);
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
    <section id="wedding-date" aria-labelledby={`${inputId}-heading`} className="rounded-xl border border-line-soft bg-bg-elevated p-5">
      <h2 id={`${inputId}-heading`} className="text-[15px] font-semibold text-ink">Wedding date</h2>
      <p id={`${inputId}-help`} className="mt-2 max-w-[65ch] text-[13px] leading-relaxed text-ink-soft">
        Add your date when you know it. You can update it here if plans change. Existing task dates stay as you set them.
      </p>
      {saved.canManage ? (
        <form onSubmit={submit} className="mt-4">
          <label htmlFor={inputId} className="block text-[12px] font-medium text-ink">Your wedding date</label>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <input id={inputId} type="date" value={draft} onChange={event => setDraft(event.target.value)} disabled={pending} aria-describedby={`${inputId}-help ${inputId}-unknown`} className="min-h-11 min-w-0 rounded-lg border border-line-soft bg-bg px-3 text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
            <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-brand px-4 text-[13px] font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Save wedding date"}</button>
            {draft ? <button type="button" disabled={pending} onClick={() => setDraft("")} className="min-h-11 text-[13px] text-ink-soft underline underline-offset-2">Clear date</button> : null}
          </div>
          <p id={`${inputId}-unknown`} className="mt-2 max-w-[65ch] text-[12px] leading-relaxed text-ink-quiet">Not set yet? Leave the date blank. Sponsored access starts with at least 548 days from redemption when no wedding date is known. You can add it here later.</p>
        </form>
      ) : (
        <div className="mt-4 text-[13px] text-ink">
          <p>{saved.weddingDate ? dateLabel(saved.weddingDate) : "No wedding date set yet."}</p>
          <p className="mt-1 text-ink-soft">Someone who can manage this project can update its wedding date.</p>
        </div>
      )}
      {message ? <p role={failed ? "alert" : "status"} className="mt-3 text-[13px] text-ink">{message}</p> : null}
      <div className="mt-5 border-t border-line-soft pt-4 text-[13px] leading-relaxed text-ink-soft">
        {saved.access.status === "active" ? <p className="font-medium text-ink">{saved.access.expiresAt ? `Your sponsored access is available until ${dateLabel(saved.access.expiresAt)}.` : "Your sponsored access has no scheduled end date."}</p> : null}
        {saved.access.status === "expired" ? <p className="font-medium text-ink">Your sponsored access ended on {dateLabel(saved.access.expiresAt!)}. Saving a later wedding date may extend it.</p> : null}
        {saved.access.status === "revoked" ? <p className="font-medium text-ink">Your sponsored access was revoked. Changing the wedding date will not restore it.</p> : null}
        {saved.access.status === "none" ? <p>No sponsored access is recorded for your account in this project. Saving the date updates eligible sponsored access for its members.</p> : null}
        {saved.access.status !== "revoked" ? <p className="mt-1">{COUPLE_ACCESS_TERM_SENTENCE} Moving the date earlier or clearing it does not shorten access already granted.</p> : null}
      </div>
      {previousTarget ? <p className="mt-4 text-[12px] leading-relaxed text-ink-quiet">Previous project target: {dateLabel(previousTarget)}. This is separate from your wedding date and is not used for sponsored access.</p> : null}
    </section>
  );
}
