"use client";

import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import { PEOPLE, PROJECTS, type FileItem } from "./data";
import {
  clip,
  isLatest,
  latestIn,
  pageOf,
  pillLabel,
  samePill,
  tokenFor,
  when,
  type Group,
  type Hit,
  type Pill,
  type PillKey,
  type Query,
} from "./engine";
import {
  Avatar,
  Glyph,
  Icon,
  KIND_NAME,
  Kbd,
  Marked,
  ProjectTag,
  personName,
} from "./parts";
import s from "./ask.module.css";

export function Groups({
  groups,
  files,
  q,
  selected,
  offset,
  onSelect,
  onOpen,
  onCopy,
  ocr,
  waiting,
}: {
  groups: Group[];
  files: FileItem[];
  q: Query;
  selected: number;
  offset: number;
  onSelect: (pos: number) => void;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
  ocr: boolean;
  /** Two readings are open: the list waits, dimmed, until one is picked. */
  waiting?: boolean;
}) {
  const starts = groups.map(
    (_, gi) =>
      offset + groups.slice(0, gi).reduce((a, x) => a + x.hits.length, 0),
  );
  return (
    <div className={`${s.groups} ${waiting ? s.groupsWaiting : ""}`}>
      {groups.map((g, gi) => (
        <section
          key={g.id}
          className={s.group}
          aria-labelledby={`c5-g-${g.id}`}
        >
          <h2 id={`c5-g-${g.id}`} className={s.groupTitle}>
            {g.title}
            <span className={s.groupCount}>{g.hits.length}</span>
            {g.id === "older" ? (
              <span className={s.groupNote}>
                Kept for the record. The latest is above.
              </span>
            ) : null}
          </h2>
          <ul className={s.rows} role="listbox" aria-label={g.title}>
            {g.hits.map((h, i) => {
              const n = starts[gi] + i;
              return (
                <Row
                  key={h.file.id}
                  hit={h}
                  files={files}
                  q={q}
                  index={i}
                  selected={selected === n}
                  onSelect={onSelect}
                  onOpen={onOpen}
                  onCopy={onCopy}
                  older={g.id === "older"}
                  ocr={ocr}
                  pos={n}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({
  hit,
  files,
  q,
  index,
  selected,
  onSelect,
  onOpen,
  onCopy,
  older,
  ocr,
  pos,
}: {
  hit: Hit;
  files: FileItem[];
  q: Query;
  index: number;
  selected: boolean;
  onSelect: (pos: number) => void;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
  older: boolean;
  ocr: boolean;
  pos: number;
}) {
  const f = hit.file;
  const marks = q.terms;
  let snippet: string;
  let snippetFrom: string | null = null;
  if (f.lockedIn) {
    snippet = `In ${personName(f.lockedIn)}'s Drive folder. Ask for access to read it.`;
  } else if (ocr && hit.inOcr && f.ocr) {
    snippet = clip(f.ocr, marks, 140);
    snippetFrom = "Text in the image";
  } else if (hit.para >= 0) {
    snippet = clip(f.body[hit.para].replace(/ \| /g, ": "), marks, 140);
    snippetFrom =
      f.kind === "image" || f.kind === "link"
        ? null
        : `p. ${pageOf(f, hit.para)}`;
  } else {
    snippet = (f.body[1] ?? f.body[0] ?? "").replace(/ \| /g, ": ");
    snippet = clip(snippet, [], 120);
  }
  const newer = older ? latestIn(files, f) : null;
  const approver = f.approvedBy
    ? PEOPLE.find((p) => p.id === f.approvedBy)?.first
    : null;

  return (
    <li
      className={`${s.row} ${selected ? s.rowSel : ""} ${older ? s.rowOlder : ""}`}
      style={{ "--i": Math.min(index, 10) } as CSSProperties}
      role="option"
      aria-selected={selected}
      id={`c5-row-${f.id}`}
      data-pos={pos}
      onMouseMove={() => !selected && onSelect(pos)}
    >
      <button
        type="button"
        className={s.rowMain}
        onClick={() => onOpen(f.id)}
        tabIndex={-1}
      >
        <Glyph file={f} size={34} />
        <span className={s.rowBody}>
          <span className={s.rowTitle}>
            <span className={s.rowName}>
              <Marked text={f.name} marks={marks} tone="ink" />
            </span>
            {f.v && !/ v\d+/.test(f.name) ? (
              <span className={s.ver}>v{f.v}</span>
            ) : null}
            {f.state === "approved" ? (
              <span className={s.stateOk}>
                <Icon name="check" size={11} />
                {approver ? `Approved by ${approver}` : "Approved"}
              </span>
            ) : f.state === "signed" ? (
              <span className={s.stateOk}>Signed</span>
            ) : f.state === "awaiting" ? (
              <span className={s.stateWait}>
                {f.waitingOn
                  ? `Waiting for ${personName(f.waitingOn)}`
                  : "Waiting for approval"}
              </span>
            ) : f.state === "draft" && !older ? (
              <span className={s.stateDraft}>Draft</span>
            ) : null}
            {f.lockedIn ? (
              <span className={s.stateLock}>
                <Icon name="lock" size={11} />
                No access
              </span>
            ) : null}
          </span>
          <span className={s.snippet}>
            {snippetFrom ? (
              <span className={s.snippetFrom}>{snippetFrom}</span>
            ) : null}
            <Marked text={snippet} marks={f.lockedIn ? [] : marks} />
          </span>
          <span className={s.rowMeta}>
            <ProjectTag id={f.project} compact />
            <span className={s.metaDot} aria-hidden="true" />
            <span>{KIND_NAME[f.kind]}</span>
            <span className={s.metaDot} aria-hidden="true" />
            <span>
              {personName(f.by)}, {when(f.date)}
            </span>
            {f.task ? (
              <>
                <span className={s.metaDot} aria-hidden="true" />
                <span className={s.metaTask}>
                  <Icon name="task" size={12} />
                  {f.task}
                </span>
              </>
            ) : null}
            {newer ? (
              <>
                <span className={s.metaDot} aria-hidden="true" />
                <span className={s.metaNewer}>
                  Replaced by v{newer.v} on {when(newer.date)}
                </span>
              </>
            ) : null}
          </span>
        </span>
      </button>
      <span className={s.rowActions}>
        <button
          type="button"
          className={s.iconBtn}
          onClick={() => onCopy(f.id)}
          aria-label={`Copy link to ${f.name}`}
          tabIndex={-1}
        >
          <Icon name="link" size={15} />
        </button>
        <span className={s.rowEnter}>
          <Kbd>↵</Kbd>
        </span>
      </span>
    </li>
  );
}

/* ── Narrowing tokens ───────────────────────────────────────────── */

export type FacetValue = {
  pill: Pill;
  label: string;
  count: number;
  lead?: "project" | "person" | "kind";
  ref?: string;
};
export type Facet = { key: PillKey; title: string; values: FacetValue[] };

export function buildFacets(countFor: (key: PillKey) => Hit[]): Facet[] {
  const projectHits = countFor("project");
  const personHits = countFor("person");
  const typeHits = countFor("type");

  const projects: FacetValue[] = PROJECTS.map((p) => ({
    pill: { key: "project", value: p.id },
    label: p.short,
    count: projectHits.filter((h) => h.file.project === p.id).length,
    lead: "project",
    ref: p.tone,
  }));
  const people: FacetValue[] = PEOPLE.filter((p) => p.id !== "hireco").map(
    (p) => ({
      pill: { key: "person", value: p.id } as Pill,
      label: p.first,
      count: personHits.filter(
        (h) => h.file.by === p.id || h.file.approvedBy === p.id,
      ).length,
      lead: "person" as const,
      ref: p.id,
    }),
  );
  const kinds: [string, string][] = [
    ["doc", "Documents"],
    ["sheet", "Sheets"],
    ["image", "Images"],
    ["design", "Designs"],
    ["link", "Links"],
  ];
  const types: FacetValue[] = kinds.map(([k, label]) => ({
    pill: { key: "type", value: k },
    label,
    count: typeHits.filter((h) =>
      k === "doc"
        ? h.file.kind === "doc" || h.file.kind === "pdf"
        : h.file.kind === k,
    ).length,
    lead: "kind",
    ref: k,
  }));
  return [
    { key: "project", title: "Project", values: projects },
    { key: "person", title: "Person", values: people },
    { key: "type", title: "Type", values: types },
  ];
}

const KIND_TONE: Record<string, string> = {
  doc: "var(--v3-kind-doc)",
  sheet: "var(--v3-kind-sheet)",
  image: "var(--v3-kind-image)",
  design: "var(--v3-kind-design)",
  link: "var(--v3-kind-link)",
};

/**
 * One line of suggested narrowing, drawn from what the results contain.
 * Each is the literal token you could have typed, so clicking teaches the
 * syntax. Tab from the field lands here; arrows move; Esc goes back.
 */
export function Narrow({
  facets,
  pills,
  total,
  onAdd,
  ocr,
  ocrExtra,
  onOcr,
  firstRef,
  onEscape,
}: {
  facets: Facet[];
  pills: Pill[];
  total: number;
  onAdd: (p: Pill) => void;
  ocr: boolean;
  ocrExtra: number;
  onOcr: () => void;
  firstRef: RefObject<HTMLButtonElement | null>;
  onEscape: () => void;
}) {
  const values = facets
    .flatMap((f) => f.values)
    .filter(
      (v) =>
        v.count > 0 &&
        v.count < total &&
        !pills.some((p) => samePill(p, v.pill)),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
      return;
    }
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const list = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
    );
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    list[
      Math.max(
        0,
        Math.min(list.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)),
      )
    ]?.focus();
  };
  if (values.length === 0 && ocr) return null;
  return (
    <div
      className={s.narrow}
      role="group"
      aria-label="Narrow the results"
      onKeyDown={onKey}
    >
      <span className={s.narrowLabel}>Narrow</span>
      {values.map((v, i) => (
        <button
          key={`${v.pill.key}-${v.pill.value}`}
          ref={i === 0 ? firstRef : undefined}
          type="button"
          className={s.narrowTok}
          onClick={() => onAdd(v.pill)}
          aria-label={`Only ${pillLabel(v.pill)}, ${v.count} files`}
          style={{ "--i": i } as CSSProperties}
        >
          <span className={s.narrowPlus} aria-hidden="true">
            +
          </span>
          {v.lead === "project" ? (
            <span className={s.projectDot} style={{ background: v.ref }} />
          ) : null}
          {v.lead === "person" && v.ref ? (
            <Avatar id={v.ref as never} size={14} />
          ) : null}
          {v.lead === "kind" && v.ref ? (
            <span
              className={s.kindDot}
              style={{ background: KIND_TONE[v.ref] }}
            />
          ) : null}
          <code className={s.narrowCode}>{tokenFor(v.pill)}</code>
          <span className={s.narrowCount}>{v.count}</span>
        </button>
      ))}
      {!ocr ? (
        <button
          ref={values.length === 0 ? firstRef : undefined}
          type="button"
          className={`${s.narrowTok} ${s.narrowWiden}`}
          onClick={onOcr}
          aria-label={`Also read text in images${ocrExtra ? `, ${ocrExtra} more files` : ""}`}
          style={{ "--i": values.length } as CSSProperties}
        >
          <Icon name="image" size={13} />
          <code className={s.narrowCode}>has:text-in-images</code>
          {ocrExtra ? <span className={s.narrowCount}>+{ocrExtra}</span> : null}
        </button>
      ) : null}
    </div>
  );
}

export { isLatest };
