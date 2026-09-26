"use client";

/* Ask for a tool: the field, the suggestions, the answer rail and the quiet lists. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { hueVar, PROJECTS, projectById, TOOLS, toolById, type OnItem, type ProjectId, type ToolId } from "./data";
import { EXAMPLES, SUGGESTIONS } from "./match";
import { ArrowDown, ArrowUp, Check, ChevronDown, Close, ReturnKey, Source, ToolGlyph } from "./glyphs";
import { GuestSources, type Provenance } from "./previews";
import s from "./c4.module.css";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

export function ToolTile({ tool, size = "m" }: { tool: ToolId; size?: "s" | "m" | "l" }) {
  const t = toolById(tool);
  return (
    <span className={cx(s.tile, size === "s" && s.tileS, size === "l" && s.tileL)} style={{ background: hueVar(t.hue) }} aria-hidden>
      <ToolGlyph g={t.glyph} size={size === "l" ? 22 : size === "s" ? 14 : 18} />
    </span>
  );
}

export function ProjectDot({ id }: { id: ProjectId }) {
  return <span className={s.pDot} style={{ background: hueVar(projectById(id).hue) }} aria-hidden />;
}

/* ── the need field ──────────────────────────────────────────────── */

export function NeedField({
  inputRef,
  value,
  onChange,
  onKeyDown,
  project,
  onProject,
  ghost,
  onClear,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  project: ProjectId;
  onProject: (p: ProjectId) => void;
  ghost: string;
  onClear: () => void;
}) {
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [ex, setEx] = useState(0);
  const hintId = useId();
  const rotating = !value && !focused && !reduced;

  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => setEx((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(id);
  }, [rotating]);

  return (
    <div className={cx(s.field, focused && s.fieldFocus)}>
      <label className={s.fieldLead} htmlFor="c4-need">
        I need to
      </label>
      <div className={s.fieldInputWrap}>
        <input
          id="c4-need"
          ref={inputRef}
          className={s.fieldInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={hintId}
        />
        <span className={s.fieldOverlay} aria-hidden>
          {value ? (
            ghost && value.length < 44 ? (
              <>
                <span className={s.fieldMirror}>{value}</span>
                <span className={s.fieldGhost}>{ghost}</span>
              </>
            ) : null
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ex}
                className={s.fieldPlaceholder}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {EXAMPLES[ex]}
              </motion.span>
            </AnimatePresence>
          )}
        </span>
        <span id={hintId} className={s.srOnly}>
          Say what you need in your own words. Answers appear below as you type. Up and down move between answers, Enter keeps one, Escape clears.
        </span>
      </div>
      {value && (
        <button type="button" className={s.fieldClear} onClick={onClear} aria-label="Clear what you typed">
          <Close />
        </button>
      )}
      <span className={s.fieldFor}>for</span>
      <ProjectChip project={project} onProject={onProject} />
    </div>
  );
}

function ProjectChip({ project, onProject }: { project: ProjectId; onProject: (p: ProjectId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const p = projectById(project);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className={s.chipWrap} ref={ref}>
      <button type="button" className={s.chip} aria-haspopup="true" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
        <span className={s.srOnly}>Project: </span>
        <ProjectDot id={project} />
        <motion.span key={project} className={s.chipName} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {p.short}
        </motion.span>
        <ChevronDown />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={listId}
            className={s.menu}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <p className={s.menuHead}>Which Project is it for?</p>
            {PROJECTS.map((x) => (
              <button
                key={x.id}
                type="button"
                className={s.menuItem}
                aria-current={x.id === project ? "true" : undefined}
                onClick={() => {
                  onProject(x.id);
                  setOpen(false);
                }}
              >
                <ProjectDot id={x.id} />
                <span className={s.menuText}>
                  <span className={s.menuName}>{x.name}</span>
                  <span className={s.menuDetail}>{x.detail}</span>
                </span>
                {x.id === project && <Check />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── suggestions ─────────────────────────────────────────────────── */

const ONE_LINERS: { text: string; project: ProjectId }[] = [
  { text: "a timer for the speeches", project: "mf" },
  { text: "countdown to 2 November", project: "hollis" },
];

export function SuggestionPhrases({ onPick }: { onPick: (text: string, project: ProjectId) => void }) {
  return (
    <div className={s.sugg}>
      <p className={s.suggHead}>From what is going on in your Projects</p>
      <ul className={s.suggList}>
        {SUGGESTIONS.map((x) => (
          <li key={x.text}>
            <button type="button" className={s.suggItem} onClick={() => onPick(x.text, x.project)}>
              <ProjectDot id={x.project} />
              {x.text}
            </button>
          </li>
        ))}
      </ul>
      <p className={s.oneLine}>
        Small tools are made on the spot. Try{" "}
        {ONE_LINERS.map((x, i) => (
          <span key={x.text}>
            {i > 0 && " or "}
            <button type="button" className={s.oneLineBtn} onClick={() => onPick(x.text, x.project)}>
              {x.text}
            </button>
          </span>
        ))}
        .
      </p>
    </div>
  );
}

/* ── keys, as buttons ────────────────────────────────────────────── */

export function KeyBar({
  count,
  onUp,
  onDown,
  onEnter,
  onEsc,
  enterLabel,
  tab,
  onTab,
}: {
  count: number;
  onUp: () => void;
  onDown: () => void;
  onEnter?: () => void;
  onEsc: () => void;
  enterLabel?: string;
  tab: boolean;
  onTab: () => void;
}) {
  return (
    <div className={s.keys} role="group" aria-label="Keyboard shortcuts, also buttons">
      {tab && (
        <button type="button" className={s.key} onClick={onTab}>
          <kbd>Tab</kbd> Finish the sentence
        </button>
      )}
      {count > 1 && (
        <span className={s.keyPair}>
          <button type="button" className={s.key} onClick={onUp} aria-label="Previous answer">
            <kbd>
              <ArrowUp size={12} />
            </kbd>
          </button>
          <button type="button" className={s.key} onClick={onDown} aria-label="Next answer">
            <kbd>
              <ArrowDown size={12} />
            </kbd>
          </button>
          <span className={s.keyLabel}>Move</span>
        </span>
      )}
      {onEnter && enterLabel && (
        <button type="button" className={s.key} onClick={onEnter}>
          <kbd>
            <ReturnKey size={12} />
          </kbd>{" "}
          {enterLabel}
        </button>
      )}
      <button type="button" className={s.key} onClick={onEsc}>
        <kbd>Esc</kbd> Clear
      </button>
    </div>
  );
}

/* ── rail of answers ─────────────────────────────────────────────── */

export function RailCard({
  tool,
  title,
  line,
  selected,
  rank,
  onSelect,
  kept,
}: {
  tool: ToolId;
  title: string;
  line: string;
  selected: boolean;
  rank: string;
  onSelect: () => void;
  kept: boolean;
}) {
  return (
    <button type="button" className={cx(s.rail, selected && s.railOn, kept && s.railKept)} aria-pressed={selected} onClick={onSelect}>
      <ToolTile tool={tool} size="s" />
      <span className={s.railText}>
        <span className={s.railRank}>{kept ? "Kept" : rank}</span>
        <span className={s.railTitle}>{title}</span>
        <span className={s.railLine}>{line}</span>
      </span>
    </button>
  );
}

/* ── provenance ──────────────────────────────────────────────────── */

export function WhereItCameFrom({ p }: { p: Provenance }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={s.where}>
      <p className={s.whereLine}>
        <span className={s.whereIcon} aria-hidden>
          <Source />
        </span>
        <span>{p.line}</span>
        {p.detail && (
          <button type="button" className={s.whereBtn} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "See where"}
          </button>
        )}
      </p>
      <AnimatePresence initial={false}>
        {open && p.detail && (
          <motion.div id={id} className={s.whereDetail} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
            {p.detail === "guests" ? (
              <GuestSources />
            ) : (
              <ul className={s.whereList}>
                {p.detail.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── the quiet lists ─────────────────────────────────────────────── */

export type OnRow = OnItem & { label?: string; key: string };

export function AlreadyOn({ items, fresh, onOpen }: { items: OnRow[]; fresh: string | null; onOpen: (row: OnRow) => void }) {
  return (
    <section className={s.quiet} aria-labelledby="c4-on">
      <div className={s.quietHead}>
        <h2 id="c4-on" className={s.h2}>
          Already on
        </h2>
        <span className={cx(s.quietCount, s.num)}>{items.length} tools</span>
      </div>
      <ul className={s.onList}>
        <AnimatePresence initial={false}>
          {items.map((o) => {
            const t = toolById(o.tool);
            const key = o.key;
            return (
              <motion.li
                key={key}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                className={cx(s.onItem, fresh === key && s.onFresh)}
              >
                <button type="button" className={s.onBtn} onClick={() => onOpen(o)}>
                  <ToolTile tool={o.tool} size="s" />
                  <span className={s.onName}>{o.label ?? t.name}</span>
                  <span className={s.onProject}>
                    {o.project === "all" ? (
                      <>
                        <span className={s.pDotAll} aria-hidden />
                        Every Project
                      </>
                    ) : (
                      <>
                        <ProjectDot id={o.project} />
                        {projectById(o.project).short}
                      </>
                    )}
                  </span>
                  <span className={s.onUsed}>{o.used}</span>
                  <span className={s.onOpen}>Open</span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}

export function AtoZ({ onPick }: { onPick: (t: ToolId) => void }) {
  const sorted = [...TOOLS].sort((a, b) => a.name.localeCompare(b.name));
  const groups = new Map<string, typeof sorted>();
  for (const t of sorted) {
    const k = t.name[0].toUpperCase();
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  return (
    <section className={s.quiet} aria-labelledby="c4-az" id="c4-browse">
      <div className={s.quietHead}>
        <h2 id="c4-az" className={s.h2}>
          Browse everything
        </h2>
        <span className={cx(s.quietCount, s.num)}>{TOOLS.length} tools, A to Z</span>
      </div>
      <nav className={s.azIndex} aria-label="Jump to a letter">
        {[...groups.keys()].map((k) => (
          <a key={k} href={`#c4-az-${k}`} className={s.azJump}>
            {k}
          </a>
        ))}
      </nav>
      <div className={s.az}>
        {[...groups.entries()].map(([k, list]) => (
          <div key={k} className={s.azGroup} id={`c4-az-${k}`}>
            <span className={s.azLetter} aria-hidden>
              {k}
            </span>
            <ul className={s.azList}>
              {list.map((t) => (
                <li key={t.id}>
                  <button type="button" className={s.azItem} onClick={() => onPick(t.id)}>
                    <ToolTile tool={t.id} size="s" />
                    <span className={s.azText}>
                      <span className={s.azName}>{t.name}</span>
                      <span className={s.azLine}>{t.line}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
