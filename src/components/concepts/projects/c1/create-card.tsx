"use client";

import { AnimatePresence, motion } from "motion/react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./bits";
import { CoverArt, coverDetail } from "./cover-art";
import { KIND_LABEL, type Kind } from "./data";
import s from "./shelf.module.css";

const KINDS: Kind[] = ["wedding", "event", "season", "works", "school", "agency"];
const DEMO_HUES = [8, 5, 7, 2, 4, 3];

/*
 * A new cover takes the colour the shelf uses least, so it never lands as a
 * twin of its neighbour. Ties break by the name; the shuffle walks the list.
 */
function hueFor(name: string, shift: number, taken: number[]) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const count = new Map<number, number>();
  for (const t of taken) count.set(t, (count.get(t) ?? 0) + 1);
  const order = [1, 2, 3, 4, 5, 6, 7, 8].sort(
    (a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0) || ((a + h) % 8) - ((b + h) % 8),
  );
  return order[shift % order.length];
}

/** Reads the name as it is typed and suggests a kind, until someone picks one. */
const GUESSES: [RegExp, Kind][] = [
  [/wedding|marriage|elop|vow/i, "wedding"],
  [/school|class|year \d|science|fair|pupils/i, "school"],
  [/roof|repair|works|fit-?out|build|heating|renovat|paint/i, "works"],
  [/rebrand|brand|campaign|website|client|launch/i, "agency"],
  [/season|markets?|christmas|summer|winter|spring|autumn/i, "season"],
  [/party|birthday|\d+(st|nd|rd|th)\b|supper|dinner|gala|night|tasting/i, "event"],
];
const GUESS_NOTE: Record<Kind, string> = {
  wedding: "Looks like a wedding",
  event: "Looks like an event",
  season: "Looks like a season",
  works: "Looks like works",
  school: "Looks like a school project",
  agency: "Looks like client work",
};

function guessKind(name: string): Kind | null {
  for (const [re, k] of GUESSES) if (re.test(name)) return k;
  return null;
}

export type Draft = { name: string; purpose: string; kind: Kind; hue: number; seed: string };

type Props = {
  /** Whether the editor is open. The parent owns it so N, the header button and the tile agree. */
  editing: boolean;
  /** Bumped by the parent each time someone asks to start, so a second N refocuses the name. */
  openSignal: number;
  startKind: Kind | null;
  /** Colours already on the shelf's active covers. */
  takenHues: number[];
  /** "panel" is the large invitation beside a lone project; otherwise the card only exists while editing. */
  variant?: "panel" | "editor";
  wide?: boolean;
  animateIn: boolean;
  onStart: () => void;
  onCancel: () => void;
  onCreate: (draft: Draft) => void;
};

export const CreateCard = forwardRef<HTMLElement, Props>(function CreateCard(
  { editing, openSignal, startKind, takenHues, variant = "editor", wide, animateIn, onStart, onCancel, onCreate },
  ref,
) {
  const [seenSignal, setSeenSignal] = useState(openSignal);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [picked, setPicked] = useState<Kind>(startKind ?? "wedding");
  const [userPicked, setUserPicked] = useState(Boolean(startKind));
  const [shift, setShift] = useState(0);
  // The cover re-seeds from the name once typing pauses, not on every key.
  const [seed, setSeed] = useState("");
  const seedTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [demo, setDemo] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  // Hovering the blank cover flips through what the generator can draw.
  function startDemo() {
    if (timer.current !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setDemo(0);
    timer.current = window.setInterval(() => setDemo((d) => (d ?? 0) + 1), 1100);
  }
  function stopDemo() {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setDemo(null);
  }
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearInterval(timer.current);
      if (seedTimer.current !== null) window.clearTimeout(seedTimer.current);
    },
    [],
  );

  function onName(value: string) {
    setName(value);
    if (seedTimer.current !== null) window.clearTimeout(seedTimer.current);
    seedTimer.current = window.setTimeout(() => setSeed(value.trim()), 220);
  }

  // Adjust state while rendering when the parent asks again with a starting kind.
  if (openSignal !== seenSignal) {
    setSeenSignal(openSignal);
    if (startKind) {
      setPicked(startKind);
      setUserPicked(true);
    }
  }

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    input?.focus({ preventScroll: true });
    input?.closest("article")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  }, [editing, openSignal]);

  const trimmed = name.trim();
  const guessed = userPicked ? null : guessKind(trimmed);
  const kind: Kind = guessed ?? picked;
  const hue = hueFor(seed || "New", shift, takenHues);
  const artSeed = seed || "draft";
  const detail = useMemo(() => coverDetail({ name: trimmed || "Your project", purpose }), [trimmed, purpose]);

  function reset() {
    setName("");
    setSeed("");
    setPurpose("");
    setShift(0);
    setUserPicked(false);
    stopDemo();
  }

  function cancel() {
    reset();
    onCancel();
  }

  function submit() {
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    // Create with exactly the cover on screen, even mid-pause.
    const finalSeed = trimmed;
    onCreate({ name: trimmed, purpose: purpose.trim(), kind, hue: hueFor(finalSeed, shift, takenHues), seed: finalSeed });
    reset();
  }

  return (
    <motion.article
      ref={ref}
      layout="position"
      className={`${s.card} ${s.createCard} ${editing ? s.createEditing : ""} ${wide ? s.createWide : ""}`}
      initial={animateIn ? { opacity: 0, y: 10, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {!editing && variant === "panel" ? (
        <button
          type="button"
          className={s.createIdle}
          onClick={() => {
            stopDemo();
            onStart();
          }}
          onPointerEnter={startDemo}
          onPointerLeave={stopDemo}
          onFocus={startDemo}
          onBlur={stopDemo}
        >
          <span className={s.createBlank}>
            <AnimatePresence>
              {demo !== null ? (
                <motion.span
                  key={demo}
                  className={s.createGhost}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  aria-hidden="true"
                >
                  <CoverArt
                    kind={KINDS[demo % KINDS.length]}
                    hue={DEMO_HUES[demo % DEMO_HUES.length]}
                    seed={`ghost-${demo % KINDS.length}`}
                    initial="S"
                    w={1400}
                    h={600}
                  />
                </motion.span>
              ) : null}
            </AnimatePresence>
            <span className={s.createPlus}>
              <Icon.plus size={20} />
            </span>
            <span className={s.createTitle}>Start the next one</span>
            <span className={s.createHint}>Name it and pick a kind. The cover draws itself.</span>
            <span className={s.createKindHint} aria-hidden="true">
              {demo !== null ? `${KIND_LABEL[KINDS[demo % KINDS.length]]} cover` : " "}
            </span>
          </span>
        </button>
      ) : (
        <form
          className={s.createForm}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              cancel();
            }
          }}
        >
          <div className={`${s.coverSlot} ${s.editorSlot}`}>
            <div className={`${s.cover} ${s.editorCover}`} style={{ borderRadius: 12 }}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={`${kind}-${hue}-${artSeed}`}
                  className={s.artBox}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: "linear" }}
                >
                  <CoverArt
                    kind={kind}
                    hue={hue}
                    seed={artSeed}
                    initial={(trimmed[0] ?? "A").toUpperCase()}
                    detail={detail}
                    w={1400}
                    h={600}
                  />
                </motion.div>
              </AnimatePresence>
              <div className={s.badgeSpot}>
                <span className={`${s.badge} ${s.badgeEmpty}`}>
                  <span className={s.badgeBig}>No date yet</span>
                  <span className={s.badgeSmall}>Add one after</span>
                </span>
              </div>
            </div>
            <div className={s.kindRail}>
              <div className={s.kindBar} role="radiogroup" aria-label="Kind of project">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    className={`${s.kindChip} ${kind === k ? s.kindChipOn : ""}`}
                    onClick={() => {
                      setPicked(k);
                      setUserPicked(true);
                    }}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={s.kindShuffle}
                onClick={() => setShift((v) => v + 1)}
                aria-label="Try another colour"
                title="Try another colour"
              >
                <Icon.shuffle size={14} />
              </button>
            </div>
          </div>
          <div className={`${s.foot} ${s.createFormFoot}`}>
            <input
              ref={inputRef}
              className={s.nameInput}
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Name your project"
              aria-label="Project name"
              maxLength={80}
            />
            <input
              className={s.purposeInput}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What is it for? One line is plenty."
              aria-label="What the project is for"
              maxLength={120}
            />
            <div className={s.createActions}>
              <span className={s.createNote}>
                {guessed ? GUESS_NOTE[guessed] : "The cover follows the name"}
              </span>
              <button type="button" className={s.btnGhost} onClick={cancel}>
                Cancel
              </button>
              <button type="submit" className={s.btnPrimary} disabled={!trimmed}>
                Create
              </button>
            </div>
          </div>
        </form>
      )}
    </motion.article>
  );
});

/* ── The quiet way in, after the last cover ──────────────────────── */

export function NewTile({ onStart }: { onStart: () => void }) {
  return (
    <button type="button" className={s.newTile} onClick={onStart}>
      <span className={s.newTilePlus}>
        <Icon.plus size={16} />
      </span>
      <span className={s.newTileText}>
        <span className={s.newTileTitle}>New project</span>
        <span className={s.newTileLine}>Name it and pick a kind. The cover draws itself.</span>
      </span>
      <kbd className={s.kbd}>N</kbd>
    </button>
  );
}

/* ── No projects yet ─────────────────────────────────────────────── */

const STARTERS: { kind: Kind; label: string; line: string; hue: number }[] = [
  { kind: "wedding", label: "A wedding", line: "Couple, suppliers, the day itself", hue: 8 },
  { kind: "event", label: "An event", line: "Parties, suppers, launches", hue: 5 },
  { kind: "works", label: "An internal job", line: "Repairs, fit-outs, the jobs behind the scenes", hue: 2 },
];

export function EmptyShelf({ onStart }: { onStart: (kind: Kind) => void }) {
  return (
    <motion.section
      className={s.empty}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      aria-labelledby="empty-title"
    >
      <div className={s.emptyCover}>
        <span className={s.createPlus}>
          <Icon.plus size={22} />
        </span>
        <h2 id="empty-title" className={s.emptyTitle}>
          Start your first project
        </h2>
        <p className={s.emptyBody}>
          A project holds everything for one thing you are running: its tasks, dates, people and files. Pick where
          to begin and its cover draws itself.
        </p>
        <div className={s.starters}>
          {STARTERS.map((st) => (
            <button key={st.kind} type="button" className={s.starter} onClick={() => onStart(st.kind)}>
              <span className={s.starterArt}>
                <CoverArt kind={st.kind} hue={st.hue} seed={st.label} initial="A" w={400} h={250} />
              </span>
              <span className={s.starterText}>
                <span className={s.starterLabel}>{st.label}</span>
                <span className={s.starterLine}>{st.line}</span>
              </span>
              <Icon.arrowRight size={16} />
            </button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
