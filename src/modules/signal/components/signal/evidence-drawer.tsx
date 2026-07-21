"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
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
  projectNames: Readonly<Record<string, string>>;
}

export function EvidenceDrawer({
  evidence,
  closeHref,
  ownerNames,
  projectNames,
}: EvidenceDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(
    1,
    Math.ceil(evidence.pagination.total / evidence.pagination.perPage),
  );

  const restoreFocus = useCallback(() => {
    const returnTarget = returnFocusRef.current;
    if (returnTarget?.isConnected) returnTarget.focus();
    else document.querySelector<HTMLElement>("#signal-main-content")?.focus();
  }, []);

  const closeDrawer = useCallback(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
    restoreFocus();
    router.replace(closeHref, { scroll: false });
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
      dialog.showModal();
      closeButtonRef.current?.focus();
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
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDrawer();
      }}
    >
      <div className="signal-drawer-header">
        <span className="signal-eyebrow">Evidence</span>
        <button
          ref={closeButtonRef}
          className="signal-button-quiet"
          type="button"
          onClick={closeDrawer}
        >
          Close
        </button>
      </div>
      <div className="signal-drawer-body">
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
          <SourceRecordList
            records={evidence.records}
            timezone={evidence.meta.period.timezone}
            ownerNames={ownerNames}
            projectNames={projectNames}
          />
          {totalPages > 1 ? (
            <nav className="signal-actions" aria-label="Evidence pages">
              {evidence.pagination.page > 1 ? (
                <Link
                  className="signal-button-secondary"
                  href={signalHref(pathname, searchParams, {
                    evidence_page: String(evidence.pagination.page - 1),
                  })}
                  scroll={false}
                >
                  Previous
                </Link>
              ) : null}
              <span className="signal-freshness">
                Page {evidence.pagination.page} of {totalPages}
              </span>
              {evidence.pagination.page < totalPages ? (
                <Link
                  className="signal-button-secondary"
                  href={signalHref(pathname, searchParams, {
                    evidence_page: String(evidence.pagination.page + 1),
                  })}
                  scroll={false}
                >
                  Next
                </Link>
              ) : null}
            </nav>
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
