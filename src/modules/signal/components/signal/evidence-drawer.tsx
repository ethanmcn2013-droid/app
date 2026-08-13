"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EvidenceResponse } from "../../lib/analytics/contracts";
import { ActionLink } from "./action-link";
import { formatInstant, formatPeriod } from "./format";
import { SourceRecordList } from "./source-record-list";
import { signalHref } from "./links";

interface EvidenceDrawerProps {
  evidence: EvidenceResponse;
  closeHref: string;
  ownerNames: Readonly<Record<string, string>>;
  labelNames: Readonly<Record<string, string>>;
}

export function EvidenceDrawer({
  evidence,
  closeHref,
  ownerNames,
  labelNames,
}: EvidenceDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Pagination is a server round-trip. isPending is the honest busy window:
  // React holds it true until the new evidence page commits.
  const [isPaging, startPaging] = useTransition();
  // Which page the round-trip is fetching, so the status line can name it.
  // The committed page is still the old one for the whole busy window, so it
  // cannot be derived from `evidence`. It is never reset: it is written before
  // every transition and read only while `isPaging` holds, so a stale value is
  // unreachable, and clearing it in an effect would be setState-in-effect for
  // no observable gain.
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const totalPages = Math.max(
    1,
    Math.ceil(evidence.pagination.total / evidence.pagination.perPage),
  );

  const goToPage = useCallback(
    (href: string, page: number) => {
      setPendingPage(page);
      startPaging(() => {
        router.replace(href, { scroll: false });
      });
    },
    [router],
  );

  const restoreFocus = useCallback(() => {
    const returnTarget = returnFocusRef.current;
    if (returnTarget?.isConnected) {
      returnTarget.focus();
      return;
    }
    // The trigger is gone (pagination re-render, scope change), so focus falls
    // back to the content region. Two shells render this drawer and they name
    // that region differently: the standalone Signal shell and the brief page
    // wrap the ledger in #signal-main-content, while the consolidated app
    // shell — the only one present on the default /app/home/briefing — labels its
    // <main> #app-main-content. Querying one id only left focus on <body>
    // wherever the other was in play. Prefer the Signal region when it exists,
    // because that is the region the trigger lived in.
    const region =
      document.querySelector<HTMLElement>("#signal-main-content") ??
      document.querySelector<HTMLElement>("#app-main-content");
    region?.focus();
  }, []);

  const closeDrawer = useCallback(() => {
    const dialog = dialogRef.current;
    const finish = () => {
      if (dialog?.open) dialog.close();
      restoreFocus();
      router.replace(closeHref, { scroll: false });
    };
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!dialog?.open || reduceMotion) {
      finish();
      return;
    }
    // Structural sheet exit (260ms, matching the Tasks panel register).
    if (dialog.hasAttribute("data-closing")) return;

    // [data-closing] cancels the entrance animation. A cancelled animation
    // leaves no before-change style for the exit transition to start from, so
    // the sheet would jump straight off-screen when the drawer is dismissed
    // inside the 420ms entrance. Pin where the sheet and backdrop actually
    // are, commit that as a real style, then release it on the next frame so
    // the exit glides from the pinned position instead of teleporting.
    const heldTransform = window.getComputedStyle(dialog).transform;
    const heldBackdrop = window.getComputedStyle(dialog, "::backdrop").opacity;
    if (heldTransform && heldTransform !== "none") {
      dialog.style.transform = heldTransform;
    }
    dialog.style.setProperty("--signal-drawer-backdrop-hold", heldBackdrop);
    dialog.setAttribute("data-closing", "");
    void dialog.offsetWidth; // commit the pinned position

    window.requestAnimationFrame(() => {
      if (!dialog.isConnected) return;
      dialog.style.transform = "";
      dialog.style.removeProperty("--signal-drawer-backdrop-hold");
      window.setTimeout(finish, 260);
    });
  }, [closeHref, restoreFocus, router]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const active =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnFocusRef.current =
      active && active !== document.body
        ? active
        : findEvidenceTrigger(evidence.observation.id);
    if (!dialog.open) {
      dialog.removeAttribute("data-closing");
      dialog.style.transform = "";
      dialog.style.removeProperty("--signal-drawer-backdrop-hold");
      dialog.showModal();
      // showModal() focuses the first focusable descendant, which is the Close
      // button, so a screen reader reads "Close, button" before the sheet says
      // what it is. Focus the dialog itself instead: it is labelled by the
      // sheet's own h2, so the announcement leads with the observation.
      // showModal() keeps focus trapped in the top layer either way.
      dialog.focus();
    }

    const handleCancel = (event: Event) => {
      event.preventDefault();
      closeDrawer();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      if (dialog.open) dialog.close();
      restoreFocus();
    };
  }, [closeDrawer, evidence.observation.id, restoreFocus]);

  return (
    <dialog
      ref={dialogRef}
      className="signal-evidence-drawer"
      aria-labelledby="signal-evidence-title"
      tabIndex={-1}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDrawer();
      }}
    >
      <div className="signal-drawer-header">
        <span className="signal-eyebrow">Evidence</span>
        <button
          className="signal-button-quiet"
          type="button"
          onClick={closeDrawer}
        >
          Close
        </button>
      </div>
      <div className="signal-drawer-body" aria-busy={isPaging}>
        <header>
          <p className="signal-eyebrow">What Signal observed</p>
          <h2 id="signal-evidence-title">{evidence.observed}</h2>
        </header>

        <section className="signal-drawer-section" aria-labelledby="evidence-why">
          <h3 id="evidence-why">Why it surfaced</h3>
          <ul className="signal-evidence-reasons">
            {evidence.why.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>

        <section className="signal-drawer-section" aria-labelledby="evidence-rule">
          <h3 id="evidence-rule">Rule and comparison</h3>
          <p>{evidence.deterministicRule}</p>
          <p>{evidence.comparisonBasis}</p>
          <p>
            Rule {evidence.observation.ruleVersion} · {formatPeriod(evidence.meta.period)}
          </p>
        </section>

        <section className="signal-drawer-section" aria-labelledby="evidence-records">
          <h3 id="evidence-records">
            Contributing work · {evidence.pagination.total}
          </h3>
          {/* The list holds the page that is being replaced. Dimming it is
              the only thing a sighted user could see during the round-trip:
              aria-busy on the body below is silent, and the records are
              identical until the new page commits. */}
          <div
            className="signal-record-pane"
            data-paging={isPaging ? "" : undefined}
          >
            <SourceRecordList
              records={evidence.records}
              timezone={evidence.meta.period.timezone}
              ownerNames={ownerNames}
              labelNames={labelNames}
            />
          </div>
          {totalPages > 1 ? (
            <>
              <nav className="signal-actions" aria-label="Evidence pages">
                {evidence.pagination.page > 1 ? (
                  <PageLink
                    href={signalHref(pathname, searchParams, {
                      evidence_page: String(evidence.pagination.page - 1),
                    })}
                    page={evidence.pagination.page - 1}
                    onNavigate={goToPage}
                  >
                    Previous
                  </PageLink>
                ) : null}
                <span className="signal-freshness">
                  Page {evidence.pagination.page} of {totalPages}
                </span>
                {evidence.pagination.page < totalPages ? (
                  <PageLink
                    href={signalHref(pathname, searchParams, {
                      evidence_page: String(evidence.pagination.page + 1),
                    })}
                    page={evidence.pagination.page + 1}
                    onNavigate={goToPage}
                  >
                    Next
                  </PageLink>
                ) : null}
              </nav>
              {/* A screen reader never announces an aria-busy toggle on a
                  plain container, so the busy window says so itself. Mounted
                  with the pagination and holding an empty line at rest, so
                  the announcement costs no layout shift when it arrives. */}
              <p
                className="signal-drawer-status"
                role="status"
                aria-live="polite"
              >
                {isPaging && pendingPage !== null
                  ? `Loading page ${pendingPage} of ${totalPages}…`
                  : ""}
              </p>
            </>
          ) : null}
        </section>

        <section className="signal-drawer-section" aria-labelledby="evidence-actions">
          <h3 id="evidence-actions">Actions</h3>
          <div className="signal-actions">
            {evidence.actions.map((action) => (
              <ActionLink action={action} key={action.id} />
            ))}
          </div>
        </section>

        <section className="signal-drawer-section" aria-labelledby="evidence-trust">
          <h3 id="evidence-trust">Trust and coverage</h3>
          <p>
            Last calculated {formatInstant(
              evidence.meta.calculatedAt,
              evidence.meta.period.timezone,
            )}
            . Scope: {evidence.meta.scope.type} · {evidence.meta.scope.id}.
          </p>
          <div className="signal-coverage-grid">
            {Object.values(evidence.meta.coverage.providers)
              .filter((provider) => provider !== undefined)
              .map((provider) => (
                <div className="signal-coverage-row" key={provider.provider}>
                  <span>{provider.provider}</span>
                  <span>
                    {provider.status} · {provider.sourceRecordCount} records
                  </span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </dialog>
  );
}

/**
 * A pagination link that routes its client-side navigation through the
 * drawer's transition, so the busy window it opens — the dimmed record pane
 * and the polite status line — covers the real round-trip. Still a plain
 * anchor: the href, middle-click, and open-in-new-tab all behave normally.
 * `page` is the destination the status line names; it is the one thing the
 * href carries that the drawer cannot read back until the page commits.
 */
function PageLink({
  href,
  page,
  onNavigate,
  children,
}: {
  href: string;
  page: number;
  onNavigate: (href: string, page: number) => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      className="signal-button-secondary"
      href={href}
      scroll={false}
      onNavigate={(event) => {
        event.preventDefault();
        onNavigate(href, page);
      }}
    >
      {children}
    </Link>
  );
}

function findEvidenceTrigger(evidenceId: string): HTMLElement | null {
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    try {
      if (new URL(link.href).searchParams.get("evidence") === evidenceId) {
        return link;
      }
    } catch {
      // Ignore non-URL hrefs; product links are validated elsewhere.
    }
  }
  return null;
}
