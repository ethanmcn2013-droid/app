"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { hueVar } from "./art";
import { PROJECTS, TAGS, toolById, type ProjectId, type StoryId, type Tag, type Tool, type ToolId } from "./data";
import { CheckIcon, ChevronDown, ToolTile } from "./glyphs";
import { plural, type Enabled } from "./reader";
import { storyById } from "./data";
import styles from "./c3.module.css";

export type GuideFilter = "all" | "kit" | Tag;

/* One tab stop per group: arrows move between the buttons, Home and End jump to the ends. */
function roving(e: ReactKeyboardEvent<HTMLElement>, horizontalOnly = true) {
  const keys = horizontalOnly ? ["ArrowLeft", "ArrowRight", "Home", "End"] : ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(e.key)) return null;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return null;
  e.preventDefault();
  const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + items.length) % items.length : (i + 1) % items.length;
  items[next].focus();
  return items[next];
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ALWAYS: ToolId[] = ["tasks", "timeline", "files"];

type EntryProps = {
  tool: Tool;
  enabled: Enabled;
  open: boolean;
  onToggleOpen: () => void;
  onSet: (tool: ToolId, project: ProjectId, on: boolean) => void;
  onStory: (id: StoryId) => void;
};

export function EntryRow({ tool, enabled, open, onToggleOpen, onSet, onStory }: EntryProps) {
  const on = enabled[tool.id] ?? [];
  const always = ALWAYS.includes(tool.id);
  const building = tool.status === "building";
  const panelId = useId();
  const reduce = useReducedMotion();
  const [idea, setIdea] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <li className={`${styles.entry} ${open ? styles.entryOpen : ""}`}>
      <button type="button" className={styles.entryHead} aria-expanded={open} aria-controls={panelId} onClick={onToggleOpen}>
        <span className={building ? styles.tileBuilding : undefined}>
          <ToolTile id={tool.id} />
        </span>
        <span className={styles.entryText}>
          <span className={styles.entryName}>{tool.name}</span>
          <span className={styles.entryLine}>{tool.line}</span>
        </span>
        <span className={styles.entryTags}>
          <span className={styles.goodFor}>Good for</span>
          {tool.goodFor.slice(0, 3).map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </span>
        <span className={styles.entryState}>
          {building ? (
            <span className={styles.stateBuilding}>Being built</span>
          ) : always ? (
            <span className={styles.stateOn}>
              <CheckIcon /> Always on
            </span>
          ) : on.length ? (
            <span className={styles.stateOn}>
              <CheckIcon /> On for {plural(on.length, "Project")}
            </span>
          ) : (
            <span className={styles.stateOff}>Off</span>
          )}
        </span>
        <span className={styles.entryChevron} aria-hidden>
          <ChevronDown />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            className={styles.entryPanelWrap}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className={styles.entryPanel}>
              <p className={styles.entryBody}>{tool.entry}</p>
              {tool.pairs && (
                <p className={styles.pairs}>
                  <span className={styles.pairsLabel}>Keeps company with</span>
                  {tool.pairs.map((p) => (
                    <span key={p} className={styles.pair}>
                      <ToolTile id={p} size="sm" />
                      {toolById(p).name}
                    </span>
                  ))}
                </p>
              )}
              {building ? (
                sent ? (
                  <p className={styles.thanks} role="status">
                    <CheckIcon /> Thank you. We read every one, and we will write when {tool.name} is ready.
                  </p>
                ) : (
                  <form
                    className={styles.ideaForm}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (idea.trim()) setSent(true);
                    }}
                  >
                    <label className={styles.ideaLabel} htmlFor={`${panelId}-idea`}>
                      Being built. Tell us how you would use it
                    </label>
                    <div className={styles.ideaRow}>
                      <input
                        id={`${panelId}-idea`}
                        className={styles.ideaInput}
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder={tool.id === "seating" ? "For example: 14 round tables, and the kitchen needs a copy" : "A sentence is plenty"}
                      />
                      <button type="submit" className={styles.btnSecondary} disabled={!idea.trim()}>
                        Send
                      </button>
                    </div>
                  </form>
                )
              ) : always ? (
                <p className={styles.alwaysLine}>Comes with every Project. There is nothing to turn on.</p>
              ) : (
                <div className={styles.onFor}>
                  <span className={styles.onForLabel}>On for</span>
                  <span className={styles.onForChips}>
                    {PROJECTS.map((p) => {
                      const isOn = on.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={isOn}
                          className={`${styles.projectToggle} ${isOn ? styles.projectToggleOn : ""}`}
                          onClick={() => onSet(tool.id, p.id, !isOn)}
                        >
                          <span className={styles.swatch} style={{ background: hueVar(p.hue) }} aria-hidden />
                          {p.short}
                          <span className={styles.toggleMark} aria-hidden>
                            {isOn && <CheckIcon size={10} />}
                          </span>
                        </button>
                      );
                    })}
                  </span>
                </div>
              )}
              {tool.story && (
                <button type="button" className={styles.storyLink} onClick={() => onStory(tool.story!)}>
                  Read the story: {storyById(tool.story).headline}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

type GuideProps = {
  tools: Tool[];
  enabled: Enabled;
  filter: GuideFilter;
  onFilter: (f: GuideFilter) => void;
  onSet: (tool: ToolId, project: ProjectId, on: boolean) => void;
  onStory: (id: StoryId) => void;
  searching: boolean;
};

export function GuideIndex({ tools, enabled, filter, onFilter, onSet, onStory, searching }: GuideProps) {
  const [openId, setOpenId] = useState<ToolId | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [letterStop, setLetterStop] = useState<string | null>(null);
  const scrub = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const shown = tools
    .filter((t) => (filter === "all" ? true : filter === "kit" ? (enabled[t.id] ?? []).length > 0 : t.goodFor.includes(filter) || t.goodFor.includes("everyone")))
    .sort((a, b) => a.name.localeCompare(b.name));
  const groups = new Map<string, Tool[]>();
  shown.forEach((t) => {
    const k = t.name[0].toUpperCase();
    groups.set(k, [...(groups.get(k) ?? []), t]);
  });
  const present = new Set(groups.keys());

  const jump = (letter: string, smooth = true) => {
    const target = ALPHA.slice(ALPHA.indexOf(letter)).find((l) => present.has(l)) ?? [...present].pop();
    if (!target) return;
    document.getElementById(`guide-letter-${target}`)?.scrollIntoView({ block: "start", behavior: smooth && !reduce ? "smooth" : "auto" });
    return target;
  };

  const pickFromPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = scrub.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.max(0, Math.min(ALPHA.length - 1, Math.floor(((e.clientY - r.top) / r.height) * ALPHA.length)));
    const hit = jump(ALPHA[i], false);
    if (hit) setBubble(hit);
  };

  const chips: { id: GuideFilter; label: string }[] = [
    { id: "all", label: "Every tool" },
    { id: "kit", label: "In your kit" },
    ...TAGS.map((t) => ({ id: t as GuideFilter, label: t[0].toUpperCase() + t.slice(1) })),
  ];

  return (
    <div className={styles.guide}>
      {!searching && (
        <div
          className={styles.guideFilters}
          role="radiogroup"
          aria-label="Show tools"
          onKeyDown={(e) => {
            const b = roving(e);
            if (b) b.click();
          }}
        >
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={filter === c.id}
              tabIndex={filter === c.id ? 0 : -1}
              className={`${styles.filterChip} ${filter === c.id ? styles.filterChipOn : ""}`}
              onClick={() => onFilter(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {!searching && present.size > 1 && (
        <nav className={styles.letters} aria-label="Jump to a letter" onKeyDown={(e) => roving(e)}>
          {ALPHA.map((l) => {
            const stop = letterStop && present.has(letterStop) ? letterStop : [...present].sort()[0];
            return (
              <button
                key={l}
                type="button"
                className={styles.letter}
                disabled={!present.has(l)}
                tabIndex={l === stop ? 0 : -1}
                aria-label={present.has(l) ? `Tools starting with ${l}` : undefined}
                onFocus={() => setLetterStop(l)}
                onClick={() => jump(l)}
              >
                {l}
              </button>
            );
          })}
        </nav>
      )}
      <div className={styles.guideBody}>
        <div className={styles.guideList}>
          {[...groups.entries()].map(([letter, list]) => (
            <section key={letter} id={`guide-letter-${letter}`} className={styles.letterGroup} aria-label={`Tools starting with ${letter}`}>
              <span className={styles.letterMark} aria-hidden>
                {letter}
              </span>
              <ul className={styles.entries}>
                {list.map((t) => (
                  <EntryRow
                    key={t.id}
                    tool={t}
                    enabled={enabled}
                    open={openId === t.id}
                    onToggleOpen={() => setOpenId((o) => (o === t.id ? null : t.id))}
                    onSet={onSet}
                    onStory={onStory}
                  />
                ))}
              </ul>
            </section>
          ))}
          {shown.length === 0 && <p className={styles.guideEmpty}>No tools here yet. Try Every tool.</p>}
        </div>
        <div
          ref={scrub}
          className={styles.scrubber}
          aria-hidden
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pickFromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) pickFromPointer(e);
          }}
          onPointerUp={() => setBubble(null)}
          onPointerCancel={() => setBubble(null)}
        >
          {ALPHA.map((l) => (
            <span key={l} className={present.has(l) ? styles.scrubOn : styles.scrubOff}>
              {l}
            </span>
          ))}
          <AnimatePresence>
            {bubble && (
              <motion.span
                className={styles.scrubBubble}
                style={{ top: `${((ALPHA.indexOf(bubble) + 0.5) / ALPHA.length) * 100}%` }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.12 }}
              >
                {bubble}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
