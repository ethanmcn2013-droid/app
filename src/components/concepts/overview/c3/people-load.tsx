"use client";

import { CAPACITY, PEOPLE, PROJECTS } from "./data";
import s from "./atlas.module.css";

const SCALE = 16; // the track shows up to 160% of someone's room

type Load = [number, number, number];

export function PeopleLoadStrip(props: {
  loads: Record<string, Load>;
  previewLoads: Record<string, Load> | null;
  previewIds: Set<string>;
  highlight: Set<string>;
  selectedPerson: string | null;
  tracing: boolean;
  onSelectPerson: (id: string | null) => void;
}) {
  const { loads, previewLoads, highlight, selectedPerson, tracing } = props;
  const capPct = (CAPACITY / SCALE) * 100;

  return (
    <section className={s.people} aria-labelledby="c3-people">
      <div className={s.peopleHead}>
        <div>
          <h2 id="c3-people" className={s.peopleTitle}>
            Who is carrying what
          </h2>
          <p className={s.peopleLede}>Open tasks for each person by when they are due, against room for about {CAPACITY} at a time.</p>
        </div>
        <ul className={s.loadKey} aria-label="Key">
          <li>
            <span className={s.keySeg} data-seg="0" aria-hidden="true" />
            This week
          </li>
          <li>
            <span className={s.keySeg} data-seg="1" aria-hidden="true" />
            Next week
          </li>
          <li>
            <span className={s.keySeg} data-seg="2" aria-hidden="true" />
            Later
          </li>
          <li>
            <span className={s.keyCap} aria-hidden="true" />
            Room
          </li>
        </ul>
      </div>

      <ul className={s.peopleList} style={{ ["--cap" as string]: `${capPct}%` }}>
        {PEOPLE.map((p) => {
          const now = loads[p.id];
          const ghost = props.previewIds.has(p.id) ? previewLoads?.[p.id] : undefined;
          const shown = ghost ?? now;
          const total = shown[0] + shown[1] + shown[2];
          const nowTotal = now[0] + now[1] + now[2];
          const pct = Math.round((total / CAPACITY) * 100);
          const over = total > CAPACITY;
          const isSel = selectedPerson === p.id;
          const isHl = highlight.has(p.id);
          const dim = tracing && !isSel && !isHl;
          let acc = 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={s.person}
                data-selected={isSel || undefined}
                data-hl={isHl || undefined}
                data-dim={dim || undefined}
                data-ghost={ghost ? true : undefined}
                aria-pressed={isSel}
                aria-label={`${p.name}${p.isYou ? " (you)" : ""}: ${nowTotal} open, ${now[0]} due this week, ${Math.round((nowTotal / CAPACITY) * 100)}% of their room.${ghost ? ` Preview: ${total} open.` : ""}`}
                onClick={() => props.onSelectPerson(isSel ? null : p.id)}
              >
                <span className={s.personWho}>
                  <span className={s.avatar} style={{ background: p.hue }} aria-hidden="true">
                    {p.initials}
                  </span>
                  <span className={s.personName}>
                    {p.name}
                    {p.isYou ? <span className={s.you}>you</span> : null}
                  </span>
                </span>

                <span className={s.track} aria-hidden="true">
                  <span className={s.capLine} />
                  {over ? <span className={s.overZone} style={{ width: `${Math.min(100, (total / SCALE) * 100) - capPct}%` }} /> : null}
                  {shown.map((n, i) => {
                    const left = (acc / SCALE) * 100;
                    acc += n;
                    return <span key={i} className={s.seg} data-seg={i} style={{ left: `${left}%`, width: `${(n / SCALE) * 100}%` }} />;
                  })}
                  {ghost ? <span className={s.was} style={{ width: `${(nowTotal / SCALE) * 100}%` }} /> : null}
                </span>

                <span className={s.personMeta}>
                  <span className={s.pct} data-over={over || undefined}>
                    {ghost && total !== nowTotal ? (
                      <>
                        <span className={s.pctWas}>{Math.round((nowTotal / CAPACITY) * 100)}%</span>
                        <span aria-hidden="true">→</span>
                      </>
                    ) : null}
                    {pct}%
                  </span>
                  <span className={s.personSub}>
                    {total} open · {shown[0]} this week
                    {p.overdue ? <span className={s.late}> · {p.overdue} late</span> : null}
                  </span>
                </span>

                <span className={s.personOn} aria-hidden="true">
                  {p.on.map((id) => {
                    const proj = PROJECTS.find((x) => x.id === id)!;
                    return (
                      <span key={id} className={s.onTile} style={{ background: proj.color }} title={proj.name}>
                        {proj.initials}
                      </span>
                    );
                  })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
