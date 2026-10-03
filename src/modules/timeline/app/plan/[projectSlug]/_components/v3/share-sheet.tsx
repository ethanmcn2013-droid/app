"use client";

/**
 * Share (spec 5.4): a right-hand sheet on desktop, a bottom sheet on a
 * phone. The same actions as before, and nothing they could not do.
 *
 *   - Each state has its own hero and one primary action. A link exists only
 *     in the reply of the action that made it (publishing stores a hash), so
 *     the receipt with Copy appears straight after minting, once. On a
 *     live page a new link breaks the one guests hold, so it needs a
 *     second press and is never the filled action.
 *   - "Stop the link working after…" is an optional date, posted as
 *     `expiresOn` exactly as before. The time zone is said only when the
 *     page's zone differs from the reader's.
 *   - "Stop sharing" is its own section at the foot. Turning links off and
 *     taking the page down each need a second press: the first arms it for
 *     six seconds, Esc disarms.
 *   - Every word keys off "live" (published AND a link still open), never the
 *     raw state: switching every link off leaves it reading "published".
 *   - Archived (ADR 0001 §5): nothing new is minted; turning links off stays,
 *     because killing a leaked link is a security control. The server
 *     refuses the mint on its own too.
 *   - `canManage` false: the facts only.
 *   - Divergence is per milestone, so it is named, never bulk-updated here.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { DueCalendar } from "@/components/app/detail-panel/due-calendar";
import { Sheet } from "@/components/app/portfolio/timeline-ui";
import { ActionNotice, ShareReceipt } from "@/modules/timeline/app/audience/share-controls";
import {
  publishAudiencePublicationAction,
  revokeAudienceShareAction,
  rotateAudienceShareAction,
  unpublishAudiencePublicationAction,
  type AudienceActionState,
} from "@/modules/timeline/server/actions/audience-timeline";
import { formatShortDay, formatWeekdayDate } from "@/lib/projects/project-portfolio-scale";
import { linkCount, shareStateOf, type SharePublicationSummary } from "./share-state";
import styles from "./plan.module.css";

const INITIAL: AudienceActionState = { status: "idle" };
const NEW_LINK = "Make a new link";
const ARM_MS = 6000;

function isoOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "Stop the link working after…": an optional date, posted as `expiresOn`. */
function ExpiryField({ todayIso, timezone }: { todayIso: string; timezone: string }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewerZone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return timezone;
    }
  });

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className={styles.expiry} ref={rootRef}>
      <input type="hidden" name="expiresOn" value={value} />
      <button type="button" className={styles.expiryButton} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 5.5v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {value ? `Stops working after ${formatWeekdayDate(value)}` : "Stop the link working after…"}
      </button>
      {value ? (
        <button type="button" className={styles.textButton} onClick={() => setValue("")}>
          No end date
        </button>
      ) : null}
      {open ? (
        <div className={styles.calendarPop} role="dialog" aria-label="Stop the link working after">
          <DueCalendar
            value={value ? new Date(`${value}T12:00:00`) : null}
            today={new Date(`${todayIso}T12:00:00`)}
            showQuickPicks={false}
            onSelect={(date) => {
              setValue(isoOf(date));
              setOpen(false);
            }}
            onClear={() => {
              setValue("");
              setOpen(false);
            }}
          />
        </div>
      ) : null}
      {value && viewerZone !== timezone ? (
        <p className={styles.fieldHelp}>It stops at the end of that day in {timezone}.</p>
      ) : null}
    </div>
  );
}

/** A destructive action that needs a second press within six seconds. */
function DangerAction({
  label,
  armedLabel,
  help,
  pending,
  tone = "danger",
}: {
  label: string;
  armedLabel: string;
  help: string;
  pending: boolean;
  /** "neutral" looks like a secondary button until armed. */
  tone?: "danger" | "neutral";
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpId = useId();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function disarm() {
    if (timer.current) clearTimeout(timer.current);
    setArmed(false);
  }

  return (
    <div className={styles.danger} data-armed={armed ? "" : undefined} data-tone={tone}>
      <div className={styles.dangerText}>
        <p className={styles.dangerLabel}>{label}</p>
        <p id={helpId} className={styles.dangerHelp}>
          {armed ? "Press again to confirm. Esc to keep it." : help}
        </p>
      </div>
      <button
        type="submit"
        className={styles.dangerButton}
        data-armed={armed ? "" : undefined}
        data-tone={tone}
        aria-describedby={helpId}
        disabled={pending}
        onClick={(event) => {
          if (armed) {
            disarm();
            return;
          }
          event.preventDefault();
          setArmed(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setArmed(false), ARM_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && armed) {
            event.preventDefault();
            event.stopPropagation();
            disarm();
          }
        }}
        onBlur={disarm}
      >
        {/* Both labels share one grid cell, so the button never changes width
            under the pointer between the two presses. */}
        <span className={styles.dangerLabels}>
          <span style={{ visibility: armed ? "hidden" : "visible" }}>{label}</span>
          <span style={{ visibility: armed ? "visible" : "hidden" }}>{armedLabel}</span>
        </span>
      </button>
    </div>
  );
}

export function ShareSheet({
  open,
  onClose,
  workspaceSlug,
  planName,
  todayIso,
  publication,
  manageHref,
  previewHref,
  canManage,
  canPublish,
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  planName: string;
  todayIso: string;
  publication: SharePublicationSummary | null;
  manageHref: string;
  previewHref: string;
  canManage: boolean;
  /** False when the Project is archived. Hides only the controls that MINT a link. */
  canPublish: boolean;
}) {
  const router = useRouter();
  const [publishState, publishAction, publishPending] = useActionState(publishAudiencePublicationAction, INITIAL);
  const [rotateState, rotateAction, rotatePending] = useActionState(rotateAudienceShareAction, INITIAL);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeAudienceShareAction, INITIAL);
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(unpublishAudiencePublicationAction, INITIAL);

  // The share actions revalidate the shared-pages path, not this plan, so
  // without this refresh the sheet would keep describing the state the page
  // was rendered with.
  useEffect(() => {
    if (
      publishState.status === "success" ||
      rotateState.status === "success" ||
      revokeState.status === "success" ||
      unpublishState.status === "success"
    ) {
      router.refresh();
    }
  }, [publishState, rotateState, revokeState, unpublishState, router]);

  const kind = shareStateOf(publication);
  // A URL only exists in this session, in the reply from the action that just
  // minted it; whichever ran most recently holds it.
  const minted = rotateState.shareUrl ? rotateState : publishState.shareUrl ? publishState : null;
  const changes = publication?.divergedTitles ?? [];

  const hero = minted
    ? { title: "Your new link is ready", body: "Copy it now. For your privacy we don’t keep it, so this page can’t show it again." }
    : kind === "private"
      ? { title: "Only people in this project can see this plan.", body: "Pick which milestones guests see, then publish to make a link." }
      : kind === "draft"
        ? { title: "Ready to share, not live yet.", body: "Publishing makes the link in the same step. Copy it when it appears." }
        : kind === "live" && publication
          ? {
              title: `Live${publication.publishedOn ? ` since ${formatShortDay(publication.publishedOn, todayIso)}` : ""} · ${linkCount(publication.activeShareCount)}`,
              body: "Anyone with the link can view it. No sign-in.",
            }
          : kind === "off"
            ? { title: "Links are off. The page is still ready.", body: "Nobody can open it until you make a new link." }
            : { title: "Taken down.", body: "No link opens the shared page. Choose what to share to publish it again." };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Share ${planName}`}
      side="right"
      width={480}
      footer={
        <div className={styles.shareFoot}>
          <Link href={manageHref} className={styles.link}>
            Choose what guests see
          </Link>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <Link href={previewHref} className={styles.link}>
            Preview
          </Link>
        </div>
      }
    >
      <div data-timeline-module className={styles.shareBody} data-share-state={minted ? "minted" : kind}>
        <div className={styles.shareHero} data-state={minted ? "minted" : kind}>
          <span className={styles.shareHeroMark} data-state={minted ? "live" : kind} aria-hidden="true">
            {kind === "live" || minted ? (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.5 8.8a2.6 2.6 0 0 0 3.7 3.7l.9-.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.25 7V5.25a2.75 2.75 0 0 1 5.5 0V7" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}
          </span>
          <div>
            <p className={styles.shareHeroTitle}>{hero.title}</p>
            <p className={styles.shareHeroBody}>{hero.body}</p>
            {kind === "live" && !minted ? (
              <p className={styles.shareHeroNote}>Lost the link? We don’t keep it, so make a new one.</p>
            ) : null}
          </div>
        </div>

        {minted ? (
          <div className={styles.receiptWrap}>
            <ShareReceipt state={minted} />
          </div>
        ) : null}
        <ActionNotice state={publishState} />
        <ActionNotice state={rotateState} />
        <ActionNotice state={revokeState} />
        <ActionNotice state={unpublishState} />

        {!canManage ? (
          <p className={styles.shareNote}>Only a project owner can change sharing.</p>
        ) : publication === null ? (
          <div className={styles.shareActions}>
            <Link href={manageHref} className={styles.buttonPrimary}>
              Choose what to share
            </Link>
          </div>
        ) : (
          <>
            {canPublish ? (
              kind === "live" ? (
                // Rotating a live link breaks the one every guest already
                // has, so it is a second-press action, never the filled one.
                <form action={rotateAction} className={styles.shareForm}>
                  <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                  <input type="hidden" name="publicationId" value={publication.id} />
                  <DangerAction
                    tone="neutral"
                    label={NEW_LINK}
                    armedLabel="Replace the link now"
                    help="Guests’ current link stops working."
                    pending={rotatePending}
                  />
                  <ExpiryField todayIso={todayIso} timezone={publication.timezone} />
                </form>
              ) : (
                <form action={publication.state === "published" ? rotateAction : publishAction} className={styles.shareForm}>
                  <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                  <input type="hidden" name="publicationId" value={publication.id} />
                  <div className={styles.shareActions}>
                    {kind === "unpublished" ? (
                      <Link href={manageHref} className={changes.length > 0 ? styles.button : styles.buttonPrimary}>
                        Choose what to share
                      </Link>
                    ) : null}
                    <button
                      type="submit"
                      disabled={publication.state === "published" ? rotatePending : publishPending}
                      className={kind === "unpublished" || changes.length > 0 ? styles.button : styles.buttonPrimary}
                    >
                      {publication.state === "published"
                        ? NEW_LINK
                        : kind === "unpublished"
                          ? "Publish again"
                          : "Publish and make the link"}
                    </button>
                    {kind === "draft" ? (
                      <Link href={manageHref} className={styles.button}>
                        Choose what to share
                      </Link>
                    ) : null}
                  </div>
                  {publication.state === "published" ? (
                    <p className={styles.fieldHelp}>Every earlier link stays off.</p>
                  ) : null}
                  <ExpiryField todayIso={todayIso} timezone={publication.timezone} />
                </form>
              )
            ) : (
              <p className={styles.shareNote}>
                This project is archived, so no new link can be made. Anything already shared still works, and you can turn it off below.
              </p>
            )}

            {changes.length > 0 ? (
              <div className={styles.changes}>
                <p className={styles.changesTitle}>
                  {changes.length === 1 ? "1 change is not on the shared page yet" : `${changes.length} changes are not on the shared page yet`}
                </p>
                <ul className={styles.changeList}>
                  {changes.slice(0, 6).map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                  {changes.length > 6 ? <li>and {changes.length - 6} more</li> : null}
                </ul>
                <Link href={manageHref} className={styles.buttonPrimary}>
                  Review and publish
                </Link>
              </div>
            ) : null}

            {publication.state === "published" ? (
              <section className={styles.stopSharing} aria-labelledby="share-stop-title">
                <h3 id="share-stop-title" className={styles.stopTitle}>
                  Stop sharing
                </h3>
                <form action={revokeAction}>
                  <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                  <input type="hidden" name="publicationId" value={publication.id} />
                  <DangerAction
                    label="Turn off all links"
                    armedLabel="Turn off all links now"
                    help="The page stays ready, and nobody can open it."
                    pending={revokePending}
                  />
                </form>
                <form action={unpublishAction}>
                  <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
                  <input type="hidden" name="publicationId" value={publication.id} />
                  <DangerAction
                    label="Take the page down"
                    armedLabel="Take the page down now"
                    help="Unpublishes the page and turns off every link."
                    pending={unpublishPending}
                  />
                </form>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  );
}
