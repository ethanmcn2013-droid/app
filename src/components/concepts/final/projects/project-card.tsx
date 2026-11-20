"use client";

import { motion, type Transition } from "motion/react";
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AvatarStack, HealthRing, Icon } from "./bits";
import { HealthPill } from "../../demo/health";
import { SharedCover } from "./shared-cover";
import { badgeFor, dayDate, fmtDate, healthOf, ME, PEOPLE, percent, statusWord, type FactTone, type Project } from "./data";
import s from "./shelf.module.css";

/* A touch softer than a UI spring, so the cover's growth reads over about 380 ms. */
export const SPRING: Transition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 };

export function wrappedOn(p: Project) {
  return fmtDate(p.wrappedOn ?? p.date);
}

/** When the health was last set, and by whom: "since Thu 24 Sep · Aoife", from the store's project history. */
export function statusSetBy(p: Project) {
  const last = p.history[p.history.length - 1];
  if (!last) return "";
  // Too early to tell is not a health anyone set, so it has no "since": it says when the work started.
  if (p.tooEarly && p.status === "on_track") return `started ${fmtDate(p.start)}`;
  const who = last.by === ME ? "you" : PEOPLE[last.by]?.short;
  return `since ${dayDate(last.date)} · ${who}`;
}

/** "5 of 13 tasks done", or "No tasks yet". */
export function doneWords(p: Pick<Project, "done" | "total">) {
  return p.total === 0 ? "No tasks yet" : `${p.done} of ${p.total} tasks done`;
}

export function tooltipFor(p: Project) {
  if (p.status === "wrapped") return `Wrapped ${wrappedOn(p)}. ${doneWords(p)}.`;
  const parts = [doneWords(p)];
  if (p.overdue > 0) parts.push(`${p.overdue} late`);
  return `${parts.join(", ")}. ${statusWord(p)}, ${statusSetBy(p)}.`;
}

export function FactIcon({ tone }: { tone: FactTone }) {
  if (tone === "you") return <Icon.hand size={14} />;
  if (tone === "risk" || tone === "past") return <Icon.alert size={14} />;
  if (tone === "done") return <Icon.check size={14} />;
  return <Icon.clock size={14} />;
}

type Props = {
  p: Project;
  fact: { text: string; tone: FactTone };
  index: number;
  open: boolean;
  hubOpen: boolean;
  reduce: boolean;
  feature?: boolean;
  returning: boolean;
  /** Focus just came back from the project home: show the health note briefly, then let it go. */
  back?: boolean;
  fresh?: boolean;
  /** False for whatever is on the page at first paint: it renders visible on the server. */
  animateIn: boolean;
  /** Roving tab stop: only one cover in the shelf is in the tab order. */
  tabbable: boolean;
  onOpen: (id: string) => void;
  onFocusCard: (id: string) => void;
  onKeyNav: (e: ReactKeyboardEvent<HTMLButtonElement>, id: string) => void;
  onReturned: () => void;
  onLeaveBack?: () => void;
  registerHit: (id: string, el: HTMLButtonElement | null) => void;
};

export function ProjectCard({
  p,
  fact,
  index,
  open,
  hubOpen,
  reduce,
  feature,
  returning,
  back,
  fresh,
  animateIn,
  tabbable,
  onOpen,
  onFocusCard,
  onKeyNav,
  onReturned,
  onLeaveBack,
  registerHit,
}: Props) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const pct = percent(p.done, p.total);
  const badge = badgeFor(p);
  const wrapped = p.status === "wrapped";
  // Calm stays quiet: only a project that needs a look, or one too new to judge, wears its health.
  const health = healthOf(p);
  const layoutT = SPRING;
  // While the home is open the shelf's covers render without shared ids, so
  // flipping between projects never pulls a cover out of the grid. They
  // remount with ids on close, and the open one flies home from the hero.
  const shared = !reduce && !hubOpen;
  const k = shared ? "shared" : "static";

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== "mouse") return;
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 3).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 2.4).toFixed(2)}deg`);
    el.style.setProperty("--mx", x.toFixed(3));
    el.style.setProperty("--my", y.toFixed(3));
  }

  function onLeave() {
    const el = tiltRef.current;
    if (!el) return;
    for (const v of ["--ry", "--rx", "--mx", "--my"]) el.style.removeProperty(v);
  }

  return (
    <motion.article
      layout={reduce ? false : "position"}
      transition={{
        layout: layoutT,
        default: { duration: 0.42, delay: Math.min(index, 10) * 0.035, ease: [0.2, 0.8, 0.2, 1] },
      }}
      initial={animateIn ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      className={`${s.card} ${feature ? s.cardFeature : ""} ${wrapped ? s.cardWrapped : ""} ${
        returning ? s.cardReturning : ""
      } ${back ? s.cardBack : ""} ${fresh ? s.cardFresh : ""}`}
      data-card={p.id}
    >
      <div ref={tiltRef} className={s.tilt} onPointerMove={onMove} onPointerLeave={onLeave}>
        <button
          type="button"
          ref={(el) => registerHit(p.id, el)}
          className={s.hit}
          tabIndex={tabbable ? 0 : -1}
          onClick={() => {
            onLeave();
            onOpen(p.id);
          }}
          onFocus={() => onFocusCard(p.id)}
          onKeyDown={(e) => onKeyNav(e, p.id)}
          aria-label={`Open ${p.name}. ${fact.text}. ${tooltipFor(p)}`}
          onBlur={back ? onLeaveBack : undefined}
        />
        <div className={s.coverSlot}>
          {open ? (
            <div className={s.coverGhost} />
          ) : (
            <SharedCover
              key={k}
              p={p}
              layoutId={shared ? `cover-${p.id}` : undefined}
              transition={layoutT}
              radius={12}
              onLayoutAnimationComplete={returning ? onReturned : undefined}
            />
          )}

          {!open ? (
            <>
              <div className={s.badgeSpot}>
                {wrapped ? (
                  <span className={s.ribbon}>
                    <Icon.check size={13} />
                    Wrapped {wrappedOn(p)}
                  </span>
                ) : (
                  <motion.span
                    key={k}
                    layoutId={shared ? `badge-${p.id}` : undefined}
                    transition={layoutT}
                    className={s.badge}
                    style={{ borderRadius: 10 }}
                  >
                    <span className={s.badgeBig}>{badge.big}</span>
                    <span className={s.badgeSmall}>{badge.small}</span>
                  </motion.span>
                )}
              </div>

              <div className={s.peopleSpot}>
                <AvatarStack ids={p.people} />
              </div>

              <div
                className={s.ringSpot}
                onClick={() => {
                  onLeave();
                  onOpen(p.id);
                }}
              >
                {wrapped ? (
                  <span className={s.medal} aria-hidden="true">
                    <Icon.check size={13} />
                    <span className={s.medalNum}>
                      {p.done} of {p.total}
                    </span>
                  </span>
                ) : (
                  <>
                    <span className={s.doneLabel}>
                      {p.total === 0 ? (
                        "No tasks yet"
                      ) : (
                        <>
                          <b>{p.done}</b> of {p.total} done
                        </>
                      )}
                      {p.overdue > 0 ? <span className={s.lateBadge}>{p.overdue} late</span> : null}
                    </span>
                    <motion.span
                      key={k}
                      layoutId={shared ? `ring-${p.id}` : undefined}
                      transition={layoutT}
                      className={s.ringDisc}
                      style={{ borderRadius: 999 }}
                    >
                      <HealthRing pct={pct} status={p.status} tooEarly={p.tooEarly} size={44} stroke={4} />
                    </motion.span>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className={s.foot}>
          <div className={s.nameRow}>
            <h2 className={s.name}>{p.name}</h2>
            {health && health !== "on_track" ? <HealthPill health={health} className={s.namePill} /> : null}
          </div>
          <p className={`${s.fact} ${s[`fact_${fact.tone}`]} ${p.status === "off_track" ? s.fact_off : ""}`} title={fact.text}>
            <FactIcon tone={fact.tone} />
            <span>{fact.text}</span>
          </p>
          <p className={s.purpose}>{p.purpose}</p>
        </div>
      </div>
    </motion.article>
  );
}
