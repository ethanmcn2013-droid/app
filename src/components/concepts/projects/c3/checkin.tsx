"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { I, Kbd, StatusDot, Swatch, firstName } from "./bits";
import { daysLabel } from "./card";
import { LANES, STATUS_LABEL, THIS_WEEK, WEEKS, type Lane, type Project, type Status } from "./data";
import { openSignals, suggestFor, type Answer, type PState } from "./logic";
import s from "./c3.module.css";

/**
 * One project's answer in progress. `suggested` means the line is still the
 * one written for you: it is kept on Enter, and replaced the moment you type.
 */
export type Draft = { status?: Status; line: string; suggested?: boolean; skipped?: boolean };

const MEANING: Record<Status, string> = {
  on: "Will land as planned",
  risk: "Could slip without help",
  off: "Needs a new plan or date",
};

const CHOICES: Status[] = ["on", "risk", "off"];

type Props = {
  queue: Project[];
  pstate: Record<string, PState>;
  index: number;
  setIndex: Dispatch<SetStateAction<number>>;
  drafts: Record<string, Draft>;
  setDrafts: Dispatch<SetStateAction<Record<string, Draft>>>;
  isPhone: boolean;
  reduce: boolean;
  startedAt: number;
  onPause: () => void;
  onFinish: () => void;
};

export function CheckIn({ queue, pstate, index, setIndex, drafts, setDrafts, isPhone, reduce, startedAt, onPause, onFinish }: Props) {
  const p = queue[Math.min(index, queue.length - 1)];
  const draft = drafts[p.id] ?? { line: "" };
  const [dir, setDir] = useState(1);
  const [nudge, setNudge] = useState(0);
  // popLayout keeps the outgoing card mounted for a moment, so its textarea
  // unmounts after the incoming one has mounted. Only ever take a live element,
  // never the null an unmounting card hands back.
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const keepInput = (el: HTMLTextAreaElement | null) => {
    if (el) inputRef.current = el;
  };
  // The field that belongs to the card on screen now, whatever is still animating out.
  const field = () =>
    document.querySelector<HTMLTextAreaElement>(`textarea[data-ci-project="${p.id}"]`) ??
    (inputRef.current?.isConnected ? inputRef.current : null);
  const gesture = useRef<{ y: number; id: number } | null>(null);
  const [dy, setDy] = useState(0);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.round((now - startedAt) / 1000));
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const last = p.history[p.history.length - 1];
  const top = openSignals(p, pstate[p.id] ?? { resolved: [], snoozed: [], nudged: [], done: [] }).find((x) => x.weight !== "fine");
  const isLast = index >= queue.length - 1;

  const setDraft = (patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [p.id]: { ...(d[p.id] ?? { line: "" }), ...patch } }));

  // Picking a status writes the line for you, and rewrites it if you change
  // your mind, until you have made the line your own.
  const choose = (st: Status) => {
    const keep = draft.line.trim().length > 0 && !draft.suggested;
    setDraft(keep ? { status: st, skipped: false } : { status: st, skipped: false, line: suggestFor(p, st), suggested: true });
  };

  const editLine = () => {
    const el = field();
    if (!el) return;
    el.focus();
    // Selected, so typing or Backspace replaces the suggestion in one go.
    if (draft.suggested) el.select();
  };

  const advance = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setDir(1);
    setIndex(index + 1);
    field()?.blur();
  };

  const skip = () => {
    setDraft({ skipped: true, status: undefined, line: "", suggested: false });
    advance();
  };

  const go = (delta: number) => {
    if (delta > 0 && !draft.status) {
      setNudge((n) => n + 1);
      return;
    }
    if (delta > 0 && isLast) {
      onFinish();
      return;
    }
    const nextIndex = Math.max(0, Math.min(queue.length - 1, index + delta));
    if (nextIndex === index) return;
    setDir(delta);
    setIndex(nextIndex);
    field()?.blur();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inInput = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      // Buttons and links keep their own Enter and Space.
      const onControl = !!t && !!t.closest("button, a, [role=radio]");
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onPause();
        return;
      }
      // Digits pick a status only outside the field, so "2 suppliers left" types normally.
      if (["1", "2", "3"].includes(e.key) && !inInput) {
        e.preventDefault();
        choose(CHOICES[Number(e.key) - 1]);
        return;
      }
      if ((e.key === "e" || e.key === "E") && !inInput && !onControl) {
        e.preventDefault();
        editLine();
        return;
      }
      if ((e.key === "s" || e.key === "S") && !inInput && !onControl) {
        e.preventDefault();
        skip();
        return;
      }
      if (e.key === "Enter" && !onControl) {
        e.preventDefault();
        go(e.shiftKey ? -1 : 1);
        return;
      }
      if (!inInput && !onControl && e.key === "ArrowRight") go(1);
      if (!inInput && !onControl && e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d > 0 ? 26 : -26, scale: 0.965 }),
    center: { opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 },
    exit: (d: number) =>
      reduce ? { opacity: 0 } : isPhone ? { opacity: 0, y: d > 0 ? -120 : 120 } : { opacity: 0, x: d > 0 ? -90 : 90, rotate: d > 0 ? -2.5 : 2.5, scale: 0.98 },
  };

  return (
    <div className={s.ci} data-phone={isPhone || undefined}>
      <header className={s.ciTop}>
        <div className={s.ciTopLeft}>
          <h1 className={s.ciTitle}>Weekly check-in</h1>
          <span className={s.ciWeek}>Week of {THIS_WEEK}</span>
        </div>
        <div className={s.ciProgress} aria-label={`Project ${index + 1} of ${queue.length}`}>
          <div className={s.ciDots}>
            {queue.map((q, i) => (
              <button
                key={q.id}
                type="button"
                className={s.ciDotBtn}
                data-current={i === index || undefined}
                aria-label={`${q.name}${drafts[q.id]?.status ? `, ${STATUS_LABEL[drafts[q.id].status as Status]}` : drafts[q.id]?.skipped ? ", skipped" : ""}`}
                onClick={() => {
                  setDir(i > index ? 1 : -1);
                  setIndex(i);
                }}
              >
                <StatusDot status={drafts[q.id]?.status ?? null} skipped={drafts[q.id]?.skipped} size={8} />
              </button>
            ))}
          </div>
          <span className={s.ciCount}>
            {index + 1} of {queue.length}
          </span>
        </div>
        <button type="button" className={s.ciExit} onClick={onPause}>
          {isPhone ? <I.x size={16} /> : null}
          <span className={isPhone ? s.srOnly : undefined}>Pause</span>
          {!isPhone ? <Kbd>Esc</Kbd> : null}
        </button>
      </header>

      <div className={s.ciStage}>
        <div className={s.ciStack}>
          {index < queue.length - 1 ? <div className={s.ciGhost} data-depth="1" aria-hidden /> : null}
          {index < queue.length - 2 ? <div className={s.ciGhost} data-depth="2" aria-hidden /> : null}
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.section
              key={p.id}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 34, opacity: { duration: 0.18 } }}
              className={s.ciCard}
              aria-labelledby="c3-ci-q"
              style={dy ? { translate: `0 ${dy}px` } : undefined}
              onPointerDown={(e) => {
                if (!isPhone || e.pointerType === "mouse") return;
                if ((e.target as HTMLElement).closest("input, textarea, button")) return;
                gesture.current = { y: e.clientY, id: e.pointerId };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!gesture.current) return;
                setDy(Math.min(0, Math.max(-160, e.clientY - gesture.current.y)));
              }}
              onPointerUp={() => {
                if (!gesture.current) return;
                gesture.current = null;
                if (dy < -70) go(1);
                setDy(0);
              }}
              onPointerCancel={() => {
                gesture.current = null;
                setDy(0);
              }}
            >
              <div className={s.ciHead}>
                <Swatch hue={p.hue} size={12} />
                <span className={s.ciName}>{p.name}</span>
                <span className={s.ciMeta}>
                  {ownerPhrase(p.owner)} · {p.dateWhat} {p.date}, {daysLabel(p.daysOut)}
                </span>
              </div>

              {last ? (
                <div className={s.ciLast}>
                  <p className={s.ciLabel}>
                    Last update · Mon {last.week}
                  </p>
                  <p className={s.ciQuote}>
                    <StatusDot status={last.status} size={8} />
                    <span>{last.line}</span>
                  </p>
                </div>
              ) : (
                <div className={s.ciLast}>
                  <p className={s.ciLabel}>First check-in for this project</p>
                </div>
              )}

              <div className={s.ciSince}>
                <span className={s.ciLabel}>Since then</span>
                {p.since.done + p.since.added + p.since.overdue === 0 ? (
                  <span className={s.ciStat}>Nothing has moved</span>
                ) : (
                  <>
                    <span className={s.ciStat}>
                      <b>{p.since.done}</b> done
                    </span>
                    <span className={s.ciStat}>
                      <b>{p.since.added}</b> added
                    </span>
                    {p.since.overdue ? (
                      <span className={s.ciStat} data-bad>
                        <b>{p.since.overdue}</b> new overdue
                      </span>
                    ) : null}
                  </>
                )}
              </div>
              {top ? (
                <p className={s.ciSignal}>
                  <I.signal size={14} />
                  <span>{top.sentence}</span>
                </p>
              ) : null}

              <h2 id="c3-ci-q" className={s.ciQ}>
                How is {p.name} going?
              </h2>

              <motion.div
                key={nudge}
                className={s.choices}
                role="radiogroup"
                aria-label="Status this week"
                animate={nudge && !reduce ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
                transition={{ duration: 0.32 }}
              >
                {CHOICES.map((st, i) => {
                  const picked = draft.status === st;
                  const tags = [p.suggestion.status === st ? "Signals point here" : "", last?.status === st ? "Last week" : ""].filter(Boolean);
                  return (
                    <button
                      key={st}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      className={s.choice}
                      data-tone={st}
                      data-tagged={tags.length > 0 || undefined}
                      onClick={() => choose(st)}
                    >
                      <span className={s.choiceKey} aria-hidden>
                        {picked ? <I.check size={12} /> : i + 1}
                      </span>
                      <span className={s.choiceHead}>
                        <StatusDot status={st} size={10} />
                        <span className={s.choiceLabel}>{STATUS_LABEL[st]}</span>
                      </span>
                      <span className={s.choiceHint}>{MEANING[st]}</span>
                      <span className={s.choiceTag}>{tags.length ? tags.join(" · ") : "\u00a0"}</span>
                    </button>
                  );
                })}
              </motion.div>
              {nudge > 0 && !draft.status ? (
                <p className={s.ciNudge} role="status">
                  {isPhone ? "Pick a status first, or skip this one for now." : "Pick a status with 1, 2 or 3, or press S to skip this one for now."}
                </p>
              ) : null}

              <div className={s.ciField}>
                <div className={s.ciFieldHead}>
                  <label htmlFor="c3-ci-line" className={s.ciLabel}>
                    One line for the team
                  </label>
                  {draft.suggested && draft.status ? (
                    <button type="button" className={s.ciSuggested} onClick={editLine}>
                      <I.sparkle size={12} />
                      Suggested
                      <span aria-hidden>·</span>
                      <span className={s.ciSuggestedEdit}>edit</span>
                    </button>
                  ) : null}
                </div>
                <textarea
                  ref={keepInput}
                  data-ci-project={p.id}
                  id="c3-ci-line"
                  className={s.ciInput}
                  data-suggested={(draft.suggested && !!draft.status) || undefined}
                  value={draft.line}
                  rows={2}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={draft.status ? "Write one line, or leave it empty" : "Pick a status and a line is written for you"}
                  onFocus={(e) => {
                    if (draft.suggested) e.currentTarget.select();
                  }}
                  onChange={(e) => setDraft({ line: e.target.value.replace(/\s*\n\s*/g, " "), suggested: false })}
                />
              </div>

              <footer className={s.ciFoot}>
                <span className={s.ciFootStart}>
                  <button type="button" className={s.btnGhost} onClick={() => go(-1)} disabled={index === 0}>
                    <I.chevronLeft size={14} />
                    Back
                  </button>
                  <button type="button" className={s.btnGhost} onClick={skip}>
                    Skip for now
                    {!isPhone ? <Kbd>S</Kbd> : null}
                  </button>
                </span>
                {!isPhone ? (
                  <span className={s.ciKeys}>
                    <Kbd>1</Kbd>
                    <Kbd>2</Kbd>
                    <Kbd>3</Kbd> choose · <Kbd>E</Kbd> edit the line
                  </span>
                ) : null}
                <button type="button" className={s.btnPrimary} onClick={() => go(1)} data-ready={!!draft.status || undefined}>
                  {isLast ? "Finish" : "Next"}
                  {isPhone ? null : <Kbd>Enter</Kbd>}
                </button>
              </footer>
            </motion.section>
          </AnimatePresence>
        </div>
        {isPhone ? (
          <p className={s.ciSwipe}>
            <I.arrowUp size={12} /> Swipe up for the next project
          </p>
        ) : (
          <p className={s.ciDoneLine}>
            <I.clock size={13} />
            <span className={s.ciClock}>{clock}</span> so far · about a minute for all {queue.length}
          </p>
        )}
      </div>
    </div>
  );
}

function ownerPhrase(id: string | null) {
  if (!id) return "No owner yet";
  const who = firstName(id);
  return who === "You" ? "You own it" : `${who} owns it`;
}

/* ── summary ─────────────────────────────────────────────────────────── */

type SummaryProps = {
  /** Projects this check-in moves on the board, in the order they will land. */
  boardMoves: { id: string; name: string; to: Lane }[];
  projects: Project[];
  answers: Record<string, Answer>;
  skipped: string[];
  elapsed: number;
  reduce: boolean;
  onDone: () => void;
  onAgain: () => void;
  onToast: (t: string) => void;
};

export function Summary({ boardMoves, projects, answers, skipped, elapsed, reduce, onDone, onAgain, onToast }: SummaryProps) {
  const rows = projects.filter((p) => answers[p.id]);
  const skippedRows = projects.filter((p) => skipped.includes(p.id) && !answers[p.id]);
  const noLine = rows.filter((p) => !answers[p.id].line.trim());
  const moves = groupMoves(rows, answers);
  const [draft, setDraft] = useState(() => composeDraft(rows, answers));
  const [saved, setSaved] = useState(false);

  const secs = elapsed;
  const time = secs < 90 ? `${secs} seconds` : `${Math.round(secs / 60)} minutes`;

  return (
    <div className={s.sum}>
      <div className={s.sumInner}>
        <p className={s.eyebrow}>Week of 21 September</p>
        <h1 className={s.sumTitle}>This week, settled</h1>
        <p className={s.sumLead}>
          {rows.length} {rows.length === 1 ? "project" : "projects"} in {time}.{" "}
          {changeSentence(rows, answers)}
          {skippedRows.length ? ` ${count(skippedRows.length)} skipped for now.` : ""}
        </p>

        <ul className={s.ribbon} aria-label="What changed since last week">
          {[...moves.slipped, ...moves.recovered].map((p, i) => {
            const prev = p.history[p.history.length - 1]?.status ?? null;
            const now = answers[p.id].status;
            return (
              <li key={p.id} className={s.ribbonChip} data-kind={RANK[now] > RANK[prev as Status] ? "slipped" : "recovered"}>
                <Swatch hue={p.hue} size={9} />
                <span className={s.ribbonName}>{p.name}</span>
                <span className={s.ribbonChange}>
                  <StatusDot status={prev} size={8} settle={false} />
                  <span className={s.srOnly}>{prev ? STATUS_LABEL[prev] : ""} to </span>
                  <I.arrowRight size={10} />
                  <StatusDot status={now} size={8} settle={!reduce} delay={380 + i * 120} />
                  <span className={s.ribbonNow}>{STATUS_LABEL[now]}</span>
                </span>
              </li>
            );
          })}
          {moves.steady.length ? (
            <li className={s.ribbonChip} data-kind="steady">
              <span className={s.ribbonName}>Held steady</span>
              <span className={s.ribbonCount}>{moves.steady.length}</span>
            </li>
          ) : null}
          {moves.first.length ? (
            <li className={s.ribbonChip} data-kind="steady">
              <span className={s.ribbonName}>First check-in</span>
              <span className={s.ribbonCount}>{moves.first.length}</span>
            </li>
          ) : null}
        </ul>

        <section className={s.sumList} aria-label="Each project">
          <div className={s.sumListHead} data-months aria-hidden>
            <span />
            <span className={s.sumWeeks}>
              <span className={s.sumMonth} style={{ gridColumn: "1 / span 4" }}>
                August
              </span>
              <span className={s.sumMonth} style={{ gridColumn: "5 / span 3" }}>
                September
              </span>
            </span>
            <span />
          </div>
          <div className={s.sumListHead}>
            <span>Project</span>
            <span className={s.sumWeeks}>
              {WEEKS.map((w) => (
                <span key={w}>{w.split(" ")[0]}</span>
              ))}
              <span className={s.sumNow}>21</span>
            </span>
            <span>This week&rsquo;s line</span>
          </div>
          {[
            { title: "Changed this week", list: [...moves.slipped, ...moves.recovered] },
            { title: "Held steady", list: moves.steady },
            { title: "First check-in", list: moves.first },
          ]
            .filter((g) => g.list.length)
            .map((g, gi) => (
              <div key={g.title} role="group" aria-label={g.title}>
                <p className={s.sumSub}>{g.title}</p>
                {g.list.map((p, i) => {
                  const prev = p.history[p.history.length - 1]?.status;
                  const now = answers[p.id].status;
                  return (
                    <div key={p.id} className={s.sumRow}>
                      <span className={s.sumName}>
                        <Swatch hue={p.hue} />
                        <span className={s.sumNameText}>
                          {p.name}
                          {prev && prev !== now ? (
                            <span className={s.sumWas}>
                              <StatusDot status={prev} size={6} />
                              {STATUS_LABEL[prev]}
                              <I.arrowRight size={10} />
                              <StatusDot status={now} size={6} />
                              {STATUS_LABEL[now]}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className={s.sumWeeks}>
                        {WEEKS.map((w) => {
                          const h = p.history.find((x) => x.week === w);
                          return (
                            <span key={w} className={s.sumCell}>
                              <StatusDot status={h?.status ?? null} size={8} />
                              <span className={s.srOnly}>{h ? `${w}: ${STATUS_LABEL[h.status]}` : `${w}: no check-in`}</span>
                            </span>
                          );
                        })}
                        <span className={`${s.sumCell} ${s.sumNow}`}>
                          <StatusDot status={now} size={14} settle={!reduce} delay={500 + (gi * 4 + i) * 140} />
                          <span className={s.srOnly}>This week: {STATUS_LABEL[now]}</span>
                        </span>
                      </span>
                      <span className={s.sumLine}>{answers[p.id].line}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          {noLine.length || skippedRows.length ? (
            <div className={s.sumNotes}>
              {noLine.length ? (
                <p className={s.sumNote}>
                  <span className={s.sumNoteLabel}>No new line</span>
                  {listNames(noLine)}. Status only this week.
                </p>
              ) : null}
              {skippedRows.length ? (
                <p className={s.sumNote}>
                  <span className={s.sumNoteLabel}>
                    <StatusDot status={null} skipped size={8} />
                    Skipped for now
                  </span>
                  {listNames(skippedRows)}. {skippedRows.length === 1 ? "It stays" : "They stay"} first in the queue next time.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={s.share}>
          <div className={s.shareHead}>
            <div>
              <h2 className={s.shareTitle}>Share this update with the team</h2>
              <p className={s.shareText}>Written from your answers. Edit anything before it goes out.</p>
            </div>
            <span className={s.draftChip}>{saved ? "Draft saved" : "Draft"}</span>
          </div>
          <textarea
            className={s.shareArea}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
            rows={Math.min(14, draft.split("\n").length + 1)}
            aria-label="Team update draft"
          />
          <div className={s.shareActions}>
            <p className={s.shareNote}>Nothing is sent from here. The draft waits in Messages until you choose to send it.</p>
            <button
              type="button"
              className={s.btn}
              onClick={() => {
                void navigator.clipboard?.writeText(draft).catch(() => undefined);
                onToast("Copied the update.");
              }}
            >
              Copy text
            </button>
            <button
              type="button"
              className={s.btnPrimary}
              onClick={() => {
                setSaved(true);
                onToast("Saved as a draft in Messages. Nothing has been sent.");
              }}
            >
              <I.pencil size={14} />
              Save draft
            </button>
          </div>
        </section>

        <div className={s.sumFoot}>
          {boardMoves.length ? (
            <p className={s.sumFootNote}>
              <I.signal size={13} />
              <span>{boardSentence(boardMoves)}</span>
            </p>
          ) : null}
          <button type="button" className={s.btnGhost} onClick={onAgain}>
            Do it again
          </button>
          <button type="button" className={s.btnPrimary} onClick={onDone}>
            Back to projects
            <I.arrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

const RANK: Record<Status, number> = { on: 0, risk: 1, off: 2 };
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** "Since last week, two slipped to off track and one came back on track." */
function changeSentence(rows: Project[], answers: Record<string, Answer>) {
  const moves = { off: 0, risk: 0, back: 0 };
  for (const p of rows) {
    const prev = p.history[p.history.length - 1]?.status;
    const now = answers[p.id].status;
    if (!prev || prev === now) continue;
    if (RANK[now] < RANK[prev]) moves.back += 1;
    else moves[now as "off" | "risk"] += 1;
  }
  const parts: string[] = [];
  const word = (n: number, first: boolean) => (first ? WORDS[n] ?? String(n) : (WORDS[n] ?? String(n)).toLowerCase());
  if (moves.off) parts.push(`${word(moves.off, parts.length === 0)} slipped to off track`);
  if (moves.risk) parts.push(`${word(moves.risk, parts.length === 0)} ${parts.length ? "to" : "slipped to"} at risk`);
  if (moves.back) parts.push(`${word(moves.back, parts.length === 0)} came back on track`);
  if (parts.length === 0) return "Every project kept last week’s status.";
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  return `Since last week, ${joined[0].toLowerCase()}${joined.slice(1)}.`;
}

function groupMoves(rows: Project[], answers: Record<string, Answer>) {
  const out = { slipped: [] as Project[], recovered: [] as Project[], steady: [] as Project[], first: [] as Project[] };
  for (const p of rows) {
    const prev = p.history[p.history.length - 1]?.status;
    const now = answers[p.id].status;
    if (!prev) out.first.push(p);
    else if (prev === now) out.steady.push(p);
    else if (RANK[now] > RANK[prev]) out.slipped.push(p);
    else out.recovered.push(p);
  }
  return out;
}

function count(n: number) {
  return WORDS[n] ?? String(n);
}

function listNames(list: Project[]) {
  const names = list.map((p) => p.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
}

/** "Back on the board, Winter season launch moves to Needs you." */
function boardSentence(list: { name: string; to: Lane }[]) {
  const title = (l: Lane) => LANES.find((x) => x.id === l)?.title ?? "";
  if (list.length === 1) return `Back on the board, ${list[0].name} moves to ${title(list[0].to)}.`;
  if (list.length === 2)
    return `Back on the board, ${list[0].name} moves to ${title(list[0].to)} and ${list[1].name} to ${title(list[1].to)}.`;
  return `Back on the board, ${list.length} projects move. ${list[0].name} goes to ${title(list[0].to)}.`;
}

function composeDraft(rows: Project[], answers: Record<string, Answer>) {
  const order: Status[] = ["off", "risk", "on"];
  const sorted = [...rows].sort((a, b) => order.indexOf(answers[a.id].status) - order.indexOf(answers[b.id].status));
  const lines = sorted.map((p) => {
    const a = answers[p.id];
    return `${p.name}: ${STATUS_LABEL[a.status].toLowerCase()}.${a.line ? ` ${a.line}` : ""}`;
  });
  return `Week of 21 September\n\n${lines.join("\n")}\n\nOrla`;
}
