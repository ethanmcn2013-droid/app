"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Clock } from "./clock";
import { useNow } from "./clock";
import type { World } from "./data";
import type { Model } from "./model";
import type { Scrub } from "./dial";
import { dShort, dWeek, daysBetween, pad, plural, split } from "./time";
import s from "./c2.module.css";

/** One digit that rolls when, and only when, it changes. */
function Digit({ ch }: { ch: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={s.digit}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={ch}
          className={s.digitInner}
          initial={reduce ? false : { y: "-0.62em", opacity: 0, filter: "blur(2px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: "0.62em", opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: reduce ? 0 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {ch}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Roll({ value }: { value: string }) {
  const chars = value.split("");
  return (
    <span className={s.roll} aria-hidden>
      {chars.map((ch, i) => (
        <Digit key={chars.length - i} ch={ch} />
      ))}
    </span>
  );
}

type Props = { world: World; model: Model; clock: Clock; scrub: Scrub; hoverId: string | null; finalTen: boolean };

export function Centre({ world, model, clock, scrub, hoverId, finalTen }: Props) {
  const now = useNow(clock, 1000);
  const hovered = hoverId ? model.nodes.find((n) => n.id === hoverId) : undefined;
  const gap = hovered ? daysBetween(model.now, hovered.at) : 0;
  const gapText = gap === 0 ? "today" : gap > 0 ? `${plural(gap, "day")} away` : `${plural(-gap, "day")} ago`;

  if (scrub) return <Story model={model} scrub={scrub} />;

  if (!model.hasDate) {
    return (
      <div className={s.centre}>
        <p className={s.centreKicker}>{world.eventName}</p>
        <p className={s.soon}>Date coming soon</p>
        <p className={s.centreNote}>{world.noDateNote}</p>
      </div>
    );
  }

  const remaining = world.target - now;

  if (remaining <= 0) {
    const since = now - world.target;
    if (since < 90_000) {
      return (
        <div className={`${s.centre} ${s.centreLive}`} role="status">
          <Lights lit={0} out />
          <p className={s.liveLine}>{world.liveLine}</p>
          <p className={s.centreNote}>
            {dWeek(world.target)} · {world.timeShort}
          </p>
        </div>
      );
    }
    const d = daysBetween(world.target, now);
    const ago = d >= 1 ? plural(d, "day") : since >= 3_600_000 ? plural(Math.floor(since / 3_600_000), "hour") : plural(Math.floor(since / 60_000), "minute");
    return (
      <div className={s.centre}>
        <p className={s.centreKicker}>{world.pastVerb}</p>
        <p className={s.agoLine}>
          <span className={s.agoFigure}>{ago.split(" ")[0]}</span> {ago.split(" ")[1]} ago
        </p>
        <a className={s.recapLink} href="#c2-recap">
          What happened
        </a>
      </div>
    );
  }

  const p = split(remaining);
  const far = p.d >= 400;
  const lastMinute = remaining <= 60_000;
  const finalDay = p.d === 0 && !lastMinute;
  const wide = p.d >= 100 && !far;
  const showLights = finalTen || remaining <= 10_000;
  const lit = Math.max(0, Math.min(5, 6 - Math.ceil(remaining / 1000)));
  const cols: { v: string; label: string; key: string }[] = far
    ? [{ v: String(p.d), label: plural(p.d, "day").split(" ")[1], key: "d" }]
    : lastMinute
      ? [{ v: String(p.s), label: p.s === 1 ? "second" : "seconds", key: "s" }]
      : [
        ...(finalDay ? [] : [{ v: pad(p.d), label: p.d === 1 ? "day" : "days", key: "d" }]),
        { v: pad(p.h), label: p.h === 1 ? "hour" : "hours", key: "h" },
        { v: pad(p.m), label: p.m === 1 ? "minute" : "minutes", key: "m" },
        { v: pad(p.s), label: p.s === 1 ? "second" : "seconds", key: "s" },
      ];
  const spoken = far
    ? `${p.d} days to go`
    : lastMinute
      ? `${p.s} seconds to go`
    : `${finalDay ? "" : `${p.d} days, `}${p.h} hours, ${p.m} minutes to go`;

  return (
    <div
      className={`${s.centre} ${far ? s.centreFar : lastMinute ? s.centreLast : finalDay ? s.centreFinal : wide ? s.centreWide : ""}`}
    >
      {showLights ? <Lights lit={lit} /> : null}
      {!showLights && hovered ? (
        <p className={`${s.centreKicker} ${s.kickerGap}`}>
          <span className={s.kickerGapName}>{hovered.short}</span>
          <span className={s.kickerGapDays}>{gapText}</span>
        </p>
      ) : !showLights && !far ? (
        <p className={s.centreKicker}>
          <span className={s.pulse} aria-hidden />
          {world.eventName} in
        </p>
      ) : null}
      <div className={s.cols} data-cols={cols.length}>
        {cols.map((c, i) => (
          <div key={c.key} className={`${s.col} ${i === 0 ? s.colLead : ""}`} data-key={c.key}>
            <Roll value={c.v} />
            <span className={s.colLabel}>{c.label}</span>
          </div>
        ))}
      </div>
      <span className={s.srOnly}>{spoken}</span>
      {far ? <p className={s.centreNote}>The countdown gets more exciting from here.</p> : null}
    </div>
  );
}

function Lights({ lit, out = false }: { lit: number; out?: boolean }) {
  return (
    <div className={`${s.lights} ${out ? s.lightsOut : ""}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`${s.light} ${i < lit ? s.lightOn : ""}`} />
      ))}
    </div>
  );
}

function Story({ model, scrub }: { model: Model; scrub: NonNullable<Scrub> }) {
  const node = scrub.id ? model.nodes.find((n) => n.id === scrub.id) : undefined;
  const t = node ? node.at : model.timeAt(scrub.angle);
  const d = daysBetween(model.now, t);
  const figure = Math.abs(d);
  const tail = d === 0 ? "today" : d > 0 ? (figure === 1 ? "day away" : "days away") : figure === 1 ? "day ago" : "days ago";
  const before = [...model.nodes].reverse().find((n) => n.at <= t);
  const after = model.nodes.find((n) => n.at > t);
  const between = !node && before && after ? `Between ${before.short.toLowerCase()} and ${after.short.toLowerCase()}` : undefined;
  return (
    <div className={`${s.centre} ${s.story}`} aria-live="polite">
      <p className={s.centreKicker}>{d < 0 ? "Looking back" : d > 0 ? "Looking ahead" : "Today"}</p>
      <p className={s.storyFigure}>
        {d === 0 ? (
          <span className={s.storyNum}>Today</span>
        ) : (
          <>
            <span className={s.storyNum}>{figure}</span> <span className={s.storyTail}>{tail}</span>
          </>
        )}
      </p>
      <p className={s.storyName}>{node ? node.name : between ?? dShort(t)}</p>
      <p className={s.storyMeta}>
        {dWeek(t)}
        {node ? ` · ${node.state === "done" ? "done" : node.state === "next" ? "up next" : node.movedFrom ? `moved from ${dShort(node.movedFrom)}` : "coming up"}` : ""}
      </p>
    </div>
  );
}
