"use client";

/* The Invitation Suite. The shared timeline arrives as printed stationery:
   a sealed envelope that opens into one card per moment on the way to the
   day. Front-end only, sample data, no account needed to read it. */

import { Cormorant_Garamond, EB_Garamond } from "next/font/google";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MOMENTS, WORLDS, buildSuite, type Moment, type WorldId } from "./data";
import { Envelope } from "./envelope";
import { Carousel, Table } from "./suite";
import { WaxSeal } from "./art";
import { StudioMark } from "./mark";
import s from "./c3.module.css";

const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--is-display-font",
  display: "swap",
});
const text = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--is-text-font",
  display: "swap",
});

/* ── Tiny external stores: "opened before" and "phone width" ───────── */

const KEY = "signal-invitation-suite-opened";
const openedListeners = new Set<() => void>();
function readOpened() {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function writeOpened(v: boolean) {
  try {
    if (v) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* private mode: the envelope simply shows again next time */
  }
  openedListeners.forEach((l) => l());
}
const subscribeOpened = (l: () => void) => {
  openedListeners.add(l);
  return () => openedListeners.delete(l);
};

const PHONE = "(max-width: 640px)";
const subscribePhone = (l: () => void) => {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", l);
  return () => m.removeEventListener("change", l);
};

type Phase = "sealed" | "opening" | "open";

export default function InvitationSuite() {
  const reduce = useReducedMotion();
  const [worldId, setWorldId] = useState<WorldId>("wedding");
  const [moment, setMoment] = useState<Moment>("live");
  const [phase, setPhase] = useState<Phase>("sealed");
  const [fanIn, setFanIn] = useState(false);
  const openedBefore = useSyncExternalStore(subscribeOpened, readOpened, () => false);
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const suite = useMemo(() => buildSuite(worldId, moment), [worldId, moment]);
  const shown: Phase = phase === "sealed" && (openedBefore || reduce) ? "open" : phase;

  const finish = useCallback(() => {
    setPhase((p) => (p === "opening" ? "open" : p));
    writeOpened(true);
  }, []);
  const begin = useCallback(() => {
    setFanIn(true);
    setPhase("opening");
  }, []);

  /* The opening runs 1.1s; any key, scroll or tap skips to the end. */
  useEffect(() => {
    if (phase !== "opening") return;
    const t = window.setTimeout(finish, 1150);
    const skip = () => finish();
    const arm = window.setTimeout(() => {
      window.addEventListener("keydown", skip);
      window.addEventListener("wheel", skip, { passive: true });
      window.addEventListener("touchstart", skip, { passive: true });
      window.addEventListener("pointerdown", skip);
    }, 60);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(arm);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [phase, finish]);

  /* Sealed: Enter or Space anywhere breaks the seal. */
  useEffect(() => {
    if (shown !== "sealed") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("button, a, input, textarea, [role='radiogroup']")) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        begin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, begin]);

  const reseal = () => {
    writeOpened(false);
    setFanIn(false);
    setPhase("sealed");
    rootRef.current?.scrollTo({ top: 0 });
  };

  const choose = (w: WorldId, m: Moment) => {
    setWorldId(w);
    setMoment(w !== "wedding" && m === "long" ? "live" : m);
    setFanIn(false);
  };

  const sealedView = shown === "sealed" || shown === "opening";

  return (
    <div
      ref={rootRef}
      className={`${s.root} ${display.variable} ${text.variable}`}
      data-ink={suite.world.ink}
      data-phase={shown}
    >
      <div className={s.topbar} data-quiet={sealedView || undefined}>
        <div className={s.from}>
          {!sealedView ? (
            <>
              <span className={s.miniSeal} aria-hidden="true">
                <WaxSeal monogram={suite.monogram} />
              </span>
              <span className={s.fromText}>
                <span className={s.fromWord}>From </span>
                <span className={s.fromName}>{suite.host}</span>
              </span>
            </>
          ) : null}
        </div>
        <div className={s.tools}>
          {!sealedView ? <CopyLink /> : null}
          <SamplePicker worldId={worldId} moment={moment} onChoose={choose} />
        </div>
      </div>

      <AnimatePresence>
        {sealedView ? (
          <motion.div
            key={`env-${worldId}-${moment}`}
            className={s.envLayer}
            exit={{ opacity: 0, y: 60, transition: { duration: 0.45, ease: [0.4, 0, 1, 1] } }}
          >
            <Envelope suite={suite} opening={shown === "opening"} onOpen={begin} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!sealedView ? (
        <main className={s.page} key={`${worldId}-${moment}`}>
          {isPhone ? (
            <Carousel suite={suite} fanIn={fanIn} />
          ) : (
            <>
              <p className={s.intro}>
                {moment === "dayof"
                  ? `Today is the ${worldId === "wedding" ? "day" : "evening"}. The running order is on the main card.`
                  : `${suite.pieces.length} cards on the way to the ${worldId === "wedding" ? "day" : "evening"}.`}{" "}
                {moment === "dayof" ? null : <span className={s.introSoft}>Pick one up to read it, or turn it over.</span>}
              </p>
              <Table suite={suite} fanIn={fanIn} />
              <footer className={s.footer}>
                <div className={s.backOfEnvelope}>
                  <svg viewBox="0 0 100 60" preserveAspectRatio="none" className={s.backEnvSvg} aria-hidden="true">
                    <rect x="0" y="0" width="100" height="60" fill="var(--is-env)" />
                    <path d="M0 0 L50 36 L0 60 Z M100 0 L50 36 L100 60 Z" fill="var(--is-env-side)" />
                    <path d="M0 60 L50 27 L100 60 Z" fill="var(--is-env-bottom)" />
                    <path d="M0 60 L50 27 L100 60" fill="none" stroke="var(--is-env-seam)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                    <path d="M0 0 H100 L53.5 33 Q50 35.5 46.5 33 Z" fill="var(--is-env-flap-a)" />
                    <path d="M0 0 L46.5 33 Q50 35.5 53.5 33 L100 0" fill="none" stroke="var(--is-env-seam)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <div className={s.backEnvText}>
                    <p className={s.keepLink}>This page changes as plans do. Keep the link, not a screenshot.</p>
                    <StudioMark />
                  </div>
                </div>
                <button type="button" className={s.textLinkTable} onClick={reseal}>
                  Seal the envelope again
                </button>
              </footer>
            </>
          )}
        </main>
      ) : null}
    </div>
  );
}

/* ── Copy link ─────────────────────────────────────────────────────── */

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* the concept still confirms; a real page would fall back to a share sheet */
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2200);
  };
  return (
    <button type="button" className={s.barButton} onClick={copy} aria-live="polite">
      <svg viewBox="0 0 20 20" aria-hidden="true" className={s.barIcon}>
        {copied ? (
          <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2l-1 1M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2l1-1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        )}
      </svg>
      <span className={s.barLabel}>{copied ? "Link copied" : "Pass it on"}</span>
    </button>
  );
}

/* ── Sample picker (concept only) ──────────────────────────────────── */

function SamplePicker({
  worldId,
  moment,
  onChoose,
}: {
  worldId: WorldId;
  moment: Moment;
  onChoose: (w: WorldId, m: Moment) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const momentLabel = MOMENTS.find((m) => m.id === moment)?.label;
  return (
    <div className={s.picker} ref={ref}>
      <button
        type="button"
        className={s.barButton}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={s.barLabel}>
          Sample<span className={s.pickerNow}>: {WORLDS[worldId].kind}, {momentLabel?.toLowerCase()}</span>
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className={s.barIcon}>
          <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className={s.pickerPanel}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18 }}
          >
            <p className={s.pickerNote}>This is a concept with sample data. Try another suite or another moment.</p>
            <fieldset className={s.pickerGroup}>
              <legend>Suite</legend>
              {(Object.keys(WORLDS) as WorldId[]).map((w) => (
                <label key={w} className={s.pickerOption}>
                  <input type="radio" name="is-world" checked={worldId === w} onChange={() => onChoose(w, moment)} />
                  <span>
                    {WORLDS[w].kind}
                    <span className={s.pickerHint}>{WORLDS[w].label}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className={s.pickerGroup}>
              <legend>Moment</legend>
              {MOMENTS.filter((m) => m.id !== "long" || worldId === "wedding").map((m) => (
                <label key={m.id} className={s.pickerOption}>
                  <input type="radio" name="is-moment" checked={moment === m.id} onChange={() => onChoose(worldId, m.id)} />
                  <span>
                    {m.label}
                    <span className={s.pickerHint}>{m.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
