"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Item, PERSON, PROJECTS, fullDay, mondayOf, relative, short, withDay } from "./data";
import { ownerBreakdown, plural, WS_COLOR } from "./model";
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
  nav: boolean;
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

function TrayView({
  r,
  sheet,
  collapsed,
  rows,
  onToggle,
}: {
  r: River;
  sheet: boolean;
  collapsed: boolean;
  rows: 1 | 2;
  onToggle?: () => void;
}) {
  const v = view(r);
  // A new week (or mode) starts its cards from the first one.
  const stripKey = v.nav ? `week:${r.focusWeek}` : v.label;
  const [stripRef, strip] = useStrip(v.cards.length, stripKey);
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
  const weekNav = v.nav ? (
    <span className={s.navGroup}>
      <button type="button" className={s.iconBtn} aria-label="Previous week" title="Previous week (←)" onClick={() => r.setFocusWeek(r.focusWeek - 7)}>
        <Icon name="chevron-left" size={14} />
      </button>
      <button type="button" className={s.iconBtn} aria-label="Next week" title="Next week (→)" onClick={() => r.setFocusWeek(r.focusWeek + 7)}>
        <Icon name="chevron-right" size={14} />
      </button>
      {!collapsed && !strip.more ? <span className={s.trayKeys}>Press ← or → to change week</span> : null}
    </span>
  ) : null;
  // The card pager lives here, beside the week arrows, never on top of a card.
  const pager =
    !collapsed && strip.more ? (
      <span className={s.pager}>
        <span className={s.pagerText}>
          {strip.first + 1}
          {strip.last > strip.first + 1 ? `–${strip.last}` : ""} of {v.cards.length}
        </span>
        <button type="button" className={s.pagerBtn} aria-label="Earlier cards" disabled={strip.first === 0} onClick={() => strip.page(-1)}>
          <Icon name="chevron-left" size={13} />
        </button>
        <button type="button" className={s.pagerBtn} aria-label="More cards" disabled={strip.last >= v.cards.length} onClick={() => strip.page(1)}>
          <Icon name="chevron-right" size={13} />
        </button>
      </span>
    ) : null;
  const nav = weekNav || pager ? (
    <div className={s.trayNav}>
      {weekNav}
      {pager}
    </div>
  ) : null;

  if (collapsed) {
    return (
      <section className={cx(s.tray, s.trayCollapsed)} aria-label={v.label}>
        {toggle}
        <span className={cx(s.trayEyebrow, v.danger && s.trayEyebrowDanger)}>{v.eyebrow}</span>
        <h2 className={s.trayTitleInline}>{v.title}</h2>
        <p className={s.trayLineInline}>{v.line}</p>
        {nav}
      </section>
    );
  }

  return (
    <section className={cx(s.tray, sheet && s.traySheet, rows === 2 && !sheet && s.trayTall)} aria-label={v.label}>
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
              className={cx(s.trayCards, rows === 2 && !ahead && v.cards.length > 3 && s.trayCardsTwo, strip.end && s.trayCardsEnd)}
              ref={stripRef}
            >
              {v.cards}
            </div>
          ) : (
            <EmptyCards text={v.empty} />
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
                <EmptyCards text={ahead.empty} />
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
      label: "Forecast detail",
      eyebrow: "Forecast at the current pace",
      danger: true,
      title: fullDay(r.forecast),
      line: list.length ? `${plural(list.length, "thing")} late by then. Let go to spring back.` : "Nothing late by then. Let go to spring back.",
      owners: list,
      cards: list.map((it) => {
        const lands = it.due! >= 0 && it.eta && it.eta > it.due! ? `lands ${short(it.eta)}` : undefined;
        return <Card key={it.id} it={it} r={r} when={`Due ${short(it.due!)}`} flag={lands} tone="danger" />;
      }),
      empty: "Clear water. Keep going to find the first slip.",
      nav: false,
    };
  }

  if (r.asOf < 0) {
    const list = r.replaySettled.slice().sort((a, b) => a.doneOn! - b.doneOn!);
    return {
      label: "Replay detail",
      eyebrow: "Replay",
      title: fullDay(r.asOf),
      line: list.length
        ? `${plural(list.length, "thing")} still open then ${list.length === 1 ? "has" : "have"} settled since.`
        : "Nothing has settled since then.",
      owners: [],
      cards: list.map((it) => <Card key={it.id} it={it} r={r} when={`Settled ${withDay(it.doneOn!)}`} tone="success" />),
      empty: "Go further back to see work come unsettled.",
      nav: false,
    };
  }

  const wk = r.weekSummary(week);
  const due = [...wk.due].sort((a, b) => a.due! - b.due!);
  const milestones = r.scoped.filter(
    (it) => it.terminal && it.due !== undefined && it.due >= week && it.due < week + 7,
  );
  const clashes = r.clashes.filter((c) => mondayOf(c.day) === week || mondayOf(c.day + 2) === week);
  const cards: ReactNode[] = [
    ...clashes.map((c) => (
      <div key={`c${c.day}`} className={cx(s.card, s.cardClash)}>
        <div className={s.cardTop}>
          <span aria-hidden="true">⚑</span>
          <span className={s.cardLane}>Clash across projects</span>
        </div>
        <div className={s.cardTitle}>{c.sentence}</div>
        <div className={s.cardFoot}>
          {c.people.map((p) => (
            <Avatar key={p} person={p} size={16} />
          ))}
          <span className={s.cardWhen}>{c.items.map((m) => PROJECTS[m.project].short).join(" · ")}</span>
        </div>
      </div>
    )),
    ...milestones.map((m) => (
      <div key={m.id} className={cx(s.card, s.cardDest)}>
        <div className={s.cardTop}>
          <FlagGlyph size={11} />
          <span className={s.cardLane}>Destination</span>
        </div>
        <div className={s.cardTitle}>{m.title}</div>
        <div className={s.cardFoot}>
          <span className={s.cardWhen}>{withDay(m.due!)}</span>
        </div>
      </div>
    )),
    ...due.map((it) => <Card key={it.id} it={it} r={r} when={`${withDay(it.due!)}, ${relative(it.due!, r.asOf)}`} />),
    ...wk.settled.map((it) => <Card key={it.id} it={it} r={r} when={`Settled ${withDay(it.doneOn!)}`} tone="success" />),
  ];
  return {
    label: "Week in focus",
    eyebrow: "Week in focus",
    title: wk.label,
    line: wk.line.replace(`${wk.label}: `, "").replace(/^./, (c) => c.toUpperCase()),
    owners: wk.due,
    cards,
    empty: r.undated.length ? "Nothing dated this week. Undated work waits on the left." : "A quiet week. Nothing is due.",
    nav: true,
  };
}

/** A strip of cards that always shows whole cards, paged from the tray's lead column. */
function useStrip(count: number, key: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState({ first: 0, last: count, end: true });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      const left = el.scrollLeft;
      const right = left + el.clientWidth;
      let first = -1;
      let last = 0;
      kids.forEach((k, i) => {
        if (k.offsetLeft >= left - 2 && k.offsetLeft + k.offsetWidth <= right + 2) {
          if (first < 0) first = i;
          last = i + 1;
        }
      });
      setSeen({ first: Math.max(0, first), last, end: right >= el.scrollWidth - 4 });
    };
    // The observer reports once on attach, which takes the first measure.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [count, key]);
  // Page by whole cards: the next page starts exactly where a card starts.
  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const perPage = Math.max(1, seen.last - seen.first);
    const target = Math.min(kids.length - 1, Math.max(0, seen.first + dir * perPage));
    const pad = kids[0]?.offsetLeft ?? 0;
    el.scrollTo({ left: Math.max(0, (kids[target]?.offsetLeft ?? 0) - pad), behavior: "smooth" });
  };
  const more = count > 1 && (seen.first > 0 || seen.last < count);
  return [ref, { ...seen, more, page }] as const;
}

function Owners({ items }: { items: Item[] }) {
  const rows = ownerBreakdown(items);
  if (!rows.length) return null;
  const total = items.length;
  return (
    <div className={s.owners}>
      <div className={s.ownerBar} aria-hidden="true">
        {rows.map((o) => (
          <span
            key={o.person}
            className={s.ownerSeg}
            style={{ flexGrow: o.count / total, background: `var(--rv-person-${o.person})` }}
            title={PERSON[o.person].name}
          />
        ))}
      </div>
      <div className={s.ownerList}>
        {rows.slice(0, rows.length > 3 ? 2 : 3).map((o) => (
          <span key={o.person} className={s.ownerItem}>
            <Avatar person={o.person} size={16} />
            {PERSON[o.person].name} <b>{o.count}</b>
          </span>
        ))}
        {rows.length > 3 ? (
          <span
            className={s.ownerMore}
            title={rows
              .slice(2)
              .map((o) => `${PERSON[o.person].name} ${o.count}`)
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
  tone?: "danger" | "success";
}) {
  const deps = it.status === "done" ? [] : r.downstreamOf(it.id);
  const aside = deps.length
    ? `Holds up ${deps
        .slice(0, 2)
        .map((d) => d.title.charAt(0).toLowerCase() + d.title.slice(1))
        .join(" and ")}${deps.length > 2 ? ` and ${deps.length - 2} more` : ""}.`
    : it.note;
  return (
    <button
      type="button"
      className={cx(s.card, tone === "danger" && s.cardDanger, tone === "success" && s.cardSuccess)}
      onClick={() => r.setSelectedId(it.id)}
    >
      <div className={s.cardTop}>
        <span className={s.laneSwatchSm} style={{ background: WS_COLOR(it.lane) }} />
        <span className={s.cardLane}>{r.scope === "all" ? PROJECTS[it.project].short : laneName(it)}</span>
        <StatusChip item={it} asOf={r.asOf} />
      </div>
      <div className={s.cardTitle}>
        {it.kind === "milestone" ? (
          <span className={s.cardFlag}>
            <FlagGlyph size={10} />
          </span>
        ) : null}
        {it.title}
      </div>
      {aside ? <span className={s.cardNote}>{aside}</span> : null}
      <div className={s.cardFoot}>
        <Avatar person={it.owner} size={16} />
        {!flag ? <span className={s.cardOwner}>{PERSON[it.owner].name}</span> : null}
        <span className={s.cardWhen}>{when}</span>
        {flag ? <span className={cx(s.chip, s.chipLate)}>{flag}</span> : null}
      </div>
    </button>
  );
}

function EmptyCards({ text }: { text: string }) {
  return <div className={s.trayEmpty}>{text}</div>;
}

function Detail({ item, r, sheet }: { item: Item; r: River; sheet: boolean }) {
  const deps = r.downstreamOf(item.id);
  const waitsOn = (item.after ?? []).map((id) => r.items.find((x) => x.id === id)).filter(Boolean) as Item[];
  const done = item.status === "done";
  return (
    <section className={cx(s.tray, sheet && s.traySheet, s.trayDetail)} aria-label="Selected item">
      <div className={s.trayLead}>
        <button type="button" className={s.backBtn} onClick={() => r.setSelectedId(null)}>
          <Icon name="chevron-left" size={14} />
          Back to the week
        </button>
        <h2 className={s.trayTitle}>{item.title}</h2>
        <div className={s.detailMeta}>
          <span className={s.laneSwatchSm} style={{ background: WS_COLOR(item.lane) }} />
          {laneName(item)}
          <span className={s.dotSep} aria-hidden="true" />
          <Avatar person={item.owner} size={16} />
          {PERSON[item.owner].name}
          <span className={s.dotSep} aria-hidden="true" />
          <StatusChip item={item} asOf={r.asOf} />
        </div>
        <p className={s.trayLine}>
          {done ? `Settled ${fullDay(item.doneOn!)}.` : item.kind === "milestone" ? `${fullDay(item.due!)}.` : `${dueText(item)}.`}
          {!done && item.eta && item.eta > item.due! ? ` At this pace it lands ${short(item.eta)}.` : ""}
        </p>
      </div>
      <div className={s.detailBody}>
        <div className={s.detailCol}>
          <span className={s.detailLabel}>Notes</span>
          <p className={s.detailNote}>{item.note ?? "No notes yet."}</p>
        </div>
        <div className={s.detailCol}>
          <span className={s.detailLabel}>Waits on</span>
          {waitsOn.length ? (
            <ul className={s.depList}>
              {waitsOn.map((d) => (
                <li key={d.id}>
                  <button type="button" className={s.depItem} onClick={() => r.setSelectedId(d.id)}>
                    {d.title}
                    <span className={s.depWhen}>{d.status === "done" ? "Done" : short(d.due!)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.detailNote}>{item.status === "todo" ? "Nothing. It can start any time." : "Nothing."}</p>
          )}
          <span className={s.detailLabel}>Holds up</span>
          {deps.length ? (
            <ul className={s.depList}>
              {deps.map((d) => (
                <li key={d.id}>
                  <button type="button" className={s.depItem} onClick={() => r.setSelectedId(d.id)}>
                    {d.title}
                    <span className={s.depWhen}>{d.due !== undefined ? short(d.due) : "No date"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.detailNote}>Nothing waits on it.</p>
          )}
        </div>
        {!done && r.lens !== "projects" && item.due !== undefined ? (
          <div className={s.detailActions}>
            <button type="button" className={s.btnGhost} onClick={() => r.moveItem(item.id, 7)}>
              <Icon name="arrow-right" size={14} />
              A week later{deps.length ? `, with ${plural(deps.length, "follower")}` : ""}
            </button>
            {!item.terminal ? (
              <button type="button" className={s.btnPrimary} onClick={() => r.markDone(item.id)}>
                <Icon name="check" size={14} />
                Mark done
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
