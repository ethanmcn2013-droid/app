"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Avatar, I, LinkIcon, Ring, StatusDot, hueVar, useFocusTrap } from "./bits";
import { daysLabel } from "./card";
import { LANES, ME, PEOPLE, STATUS_LABEL, THIS_WEEK, type Action, type ActionOption, type Lane, type Project } from "./data";
import { declaredLine, placement, reasonOf, type Answer, type PState } from "./logic";
import s from "./c3.module.css";

type Props = {
  project: Project;
  st: PState;
  lane: Lane;
  answer?: Answer;
  isPhone: boolean;
  reduce: boolean;
  onClose: () => void;
  /** Where focus goes back to when the sheet closes. */
  restoreTo: () => HTMLElement | null;
  onAction: (a: Action, o?: ActionOption) => void;
  onToggleNext: (title: string) => void;
  onToast: (t: string) => void;
};

export function Hub({ project: p, st, lane, answer, isPhone, reduce, onClose, restoreTo, onAction, onToggleNext, onToast }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  useFocusTrap(sheet, restoreTo);
  const { lead, also } = reasonOf(p, st);
  const laneMeta = LANES.find((l) => l.id === lane);
  const history = answer ? [...p.history, { week: THIS_WEEK, status: answer.status, line: answer.line || "No line this week." }] : p.history;
  const diary = [...history].reverse();

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initials = p.name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <>
      <motion.div
        className={s.scrim}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.aside
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c3-hub-title"
        className={`${s.hub} thin-scroll`}
        initial={reduce ? { opacity: 0 } : isPhone ? { y: 40, opacity: 0 } : { x: 48, opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : isPhone ? { y: 40, opacity: 0 } : { x: 48, opacity: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
      >
        <header className={s.hubHead}>
          <span className={s.hubTile} style={{ background: hueVar(p.hue) }} aria-hidden>
            {initials}
          </span>
          <div className={s.hubHeadText}>
            <h2 id="c3-hub-title" className={s.hubTitle}>
              {p.name}
            </h2>
            <p className={s.hubSub}>
              <Avatar id={p.owner} size={16} />
              {p.owner ? PEOPLE[p.owner].name : "No owner yet"}
              <span aria-hidden>·</span>
              {p.dateWhat} {p.date}, {daysLabel(p.daysOut)}
            </p>
          </div>
          <button ref={closeRef} type="button" className={s.iconBtn} onClick={onClose} aria-label="Close">
            <I.x size={16} />
          </button>
        </header>

        {!p.wrapped ? (
          <div className={s.hubReason} data-tone={lane}>
            <p className={s.hubLane}>
              <span className={s.laneDot} aria-hidden />
              {laneMeta?.title}
            </p>
            <p className={s.hubLead}>{lead}</p>
            {also ? <p className={s.hubAlso}>{also}</p> : null}
            <p className={s.hubWhy}>{placement(p, st, lane, answer)}</p>
            {p.actions.some((a) => !st.done.includes(a.id) && a.kind !== "open") ? (
              <div className={s.hubActions}>
                {p.actions
                  .filter((a) => !st.done.includes(a.id) && a.kind !== "open")
                  .map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      className={i === 0 ? s.actionPrimary : s.action}
                      onClick={() => onAction(a, a.options?.[0])}
                    >
                      {a.kind === "choose" && a.options ? a.options[0].label : a.label}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className={s.hubReason} data-tone="wrapped">
            <p className={s.hubLead}>Wrapped {p.wrapped.on}. {p.wrapped.note}</p>
          </div>
        )}

        {p.next.length > 0 ? (
          <section className={s.hubSection}>
            <h3 className={s.hubH}>What needs doing next</h3>
            <ol className={s.nextList}>
              {p.next.map((n, i) => {
                const done = st.done.includes(`next:${n.title}`);
                return (
                  <li key={n.title} className={s.nextItem} data-done={done || undefined}>
                    <span className={s.nextRank}>{i + 1}</span>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      className={s.nextCheck}
                      onClick={() => onToggleNext(n.title)}
                      aria-label={`Mark ${n.title} done`}
                    >
                      {done ? <I.check size={11} /> : null}
                    </button>
                    <span className={s.nextTitle}>{n.title}</span>
                    <span className={s.nextOwner}>
                      <Avatar id={n.owner} size={18} />
                      {n.owner === ME ? "You" : PEOPLE[n.owner].first}
                    </span>
                    <span className={s.nextDue} data-late={n.late || undefined}>
                      {n.due}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {history.length > 0 ? (
          <section className={s.hubSection}>
            <div className={s.hubHRow}>
              <h3 className={s.hubH}>How it has been going</h3>
              <span className={s.hubHNote}>{declaredLine(p, lane, answer)}</span>
            </div>
            <div className={s.weekStrip} role="list" aria-label="Weekly status">
              {history.map((h) => (
                <div key={h.week} className={s.weekCell} role="listitem" data-now={h.week === THIS_WEEK || undefined}>
                  <StatusDot status={h.status} size={h.week === THIS_WEEK ? 14 : 12} />
                  <span className={s.weekLabel}>{h.week}</span>
                  <span className={s.srOnly}>{STATUS_LABEL[h.status]}</span>
                </div>
              ))}
              {!answer ? (
                <div className={s.weekCell} role="listitem" data-pending>
                  <span className={s.weekPending} aria-hidden />
                  <span className={s.weekLabel}>{THIS_WEEK}</span>
                  <span className={s.srOnly}>Not checked in yet</span>
                </div>
              ) : null}
            </div>
            <ol className={s.diary}>
              {diary.map((h) => (
                <li key={h.week} className={s.diaryItem}>
                  <span className={s.diaryWeek}>{h.week}</span>
                  <StatusDot status={h.status} size={8} />
                  <span className={s.diaryLine}>
                    <span className={s.diaryStatus}>{STATUS_LABEL[h.status]}.</span> {h.line}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {p.milestones.length > 0 ? (
          <section className={s.hubSection}>
            <h3 className={s.hubH}>Milestones</h3>
            <ol className={s.miles} style={{ ["--n" as string]: p.milestones.length }}>
              {p.milestones.map((m) => (
                <li key={m.title} className={s.mile} data-done={m.done || undefined}>
                  <span className={s.mileDot} style={m.done ? { background: hueVar(p.hue), borderColor: hueVar(p.hue) } : undefined}>
                    {m.done ? <I.check size={9} /> : null}
                  </span>
                  <span className={s.mileTitle}>{m.title}</span>
                  <span className={s.mileDate}>{m.date}</span>
                  {m.moved ? <span className={s.mileMoved}>{m.moved}</span> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <div className={s.hubGrid}>
          {p.waiting.length > 0 ? (
            <section className={s.hubSection}>
              <h3 className={s.hubH}>People</h3>
              <ul className={s.people}>
                {p.waiting.map((w) => {
                  const person = PEOPLE[w.person];
                  const me = w.person === ME;
                  return (
                    <li key={w.person} className={s.person}>
                      <Avatar id={w.person} size={28} />
                      <div className={s.personText}>
                        <p className={s.personName}>
                          {me ? "You" : person.first}
                          <span className={s.personWait}>
                            {" "}
                            · {w.count} {w.count === 1 ? "thing" : "things"} waiting on {me ? "you" : person.pronoun}
                          </span>
                        </p>
                        <p className={s.personWhat}>{w.what}</p>
                      </div>
                      {!me ? (
                        <button type="button" className={s.signalBtn} onClick={() => onToast(`${person.first} will get a nudge about ${w.what.toLowerCase()}.`)}>
                          Nudge
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {p.links.length > 0 ? (
            <section className={s.hubSection}>
              <h3 className={s.hubH}>Key links</h3>
              <ul className={s.links}>
                {p.links.map((l) => (
                  <li key={l.label}>
                    <button type="button" className={s.linkRow} onClick={() => onToast(`Opening ${l.label}.`)}>
                      <LinkIcon kind={l.kind} />
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {p.activity.length > 0 ? (
          <section className={s.hubSection}>
            <h3 className={s.hubH}>Recent activity</h3>
            <ul className={s.activity}>
              {p.activity.map((a, i) => (
                <li key={i} className={s.activityItem}>
                  <Avatar id={a.who} size={18} />
                  <span>
                    <b>{a.who === ME ? "You" : PEOPLE[a.who].first}</b> {a.what}
                  </span>
                  <span className={s.activityWhen}>{a.when}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className={s.hubFoot}>
          <Ring done={p.done} total={p.total} hue={p.hue} size={20} />
          <span>
            {p.done} of {p.total} tasks done
          </span>
          <button type="button" className={s.btn} onClick={() => onToast(`Opening ${p.name}.`)}>
            Open project
            <I.arrowRight size={14} />
          </button>
        </footer>
      </motion.aside>
    </>
  );
}
