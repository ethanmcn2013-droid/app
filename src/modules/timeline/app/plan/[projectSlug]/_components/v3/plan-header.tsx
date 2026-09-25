"use client";

/**
 * The plan's header (v3, round 3):
 *
 *   Mara & Finn                          [ All projects ][ TO The Orchard ▾ ]
 *   ⚑ Wedding day · Sat 3 Oct · 79 days to go         [Preview P] [Share]
 *   ● Shared page live · 1 link · Updated from Tasks 2 min ago
 *
 * The view tabs sit where they sit on All projects, top right and level with
 * the title, so the control just pressed never moves. The tab names the
 * Project, so there is no separate project line (the top bar keeps the
 * breadcrumb). On a phone the tabs are a full-width row above the title, and
 * Preview and Share fold into a ⋯ menu.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { EffectiveNode } from "@/modules/timeline/server/db/timeline-queries";
import { formatWeekdayDate, relativeDayPhrase } from "@/lib/projects/project-portfolio-scale";
import { RowMenu, RowMenuButton, type RowMenuState } from "@/components/app/portfolio/row-menu";
import { FlagGlyph, Kbd } from "@/components/app/portfolio/timeline-ui";
import styles from "./plan.module.css";

function daysToGo(iso: string, todayIso: string): string {
  const phrase = relativeDayPhrase(iso, todayIso);
  if (phrase === "today") return "Today";
  if (phrase === "tomorrow") return "Tomorrow";
  if (phrase.startsWith("in ")) return `${phrase.slice(3)} to go`;
  return phrase;
}

export function PlanHeader({
  planName,
  viewSwitch,
  keyNode,
  todayIso,
  counts,
  previewHref,
  manageHref,
  onShare,
  statusLine,
  archived,
  shareLabel,
}: {
  planName: string;
  viewSwitch: ReactNode;
  keyNode: EffectiveNode | null;
  todayIso: string;
  counts: { total: number; done: number };
  previewHref: string;
  manageHref: string;
  onShare: () => void;
  statusLine: ReactNode;
  archived: boolean;
  shareLabel: string;
}) {
  const [menu, setMenu] = useState<RowMenuState | null>(null);

  return (
    <header className={styles.header}>
      <div className={styles.tabsRow}>{viewSwitch}</div>

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{planName}</h1>
        {/* Each segment keeps its words together and carries its own "·", so
            a wrapped line never ends on a separator. */}
        <p className={styles.keyLine}>
          {keyNode?.targetDate ? (
            <>
              <span className={styles.keySeg}>
                <span className={styles.keyFlag}>
                  <FlagGlyph size={12} />
                </span>
                <span className={styles.keyTitle}>{keyNode.title}</span>
              </span>
              <span className={styles.keySeg} data-sep="">
                {formatWeekdayDate(keyNode.targetDate).replace(/ \d{4}$/, "")}
              </span>
              <span className={`${styles.keySeg} ${styles.keyCount}`} data-sep="">
                {daysToGo(keyNode.targetDate, todayIso)}
              </span>
            </>
          ) : (
            <span>
              {counts.total === 0
                ? "No milestones yet"
                : `${counts.total} ${counts.total === 1 ? "milestone" : "milestones"} · ${counts.done} done`}
            </span>
          )}
        </p>
      </div>
      <div className={styles.headActions}>
        <div className={styles.actions}>
          <Link href={previewHref} className={styles.button} title="Preview what guests see (P)">
            Preview
            <Kbd className={styles.kbdInline}>P</Kbd>
          </Link>
          <button type="button" className={styles.buttonPrimary} onClick={onShare} aria-haspopup="dialog" title="Share (S)">
            {shareLabel}
          </button>
        </div>
        <div className={styles.phoneActions}>
          <RowMenuButton
            className={styles.iconButton}
            label="Plan actions"
            expanded={menu !== null}
            onOpen={(anchor, button) =>
              setMenu({
                anchor,
                label: "Plan actions",
                returnTo: button,
                items: [
                  { id: "share", label: shareLabel, onSelect: onShare },
                  { id: "preview", label: "Preview what guests see", onSelect: () => window.location.assign(previewHref) },
                  { id: "pages", label: "Shared pages", onSelect: () => window.location.assign(manageHref) },
                ],
              })
            }
          />
        </div>
      </div>

      <div className={styles.statusSlot}>{statusLine}</div>

      {archived ? (
        <p role="status" className={`${styles.archivedNote} ${styles.archivedSlot}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2" y="3" width="12" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3 6v6.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6M6.5 9h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>This project is archived. You can read this plan but not change it. Existing links still work and can be turned off.</span>
        </p>
      ) : null}
      <RowMenu state={menu} onClose={() => setMenu(null)} />
    </header>
  );
}
