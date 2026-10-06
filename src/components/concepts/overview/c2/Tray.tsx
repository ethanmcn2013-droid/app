"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useDemoLinks } from "../../demo/links";
import { type Item, fullDay, mondayOf, personColor, personName, projectColor, relative, short, withDay } from "./data";
import { itemColor, ownerBreakdown, plural } from "./model";
import { Avatar, cx, dueText, FlagGlyph, Icon, laneName, StatusChip } from "./parts";
import type { River } from "./useRiver";
import s from "./river.module.css";

type View = {
  label: string;
  eyebrow: string;
  danger?: boolean;
  title: string;
  line: string;
  owners: Item[];
  cards: ReactNode[];
  empty: string;
  /** Week arrows: the tray's one pager. */
  nav: boolean;
  /** A way back to the week, for the late list. */
  back?: boolean;
};

export function Tray({
  river: r,
  sheet = false,
  collapsed = false,
  rows = 1,
  onToggle,
}: {
  river: River;
  sheet?: boolean;
  /** Desktop only: two rows of cards when the screen is tall enough to spare them. */
  rows?: 1 | 2;
  /** Desktop only: fold the tray to a one-line summary so the river gets the height. */
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  if (r.selected && r.forecast === null && r.asOf >= 0) return <Detail item={r.selected} r={r} sheet={sheet} />;
  return <TrayView r={r} sheet={sheet} collapsed={collapsed} rows={rows} onToggle={onToggle} />;
}

function TrayView({ r, sheet, collapsed, rows, onToggle }: { r: River; sheet: boolean; collapsed: boolean; rows: 1 | 2; onToggle?: () => void }) {
  const v = view(r);
  // A new week (or mode) starts its cards from the first one.
  const stripKey = v.nav ? `week:${r.focusWeek}` : v.label;
  const [stripRef, atEnd] = useStripEnd(v.cards.length, stripKey);
  // A tall screen shows the week after as a second row, so the spare height carries the next step.
  const ahead = rows === 2 && v.nav && !sheet ? view(r, r.focusWeek + 7) : null;
  const toggle = onToggle ? (
    <button
      type="button"
      className={cx(s.trayToggle, !collapsed && s.trayToggleCorner)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Show details" : "Hide details"}
      title={collapsed ? "Show details" : "Hide details"}
      onClick={onToggle}
    >
      <Icon name={collapsed ? "chevron-up" : "chevron-down"} size={14} />
    </button>
  ) : null;
  const nav = v.nav ? (
    <div className={s.trayNav}>
      <span className={s.navGroup}>
        <button type="button" className={s.iconBtn} aria-label="Previous week" title="Previous week (←)" onClick={() => r.setFocusWeek(r.focusWeek - 7)}>
          <Icon name="chevron-left" size={14} />
        </button>
        <button type="button" className={s.iconBtn} aria-label="Next week" title="Next week (→)" onClick={() => r.setFocusWeek(r.focusWeek + 7)}>
          <Icon name="chevron-right" size={14} />
        </button>
        {!collapsed && r.focusWeek !== mondayOf(0) ? (
          <button type="button" className={s.linkBtn} onClick={() => r.setFocusWeek(mondayOf(0))}>
            This week
          </button>
        ) : null}
      </span>
    </div>
  ) : v.back ? (
    <div className={s.trayNav}>
      <button type="button" className={s.backBtn} onClick={() => r.setLateOpen(false)}>
        <Icon name="chevron-left" size={14} />
        Back to the week
      </button>
    </div>
  ) : null;

  if (collapsed) {
    return (
      <section id="rv-tray" className={cx(s.tray, s.trayCollapsed)} aria-label={v.label}>
        {toggle}
        <span className={cx(s.trayEyebrow, v.danger && s.trayEyebrowDanger)}>{v.eyebrow}</span>
        <h2 className={s.trayTitleInline}>{v.title}</h2>
        <p className={s.trayLineInline}>{v.line}</p>
        {nav}
      </section>
    );
  }

  return (
    <section id="rv-tray" className={cx(s.tray, sheet && s.traySheet, rows === 2 && !sheet && s.trayTall)} aria-label={v.label}>
      <div className={s.trayLead}>
        {toggle}
        <span className={cx(s.trayEyebrow, v.danger && s.trayEyebrowDanger)}>{v.eyebrow}</span>
        <h2 className={s.trayTitle}>{v.title}</h2>
        <p className={s.trayLine}>{v.line}</p>
        <Owners items={v.owners} />
        {nav}
      </div>
      <div className={s.stripStack}>
        <div className={s.strip}>
          {v.cards.length ? (
            <div
              key={stripKey}
              className={cx(s.trayCards, rows === 2 && !ahead && v.cards.length > 3 && s.trayCardsTwo, atEnd && s.trayCardsEnd)}
              ref={stripRef}
            >
              {v.cards}
            </div>
          ) : (
            <div className={s.trayEmpty}>{v.empty}</div>
          )}
        </div>
        {ahead ? (
          <div className={s.aheadRow}>
            <button type="button" className={s.aheadHead} onClick={() => r.setFocusWeek(r.focusWeek + 7)}>
              <span className={s.aheadTitle}>Then, {ahead.title.charAt(0).toLowerCase() + ahead.title.slice(1)}</span>
              <span className={s.aheadLine}>{ahead.line.replace(/\.$/, "")}</span>
              <Icon name="arrow-right" size={13} />
            </button>
            <div className={s.strip}>
              {ahead.cards.length ? (
                <div className={cx(s.trayCards, s.trayCardsAhead)}>{ahead.cards}</div>
              ) : (
                <div className={s.trayEmpty}>{ahead.empty}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function view(r: River, week = r.focusWeek): View {
  if (r.forecast !== null) {
    const list = r.forecastLate.slice().sort((a, b) => a.due! - b.due!);
    return {
      label: "Looking ahead",
      eyebrow: "Looking ahead, at the recent pace",
      danger: list.length > 0,
      title: fullDay(r.forecast),
      line: list.length ? `${plural(list.length, "task")} late by then. Let go to come back to today.` : "Nothing late by then. Let go to come back to today.",
      owners: list,
      cards: list.map((it) => {
        const lands = it.due! >= 0 && it.eta && it.eta > it.due! ? `lands ${short(it.eta)}` : undefined;
        return <Card key={it.id} it={it} r={r} when={`Due ${short(it.due!)}`} flag={lands} tone="danger" />;
      }),
      empty: "Nothing slips by then. Keep going to find the first late task.",
      nav: false,
    };
  }

  if (r.asOf < 0) {
    const list = r.replayDone.slice().sort((a, b) => a.doneOn! - b.doneOn!);
    return {
      label: "Looking back",
      eyebrow: "Looking back",
      title: fullDay(r.asOf),
      line: list.length ? `${plural(list.length, "task")} still open then ${list.length === 1 ? "has" : "have"} been done since.` : "Nothing has been done since then.",
      owners: [],
      cards: list.map((it) => <Card key={it.id} it={it} r={r} when={`Done ${withDay(it.doneOn!)}`} tone="done" />),
      empty: "Go further back to see more work still open.",
      nav: false,
    };
  }

  if (r.lateOpen && r.lateNow.length) {
    const list = r.lateNow;
    return {
      label: "Late",
      eyebrow: "Late",
      danger: true,
      title: `${list.length} late`,
      line: `Due before today and not done, most overdue first.`,
      owners: list,
      cards: list.map((it) => <Card key={it.id} it={it} r={r} when={`Due ${withDay(it.due!)}`} tone="danger" />),
      empty: "Nothing is late.",
      nav: false,
      back: true,
    };
  }

  const wk = r.weekSummary(week);
  const due = [...wk.due].sort((a, b) => a.due! - b.due!);
  const marks = r.marks.filter((m) => m.due !== undefined && m.due >= week && m.due < week + 7).sort((a, b) => a.due! - b.due!);
  const cards: ReactNode[] = [
    ...marks.map((m) => (
      <div key={m.id} className={cx(s.card, s.cardMark, m.terminal && s.cardDest)}>
        <div className={s.cardTop}>
          <span className={s.cardFlagMark} style={{ color: projectColor(m.project) }}>
            <FlagGlyph size={11} />
          </span>
          <span className={s.cardLane}>{m.terminal ? "The day itself" : "Big date"}</span>
          {m.status === "done" ? <span className={cx(s.chip, s.chipDone)}>Done</span> : null}
        </div>
        <div className={s.cardTitle}>{m.title}</div>
        <div className={s.cardFoot}>
          <span className={s.cardWhen}>
            {withDay(m.due!)}, {relative(m.due!, r.asOf)}
          </span>
        </div>
      </div>
    )),
    ...due.map((it) => <Card key={it.id} it={it} r={r} when={`${withDay(it.due!)}, ${relative(it.due!, r.asOf)}`} />),
    ...wk.done.map((it) => <Card key={it.id} it={it} r={r} when={`Done ${withDay(it.doneOn!)}`} tone="done" />),
  ];
  return {
    label: wk.label,
    eyebrow: `${short(week)} to ${short(week + 6)}`,
    title: wk.label,
    line: wk.line,
    owners: wk.due,
    cards,
    empty: r.undated.length ? "Nothing dated this week. Work with no date yet waits at the left of the river." : "A quiet week. Nothing is due.",
    nav: true,
  };
}

/** Whether the strip of cards has been scrolled to its end, for the fade at its edge. */
function useStripEnd(count: number, key: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [end, setEnd] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [count, key]);
  return [ref, end] as const;
}

function Owners({ items }: { items: Item[] }) {
  const rows = ownerBreakdown(items);
  if (!rows.length) return null;
  const total = items.length;
  return (
    <div className={s.owners}>
      <div className={s.ownerBar} aria-hidden="true">
        {rows.map((o) => (
          <span key={o.person} className={s.ownerSeg} style={{ flexGrow: o.count / total, background: personColor(o.person) }} />
        ))}
      </div>
      <div className={s.ownerList}>
        {rows.slice(0, rows.length > 3 ? 2 : 3).map((o) => (
          <span key={o.person} className={s.ownerItem}>
            <Avatar person={o.person} size={16} />
            {personName(o.person)} <b>{o.count}</b>
          </span>
        ))}
        {rows.length > 3 ? (
          <span
            className={s.ownerMore}
            title={rows
              .slice(2)
              .map((o) => `${personName(o.person)} ${o.count}`)
              .join(", ")}
          >
            {rows.slice(2, 5).map((o) => (
              <Avatar key={o.person} person={o.person} size={16} />
            ))}
            <span className={s.ownerMoreCount}>+{rows.length - 2}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Card({
  it,
  r,
  when,
  flag,
  tone,
}: {
  it: Item;
  r: River;
  when: string;
  /** A short second token, such as "lands 17 Jul". */
  flag?: string;
  tone?: "danger" | "done";
}) {
  const project = r.projects.find((p) => p.id === it.project);
  const aside = it.waitingOn && it.status !== "done" ? `Waiting on ${it.waitingOn}.` : it.note;
  return (
    <button
      type="button"
      className={cx(s.card, tone === "danger" && s.cardDanger, tone === "done" && s.cardSuccess)}
      onClick={() => r.setSelectedId(it.id)}
    >
      <div className={s.cardTop}>
        <span className={s.laneSwatchSm} style={{ background: itemColor(it, r.allProjects) }} />
        <span className={s.cardLane}>{r.allProjects ? project?.short : laneName(it)}</span>
        <StatusChip item={it} asOf={r.asOf} />
      </div>
      <div className={s.cardTitle}>{it.title}</div>
      {aside ? <span className={s.cardNote}>{aside}</span> : null}
      <div className={s.cardFoot}>
        <Avatar person={it.owner} size={16} />
        {!flag ? <span className={s.cardOwner}>{personName(it.owner)}</span> : null}
        <span className={s.cardWhen}>{when}</span>
        {flag ? <span className={cx(s.chip, s.chipLate)}>{flag}</span> : null}
      </div>
    </button>
  );
}

function Detail({ item, r, sheet }: { item: Item; r: River; sheet: boolean }) {
  const links = useDemoLinks();
  const done = item.status === "done";
  const project = r.projects.find((p) => p.id === item.project);
  const isTask = item.kind === "task";
  return (
    <section id="rv-tray" className={cx(s.tray, sheet && s.traySheet, s.trayDetail)} aria-label={isTask ? "Selected task" : "Selected milestone"}>
      <div className={s.trayLead}>
        <button type="button" className={s.backBtn} onClick={() => r.setSelectedId(null)}>
          <Icon name="chevron-left" size={14} />
          Back to the week
        </button>
        <h2 className={s.trayTitle}>{item.title}</h2>
        <div className={s.detailMeta}>
          <span className={s.laneSwatchSm} style={{ background: itemColor(item, r.allProjects) }} />
          {isTask && !r.allProjects ? laneName(item) : project?.short}
          {isTask ? (
            <>
              <span className={s.dotSep} aria-hidden="true" />
              <Avatar person={item.owner} size={16} />
              {personName(item.owner)}
            </>
          ) : null}
          <span className={s.dotSep} aria-hidden="true" />
          <StatusChip item={item} asOf={r.asOf} />
        </div>
        <p className={s.trayLine}>
          {done ? `Done ${fullDay(item.doneOn!)}.` : item.kind === "milestone" || item.due === undefined ? `${item.due === undefined ? "No date yet" : fullDay(item.due)}.` : `${dueText(item)}.`}
          {!done && item.eta && item.due !== undefined && item.eta > item.due && item.due >= 0 ? ` At the recent pace it lands ${short(item.eta)}.` : ""}
          {!done && item.slip ? ` Moved from ${short(item.slip.from)} on ${withDay(item.slip.on)}.` : ""}
        </p>
      </div>
      <div className={s.detailBody}>
        {isTask ? (
          <div className={s.detailCol}>
            <span className={s.detailLabel}>Notes</span>
            <p className={s.detailNote}>{item.note ?? "No notes yet."}</p>
          </div>
        ) : (
          <MilestoneWork item={item} r={r} />
        )}
        <div className={s.detailCol}>
          {isTask ? (
            <>
              <span className={s.detailLabel}>Waiting on</span>
              <p className={s.detailNote}>{item.waitingOn && !done ? item.waitingOn : "Nobody."}</p>
              <span className={s.detailLabel}>With</span>
              <p className={s.detailNote}>{item.helpers?.length ? item.helpers.map(personName).join(", ") : "Nobody else."}</p>
            </>
          ) : null}
          {project ? (
            <>
              <span className={s.detailLabel}>Project</span>
              <Link href={links.project(project.id)} className={s.detailLink} prefetch={false}>
                {project.name}
              </Link>
            </>
          ) : null}
        </div>
        <div className={s.detailActions}>
          {isTask ? (
            <Link href={links.task(item.id)} className={s.btnGhost} prefetch={false}>
              Open in Tasks
              <Icon name="arrow-right" size={14} />
            </Link>
          ) : null}
          {isTask && !done && !r.allProjects && item.due !== undefined ? (
            <>
              <button type="button" className={s.btnGhost} onClick={() => r.moveItem(item.id, 7)}>
                <Icon name="calendar" size={14} />
                A week later
              </button>
              <button type="button" className={s.btnPrimary} onClick={() => r.markDone(item.id)}>
                <Icon name="check" size={14} />
                Mark done
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** A milestone's detail: the open work due by its day, so the flag says what it waits on. */
function MilestoneWork({ item, r }: { item: Item; r: River }) {
  const links = useDemoLinks();
  const day = item.due ?? 0;
  const open = r.scopedNow
    .filter((it) => it.project === item.project && it.kind === "task" && it.status !== "done" && it.due !== undefined && it.due <= day)
    .sort((a, b) => a.due! - b.due!);
  return (
    <div className={s.detailCol}>
      <span className={s.detailLabel}>Open work due by then</span>
      {open.length ? (
        <ul className={s.detailList}>
          {open.slice(0, 4).map((it) => (
            <li key={it.id}>
              <Link href={links.task(it.id)} className={s.detailLink} prefetch={false}>
                {it.title}
              </Link>
              <span className={s.detailWhen}>, {short(it.due!)}</span>
            </li>
          ))}
          {open.length > 4 ? <li className={s.detailWhen}>and {plural(open.length - 4, "more task")}</li> : null}
        </ul>
      ) : (
        <p className={s.detailNote}>{item.status === "done" ? "Nothing. It is done." : "Nothing open is due by then."}</p>
      )}
    </div>
  );
}
