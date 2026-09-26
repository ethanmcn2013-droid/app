"use client";

/* The suite on the table (desktop and tablet), the lifted card, and the
   phone carousel where every card is one screen. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Suite, SuitePiece } from "./data";
import {
  Flip,
  MainBack,
  MainFront,
  NewDateSlip,
  Paper,
  PieceBack,
  PieceFront,
  TurnButton,
  aspectFor,
  statusLine,
  tilt,
} from "./cards";
import s from "./c3.module.css";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── The main card, both sides ─────────────────────────────────────── */

function MainCard({
  suite,
  shape,
  flipped,
  onTurn,
}: {
  suite: Suite;
  shape: "native" | "tall";
  flipped: boolean;
  onTurn: () => void;
}) {
  return (
    <div
      className={s.mainWrap}
      data-slip={suite.oldDay ? "" : undefined}
      style={{ "--ar": aspectFor("main", shape) } as CSSProperties}
    >
      <Flip
        flipped={flipped}
        className={s.flipBox}
        front={
          <Paper format="main" shape={shape}>
            <MainFront
              suite={suite}
              asHeading
              onTurn={onTurn}
              tall={shape === "tall"}
            />
          </Paper>
        }
        back={
          <Paper format="main" shape={shape}>
            <MainBack suite={suite} onTurn={onTurn} />
          </Paper>
        }
      />
      <NewDateSlip suite={suite} />
    </div>
  );
}

/* ── Desktop and tablet: the flat-lay ──────────────────────────────── */

export function Table({ suite, fanIn }: { suite: Suite; fanIn: boolean }) {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const [mainFlipped, setMainFlipped] = useState(false);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const lastRef = useRef<string | null>(null);

  const pieces = suite.pieces;
  const index = selected ? pieces.findIndex((p) => p.id === selected) : -1;
  const current = index >= 0 ? pieces[index] : null;

  const close = useCallback(() => {
    setSelected(null);
    const id = lastRef.current;
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-card="${id}"]`)
        ?.focus({ preventScroll: true });
    });
  }, []);
  const open = useCallback((id: string) => {
    lastRef.current = id;
    setSelected(id);
  }, []);
  const step = useCallback(
    (d: number) => {
      if (index < 0) return;
      const next = pieces[(index + d + pieces.length) % pieces.length];
      lastRef.current = next.id;
      setSelected(next.id);
    },
    [index, pieces],
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, close, step]);

  const base = fanIn ? 0.25 : 0;
  const tableCard = (p: SuitePiece, slot: string, i: number) => {
    const rot = tilt(p.id + suite.world.id);
    const line = statusLine(p);
    return (
      <div
        key={p.id}
        className={s.slot}
        data-slot={slot}
        data-format={p.placeholder ? "placeholder" : p.format}
      >
        {selected === p.id ? (
          <div
            className={s.ghost}
            style={{
              aspectRatio: aspectFor(p.format, "native"),
              rotate: `${rot}deg`,
            }}
          />
        ) : (
          <motion.button
            type="button"
            layoutId={`card-${suite.world.id}-${p.id}`}
            data-card={p.id}
            className={s.tableCard}
            onClick={() => open(p.id)}
            aria-label={`${p.title}${line ? `, ${line}` : ""}. Pick up the card`}
            initial={
              fanIn && !reduce
                ? { opacity: 0, y: -80, scale: 0.9, rotate: rot * 4 }
                : false
            }
            animate={{ opacity: 1, y: 0, scale: 1, rotate: rot }}
            whileHover={
              reduce
                ? undefined
                : { y: -6, rotate: rot * 0.4, transition: { duration: 0.25 } }
            }
            whileTap={reduce ? undefined : { scale: 0.985 }}
            transition={{
              delay: base + i * 0.07,
              type: "spring",
              stiffness: 170,
              damping: 22,
            }}
          >
            <Paper
              format={p.placeholder ? "placeholder" : p.format}
              shape="native"
              deckle={p.format === "reply" && !p.placeholder}
            >
              <PieceFront
                piece={p}
                suite={suite}
                stampDelay={base + 0.55 + i * 0.12}
              />
            </Paper>
          </motion.button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={s.flatlay}>
        <motion.div
          className={s.mainSlot}
          initial={fanIn && !reduce ? { y: 140, opacity: 0.4 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ rotate: `${tilt(suite.world.id, 0.8)}deg` }}
        >
          <MainCard
            suite={suite}
            shape="native"
            flipped={mainFlipped}
            onTurn={() => setMainFlipped((f) => !f)}
          />
        </motion.div>
        {pieces.slice(0, 4).map((p, i) => tableCard(p, `p${i + 1}`, i))}
      </div>
      <div className={s.lowerRow}>
        {pieces.slice(4).map((p, i) => tableCard(p, `p${i + 5}`, i + 4))}
      </div>

      <AnimatePresence>
        {current ? (
          <motion.div
            key="scrim"
            className={s.scrim}
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {current ? (
          <div
            key="lift"
            className={s.liftStage}
            role="dialog"
            aria-modal="true"
            aria-label={current.title}
          >
            <motion.div
              layoutId={`card-${suite.world.id}-${current.id}`}
              className={s.liftCard}
              style={
                { "--ar": aspectFor(current.format, "native") } as CSSProperties
              }
              transition={{ type: "spring", stiffness: 210, damping: 28 }}
            >
              <Flip
                flipped={!!flipped[current.id]}
                className={s.flipBox}
                front={
                  <Paper
                    format={
                      current.placeholder ? "placeholder" : current.format
                    }
                    shape="native"
                    deckle={current.format === "reply" && !current.placeholder}
                  >
                    <PieceFront
                      piece={current}
                      suite={suite}
                      stampDelay={false}
                    />
                  </Paper>
                }
                back={
                  <Paper
                    format={
                      current.placeholder ? "placeholder" : current.format
                    }
                    shape="native"
                    deckle={current.format === "reply" && !current.placeholder}
                  >
                    <PieceBack piece={current} suite={suite} />
                  </Paper>
                }
              />
            </motion.div>
            <motion.div
              className={s.liftBar}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10, transition: { duration: 0.12 } }}
              transition={{ delay: 0.15, duration: 0.3, ease: EASE }}
            >
              <p className={s.liftCaption}>
                <span className={s.liftNo}>
                  {current.n} of {pieces.length}
                </span>
                {current.title}
                {statusLine(current) ? (
                  <span className={s.liftStatus}> · {statusLine(current)}</span>
                ) : null}
              </p>
              <div className={s.liftTools}>
                <TurnButton
                  onClick={() =>
                    setFlipped((f) => ({ ...f, [current.id]: !f[current.id] }))
                  }
                  back={!!flipped[current.id]}
                />
                <button
                  type="button"
                  className={s.ghostButton}
                  onClick={() => step(-1)}
                  aria-label="Previous card"
                >
                  <Chevron dir={-1} />
                </button>
                <button
                  type="button"
                  className={s.ghostButton}
                  onClick={() => step(1)}
                  aria-label="Next card"
                >
                  <Chevron dir={1} />
                </button>
                <button
                  type="button"
                  className={s.solidButton}
                  onClick={close}
                  autoFocus
                >
                  Put it back
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Chevron({ dir }: { dir: 1 | -1 }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={s.chev}>
      <path
        d={dir > 0 ? "M8 5l5 5-5 5" : "M12 5l-5 5 5 5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Phone: one card per screen ────────────────────────────────────── */

export function Carousel({ suite, fanIn }: { suite: Suite; fanIn: boolean }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const trackRef = useRef<HTMLDivElement | null>(null);
  const count = suite.pieces.length + 1;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== active) setActive(i);
  };
  const go = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({
      left: i * el.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  };
  const turn = (id: string) => setFlipped((f) => ({ ...f, [id]: !f[id] }));

  return (
    <div className={s.carouselWrap}>
      <div
        ref={trackRef}
        className={s.carousel}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="The cards, one at a time. Swipe or use the arrow keys."
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(Math.min(count - 1, active + 1));
          if (e.key === "ArrowLeft") go(Math.max(0, active - 1));
        }}
      >
        <section
          className={s.slide}
          aria-label={`Card 1 of ${count}: ${suite.title}`}
        >
          <motion.div
            className={s.slideCard}
            data-slip={suite.oldDay ? "" : undefined}
            initial={fanIn && !reduce ? { y: 120, opacity: 0.4 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <MainCard
              suite={suite}
              shape="tall"
              flipped={!!flipped.main}
              onTurn={() => turn("main")}
            />
          </motion.div>
          {suite.oldDay ? null : (
            <p className={s.swipeHint}>
              Swipe for the next card
              <Chevron dir={1} />
            </p>
          )}
        </section>
        {suite.pieces.map((p, i) => (
          <section
            key={p.id}
            className={s.slide}
            aria-label={`Card ${i + 2} of ${count}: ${p.title}`}
          >
            <div
              className={s.slideCard}
              style={{ "--ar": aspectFor(p.format, "tall") } as CSSProperties}
            >
              <div className={s.slideSized}>
                <Flip
                  flipped={!!flipped[p.id]}
                  className={s.flipBox}
                  front={
                    <Paper
                      format={p.placeholder ? "placeholder" : p.format}
                      shape="tall"
                      deckle={p.format === "reply" && !p.placeholder}
                    >
                      <PieceFront
                        piece={p}
                        suite={suite}
                        stampDelay={
                          Math.abs(active - (i + 1)) <= 1 ? 0.3 : false
                        }
                      />
                    </Paper>
                  }
                  back={
                    <Paper
                      format={p.placeholder ? "placeholder" : p.format}
                      shape="tall"
                      deckle={p.format === "reply" && !p.placeholder}
                    >
                      <PieceBack piece={p} suite={suite} />
                    </Paper>
                  }
                />
              </div>
            </div>
            <div className={s.slideTools}>
              <TurnButton onClick={() => turn(p.id)} back={!!flipped[p.id]} />
            </div>
          </section>
        ))}
      </div>
      <nav className={s.dots} aria-label="Choose a card">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            className={s.dot}
            aria-current={i === active ? "true" : undefined}
            aria-label={`Card ${i + 1}: ${i === 0 ? suite.title : suite.pieces[i - 1].title}`}
            onClick={() => go(i)}
          />
        ))}
      </nav>
    </div>
  );
}
