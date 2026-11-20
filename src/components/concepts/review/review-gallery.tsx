"use client";

/**
 * The concepts gallery with the review built in: progress, filters, a verdict
 * on every card, and the markdown handoff (export, copy, import).
 */

import { useRef, useState } from "react";
import Link from "next/link";
import type { ConceptMeta } from "../types";
import { CONCEPT_VIEWS, conceptHref, conceptKey } from "../views";
import { buildMarkdown, downloadMarkdown, parseMarkdown } from "./export";
import { hasContent, replaceReviews, useReviews, VERDICTS, type Verdict } from "./store";
import gallery from "../gallery.module.css";
import styles from "./review.module.css";

type Filter = "all" | "open" | Verdict;
const FILTERS: readonly { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Not reviewed" },
  { key: "like", label: "Liked" },
  { key: "partly", label: "Partly" },
  { key: "out", label: "Ruled out" },
];
const VERDICT_LABEL: Record<Verdict, string> = { like: "Liked", partly: "Partly", out: "Ruled out" };

export function ReviewGallery({ concepts }: { concepts: readonly ConceptMeta[] }) {
  const reviews = useReviews();
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const verdictOf = (concept: ConceptMeta) => reviews[conceptKey(concept)]?.verdict;
  const count = (key: Filter) =>
    key === "all" ? concepts.length : key === "open" ? concepts.filter((c) => !verdictOf(c)).length : concepts.filter((c) => verdictOf(c) === key).length;
  const reviewed = concepts.length - count("open");
  const firstOpen = concepts.find((concept) => !verdictOf(concept)) ?? concepts[0];
  const shown = (concept: ConceptMeta) =>
    filter === "all" || (filter === "open" ? !verdictOf(concept) : verdictOf(concept) === filter);

  const say = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3200);
  };
  const exportFile = () => {
    downloadMarkdown(buildMarkdown(concepts, reviews));
    say("Exported. The file is in your downloads.");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown(concepts, reviews));
      say("Copied the markdown to the clipboard.");
    } catch {
      say("Copy is blocked here. Use Export instead.");
    }
  };
  const importFile = async (file: File) => {
    const data = parseMarkdown(await file.text());
    if (!data) {
      say("That file has no review data in it.");
      return;
    }
    const hasExisting = Object.values(reviews).some(hasContent);
    if (hasExisting && !window.confirm("Replace the review in this browser with the one in this file?")) return;
    replaceReviews(data);
    say(`Imported ${Object.keys(data).length} reviews.`);
  };
  const reset = () => {
    if (window.confirm("Clear every verdict and note in this browser? Export first if you want to keep them.")) {
      replaceReviews({});
      say("Review cleared.");
    }
  };

  return (
    <div className={gallery.page}>
      <div className={gallery.inner}>
        <div className={styles.galleryHead}>
          <div>
            <h1 className={gallery.title}>Concepts</h1>
            <p className={gallery.subtitle}>Open a concept, mark it Like, Partly or Rule out, and leave notes. Export the review as a markdown handoff when you are done. The chosen designs, merged into one product, are in the demo.</p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.primary} href={conceptHref(firstOpen)}>
              {reviewed === 0 ? "Start reviewing" : reviewed === concepts.length ? "Review again" : "Continue reviewing"}
            </Link>
            <button type="button" className={styles.secondary} onClick={exportFile}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2M3 13.5h10" /></svg>
              Export markdown
            </button>
            <button type="button" className={styles.ghost} onClick={copy}>Copy</button>
            <button type="button" className={styles.ghost} onClick={() => fileRef.current?.click()}>Import</button>
            <Link className={styles.secondary} href="/demo">
              Open the demo
            </Link>
            <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} />
          </div>
        </div>

        <div className={styles.summary}>
          <div className={styles.meter} role="img" aria-label={`${reviewed} of ${concepts.length} reviewed`}>
            {VERDICTS.map((verdict) => (
              <i key={verdict.key} data-verdict={verdict.key} style={{ flexGrow: count(verdict.key) }} />
            ))}
            <i data-verdict="none" style={{ flexGrow: count("open") }} />
          </div>
          <p className={styles.summaryText}>
            <b>{reviewed}</b> of {concepts.length} reviewed · {count("like")} liked · {count("partly")} partly · {count("out")} ruled out
          </p>
          <div className={styles.filters} role="group" aria-label="Show">
            {FILTERS.map((item) => (
              <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} data-verdict={item.key}>
                {item.label}<span>{count(item.key)}</span>
              </button>
            ))}
          </div>
          {reviewed > 0 ? <button type="button" className={styles.reset} onClick={reset}>Clear review</button> : null}
        </div>
        <p className={styles.notice} role="status">{notice}</p>

        {CONCEPT_VIEWS.map((view) => {
          const list = concepts.filter((concept) => concept.view === view.key && shown(concept));
          if (!list.length) return null;
          return (
            <section key={view.key} className={gallery.section} aria-labelledby={`c-${view.key}`}>
              <h2 id={`c-${view.key}`} className={gallery.sectionTitle}>{view.label}</h2>
              <ul className={gallery.grid}>
                {list.map((concept) => {
                  const review = reviews[conceptKey(concept)];
                  const noted = Boolean(review?.keep?.trim() || review?.change?.trim() || review?.notes?.trim());
                  return (
                    <li key={concept.n}>
                      <Link href={conceptHref(concept)} className={`${gallery.card} ${styles.card}`} data-verdict={review?.verdict ?? "none"}>
                        <span className={gallery.shot}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/concepts/${concept.view}-${concept.n}.png`} alt="" loading="lazy" />
                          {review?.verdict ? <span className={styles.badge} data-verdict={review.verdict}>{VERDICT_LABEL[review.verdict]}</span> : null}
                        </span>
                        <span className={styles.cardMeta}>
                          <span className={gallery.number}>{view.label} {concept.n}</span>
                          {noted ? <span className={styles.noted} title="Has notes">Notes</span> : null}
                        </span>
                        <span className={gallery.cardTitle}>{concept.title}</span>
                        <span className={gallery.thesis}>{concept.thesis}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {concepts.every((concept) => !shown(concept)) ? <p className={styles.empty}>Nothing here yet.</p> : null}
      </div>
    </div>
  );
}
