"use client";

import { motion, type Transition } from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AvatarStack, HealthRing, Icon, StatusGlyph } from "./bits";
import { SharedCover } from "./shared-cover";
import { badgeFor, percent, STATUS_LABEL, type FactTone, type Project } from "./data";
import s from "./shelf.module.css";

/* A touch softer than a UI spring, so the cover's growth reads over about 380 ms. */
export const SPRING: Transition = { type: "spring", stiffness: 260, damping: 32, mass: 0.9 };

export function tooltipFor(p: Project) {
  const pct = percent(p.done, p.total);
  if (p.status === "wrapped") return `Wrapped ${p.wrapped?.on}. ${p.wrapped?.stat}.`;
  const parts = [`${pct}% done`];
  if (p.overdue > 0) parts.push(`${p.overdue} overdue`);
  return `${parts.join(", ")}. ${STATUS_LABEL[p.status]}, set by ${p.statusBy} ${
    /^\d/.test(p.statusWhen) ? "on " : p.statusWhen === "yesterday" || p.statusWhen === "last week" ? "" : "on "
  }${p.statusWhen}.`;
}

export function FactIcon({ tone }: { tone: FactTone }) {
  if (tone === "you") return <Icon.hand size={14} />;
  if (tone === "overdue" || tone === "risk") return <Icon.alert size={14} />;
  if (tone === "done") return <Icon.check size={14} />;
  return <Icon.clock size={14} />;
}

type Props = {
  p: Project;
  index: number;
  open: boolean;
  hubOpen: boolean;
  reduce: boolean;
  feature?: boolean;
  returning: boolean;
  /** Focus just came back from the project page: show the health note briefly, then let it go. */
  back?: boolean;
  fresh?: boolean;
  /** False for whatever is on the page at first paint: it renders visible on the server. */
  animateIn: boolean;
  onOpen: (id: string) => void;
  onSetDate: (id: string, iso: string | null) => void;
  onReturned: () => void;
  onLeaveBack?: () => void;
  registerHit: (id: string, el: HTMLButtonElement | null) => void;
};

export function ProjectCard({
  p,
  index,
  open,
  hubOpen,
  reduce,
  feature,
  returning,
  back,
  fresh,
  animateIn,
  onOpen,
  onSetDate,
  onReturned,
  onLeaveBack,
  registerHit,
}: Props) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const [dating, setDating] = useState(false);
  const pct = percent(p.done, p.total);
  const badge = badgeFor(p);
  const wrapped = p.status === "wrapped";
  const layoutT = SPRING;
  // While the hub is open the shelf's covers render without shared ids, so
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
    for (const k of ["--ry", "--rx", "--mx", "--my"]) el.style.removeProperty(k);
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
          onClick={() => {
            onLeave();
            onOpen(p.id);
          }}
          aria-label={`Open ${p.name}. ${tooltipFor(p)}`}
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
                    Wrapped {p.wrapped?.on}
                  </span>
                ) : badge ? (
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
                ) : (
                  <span className={s.noDateWrap}>
                    <button
                      type="button"
                      className={`${s.badge} ${s.badgeEmpty}`}
                      onClick={() => setDating((v) => !v)}
                      aria-expanded={dating}
                    >
                      <span className={s.badgeBig}>No date yet</span>
                      <span className={s.badgeSmall}>
                        <Icon.calendar size={12} /> Set a date
                      </span>
                    </button>
                    {dating ? (
                      <span className={s.datePop}>
                        <label className={s.datePopLabel}>
                          Target date
                          <input
                            type="date"
                            className={s.dateInput}
                            min="2026-09-25"
                            autoFocus
                            onChange={(e) => {
                              if (e.target.value) {
                                onSetDate(p.id, e.target.value);
                                setDating(false);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.stopPropagation();
                                setDating(false);
                              }
                            }}
                          />
                        </label>
                      </span>
                    ) : null}
                  </span>
                )}
              </div>

              <div className={s.peopleSpot}>
                <AvatarStack ids={p.members.map((m) => m.person)} />
              </div>

              <div
                className={s.ringSpot}
                onClick={() => {
                  onLeave();
                  onOpen(p.id);
                }}
              >
                <span className={s.tip} role="presentation">
                  {tooltipFor(p)}
                </span>
                {wrapped ? (
                  <span className={s.medal} aria-hidden="true">
                    <Icon.check size={13} />
                    <span className={s.medalNum}>
                      {p.done}/{p.total}
                    </span>
                  </span>
                ) : (
                  <>
                    <span className={`${s.statusChip} ${s[`chip_${p.status.replace("-", "_")}`]}`}>
                      <StatusGlyph status={p.status} />
                      {STATUS_LABEL[p.status]}
                    </span>
                    <motion.span
                      key={k}
                      layoutId={shared ? `ring-${p.id}` : undefined}
                      transition={layoutT}
                      className={s.ringDisc}
                      style={{ borderRadius: 999 }}
                    >
                      <HealthRing pct={pct} status={p.status} overdue={p.overdue} size={52} stroke={4.5} />
                    </motion.span>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className={s.foot}>
          <h3 className={s.name}>{p.name}</h3>
          <p className={`${s.fact} ${s[`fact_${p.fact.tone}`]}`}>
            <FactIcon tone={p.fact.tone} />
            <span>{p.fact.text}</span>
          </p>
          <p className={s.purpose}>{p.purpose}</p>
        </div>
      </div>
    </motion.article>
  );
}
