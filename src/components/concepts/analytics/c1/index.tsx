"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import { InlineGlyph, Sidenote } from "./charts";
import { PROJECTS, parse, plain, type Letter, type Note, type Piece, type Project } from "./data";
import styles from "./letter.module.css";

type Active = { note: string; mark: string } | null;

const swatch = (n: number) => `var(--v3-project-${n})`;

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function readingTime(letter: Letter) {
  const words = [letter.lede, ...letter.paras.map((p) => p.text)].map(plain).join(" ").split(/\s+/).length;
  const seconds = Math.round((words / 230) * 60);
  return seconds < 60 ? "Under a minute to read" : `About ${Math.round(seconds / 60)} minutes to read`;
}

/* ── inline rendering of a sentence with refs and glyphs ──────────── */

function Prose({
  text,
  letter,
  active,
  onHover,
  onPick,
  noteOwner,
}: {
  text: string;
  letter: Letter;
  active: Active;
  onHover: (a: Active) => void;
  onPick: (note: string, mark: string) => void;
  noteOwner: (note: string) => string | undefined;
}) {
  const pieces = parse(text);
  // A glyph belongs to the note of the nearest ref before it.
  const owners: (string | null)[] = [];
  pieces.forEach((p, i) => owners.push(p.kind === "ref" ? p.note : i > 0 ? owners[i - 1] : null));

  const renderRef = (p: Extract<Piece, { kind: "ref" }>, key: number) => {
    const on = active?.note === p.note && active.mark === p.mark;
    if (!letter.notes[p.note]) return <span key={key}>{p.text}</span>;
    const owner = noteOwner(p.note);
    return (
      <button
        key={key}
        type="button"
        className={`${styles.ref} ${on ? styles.refOn : ""}`}
        aria-controls={owner ? `note-${owner}` : undefined}
        onMouseEnter={() => onHover({ note: p.note, mark: p.mark })}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover({ note: p.note, mark: p.mark })}
        onBlur={() => onHover(null)}
        onClick={() => onPick(p.note, p.mark)}
      >
        {p.text}
      </button>
    );
  };

  // Keep each glyph on the same line as the word before it and any punctuation after it.
  const out: ReactNode[] = [];
  const texts = pieces.map((p) => (p.kind === "text" ? p.text : ""));
  pieces.forEach((p, i) => {
    if (p.kind === "ref") {
      out.push(renderRef(p, i));
      return;
    }
    if (p.kind === "glyph") {
      const glyph = letter.glyphs[p.id];
      if (!glyph) return;
      const owner = owners[i];
      const lit = owner != null && active?.note === owner;
      const before = i > 0 && pieces[i - 1].kind === "text" ? (texts[i - 1].match(/(\S+\s*)$/)?.[1] ?? "") : "";
      const after = i + 1 < pieces.length && pieces[i + 1].kind === "text" ? (texts[i + 1].match(/^[^\s\w]+/)?.[0] ?? "") : "";
      if (before) texts[i - 1] = texts[i - 1].slice(0, texts[i - 1].length - before.length);
      if (after) texts[i + 1] = texts[i + 1].slice(after.length);
      // the preceding text node was already pushed; replace it with its trimmed version
      if (before && out.length && pieces[i - 1].kind === "text") out[out.length - 1] = <span key={`${i - 1}t`}>{texts[i - 1]}</span>;
      out.push(
        <span key={i} className={styles.nowrap}>
          {before}
          <InlineGlyph glyph={glyph} lit={lit} />
          {after}
        </span>,
      );
      return;
    }
    out.push(<span key={i}>{texts[i]}</span>);
  });
  return <>{out}</>;
}

/* ── week signature: five dots, Monday to Friday ──────────────────── */

function Dots({ dots, on, max }: { dots: number[]; on: boolean; max: number }) {
  return (
    <svg className={styles.dots} width={38} height={8} viewBox="0 0 38 8" aria-hidden="true">
      {dots.map((d, i) => {
        const r = d === 0 ? 1.5 : 1.5 + (d / Math.max(1, max)) * 2.3;
        return (
          <circle
            key={i}
            cx={4 + i * 7.5}
            cy={4}
            r={r}
            fill={d === 0 ? "transparent" : on ? "var(--v3-accent)" : "var(--v3-text-3)"}
            stroke={d === 0 ? "var(--v3-control-border)" : "none"}
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}

/* ── project switch ───────────────────────────────────────────────── */

function ProjectSwitch({ project, onChange }: { project: Project; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const focusOption = (dir: 1 | -1 | 0) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? []);
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = dir === 0 ? Math.max(0, items.findIndex((b) => b.getAttribute("aria-selected") === "true")) : (at + dir + items.length) % items.length;
    items[next]?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusOption(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusOption(-1);
    }
  };

  const groups: [string, Project[]][] = [
    ["Your projects", PROJECTS.filter((p) => p.group === "main")],
    ["Other projects", PROJECTS.filter((p) => p.group === "other")],
  ];

  return (
    <div className={styles.switch}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.switchButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          requestAnimationFrame(() => focusOption(0));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusOption(0));
          }
        }}
      >
        <span className={styles.swatch} style={{ background: swatch(project.swatch) }} aria-hidden="true" />
        <span className={styles.switchName}>{project.name}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={styles.chev}>
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <>
          <div className={styles.scrimClear} onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={listRef} className={styles.menu} role="listbox" aria-label="Choose a project" onKeyDown={onKey}>
            {groups.map(([label, list]) => (
              <div key={label} role="group" aria-label={label}>
                <p className={styles.menuGroup}>{label}</p>
                {list.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={p.id === project.id}
                    className={styles.option}
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                      buttonRef.current?.focus();
                    }}
                  >
                    <span className={styles.swatch} style={{ background: swatch(p.swatch) }} aria-hidden="true" />
                    <span className={styles.optionText}>
                      <span className={styles.optionName}>{p.name}</span>
                      <span className={styles.optionKind}>
                        {p.kind}
                        {p.state === "empty" ? " · no letter yet" : ` · ${p.letters.length} ${p.letters.length === 1 ? "letter" : "letters"}`}
                      </span>
                    </span>
                    {p.id === project.id ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={styles.tick}>
                        <path d="M3 7.5 6 10.5 11 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ── the archive rail ─────────────────────────────────────────────── */

function Rail({ project, selected, onSelect }: { project: Project; selected: string; onSelect: (key: string) => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  const maxDay = Math.max(1, ...project.letters.flatMap((l) => l.dots));
  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : Math.min(items.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)));
    items[next]?.focus();
    const key = items[next]?.dataset.key;
    if (key) onSelect(key);
  };
  return (
    <nav className={styles.rail} aria-label="Past letters">
      <h2 className={styles.railTitle}>Letters</h2>
      <p className={styles.railSub}>{project.state === "empty" ? "The first arrives on Friday." : "One every Friday afternoon."}</p>
      {project.state === "empty" ? (
        <div className={styles.railEmpty}>
          <span className={styles.railEmptyDot} aria-hidden="true" />
          <span>
            <span className={styles.railWeek}>Friday 2 October</span>
            <span className={styles.railMood}>Your first letter</span>
          </span>
        </div>
      ) : (
        <ol className={styles.railList} ref={listRef} onKeyDown={onKey}>
          {project.letters.map((l, i) => {
            const on = l.key === selected;
            return (
              <li key={l.key}>
                <button
                  type="button"
                  data-key={l.key}
                  className={`${styles.railItem} ${on ? styles.railItemOn : ""}`}
                  aria-current={on ? "true" : undefined}
                  tabIndex={on ? 0 : -1}
                  onClick={() => onSelect(l.key)}
                >
                  <span className={styles.railWeek}>{i === 0 ? "This week" : `Week of ${l.week}`}</span>
                  <span className={styles.railMood}>{l.mood}</span>
                  <Dots dots={l.dots} on={on} max={maxDay} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}

/* ── one paragraph with its sidenote ──────────────────────────────── */

function Paragraph({
  id,
  topic,
  note,
  open,
  onToggle,
  active,
  children,
  reduced,
  lede,
}: {
  lede?: boolean;
  id: string;
  topic: string;
  note?: Note;
  open: boolean;
  onToggle: () => void;
  active: Active;
  children: ReactNode;
  reduced: boolean;
}) {
  const lit = Boolean(note && active?.note === note.id);
  const external = note && active?.note === note.id ? active.mark : null;
  return (
    <section className={styles.para} aria-label={topic}>
      {note ? (
        <aside className={styles.margin} id={`note-${id}`} aria-label={`The numbers: ${note.title}`}>
          <Sidenote note={note} external={external} lit={lit} />
        </aside>
      ) : null}
      <div className={styles.paraText}>
        <p className={lede ? styles.lede : styles.body}>{children}</p>
        {note ? (
          <div className={styles.fold}>
            <button type="button" className={styles.foldButton} aria-expanded={open} aria-controls={`fold-${id}`} onClick={onToggle}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`${styles.foldChev} ${open ? styles.foldChevOpen : ""}`}>
                <path d="M3.5 2 6.5 5 3.5 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {open ? "Hide the numbers" : "Show the numbers"}
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={`fold-${id}`}
                  className={styles.foldBody}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <Sidenote note={note} external={external} lit={lit} compact />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ── appendix: every number in the letter ─────────────────────────── */

function Appendix({ letter }: { letter: Letter }) {
  const rows = letter.paras.flatMap((p) => {
    const note = p.note ? letter.notes[p.note] : undefined;
    return note ? note.facts.map((f, i) => ({ topic: i === 0 ? p.topic : "", ...f, key: `${p.id}-${i}` })) : [];
  });
  return (
    <section className={styles.appendix} aria-labelledby="appendix-title">
      <h2 id="appendix-title" className={styles.appendixTitle}>
        Every number in this letter
      </h2>
      <p className={styles.appendixSub}>Where each figure comes from, and how it is counted.</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Part of the letter</th>
            <th scope="col">What</th>
            <th scope="col" className={styles.num}>
              Number
            </th>
            <th scope="col">How it is counted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.topic ? styles.rowFirst : undefined}>
              <td className={styles.tdTopic}>{r.topic}</td>
              <td>{r.label}</td>
              <td className={styles.num}>{r.value}</td>
              <td className={styles.tdHow}>{r.how}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ── the letter itself ────────────────────────────────────────────── */

function LetterView({
  project,
  letter,
  isCurrent,
  current,
  short,
  numbers,
  onBackToNow,
  onStep,
  olderKey,
  newerKey,
}: {
  project: Project;
  letter: Letter;
  isCurrent: boolean;
  current: Letter;
  short: boolean;
  numbers: boolean;
  onBackToNow: () => void;
  onStep: (key: string) => void;
  olderKey?: string;
  newerKey?: string;
}) {
  const reduced = Boolean(useReducedMotion());
  const [hover, setHover] = useState<Active>(null);
  const [pinned, setPinned] = useState<Active>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [email, setEmail] = useState(true);
  const active = hover ?? pinned;

  // The first paragraph's note sits beside the opening line, where its numbers first appear.
  const ledeNote = letter.paras[0]?.note;
  const noteOwner = (note: string) => (note === ledeNote ? "lede" : letter.paras.find((p) => p.note === note)?.id);
  const pick = (note: string, mark: string) => {
    const same = pinned?.note === note && pinned.mark === mark;
    setPinned(same ? null : { note, mark });
    const owner = noteOwner(note);
    if (owner) {
      setOpen((prev) => {
        const next = new Set(prev);
        if (same) next.delete(owner);
        else next.add(owner);
        return next;
      });
    }
  };
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const prose = (text: string) => <Prose text={text} letter={letter} active={active} onHover={setHover} onPick={pick} noteOwner={noteOwner} />;

  const thenNow = isCurrent
    ? null
    : letter.status === current.status
      ? `Then and now: ${lowerFirst(current.status)}.`
      : `Then: ${lowerFirst(letter.status)}. Now: ${lowerFirst(current.status)}.`;

  return (
    <div
      className={styles.letter}
      onKeyDown={(e) => {
        if (e.key === "Escape") setPinned(null);
      }}
    >
      <header className={styles.letterHead}>
        <p className={styles.kicker}>
          <span className={styles.swatchSmall} style={{ background: swatch(project.swatch) }} aria-hidden="true" />
          {isCurrent ? "This week's letter" : `A letter from ${letter.written.replace(/^Friday /, "")}`}
          <span className={styles.sep} aria-hidden="true">·</span>
          {readingTime(letter)}
        </p>
        <h1 className={styles.headline}>{letter.headline}</h1>
        <p className={styles.dateline}>{letter.dateline}</p>
        {thenNow ? (
          <p className={styles.thenNow}>
            <span className={styles.thenNowText}>
              {letter.status === current.status ? (
                <span className={styles.now}>Then and now: {lowerFirst(current.status)}.</span>
              ) : (
                <>
                  <span className={styles.then}>Then: {lowerFirst(letter.status)}.</span>{" "}
                  <span className={styles.now}>Now: {lowerFirst(current.status)}.</span>
                </>
              )}
            </span>
            <button type="button" className={styles.textButton} onClick={onBackToNow}>
              Read this week&rsquo;s letter
            </button>
          </p>
        ) : null}
      </header>

      {letter.notice ? (
        <p className={styles.notice} role="note">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={styles.noticeIcon}>
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 7v4M8 4.8v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{letter.notice}</span>
        </p>
      ) : null}

      {short ? (
        <div className={styles.shortWrap}>
          <ol className={styles.short}>
            {letter.short.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      ) : (
        <>
          <div className={styles.paras}>
            <Paragraph
              lede
              id="lede"
              topic="In short"
              note={ledeNote ? letter.notes[ledeNote] : undefined}
              open={open.has("lede")}
              onToggle={() => toggle("lede")}
              active={active}
              reduced={reduced}
            >
              {prose(letter.lede)}
            </Paragraph>
            {letter.paras.map((p, i) => (
              <Paragraph
                key={p.id}
                id={p.id}
                topic={p.topic}
                note={p.note && i > 0 ? letter.notes[p.note] : undefined}
                open={open.has(p.id)}
                onToggle={() => toggle(p.id)}
                active={active}
                reduced={reduced}
              >
                {prose(p.text)}
              </Paragraph>
            ))}
          </div>
        </>
      )}

      <footer className={styles.signoff}>
        {letter.actions.length ? (
          <>
            <p className={styles.suggest}>{isCurrent ? "If you have ten minutes, these would help most:" : "Suggested that week:"}</p>
            <ul className={styles.actions}>
              {letter.actions.map((a) => {
                const k = `${project.id}:${letter.key}:${a.id}`;
                const isDone = done.has(k);
                if (a.kind === "link") {
                  const href = a.id === "timeline" ? PRODUCT_APP_PATHS.timeline : PRODUCT_APP_PATHS.tasks;
                  return (
                    <li key={a.id}>
                      <Link href={href} className={styles.action}>
                        {a.label}
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M4.5 3 7.5 6 4.5 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={a.id}>
                    <AnimatePresence mode="wait" initial={false}>
                      {isDone ? (
                        <motion.p
                          key="done"
                          className={styles.actionDone}
                          role="status"
                          initial={{ opacity: 0, y: reduced ? 0 : 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduced ? 0 : 0.16 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={styles.doneTick}>
                            <path d="M3 7.5 6 10.5 11 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span>{a.done}</span>
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() =>
                              setDone((prev) => {
                                const next = new Set(prev);
                                next.delete(k);
                                return next;
                              })
                            }
                          >
                            Undo
                          </button>
                        </motion.p>
                      ) : (
                        <motion.button
                          key="todo"
                          type="button"
                          className={`${styles.action} ${a.kind === "primary" ? styles.actionPrimary : ""}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: reduced ? 0 : 0.12 }}
                          onClick={() => setDone((prev) => new Set(prev).add(k))}
                        >
                          {a.label}
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
        <p className={styles.closing}>{isCurrent ? "Have a good weekend." : "That was the week."}</p>
        <p className={styles.signature}>{letter.signoff}</p>

        <div className={styles.letterNav}>
          {olderKey ? (
            <button type="button" className={styles.navButton} onClick={() => onStep(olderKey)}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M7.5 3 4.5 6 7.5 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Older letter
            </button>
          ) : (
            <span />
          )}
          {newerKey ? (
            <button type="button" className={styles.navButton} onClick={() => onStep(newerKey)}>
              Newer letter
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M4.5 3 7.5 6 4.5 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <label className={styles.email}>
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              <span>Also send it to my inbox on Fridays</span>
            </label>
          )}
        </div>
      </footer>

      {numbers ? <Appendix letter={letter} /> : null}
    </div>
  );
}

/* ── empty state: a project too new for a letter ──────────────────── */

function EmptyLetter({ project }: { project: Project }) {
  const sample = PROJECTS[0].letters[0];
  return (
    <div className={styles.letter}>
      <header className={styles.letterHead}>
        <p className={styles.kicker}>
          <span className={styles.swatchSmall} style={{ background: swatch(project.swatch) }} aria-hidden="true" />
          {project.empty?.created}
        </p>
        <h1 className={styles.headline}>{project.empty?.title}</h1>
        <p className={styles.emptyBody}>{project.empty?.body}</p>
        <div className={styles.emptyActions}>
          <Link href={PRODUCT_APP_PATHS.tasks} className={`${styles.action} ${styles.actionPrimary}`}>
            Add this week&rsquo;s tasks
          </Link>
        </div>
      </header>
      <p className={styles.previewLabel}>This is what a letter looks like, from another project:</p>
      <div className={styles.preview} aria-hidden="true" inert>
        <p className={styles.previewHead}>{sample.headline}</p>
        <p className={styles.lede}>{plain(sample.lede)}</p>
        <p className={styles.body}>{plain(sample.paras[0].text)}</p>
        <p className={styles.body}>{plain(sample.paras[1].text)}</p>
      </div>
    </div>
  );
}

function ToggleMark({ on }: { on: boolean }) {
  return (
    <span className={`${styles.toggleMark} ${on ? styles.toggleMarkOn : ""}`} aria-hidden="true">
      {on ? (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M2.2 5.2 4.2 7.2 7.8 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

/* ── page ─────────────────────────────────────────────────────────── */

export default function FridayLetter() {
  const reduced = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLDivElement>(null);
  const [projectId, setProjectId] = useState(PROJECTS[0].id);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [short, setShort] = useState(false);
  const [numbers, setNumbers] = useState(false);

  const project = useMemo(() => PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0], [projectId]);
  const current = project.letters[0];
  const letterKey = picked[project.id] ?? current?.key;
  const index = Math.max(0, project.letters.findIndex((l) => l.key === letterKey));
  const letter = project.letters[index];

  const select = (key: string) => {
    setPicked((prev) => ({ ...prev, [project.id]: key }));
    rootRef.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  const empty = project.state === "empty" || !letter;

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.frame}>
        <Rail project={project} selected={letter?.key ?? ""} onSelect={select} />

        <div className={styles.main}>
          <div className={styles.toolbar}>
            <ProjectSwitch
              project={project}
              onChange={(id) => {
                setProjectId(id);
                rootRef.current?.scrollTo({ top: 0 });
              }}
            />
            {!empty ? (
              <div className={styles.controls}>
                <label className={styles.pastSelect}>
                  <span className={styles.srOnly}>Past letters</span>
                  <select value={letter.key} onChange={(e) => select(e.target.value)}>
                    {project.letters.map((l, i) => (
                      <option key={l.key} value={l.key}>
                        {i === 0 ? `This week · ${l.mood}` : `Week of ${l.week} · ${l.mood}`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.toggles} role="group" aria-label="How much to show">
                  <button type="button" className={`${styles.toggle} ${short ? styles.toggleOn : ""}`} aria-pressed={short} onClick={() => setShort((s) => !s)}>
                    <ToggleMark on={short} />
                    Say it shorter
                  </button>
                  <button type="button" className={`${styles.toggle} ${numbers ? styles.toggleOn : ""}`} aria-pressed={numbers} onClick={() => setNumbers((s) => !s)}>
                    <ToggleMark on={numbers} />
                    Show every number
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={empty ? `${project.id}-empty` : `${project.id}-${letter.key}-${short ? "s" : "f"}`}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -3 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {empty ? (
                <EmptyLetter project={project} />
              ) : (
                <LetterView
                  project={project}
                  letter={letter}
                  isCurrent={index === 0}
                  current={current}
                  short={short}
                  numbers={numbers}
                  onBackToNow={() => select(current.key)}
                  onStep={select}
                  olderKey={project.letters[index + 1]?.key}
                  newerKey={index > 0 ? project.letters[index - 1].key : undefined}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
