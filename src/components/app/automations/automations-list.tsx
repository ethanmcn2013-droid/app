"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AUTOMATIONS_LABEL, automationPath } from "@/lib/product-urls";
import { TEMPLATES } from "@/lib/automations/catalogue";
import {
  deleteDraft,
  getDraftsSnapshot,
  getServerDraftsSnapshot,
  saveDraft,
  subscribeDrafts,
} from "@/lib/automations/draft-store";
import {
  STEP_W,
  boundsOf,
  copyAutomation,
  describeEdited,
  fromTemplate,
  inputPoint,
  linkPath,
  outputPoint,
  stepCountLabel,
  stepHeight,
  summarise,
  type Automation,
} from "@/lib/automations/graph";
import { AutoIcon } from "./automation-icons";
import { AutoMenu } from "./editor-parts";
import styles from "./automations.module.css";

/**
 * /app/automations: the drafts kept in this browser, and four ready-made
 * ones to start from. A preview: nothing here runs, and the page says so
 * once. One create button: the top bar's New automation. A starter is opened
 * by choosing it.
 */

// Laid out once. Positions are worked out from the starter, so the server
// and the browser draw the same picture.
const STARTERS = TEMPLATES.map((template) => ({ template, preview: fromTemplate(template, 0)! }));

/** A draft drawn small: its steps as blocks, its lines as curves. */
function FlowSketch({ doc }: { doc: Automation }) {
  const bounds = boundsOf(doc.steps);
  if (!bounds) return <span className={styles.thumbEmpty}>Nothing on it yet</span>;
  const byId = new Map(doc.steps.map((step) => [step.id, step]));
  return (
    <svg viewBox={`${bounds.x - 8} ${bounds.y - 8} ${bounds.w + 16} ${bounds.h + 16}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {doc.links.map((link) => {
        const from = byId.get(link.from);
        const to = byId.get(link.to);
        return from && to ? <path key={link.id} className={styles.flowLine} d={linkPath(outputPoint(from, link.port), inputPoint(to))} /> : null;
      })}
      {doc.steps.map((step) => (
        <rect key={step.id} className={styles.flowStep} data-kind={step.kind} x={step.x} y={step.y} width={STEP_W} height={stepHeight(step)} rx={22} />
      ))}
    </svg>
  );
}

const subscribeMinute = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};

export function AutomationsList() {
  const router = useRouter();
  const drafts = useSyncExternalStore(subscribeDrafts, getDraftsSnapshot, getServerDraftsSnapshot);
  // "Edited 5 minutes ago" is read against a clock that ticks once a minute.
  const [now, setNow] = useState(0);
  useEffect(() => subscribeMinute(() => setNow(Date.now())), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, [drafts]);

  const open = (doc: Automation) => {
    saveDraft(doc);
    router.push(automationPath(doc.id));
  };

  const list = drafts ? [...drafts.drafts].sort((a, b) => b.updatedAt - a.updatedAt) : null;

  return (
    <main id="app-main-content" tabIndex={-1} className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{AUTOMATIONS_LABEL}</h1>
              <span className={styles.pill} data-tone="accent">Preview</span>
            </div>
            <p className={styles.summary}>
              Draw what should happen by itself: when a task is late, when a date is near, when someone joins.
            </p>
          </div>
        </header>

        <p className={styles.notice} role="note">
          <AutoIcon name="info" />
          <span>
            <strong>Automations are a preview.</strong> You can design them here today. Drafts stay in this browser, and
            nothing runs yet.
            {drafts && !drafts.kept ? " This browser is not keeping drafts, so they last only until this tab is closed." : ""}
          </span>
        </p>

        <section className={styles.section} aria-labelledby="automations-drafts">
          <div className={styles.sectionHead}>
            <h2 id="automations-drafts" className={styles.sectionTitle}>Your drafts</h2>
            {list && list.length > 0 ? <span className={styles.sectionNote}>{list.length}</span> : null}
          </div>
          {list === null ? (
            <div className={styles.grid} aria-hidden="true">
              <div className={styles.skeleton} />
            </div>
          ) : list.length === 0 ? (
            <div className={styles.empty}>
              <svg className={styles.emptyArt} viewBox="0 0 248 72" aria-hidden="true" focusable="false">
                <path d="M64 36h28M156 36c14 0 10-20 28-20M156 36c14 0 10 20 28 20" />
                <rect data-on="" x="8.5" y="20.5" width="56" height="31" rx="8" />
                <rect x="92.5" y="20.5" width="64" height="31" rx="8" />
                <rect x="184.5" y="2.5" width="56" height="27" rx="8" />
                <rect x="184.5" y="42.5" width="56" height="27" rx="8" />
              </svg>
              <h3 className={styles.emptyTitle}>No drafts yet</h3>
              <p className={styles.emptyBody}>
                Open one of the ready-made ones below and change it to suit, or begin with an empty canvas from New
                automation.
              </p>
            </div>
          ) : (
            <ul className={styles.grid} style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {list.map((doc) => (
                <li key={doc.id} className={styles.card}>
                  <button type="button" className={styles.cardLink} onClick={() => router.push(automationPath(doc.id))}>
                    <span className={styles.thumb}>
                      <FlowSketch doc={doc} />
                    </span>
                    <span className={styles.cardBody}>
                      <span className={styles.cardName}>
                        <span>{doc.name}</span>
                        <span className={styles.pill}>Draft</span>
                      </span>
                      <span className={styles.cardAbout}>{summarise(doc)}</span>
                      <span className={styles.cardMeta}>
                        <span>{stepCountLabel(doc.steps.length)}</span>
                        {now > 0 ? <span>{describeEdited(doc.updatedAt, now)}</span> : null}
                      </span>
                    </span>
                  </button>
                  <div className={styles.cardMenu}>
                    <AutoMenu
                      label={`More for ${doc.name}`}
                      className={styles.iconButton}
                      items={[
                        { id: "open", label: "Open", icon: "edit", onSelect: () => router.push(automationPath(doc.id)) },
                        { id: "copy", label: "Make a copy", icon: "duplicate", onSelect: () => saveDraft(copyAutomation(doc)) },
                        { id: "delete", label: "Delete this draft", icon: "trash", danger: true, confirm: "Delete this draft for good?", onSelect: () => deleteDraft(doc.id) },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section} aria-labelledby="automations-starters">
          <div className={styles.sectionHead}>
            <h2 id="automations-starters" className={styles.sectionTitle}>Start from a ready-made one</h2>
            <span className={styles.sectionNote}>Each opens as your own draft</span>
          </div>
          <ul className={styles.grid} style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {STARTERS.map(({ template, preview }) => (
              <li key={template.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.cardLink}
                  onClick={() => {
                    const doc = fromTemplate(template);
                    if (doc) open(doc);
                  }}
                >
                  <span className={styles.thumb}>
                    <FlowSketch doc={preview} />
                  </span>
                  <span className={styles.cardBody}>
                    <span className={styles.cardName}>
                      <span>{template.name}</span>
                    </span>
                    <span className={styles.cardAbout}>{template.about}</span>
                    <span className={styles.cardMeta}>
                      <span>{stepCountLabel(template.steps.length)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
