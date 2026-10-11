"use client";

import { useMemo, useState } from "react";
import { createClock, useNow } from "./clock";
import { Centre } from "./countdown";
import { MOMENT_LABEL, MOMENT_ORDER, WORLDS, WORLD_LABEL, WORLD_ORDER, momentNow, type Moment, type WorldId } from "./data";
import { Details, CalIcon, LinkIcon, downloadIcs } from "./details";
import { Dial, type Scrub } from "./dial";
import { buildModel } from "./model";
import { Facts, NextUp, Recap, spanPhrase } from "./panels";
import { Strip } from "./strip";
import { dWeek } from "./time";
import s from "./c2.module.css";

/**
 * Countdown Instrument: the shared timeline as one precise, ticking dial.
 * One turn of the dial is the whole project; the hand is today.
 */
export default function CountdownInstrument() {
  const [worldId, setWorldId] = useState<WorldId>("agency");
  const [moment, setMoment] = useState<Moment>("live");
  const [scrub, setScrub] = useState<Scrub>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const [clock] = useState(() => createClock(momentNow(WORLDS.agency, "live")));
  const world = WORLDS[worldId];

  // Statuses only need to move once a minute; the numerals tick on their own.
  const minute = useNow(clock, 60_000);
  const model = useMemo(() => buildModel(world, moment, minute), [world, moment, minute]);

  function choose(nextWorld: WorldId, nextMoment: Moment) {
    setWorldId(nextWorld);
    setMoment(nextMoment);
    setScrub(null);
    setHoverId(null);
    setRun((r) => r + 1);
    clock.reset(momentNow(WORLDS[nextWorld], nextMoment));
  }

  const eventDone = model.hasDate && minute >= world.target;

  return (
    <div className={s.root} data-world={worldId}>
      <header className={s.top}>
        <div className={s.brand}>
          <span className={s.monogram} aria-hidden>
            {world.monogram}
          </span>
          <span className={s.brandText}>
            <span className={s.brandName}>{world.from}</span>
            <span className={s.brandSub}>Shared timeline</span>
          </span>
        </div>
        <div className={s.topActions}>
          <CopyLink />
          <button
            type="button"
            className={s.btnSmall}
            aria-label="Add to calendar"
            disabled={!model.hasDate}
            onClick={() => downloadIcs(world)}
          >
            <CalIcon />
            <span className={s.hideNarrow}>Add to calendar</span>
          </button>
        </div>
      </header>

      <main>
        <section className={s.stage} aria-label="Countdown">
          <div className={s.left}>
            <Facts world={world} model={model} />
          </div>

          <div className={s.instrument}>
            <div className={s.titleBlock}>
              <h1 className={s.title}>{world.title}</h1>
              <p className={s.when}>
                {model.hasDate ? (
                  <>
                    <span>{dWeek(world.target)}</span>
                    <span className={s.dot} aria-hidden>
                      ·
                    </span>
                    <span>{world.timeShort}</span>
                    <span className={`${s.dot} ${s.dotPlace}`} aria-hidden>
                      ·
                    </span>
                    <span className={s.whenPlace}>{world.place}</span>
                  </>
                ) : (
                  <span>{world.place}</span>
                )}
              </p>
            </div>
            <div className={s.ringBox}>
              <Dial key={`${worldId}-${moment}-${run}`} world={world} model={model} clock={clock} scrub={scrub} onScrub={setScrub} onHover={setHoverId} />
              <div className={s.centreWrap}>
                <Centre world={world} model={model} clock={clock} scrub={scrub} hoverId={hoverId} finalTen={moment === "finalTen"} />
              </div>
            </div>
            <p className={s.hint}>
              {scrub
                ? scrub.keyboard
                  ? "Press Escape to come back to today"
                  : "Let go to come back to today"
                : "Drag the hand, or use the arrow keys, to move through the project"}
            </p>
          </div>

          <div className={s.right}>
            {eventDone ? <Recap world={world} /> : <NextUp model={model} clock={clock} />}
            {moment === "finalTen" ? (
              <button type="button" className={s.replay} onClick={() => choose(worldId, "finalTen")}>
                Play the last ten seconds again
              </button>
            ) : null}
          </div>
        </section>

        <section className={s.section} aria-labelledby="c2-strip">
          <div className={s.sectionHead}>
            <h2 id="c2-strip" className={s.sectionTitle}>
              Every milestone
            </h2>
            <p className={s.sectionSub}>{spanPhrase(model, world)}</p>
          </div>
          <Strip model={model} />
        </section>

        <Details world={world} hasDate={model.hasDate} />
      </main>

      <footer className={s.footer}>
        <span>Shared by {world.from.split(" × ")[0]}</span>
        <span className={s.made}>
          <span className={s.madeMark} aria-hidden />
          Made with Signal Studio
        </span>
      </footer>

      <Dock worldId={worldId} moment={moment} onChoose={choose} />
    </div>
  );
}

function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={s.btnSmall}
      aria-label={copied ? "Link copied" : "Copy link"}
      onClick={() => {
        void navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      <LinkIcon />
      <span className={s.hideNarrow} aria-hidden>
        {copied ? "Link copied" : "Copy link"}
      </span>
    </button>
  );
}

/** Reviewer controls for the concept: pick a sample and a moment in time. */
function Dock({ worldId, moment, onChoose }: { worldId: WorldId; moment: Moment; onChoose: (w: WorldId, m: Moment) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.dock}>
      {open ? (
        <div className={s.dockPanel} id="c2-dock">
          <p className={s.dockTitle}>Preview this page</p>
          <div className={s.dockGroup} role="radiogroup" aria-label="Sample">
            {WORLD_ORDER.map((w) => (
              <button key={w} type="button" role="radio" aria-checked={w === worldId} className={s.dockOpt} onClick={() => onChoose(w, moment)}>
                {WORLD_LABEL[w]}
              </button>
            ))}
          </div>
          <div className={s.dockGroup} role="radiogroup" aria-label="Moment">
            {MOMENT_ORDER.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === moment} className={s.dockOpt} onClick={() => onChoose(worldId, m)}>
                {MOMENT_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button type="button" className={s.dockToggle} aria-expanded={open} aria-controls="c2-dock" onClick={() => setOpen((o) => !o)}>
        <span className={s.dockDot} aria-hidden />
        Preview
        <span className={s.dockNow}>
          {WORLD_LABEL[worldId]} · {MOMENT_LABEL[moment]}
        </span>
      </button>
    </div>
  );
}
