"use client";

/**
 * The plan's side column (spec 3.2): What guests see, and only that. The
 * next milestone is already on the runway and leads the Now group (with its
 * "Open task →"), and Share and Preview live in the header, so none of them
 * is repeated here.
 *
 * "What guests see" is the emotional centre of the product, so it is shown,
 * not described: the guest's own page, the same component `/s/[token]`
 * renders, in a phone frame at 240px, read-only and `inert` so nothing in it
 * can be pressed, focused or counted as a view. Under it, the plain state
 * of sharing.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { changesClause, liveSince, shareStateOf, type SharePublicationSummary } from "./share-state";
import styles from "./plan.module.css";

export function GuestsSee({
  publication,
  todayIso,
  preview,
  canManage,
  manageHref,
}: {
  publication: SharePublicationSummary | null;
  todayIso: string;
  /** The guest's page, rendered by the server from the latest publication. */
  preview: ReactNode | null;
  canManage: boolean;
  manageHref: string;
}) {
  const kind = shareStateOf(publication);
  const pending = changesClause(publication?.divergedTitles.length ?? 0);
  // On a phone the preview waits behind one button; elsewhere it is open.
  const [open, setOpen] = useState(false);

  return (
    <section className={styles.sideCard} data-guests="" data-open={open ? "" : undefined} aria-labelledby="plan-guests-title">
      <h2 id="plan-guests-title" className={styles.sideTitle}>
        What guests see
      </h2>
      <button type="button" className={styles.guestsToggle} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide what guests see" : "Show what guests see"}
      </button>
      <div className={styles.guestsBody}>
      {preview ? (
        <div className={styles.phoneFrame} aria-hidden="true" inert>
          <div className={styles.phoneScreen}>
            <div className={styles.phoneScale}>{preview}</div>
          </div>
        </div>
      ) : (
        <div className={styles.phoneEmpty}>
          <span className={styles.phoneEmptyMark} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <rect x="4" y="1.75" width="8" height="12.5" rx="1.75" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </span>
          <p>Guests see nothing yet. Choose what to share, then publish to make a link.</p>
        </div>
      )}

      <p className={styles.shareLine}>
        <span className={styles.statusDot} data-state={kind} aria-hidden="true" />
        {kind === "live" && publication
          ? liveSince(publication, todayIso)
          : kind === "off"
            ? "Links are off. The page is still ready."
            : kind === "unpublished"
              ? "Taken down. No link opens it."
              : kind === "draft"
                ? "Ready to share, not live yet"
                : "Private to this project"}
      </p>
      {pending ? (
        <p className={styles.sideText}>
          <span className={styles.pendingWords}>{pending}.</span>{" "}
          {canManage ? (
            <Link href={manageHref} className={styles.link}>
              Review →
            </Link>
          ) : null}
        </p>
      ) : null}
      {!canManage ? <p className={styles.sideText}>Only project owners can share.</p> : null}
      </div>
    </section>
  );
}

export function ContextColumn(props: {
  todayIso: string;
  publication: SharePublicationSummary | null;
  preview: ReactNode | null;
  canManage: boolean;
  manageHref: string;
}) {
  return (
    <div className={styles.contextColumn}>
      <GuestsSee
        publication={props.publication}
        todayIso={props.todayIso}
        preview={props.preview}
        canManage={props.canManage}
        manageHref={props.manageHref}
      />
    </div>
  );
}
