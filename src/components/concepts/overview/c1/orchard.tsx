"use client";

import { useId, useState, type ReactNode } from "react";
import { useEdition } from "./context";
import {
  CHANGES,
  LAST_READ,
  PEOPLE,
  TODAY,
  WEEK_END,
  WEEKLY_DONE,
  fmtLong,
  lowerWord,
  word,
  type PersonId,
  type Task,
} from "./data";
import { Check, Chevron } from "./icons";
import { Chain, DecideBy, LoadStack, Ruler, Sparkline } from "./margin";
import { Chg, Rewrite, Rw, Section } from "./parts";
import {
  Act,
  Avatar,
  DatePill,
  FilePill,
  Jump,
  PersonPill,
  TaskPill,
  isLate,
} from "./pill";
import s from "./edition.module.css";

const WEEK_START = "2026-07-13";

/* Every open decision, with the date it has to be made by. One count drives
   every sentence on the page, so the prose cannot disagree with itself. */
const DECISION_BY: Record<"seating" | "tonic" | "tasting", { iso: string; when: string }> = {
  seating: { iso: "2026-07-17", when: "Friday noon" },
  tonic: { iso: "2026-07-20", when: "Monday" },
  tasting: { iso: "2026-07-20", when: "Monday" },
};

export function useOrchard() {
  const { task, tasks } = useEdition();
  const seating = task("seating");
  const tonic = task("tonic");
  const tasting = task("tasting");
  const seatingOpen = seating.status !== "done" && !seating.handled;
  const tonicOpen = isLate(tonic) && !tonic.handled;
  const tastingOpen = tasting.status === "stalled" && !tasting.handled;
  const slipped = [tonicOpen, tastingOpen].filter(Boolean).length;
  const openIds = (
    [
      ["seating", seatingOpen],
      ["tonic", tonicOpen],
      ["tasting", tastingOpen],
    ] as const
  )
    .filter(([, on]) => on)
    .map(([id]) => id);
  const openDecisions = openIds.length;
  const decided = 3 - openDecisions;
  /* The single most urgent open decision gets the one filled button. */
  const urgent = openIds[0] ?? null;
  const next = urgent ? DECISION_BY[urgent] : null;
  const orchard = tasks.filter((t) => t.project === "orchard");
  return {
    seating,
    tonic,
    tasting,
    seatingOpen,
    tonicOpen,
    tastingOpen,
    slipped,
    openDecisions,
    decided,
    urgent,
    next,
    orchard,
  };
}

type Tail = "clear" | "seat2" | "seat1" | "seat" | "both" | "tonic" | "quote";

/* The clause after the head, one per state of the three decisions. */
function tailFor(k: Tail): ReactNode {
  switch (k) {
    case "clear":
      return (
        <span className={s.ledeQuiet}>
          You have dealt with everything that needed you, so the rest of the
          morning is yours.
        </span>
      );
    case "seat2":
    case "seat1":
      return (
        <>
          {k === "seat2" ? "Three" : "Two"} things need your call: the{" "}
          <FilePill id="seating">seating plan</FilePill> by Friday, and{" "}
          <Jump to="slipped">
            {k === "seat2" ? "two that slipped" : "one that slipped"}
          </Jump>
          .
        </>
      );
    case "seat":
      return (
        <>
          Nothing is slipping now. One thing still needs your call: the{" "}
          <FilePill id="seating">seating plan</FilePill>, by Friday.
        </>
      );
    case "both":
      return (
        <>
          Both things that slipped need your call: the{" "}
          <TaskPill id="tonic">tonic order</TaskPill> and the{" "}
          <FilePill id="quote">wine quote</FilePill>.
        </>
      );
    case "tonic":
      return (
        <>
          One thing that slipped still needs your call: the{" "}
          <TaskPill id="tonic">tonic order</TaskPill>.
        </>
      );
    case "quote":
      return (
        <>
          One thing that slipped still needs your call: chasing the{" "}
          <FilePill id="quote">wine quote</FilePill>.
        </>
      );
  }
}

export function OrchardLede() {
  const { slipped, openDecisions, seatingOpen, tonicOpen } = useOrchard();
  /* At most two handles in the lede, both about work. The head holds still;
     only the clause that stopped being true is rewritten. */
  const tail: Tail = !openDecisions
    ? "clear"
    : seatingOpen && slipped
      ? slipped === 2
        ? "seat2"
        : "seat1"
      : seatingOpen
        ? "seat"
        : slipped === 2
          ? "both"
          : tonicOpen
            ? "tonic"
            : "quote";
  return (
    <>
      Mara and Finn are 79 days out and{" "}
      <Rewrite
        k={slipped ? "mostly" : "on"}
        render={(k) => (k === "mostly" ? "mostly on track." : "on track.")}
      />{" "}
      <Rewrite k={tail} render={tailFor} />
    </>
  );
}

function Resolved({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className={`${s.decision} ${s.decisionDone}`} id={id} tabIndex={-1}>
      <Check className={s.doneTick} />
      <p>{children}</p>
    </div>
  );
}

/* The past-tense line a decision becomes once the reader acts on it. */
function resolvedLine(t: Task): string {
  const a = t.lastAction;
  const who = (id: PersonId) => PEOPLE[id].name;
  if (t.id === "seating") {
    return a?.kind === "nudge"
      ? "You asked Aoife for changes to the seating plan. She has until Friday noon."
      : "You approved the seating plan. Aoife will send it to the printer today.";
  }
  if (t.id === "tonic") {
    if (a?.kind === "reassign")
      return `You gave the tonic order to ${who(a.to)}, who is in the venue all week.`;
    if (a?.kind === "reschedule")
      return `You moved the tonic order to ${fmtLong(a.to)}, when Tomás is back.`;
    return "You marked the tonic order done.";
  }
  if (a?.kind === "nudge" && a.to === "niamh")
    return "You asked Niamh to chase the Ballymaloe quote. It usually lands within a day.";
  if (a?.kind === "nudge")
    return `You asked ${who(a.to)} to chase Ballymaloe Wines for the quote.`;
  return `${t.title} is sorted.`;
}

export function OrchardBody() {
  const { task } = useEdition();
  const o = useOrchard();
  const tonic = o.tonic;
  const marquee = task("marquee");
  const orchard = o.orchard;

  /* finished this week */
  const done = orchard.filter(
    (t) => t.status === "done" && t.doneAt && t.doneAt >= WEEK_START,
  );
  const doneTotal = 7 + orchard.filter((t) => t.status === "done").length;
  const spark = [...WEEKLY_DONE.slice(0, 3), done.length];

  /* who is on what; the reader first */
  const load = (id: PersonId) => {
    const open = orchard.filter((t) => t.owner === id && t.status !== "done");
    return {
      id,
      open: open.length,
      week: open.filter((t) => t.due && t.due <= WEEK_END).length,
      tasks: open,
    };
  };
  const team = (["dara", "aoife", "tomas", "niamh", "priya"] as PersonId[]).map(
    load,
  );
  const [you, aoife, tomas, niamh, priya] = team;

  const tonicWord =
    tonic.owner === "aoife"
      ? "the tonic order too, which makes this her heaviest week since May"
      : null;

  return (
    <>
      <Section
        id="needs"
        title={o.decided < 3 ? "What needs you" : "What needed you"}
        foot="Decisions"
        keep
        margin={
          <DecideBy
            rows={[
              {
                n: 1,
                label: "Seating plan",
                when: o.seatingOpen ? "Friday noon" : "Approved",
                soon: o.seatingOpen,
                done: !o.seatingOpen,
              },
              {
                n: 2,
                label: "Tonic order",
                when: o.tonicOpen ? "Monday" : "Handled",
                done: !o.tonicOpen,
              },
              {
                n: 3,
                label: "Wine quote",
                when: o.tastingOpen ? "Monday" : "Being chased",
                done: !o.tastingOpen,
              },
            ]}
          />
        }
        topic={
          <>
            {o.seatingOpen ? (
              <div className={s.decision} id="dec-seating" tabIndex={-1}>
                <p>
                  <Rw k="seat-open">
                    <PersonPill id="aoife" />{" "}
                    <Chg n={1}>
                      sent the <FilePill id="seating">seating plan</FilePill>{" "}
                      for your approval
                    </Chg>{" "}
                    yesterday afternoon, and the printer needs it by{" "}
                    <DatePill iso="2026-07-17">Friday noon</DatePill>.{" "}
                    <Act task="seating" primary={o.urgent === "seating"}>
                      Approve it
                    </Act>{" "}
                    or{" "}
                    <Act task="seating" index={1}>
                      ask her for changes
                    </Act>
                    .
                  </Rw>
                </p>
              </div>
            ) : (
              <Resolved id="dec-seating">
                <Rw k="seat-done">{resolvedLine(o.seating)}</Rw>
              </Resolved>
            )}
            {o.tonicOpen ? (
              <div className={s.decision} id="dec-tonic" tabIndex={-1}>
                <p>
                  <Rw k={`tonic-open-${o.urgent === "tonic"}`}>
                    The <TaskPill id="tonic">tonic and olives order</TaskPill>{" "}
                    is <Chg n={2}>two days late</Chg>.{" "}
                    <Act task="tonic" primary={o.urgent === "tonic"}>
                      Push it to Monday
                    </Act>{" "}
                    or{" "}
                    <Act task="tonic" index={1}>
                      give it to Aoife
                    </Act>
                    , who is in the venue all week.
                  </Rw>
                </p>
              </div>
            ) : (
              <Resolved id="dec-tonic">
                <Rw k="tonic-done">{resolvedLine(tonic)}</Rw>
              </Resolved>
            )}
            {o.tastingOpen ? (
              <div className={s.decision} id="dec-tasting" tabIndex={-1}>
                <p>
                  <Rw k={`tasting-open-${o.urgent === "tasting"}`}>
                    The <TaskPill id="tasting">menu tasting</TaskPill> needs the
                    quote from Ballymaloe Wines. A word from Niamh usually moves
                    them within a day, so{" "}
                    <Act task="tasting" primary={o.urgent === "tasting"}>
                      ask Niamh to chase it
                    </Act>{" "}
                    or{" "}
                    <Act task="tasting" index={1}>
                      have Tomás call them
                    </Act>
                    .
                  </Rw>
                </p>
              </div>
            ) : (
              <Resolved id="dec-tasting">
                <Rw k="tasting-done">{resolvedLine(o.tasting)}</Rw>
              </Resolved>
            )}
          </>
        }
        more={
          o.decided < 3 ? (
            <p className={s.aside}>
              {o.seatingOpen
                ? "If the plan is not with the printer by Friday noon, the next print slot is 31 July, which is tight for place cards."
                : o.openDecisions === 2
                  ? "Both can wait until Monday without touching the wedding, but they get harder the longer they sit."
                  : "What is left can wait until Monday without touching the wedding, but it gets harder the longer it sits."}
            </p>
          ) : (
            <p className={s.aside}>
              That is everything that needed you. Anything new will show up here
              first.
            </p>
          )
        }
      />

      <SinceBand />

      <Section
        id="slipped"
        title="What slipped and why"
        foot="What waits on what"
        margin={
          <Chain
            steps={[
              {
                label: "Ballymaloe quote",
                state: o.tastingOpen ? "waiting" : "moved",
                meta: o.tastingOpen ? "Asked 1 Jul" : "Being chased",
              },
              { label: "Wine list", state: "blocked", meta: "Niamh" },
              { label: "Menu tasting", state: "blocked", meta: "Sat 1 Aug" },
              {
                label: "Menu to print",
                state: "ok",
                meta: "14 Aug, 4 days spare",
              },
            ]}
          />
        }
        topic={
          <p>
            <Rw k={o.tastingOpen ? "a" : "b"}>
              {o.tastingOpen ? (
                <>
                  The menu tasting has not moved in 15 days because the{" "}
                  <FilePill id="winelist">wine list</FilePill> is waiting on the{" "}
                  <FilePill id="quote">supplier quote</FilePill>, asked for on 1
                  July. <PersonPill id="niamh" /> moved the tasting from{" "}
                  <Chg n={3}>25 July to 1 August</Chg> to give Ballymaloe more
                  time. <Jump to="dec-tasting" quiet>See decision 3</Jump>
                </>
              ) : (
                <>
                  The menu tasting should start moving again: the{" "}
                  <FilePill id="quote">supplier quote</FilePill> is being
                  chased, and the <FilePill id="winelist">wine list</FilePill>{" "}
                  follows as soon as it lands.
                </>
              )}
            </Rw>
          </p>
        }
        more={
          <>
            <p>
              It only becomes a real problem if the tasting passes{" "}
              <DatePill iso="2026-08-14">14 August</DatePill>, when the menu
              goes to print.
            </p>
            <p>
              <Rw k={o.tonicOpen ? "t1" : "t2"}>
                {o.tonicOpen ? (
                  <>
                    The tonic order slipped because <PersonPill id="tomas" /> has
                    been at the marquee field since Monday, and the delivery
                    needs someone at the venue to sign for it.{" "}
                    <Jump to="dec-tonic" quiet>
                      See decision 2
                    </Jump>
                  </>
                ) : (
                  <>
                    The tonic order is back in hand, with{" "}
                    <PersonPill id={tonic.owner} />{" "}
                    {tonic.due && tonic.due > TODAY
                      ? `on it for ${fmtLong(tonic.due)}`
                      : "on it"}
                    .
                  </>
                )}
              </Rw>
            </p>
            <p>
              <Rw k={marquee.due ?? "none"}>
                {marquee.due ? (
                  <>
                    <TaskPill id="marquee">The marquee sides</TaskPill> now have
                    a date:{" "}
                    <DatePill iso={marquee.due}>
                      {fmtLong(marquee.due)}
                    </DatePill>
                    , at the site visit.
                  </>
                ) : (
                  <>
                    One more has no date at all: <TaskPill id="marquee" />.
                    Tuesday’s site visit is the natural moment, so{" "}
                    <Act task="marquee">set it for 21 July</Act>.
                  </>
                )}
              </Rw>
            </p>
          </>
        }
      />

      <Section
        id="coming"
        title="Coming up"
        foot="The next two weeks"
        margin={
          <Ruler
            marks={[
              { iso: "2026-07-16", label: "Run-sheet due", tone: "accent" },
              {
                iso: "2026-07-17",
                label: o.seatingOpen ? "Seating to print" : "Seating printed",
                tone: o.seatingOpen ? "danger" : undefined,
              },
              { iso: "2026-07-18", label: "Christening lunch" },
              { iso: "2026-07-21", label: "Site visit" },
              { iso: "2026-07-24", label: "Final numbers" },
              { iso: "2026-07-27", label: "Proofs" },
              { iso: "2026-08-01", label: "Menu tasting" },
            ]}
          />
        }
        topic={
          <p>
            The Kelly christening lunch for 40 is on{" "}
            <DatePill iso="2026-07-18">Saturday</DatePill>, so{" "}
            Aoife’s <TaskPill id="runsheet">run-sheet</TaskPill> is due
            today.
          </p>
        }
        more={
          <p>
            Next week is quieter. <PersonPill id="tomas" /> meets the hire
            company on site on{" "}
            <DatePill iso="2026-07-21">Tuesday 21 July</DatePill>, and Mara and
            Finn owe their final guest numbers by{" "}
            <DatePill iso="2026-07-24">Friday 24 July</DatePill>.{" "}
            Priya’s first <FilePill id="proofs">stationery proofs</FilePill>{" "}
            land on{" "}
            <DatePill iso="2026-07-27">Monday 27 July</DatePill>, and the menu
            tasting follows on 1 August.
          </p>
        }
      />

      <Section
        id="finished"
        title="Finished"
        foot="Pace"
        margin={<Sparkline values={spark} />}
        topic={
          <p className={s.finished}>
            <Rw k={done.map((d) => d.id).join()}>
              <FinishedList items={done} />
            </Rw>
          </p>
        }
        more={
          <p>
            That makes {doneTotal <= 10 ? lowerWord(doneTotal) : doneTotal} of the 22 tasks for the wedding. The pace has
            dropped: {lowerWord(done.length)} finished this week, against four
            or five in each of the three before, mostly because the menu is
            stuck behind the wine quote.
          </p>
        }
      />

      <Section
        id="who"
        title="Who is on what"
        foot="Who carries what"
        margin={<LoadStack rows={team.filter((t) => t.open > 0)} />}
        topic={
          <p>
            <Rw k={`${aoife.open}-${aoife.week}-${tomas.open}`}>
              <PersonPill id="aoife" /> is carrying {lowerWord(aoife.open)} open tasks,{" "}
              {lowerWord(aoife.week)} due this week
              {tomas.open <= 2 ? (
                <>
                  ; <PersonPill id="tomas" /> has room.
                </>
              ) : (
                <>
                  , and <PersonPill id="tomas" /> has {lowerWord(tomas.open)}.
                </>
              )}
            </Rw>
          </p>
        }
        more={
          <p>
            <Rw k={`${tonicWord}-${niamh.open}-${you.open}`}>
              {tonicWord && <>She now has {tonicWord}. </>}
              <PersonPill id="niamh" /> has {lowerWord(niamh.open)}, and one of them is
              waiting on the wine quote. <PersonPill id="priya" /> has{" "}
              {priya.open === 1
                ? "only the stationery proofs"
                : `${lowerWord(priya.open)} here`}
              .{" "}
              {you.open ? (
                <>
                  You have {you.open === 1 ? "one" : you.open}:{" "}
                  {joinWords(you.tasks.map((t) => t.phrase))}.
                </>
              ) : (
                <>You have nothing open on this project.</>
              )}
            </Rw>
          </p>
        }
      />
    </>
  );
}

/* What changed since the reader last opened the page, folded to one line
   right after the decisions. It opens in place, or marks the prose. */
function SinceBand() {
  const { tracked, toggleTracked } = useEdition();
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className={s.since}>
      <p className={s.sinceLine}>
        <span className={s.sinceSwatch} aria-hidden />
        <span>
          {word(CHANGES.length)} things changed since you last read, on{" "}
          {LAST_READ}.{" "}
          <button
            type="button"
            className={s.sinceBtn}
            aria-pressed={tracked}
            onClick={toggleTracked}
          >
            {tracked ? "Hide them in the text" : "Show them in the text"}
          </button>{" "}
          or{" "}
          <button
            type="button"
            className={s.sinceBtn}
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "fold the list" : "list them"}
            <Chevron className={s.sinceChev} />
          </button>
        </span>
      </p>
      <div
        className={s.more}
        data-open={open || undefined}
        aria-hidden={!open || undefined}
        inert={!open || undefined}
      >
        <div className={s.moreInner}>
          <ol id={listId} className={s.diff}>
            {CHANGES.map((c, i) => (
              <li key={c.id} className={s.diffRow}>
                <span className={s.num} data-on={tracked || undefined}>
                  {i + 1}
                </span>
                <span className={s.diffMain}>
                  <span className={s.diffSubject}>{c.subject}</span>
                  <span className={s.diffChange}>
                    {c.from && <del className={s.del}>{c.from}</del>}
                    {c.from && (
                      <span className={s.diffArrow} aria-hidden>
                        →
                      </span>
                    )}
                    <ins className={s.ins}>
                      {c.tone && (
                        <span
                          className={s.insDot}
                          data-tone={c.tone}
                          aria-hidden
                        />
                      )}
                      {c.to}
                    </ins>
                  </span>
                </span>
                <span className={s.diffBy}>
                  <Avatar id={c.who} size="xs" />
                  {c.who === "dara" ? "You" : PEOPLE[c.who].name}, {c.when}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

const joinWords = (xs: string[]) =>
  xs.length < 2
    ? xs.join("")
    : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/* How each finished task reads in a sentence. */
const FINISHED_CLAUSE: Record<string, [string, string]> = {
  openday: ["the open day", " went well, with nine couples through"],
  deposit: ["Mara and Finn’s deposit", " is settled"],
  seating: ["the seating plan", " is approved"],
};

function FinishedList({ items }: { items: Task[] }) {
  if (!items.length) return <>Nothing is finished yet this week.</>;
  return (
    <>
      This week,{" "}
      {items.map((t, i) => {
        const [phrase, rest] = FINISHED_CLAUSE[t.id] ?? [t.phrase, " is done"];
        const clause = (
          <>
            <TaskPill id={t.id}>{phrase}</TaskPill>
            {rest}
          </>
        );
        const n = t.id === "deposit" ? 4 : t.id === "openday" ? 5 : 0;
        return (
          <span key={t.id}>
            {i > 0 && (i === items.length - 1 ? ", and " : ", ")}
            {n ? <Chg n={n}>{clause}</Chg> : clause}
          </span>
        );
      })}
      .
    </>
  );
}

/* A deliberately calm edition for a quiet day. */
export function QuietLede() {
  return (
    <>
      Nothing slipped. Nothing needs you.{" "}
      <span className={s.ledeQuiet}>
        The next date that matters is the{" "}
        <TaskPill id="tasting">menu tasting</TaskPill> on{" "}
        <DatePill iso="2026-08-01">1 August</DatePill>.
      </span>
    </>
  );
}

export function QuietBody() {
  return (
    <Section
      id="quiet"
      tone="calm"
      title="That is the whole edition"
      topic={
        <p>
          <PersonPill id="aoife" /> finished the run-sheet last night
          and <PersonPill id="niamh" /> has the christening prep in hand. Every open
          task has an owner and a date. If that changes, this page will say so
          here before anywhere else.
        </p>
      }
    />
  );
}

export const personName = (id: PersonId) => PEOPLE[id].name;
