"use client";

import type { ReactNode } from "react";
import { useEdition } from "./context";
import { PROJECTS, projectById, word, type ProjectId } from "./data";
import { Arrow, Check } from "./icons";
import { Countdown, Meter, Note } from "./margin";
import { useOrchard } from "./orchard";
import { Rewrite, Rw, Section } from "./parts";
import {
  Act,
  DatePill,
  FilePill,
  PersonPill,
  TaskPill,
  tone,
} from "./pill";
import s from "./edition.module.css";

export function Tile({
  id,
  size = "sm",
}: {
  id: ProjectId;
  size?: "sm" | "lg";
}) {
  const p = projectById(id);
  return (
    <span
      className={size === "lg" ? s.tileLg : s.tile}
      style={tone(p.tone)}
      aria-hidden
    >
      {p.initials}
    </span>
  );
}

/* A project named in the prose is a handle too: it opens that project’s edition. */
export function ProjectLink({
  id,
  children,
}: {
  id: ProjectId;
  children?: ReactNode;
}) {
  const { setScope } = useEdition();
  const p = projectById(id);
  return (
    <button
      type="button"
      className={s.projectLink}
      style={tone(p.tone)}
      onClick={() => setScope(id)}
    >
      <Tile id={id} />
      <span className={s.projectText}>{children ?? p.name}</span>
    </button>
  );
}

/* ── how much each project needs the reader, from live state ── */

export function useNeeds() {
  const { task } = useEdition();
  const o = useOrchard();
  const tickets = task("tickets");
  const consent = task("consent");
  const harvestNeeds = !tickets.handled && tickets.status !== "done";
  const burrenNeeds = !consent.handled && consent.status !== "done";
  const need: Record<ProjectId, number> = {
    harvest: harvestNeeds ? 4 : 0.5,
    orchard: o.openDecisions ? 3 : 0.4,
    burren: burrenNeeds ? 2 : 0.3,
    kestrel: 0.2,
    winter: 0.1,
  };
  return { need, harvestNeeds, burrenNeeds, o };
}

/* Counts the projects that need the reader, the same way the scope menu does. */
export function PortfolioLede() {
  const { need } = useNeeds();
  const needing = [...PROJECTS]
    .filter((p) => need[p.id] >= 1)
    .sort((a, b) => need[b.id] - need[a.id])
    .map((p) => p.id);
  return <Rewrite k={needing.join(" ") || "none"} render={portfolioLine} />;
}

function portfolioLine(k: string): ReactNode {
  if (k === "none")
    return (
      <>
        All five projects are steady.{" "}
        <span className={s.ledeQuiet}>
          The supper club was the one to watch, and Priya is on the poster.
        </span>
      </>
    );
  const needing = k.split(" ") as ProjectId[];
  const steady = PROJECTS.length - needing.length;
  return (
    <>
      {steady === 0
        ? "None of the five projects is steady."
        : `${word(steady)} of five projects ${steady === 1 ? "is" : "are"} steady.`}{" "}
      {needing.map((id, i) => (
        <span key={id}>
          {i > 0 && (i === needing.length - 1 ? " and " : ", ")}
          <ProjectLink id={id}>{projectById(id).short}</ProjectLink>
        </span>
      ))}{" "}
      {needing.length === 1 ? "needs" : "need"} you.
    </>
  );
}

function Dispatch({
  id,
  children,
  margin,
  foot,
}: {
  id: ProjectId;
  children: ReactNode;
  margin: ReactNode;
  foot: string;
}) {
  const { setScope } = useEdition();
  const p = projectById(id);
  return (
    <Section
      id={`d-${id}`}
      label={p.short}
      title={
        <span className={s.dispatchHead}>
          <Tile id={id} size="lg" />
          <span className={s.dispatchName}>
            <span>{p.name}</span>
          </span>
        </span>
      }
      foot={foot}
      margin={margin}
      topic={
        <div className={s.dispatch}>
          {children}
          <button
            type="button"
            className={s.readMore}
            onClick={() => setScope(id)}
          >
            Read the full edition
            <Arrow />
          </button>
        </div>
      }
    />
  );
}

function orchardItems(o: ReturnType<typeof useOrchard>): ReactNode[] {
  const items: ReactNode[] = [];
  if (o.seatingOpen)
    items.push(
      <>
        approving the <FilePill id="seating">seating plan</FilePill> by
        Friday
      </>,
    );
  if (o.tonicOpen)
    items.push(
      <>
        the late <TaskPill id="tonic">tonic order</TaskPill>
      </>,
    );
  if (o.tastingOpen)
    items.push(
      <>
        the <TaskPill id="tasting">menu tasting</TaskPill>, which is stuck on a
        supplier quote
      </>,
    );
  return items;
}

export function PortfolioBody() {
  const { need, harvestNeeds, burrenNeeds, o } = useNeeds();
  const order = [...PROJECTS].sort((a, b) => need[b.id] - need[a.id]);
  const body: Record<ProjectId, ReactNode> = {
    harvest: (
      <Dispatch
        key="harvest"
        id="harvest"
        foot="Seats sold"
        margin={
          <Meter
            value={42}
            total={60}
            caption="Seats sold, 57 days to go"
            tone={harvestNeeds ? "warning" : "success"}
          />
        }
      >
        <p>
          <Rw k={String(harvestNeeds)}>
            Seats are selling slowly: 42 of 60 are gone with eight weeks to go,
            but only three sold last week against eleven the week before.{" "}
            {harvestNeeds ? (
              <>
                <PersonPill id="niamh" /> thinks a poster to the mailing list
                would do it, and the <FilePill id="poster">poster</FilePill> is
                still a draft.{" "}
                <Act task="tickets" primary>
                  Ask Priya to finish it
                </Act>
              </>
            ) : (
              <>
                You asked Priya for the poster, so the next update should show
                the lift.
              </>
            )}
          </Rw>
        </p>
      </Dispatch>
    ),
    orchard: (
      <Dispatch
        key="orchard"
        id="orchard"
        foot="Days to the wedding"
        margin={
          <Countdown iso="2026-10-03" caption="Until Mara & Finn’s wedding" />
        }
      >
        <p>
          <Rw k={`${o.slipped}-${o.openDecisions}`}>
            Mara and Finn are 79 days out.{" "}
            {o.openDecisions ? (
              <>
                {word(o.openDecisions)}{" "}
                {o.openDecisions === 1 ? "thing needs" : "things need"} you:{" "}
                {orchardItems(o).map((item, i, all) => (
                  <span key={i}>
                    {i > 0 && (i === all.length - 1 ? (all.length > 2 ? ", and " : " and ") : ", ")}
                    {item}
                  </span>
                ))}
                .
              </>
            ) : (
              <>You have dealt with everything that needed you this morning.</>
            )}
          </Rw>
        </p>
      </Dispatch>
    ),
    burren: (
      <Dispatch
        key="burren"
        id="burren"
        foot="Consent forms"
        margin={
          <Meter
            value={22}
            total={28}
            caption="Consent forms back"
            tone="accent"
          />
        }
      >
        <p>
          <Rw k={String(burrenNeeds)}>
            <PersonPill id="siobhan" /> has 22 of 28 consent forms back for the
            trip on <DatePill iso="2026-09-17">17 September</DatePill>.{" "}
            {burrenNeeds ? (
              <>
                The six missing are all from one class, and a reminder before
                term starts usually brings them in, so{" "}
                <Act task="consent">ask Siobhán to remind them</Act>.
              </>
            ) : (
              <>The six families have been reminded.</>
            )}
          </Rw>
        </p>
      </Dispatch>
    ),
    kestrel: (
      <Dispatch
        key="kestrel"
        id="kestrel"
        foot="Milestones"
        margin={
          <Meter value={3} total={5} caption="Milestones done" tone="success" />
        }
      >
        <p>
          Three of five milestones are done and nothing is late.{" "}
          <PersonPill id="priya" /> shows the client three logo routes at the{" "}
          <TaskPill id="logo">logo review</TaskPill> on{" "}
          <DatePill iso="2026-07-24">24 July</DatePill>.
        </p>
      </Dispatch>
    ),
    winter: (
      <Dispatch
        key="winter"
        id="winter"
        foot="Early"
        margin={
          <Note caption="Too early to chart">
            <span className={s.noteBig}>2 tasks</span>
          </Note>
        }
      >
        <p>
          Two tasks so far, both still being shaped:{" "}
          <TaskPill id="wintermenu" /> and <TaskPill id="winterdates" />. There
          is not enough here to report on yet.
        </p>
      </Dispatch>
    ),
  };
  return <>{order.map((p) => body[p.id])}</>;
}

/* ── single-project editions for the other four ───────────── */

export function ProjectLede({ id }: { id: Exclude<ProjectId, "orchard"> }) {
  const { harvestNeeds, burrenNeeds } = useNeeds();
  if (id === "harvest")
    return (
      <>
        The supper club is eight weeks out and selling slowly.{" "}
        <Rewrite
          k={harvestNeeds ? "open" : "asked"}
          render={(k) => (
            <span className={s.ledeQuiet}>
              {k === "open"
                ? "42 of 60 seats are gone, but only three sold last week."
                : "Priya is making the poster that should lift the last 18."}
            </span>
          )}
        />
      </>
    );
  if (id === "burren")
    return (
      <>
        The Burren trip is on track,{" "}
        <Rewrite
          k={burrenNeeds ? "open" : "asked"}
          render={(k) =>
            k === "open"
              ? "with one loose end: six consent forms are still out."
              : "and the last forms are being chased."
          }
        />
      </>
    );
  if (id === "kestrel")
    return (
      <>
        Nothing slipped. Nothing needs you.{" "}
        <span className={s.ledeQuiet}>
          The next date that matters is the{" "}
          <TaskPill id="logo">logo review</TaskPill> on{" "}
          <DatePill iso="2026-07-24">24 July</DatePill>.
        </span>
      </>
    );
  return (
    <>
      The winter season launch is two tasks old.{" "}
      <span className={s.ledeQuiet}>
        There is not enough here to report on yet, and that is fine.
      </span>
    </>
  );
}

export function ProjectBody({ id }: { id: Exclude<ProjectId, "orchard"> }) {
  const { task } = useEdition();
  const { harvestNeeds, burrenNeeds } = useNeeds();
  if (id === "harvest") {
    return (
      <>
        <Section
          id="h-needs"
          title="What needs you"
          foot="Seats sold"
          margin={
            <Meter
              value={42}
              total={60}
              caption="Seats sold"
              tone={harvestNeeds ? "warning" : "success"}
            />
          }
          topic={
            harvestNeeds ? (
              <div className={s.decision}>
                <p>
                  <Rw k="h1">
                    <TaskPill id="tickets">The last 18 seats</TaskPill> need a
                    push. A poster to the mailing list sold out the spring
                    supper in four days.{" "}
                    <Act task="tickets" primary>
                      Ask Priya for a poster
                    </Act>{" "}
                    or{" "}
                    <Act task="tickets" index={1}>
                      give the sale until 12 September
                    </Act>
                    .
                  </Rw>
                </p>
              </div>
            ) : (
              <div className={`${s.decision} ${s.decisionDone}`}>
                <Check className={s.doneTick} />
                <p>
                  <Rw k="h2">
                    You asked Priya for a poster. She usually turns these round
                    in two days.
                  </Rw>
                </p>
              </div>
            )
          }
        />
        <Section
          id="h-coming"
          title="Coming up"
          foot="Countdown"
          margin={
            <Countdown iso="2026-09-12" caption="Until the supper club" />
          }
          topic={
            <p>
              <PersonPill id="niamh" /> finishes{" "}
              <TaskPill id="harvestmenu" /> by <DatePill iso="2026-08-14">14 August</DatePill>, and the club
              itself is on{" "}
              <DatePill iso="2026-09-12">Saturday 12 September</DatePill>.
            </p>
          }
        />
      </>
    );
  }
  if (id === "burren") {
    return (
      <>
        <Section
          id="b-needs"
          title="What needs you"
          foot="Consent forms"
          margin={
            <Meter
              value={22}
              total={28}
              caption="Consent forms back"
              tone="accent"
            />
          }
          topic={
            burrenNeeds ? (
              <div className={s.decision}>
                <p>
                  <Rw k="b1">
                    Six families have not returned{" "}
                    <TaskPill id="consent">their consent forms</TaskPill>.
                    They are all from one class, so{" "}
                    <PersonPill id="siobhan" /> can send one reminder to all
                    six.{" "}
                    <Act task="consent" primary>
                      Ask her to send it
                    </Act>
                  </Rw>
                </p>
              </div>
            ) : (
              <div className={`${s.decision} ${s.decisionDone}`}>
                <Check className={s.doneTick} />
                <p>
                  <Rw k="b2">You asked Siobhán to remind the six families.</Rw>
                </p>
              </div>
            )
          }
        />
        <Section
          id="b-coming"
          title="Coming up"
          foot="Countdown"
          margin={<Countdown iso="2026-09-17" caption="Until the trip" />}
          topic={
            <p>
              Booking <TaskPill id="bus" /> is due by{" "}
              <DatePill iso="2026-07-31">31 July</DatePill>, with two quotes in.
              The trip itself is on{" "}
              <DatePill iso="2026-09-17">Thursday 17 September</DatePill>.
            </p>
          }
        />
      </>
    );
  }
  if (id === "kestrel") {
    return (
      <Section
        id="k-calm"
        tone="calm"
        title="That is the whole edition"
        foot="Milestones"
        margin={
          <Meter value={3} total={5} caption="Milestones done" tone="success" />
        }
        topic={
          <p>
            Three of five milestones are done. <PersonPill id="priya" /> has
            three logo routes ready, and choosing <TaskPill id="type" /> follows
            a week after the review.
          </p>
        }
      />
    );
  }
  const winterDates = task("winterdates");
  return (
    <>
      <Section
        id="w-now"
        title="What is here so far"
        topic={
          <p>
            <Rw k={winterDates.due ?? "none"}>
              <PersonPill id="niamh" /> has <TaskPill id="wintermenu" /> to
              sketch by <DatePill iso="2026-09-18">18 September</DatePill>, and{" "}
              <TaskPill id="winterdates" /> is yours
              {winterDates.due ? (
                <>
                  , for <DatePill iso={winterDates.due}>24 July</DatePill>.
                </>
              ) : (
                <>
                  , with no date yet.{" "}
                  <Act task="winterdates" index={1} primary>
                    Set it for 24 July
                  </Act>
                </>
              )}
            </Rw>
          </p>
        }
      />
      <Section
        id="w-later"
        title="What this page will tell you"
        topic={
          <p>
            Once there are a few more tasks and a first date, this edition will
            be written for you each morning. Most projects get there within a
            week.
          </p>
        }
        more={
          <ol className={s.ghostList}>
            {[
              ["What needs you", "the decisions only you can make"],
              [
                "What slipped and why",
                "anything late or stuck, and what it is waiting on",
              ],
              ["Coming up", "the next two weeks, in order"],
              ["Finished", "what got done, and whether the pace is holding"],
              ["Who is on what", "who is stretched and who has room"],
            ].map(([h, d]) => (
              <li key={h} className={s.ghostItem}>
                <span className={s.ghostHead}>{h}</span>
                <span className={s.ghostDesc}>{d}</span>
              </li>
            ))}
          </ol>
        }
      />
    </>
  );
}
