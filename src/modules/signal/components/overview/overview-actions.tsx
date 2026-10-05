"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { openSignalLedgerEntry } from "../../app/signal-ledger-actions";
import styles from "./overview.module.css";

/**
 * The Overview's only client code: opening a signal in Tasks, and the
 * "Why this" disclosure. Everything else on the page is server-rendered.
 */

/**
 * A form post, not a link, and deliberately so: the ledger DTO never lets a
 * source task id reach the URL, so the destination is rebuilt server-side
 * from an opaque entry id. That costs middle-click and open-in-new-tab, which
 * is the price of the id boundary. The action also records the one honest
 * deliberate-open moment for sponsored-use attribution.
 */
export function OpenInTasks({ entryId, label }: { entryId: string; label: string }) {
  return (
    <form action={openSignalLedgerEntry}>
      <input type="hidden" name="entryId" value={entryId} />
      <OpenButton label={label} />
    </form>
  );
}

/**
 * The action is a server round-trip. `aria-disabled` rather than `disabled`,
 * because a disabled control drops keyboard focus to the body and the reader
 * loses their place; the click guard is what actually prevents the second
 * submit. The polite status is the announcement a disabled button never makes.
 */
function OpenButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        className={styles.action}
        aria-disabled={pending}
        data-pending={pending ? "" : undefined}
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        {label}
        <ArrowIcon />
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? "Opening in Tasks." : ""}
      </span>
    </>
  );
}

/**
 * The reasons stay in the document when closed, so aria-controls always
 * resolves; `inert` keeps the collapsed panel out of the tab order and the
 * accessibility tree. Height animates through grid rows in CSS, which the
 * reduced-motion block in the stylesheet switches off.
 */
export function WhyThis({ panelId, reasons }: { panelId: string; reasons: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.why}>
      <button
        type="button"
        className={styles.whyToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        Why this
        <svg
          className={styles.whyChevron}
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
      </button>
      <div
        id={panelId}
        className={styles.whyPanel}
        data-open={open ? "" : undefined}
        inert={!open}
      >
        <div className={styles.whyInner}>
          <ul className={styles.reasons}>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}
