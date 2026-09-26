"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useEdition } from "./context";
import { Chevron } from "./icons";
import s from "./edition.module.css";

/* Remounts its children when `k` changes, so a rewritten sentence fades in. */
export function Rw({ k, children }: { k: string; children: ReactNode }) {
  return (
    <span key={k} className={s.rw}>
      {children}
    </span>
  );
}

/* The signature moment. When the reader acts, the part of a sentence that
   no longer holds fades out, and the new clause writes itself in under a
   marker stroke that settles to nothing. `render` draws the clause for a key,
   so the old clause can still be drawn while it leaves. */
export function Rewrite<K extends string>({
  k,
  render,
  className,
}: {
  k: K;
  render: (k: K) => ReactNode;
  className?: string;
}) {
  const [shown, setShown] = useState<K>(k);
  const [fresh, setFresh] = useState<K | null>(null);
  if (k !== shown) {
    return (
      <span
        className={`${s.rwOut} ${className ?? ""}`}
        aria-hidden
        inert
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget) return;
          setShown(k);
          setFresh(k);
        }}
      >
        {render(shown)}
      </span>
    );
  }
  return (
    <span
      key={shown}
      className={`${fresh === shown ? s.rwIn : ""} ${className ?? ""}`}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.animationName.includes("marker")) setFresh(null);
      }}
    >
      {render(shown)}
    </span>
  );
}

/* A phrase that changed since the reader last opened the page. */
export function Chg({ n, children }: { n: number; children: ReactNode }) {
  const { tracked } = useEdition();
  return (
    <span
      className={tracked ? s.chgOn : s.chg}
      data-chg={n}
      style={{ "--i": n } as CSSProperties}
    >
      {children}
      {tracked && (
        <sup className={s.chgNum} aria-label={`change ${n}`}>
          {n}
        </sup>
      )}
    </span>
  );
}

/* A headed paragraph with its marginal note. In the brief edition only the
   topic stays; on a phone the note folds into a footnote chip. */
export function Section({
  id,
  title,
  label,
  topic,
  more,
  margin,
  foot,
  tone,
  keep,
  after,
}: {
  id: string;
  title: ReactNode;
  /* The plain name for the running head, when the title is not plain text. */
  label?: string;
  topic: ReactNode;
  more?: ReactNode;
  margin?: ReactNode;
  foot?: string;
  tone?: "calm";
  /* Keep the marginal note in the brief edition (only for short notes). */
  keep?: boolean;
  /* Always shown under the topic, in brief and full alike (e.g. actions). */
  after?: ReactNode;
}) {
  const { brief } = useEdition();
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <section
      className={s.row}
      aria-labelledby={id}
      data-tone={tone}
      data-brief={(brief && !!more && !keep) || undefined}
      data-section
      data-title={label ?? (typeof title === "string" ? title : undefined)}
    >
      <div className={s.prose} data-prose>
        <h2 id={id} className={s.h2} tabIndex={-1}>
          {title}
        </h2>
        <div className={s.topic}>{topic}</div>
        {after}
        {more && (
          <div
            className={s.more}
            data-open={!brief || undefined}
            aria-hidden={brief || undefined}
            inert={brief || undefined}
          >
            <div className={s.moreInner}>{more}</div>
          </div>
        )}
        {margin && foot && (
          <button
            type="button"
            className={s.footChip}
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen((v) => !v)}
          >
            <span className={s.footMark} aria-hidden />
            {foot}
            <Chevron className={s.footChevron} />
          </button>
        )}
      </div>
      {margin && (
        <aside
          className={s.rail}
          data-open={noteOpen || undefined}
          aria-label={foot}
        >
          {margin}
        </aside>
      )}
    </section>
  );
}
