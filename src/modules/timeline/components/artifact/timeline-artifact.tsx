"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { AudienceTimelineDto } from "../../lib/audience-timeline";
import { PRODUCT_MARKETING_URLS } from "@/lib/product-urls";
import { buildMaster3Model, type Master3Milestone, type Master3Model } from "./master3-model";
import { CalendarAction, Icon, OwnerMenu, ShareAction, safeActionHref, type Master3GuestServices, type Master3OwnerControls, type TimelineShareOutcome } from "./master3-actions";
import styles from "./timeline-artifact.module.css";
import { master3FollowCopy } from "./master3-follow-copy";

export type { TimelineShareOutcome, Master3GuestServices, Master3OwnerControls } from "./master3-actions";
export type TimelineArtifactProps = Readonly<{
  timeline: AudienceTimelineDto; compact?: boolean; embedded?: boolean; showProductHeader?: boolean;
  /** Owner current preview: never expose published URLs, guest services or counters. */
  privatePreview?: boolean; className?: string; onShare?: () => Promise<TimelineShareOutcome>; shareLabel?: string;
  owner?: Master3OwnerControls; guestServices?: Master3GuestServices; theme?: "light" | "dark";
}>;
const dateText = (date: string | null, long = false) => date ? new Intl.DateTimeFormat("en-GB", long ?
  { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } :
  { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(",", "") : "Date to be confirmed";
const timeText = (time?: string) => { if (!time) return ""; const match = /^(\d{2}):(\d{2})$/.exec(time); if (!match) return time;
  const hour = Number(match[1]); return `${hour % 12 || 12}${match[2] === "00" ? "" : `.${match[2]}`}${hour >= 12 ? "pm" : "am"}`; };
const monthText = (date: string) => new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const when = (item: Master3Milestone) => item.isToday ? "Today" : item.daysUntil === 1 ? "Tomorrow" : item.daysUntil !== null && item.daysUntil > 0 ? `In ${item.daysUntil} days` : dateText(item.date);

/** Exact board composition only while its text remains readable. */
function useBoard(root: RefObject<HTMLElement | null>, compact: boolean, embedded: boolean) {
  const [board, setBoard] = useState({ stage: false, scale: 1 });
  useLayoutEffect(() => {
    const element = root.current; if (!element) return;
    const initialDpr = window.devicePixelRatio || 1;
    const probe = document.createElement("span"); probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;left:-9999px;visibility:hidden;font-size:20px;line-height:20px;letter-spacing:0px;word-spacing:0px";
    probe.textContent = "a b"; element.append(probe);
    const fit = () => {
      const spacing = getComputedStyle(probe);
      const spaced = (parseFloat(spacing.letterSpacing) || 0) > .5 || (parseFloat(spacing.wordSpacing) || 0) > .5 || (parseFloat(spacing.lineHeight) || 20) > 24;
      const width = element.clientWidth, height = embedded ? element.parentElement?.clientHeight || window.innerHeight : window.innerHeight;
      const scale = Math.min(width / 1440, height / 810);
      const unusualDpr = ![1, 1.25, 1.5, 1.75, 2, 2.5, 3].some(value => Math.abs((window.devicePixelRatio || 1) - value) < .02);
      const zoom = (window.devicePixelRatio || 1) > initialDpr * 1.04 || (window.visualViewport?.scale ?? 1) > 1.01 || unusualDpr || window.outerWidth / window.innerWidth > 1.05;
      const next = { stage: !compact && width >= 1024 && scale >= .85 && !spaced && !zoom, scale };
      setBoard(previous => previous.stage === next.stage && previous.scale === next.scale ? previous : next);
    };
    const observer = new ResizeObserver(fit); observer.observe(element); fit();
    window.addEventListener("resize", fit); window.visualViewport?.addEventListener("resize", fit);
    const timer = window.setInterval(fit, 1500);
    return () => { observer.disconnect(); probe.remove(); window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); window.clearInterval(timer); };
  }, [root, compact, embedded]);
  return board;
}

function Name({ title, stage }: { title: string; stage: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null), [fit, setFit] = useState({ size: 64, wrap: false });
  useLayoutEffect(() => {
    if (!stage || !ref.current) return;
    let active = true;
    const measure = () => {
      if (!active || !ref.current) return;
      const context = document.createElement("canvas").getContext("2d"); if (!context) return;
      context.font = `600 64px ${getComputedStyle(ref.current).fontFamily}`;
      const width = context.measureText(title).width - Math.max(0, title.length - 1) * 2.56;
      const size = Math.min(64, 64 * 860 / Math.max(1, width)); setFit({ size: Math.max(40, size), wrap: size < 40 });
    };
    measure(); void document.fonts.ready.then(measure); return () => { active = false; };
  }, [title, stage]);
  const parts = title.split(/\s*&\s*/);
  return <h1 ref={ref} className={styles.title} data-wrap={fit.wrap || undefined} style={stage ? { fontSize: fit.size } : undefined}>
    {parts.length === 2 ? <><span>{parts[0]} &amp;</span>{" "}<span>{parts[1]}</span></> : title}
  </h1>;
}

function PanelDate({ date, time, stage }: { date: string | null; time?: string; stage: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null), [fit, setFit] = useState({ size: 32, label: dateText(date, true) });
  useLayoutEffect(() => {
    if (!stage || !ref.current) return;
    let active = true;
    const measure = () => {
      if (!active || !ref.current) return;
      const context = document.createElement("canvas").getContext("2d"); if (!context) return;
      const family = getComputedStyle(ref.current).fontFamily, full = dateText(date, true);
      const width = (px: number) => { context.font = `600 ${px}px ${family}`; return context.measureText(full).width - Math.max(0, full.length - 1) * px * .035; };
      const size = width(32) <= 380 ? 32 : width(28) <= 380 ? 28 : 26;
      const label = width(26) <= 380 || !date ? full : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(",", "");
      setFit({ size, label });
    };
    measure(); void document.fonts.ready.then(measure); return () => { active = false; };
  }, [date, stage]);
  return <p ref={ref} className={styles.panelDate} style={stage ? { fontSize: fit.size } : undefined}><time dateTime={date ?? undefined}>{stage ? fit.label : dateText(date, true)}</time>{time ? <span className={styles.phoneTime}> · {timeText(time)}</span> : null}</p>;
}

function Mark({ item }: { item: Master3Milestone }) {
  const state = item.isFinal ? item.datePassed ? "final-done" : item.isNext ? "final-next" : "final" : item.displayState;
  return <span className={styles.mark} data-state={state} data-for-you={item.presentation.forYou || undefined} aria-hidden="true">
    {item.isFinal ? <Icon kind="flag" /> : item.displayState === "done" ? <Icon kind="check" /> : item.displayState === "passed" ? <span className={styles.passedDash} /> : null}
  </span>;
}
const spoken = (item: Master3Milestone) => `${item.title}. ${dateText(item.date, true)}. ${item.isNext ? item.isToday ? "Today." : "Next." : item.datePassed ? item.sourceState === "covered" ? "Done." : "Date has passed." : ""}${item.presentation.forYou ? " For you." : ""}`;

function Rail({ model, owner }: { model: Master3Model; owner: boolean }) {
  const items = model.milestones, dense = items.length > 10;
  const rail = useRef<HTMLOListElement>(null), [wrapped, setWrapped] = useState(false);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => { if (active && rail.current) setWrapped([...rail.current.querySelectorAll<HTMLElement>("[data-rail-title]")].some(node => node.scrollHeight > 19)); };
    measure(); void document.fonts.ready.then(measure); return () => { active = false; };
  }, [items]);
  const lastDone = items.findLastIndex(item => item.datePassed);
  return <section className={styles.rail} aria-label="Timeline" data-dense={dense || undefined} data-wrapped={wrapped || undefined}>
    <div className={styles.railLine} aria-hidden="true" />
    {lastDone >= 0 ? <div className={styles.doneRail} aria-hidden="true" style={{ width: `${items.length > 1 ? lastDone / (items.length - 1) * 100 : 0}%` }} /> : null}
    {model.noDates && !items.length ? <div className={styles.emptyRail}><span><Icon kind="flag" /></span><p>Dates to follow</p></div> : <ol ref={rail} className={styles.railItems}>
      {items.map((item, index) => <li key={item.publicId} className={styles.railItem} data-next={item.isNext || undefined} data-strong={item.isFinal || item.presentation.forYou || item.presentation.key || undefined} style={{ "--x-m3-point": `${items.length > 1 ? index / (items.length - 1) * 100 : 50}%`, "--x-m3-label-width": `${Math.max(40, Math.min(150, (dense ? 2568 : 1284) / Math.max(1, items.length - 1) - 12))}px` } as CSSProperties}>
        <span className={styles.screenReaderOnly}>{spoken(item)}</span>
        <span className={styles.railFlag} aria-hidden="true">{item.isNext ? item.isToday ? "Today" : "Next" : item.presentation.forYou && !item.datePassed ? owner ? "For guests" : "For you" : ""}</span>
        <Mark item={item} /><span className={styles.railLabel} aria-hidden="true"><span data-rail-title>{item.presentation.short || item.title}</span><time dateTime={item.date ?? undefined}>{dateText(item.date)}</time></span>
        {!dense && !wrapped && item.date && (index === 0 || item.date.slice(0, 7) !== items[index - 1].date?.slice(0, 7)) ? <span className={styles.month} aria-hidden="true">{new Intl.DateTimeFormat("en-GB", { month: "short", ...(index && item.date.slice(0, 4) !== items[index - 1].date?.slice(0, 4) ? { year: "2-digit" } : {}), timeZone: "UTC" }).format(new Date(`${item.date}T12:00:00Z`))}</span> : null}
      </li>)}
    </ol>}
  </section>;
}

function TimelineList({ model, owner, expanded, expand, all = false }: { model: Master3Model; owner: boolean; expanded: boolean; expand: () => void; all?: boolean }) {
  const visible = all ? model.milestones : model.phone.visible;
  const earlier = model.phone.earlier.filter(item => !model.returningHint?.items.some(value => value.publicId === item.publicId));
  const hidden = model.phone.hidden, firstHiddenIndex = hidden.length ? model.milestones.findIndex(item => item.publicId === hidden[0].publicId) : -1;
  const insertBefore = !all && !expanded && hidden.length ? visible.find(item => model.milestones.findIndex(value => value.publicId === item.publicId) > firstHiddenIndex)?.publicId : null;
  return <>
    {!all && earlier.length ? <p className={styles.earlier}><span className={styles.earlierDot} aria-hidden="true">{earlier.every(item => item.sourceState === "covered") ? <Icon kind="check" /> : <span className={styles.passedDash} />}</span>{earlier.length} earlier {earlier.length === 1 ? "milestone" : "milestones"} {earlier.every(item => item.sourceState === "covered") ? "done" : "passed"}.</p> : null}
    <ol className={styles.phoneList}>
      {visible.map(item => <li key={item.publicId} id={all ? undefined : `m-${item.publicId}`} tabIndex={-1} className={styles.phoneItem} data-next={item.isNext || undefined}>
        {insertBefore === item.publicId ? <button className={styles.expandButton} onClick={expand}>Show {hidden.length} more{model.phone.hiddenRange ? ` · ${monthText(model.phone.hiddenRange.from)} to ${monthText(model.phone.hiddenRange.to)}` : ""}</button> : null}
        <time dateTime={item.date ?? undefined}>{dateText(item.date)}</time><Mark item={item} />
        <div className={styles.phoneItemBody}><span className={styles.screenReaderOnly}>{spoken(item)}</span><p aria-hidden="true" className={item.isNext || item.isFinal || item.presentation.forYou ? styles.strong : undefined}>{item.title}{item.presentation.forYou && !item.datePassed ? <span className={styles.tag}>{owner ? "For guests" : "For you"}</span> : null}</p>
          {!item.datePassed && (item.isNext || item.presentation.forYou || item.presentation.note) ? <p className={styles.itemNote}>{item.isNext && !item.isToday ? "Next · " : ""}{item.isNext || item.presentation.forYou ? when(item) : ""}{item.presentation.note ? `${item.isNext || item.presentation.forYou ? " · " : ""}${item.presentation.note}` : ""}</p> : null}
          {!item.datePassed && item.presentation.rsvpUrl ? <a className={styles.textButton} href={safeActionHref(item.presentation.rsvpUrl)} target="_blank" rel="noopener noreferrer">Reply</a> : null}
        </div>
      </li>)}
    </ol>
  </>;
}

function ReferralControl({ owner, announce }: { owner: Master3OwnerControls; announce: (message: string) => void }) {
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  if (!owner.referral) return null;
  return <div className={styles.referral}><label><input type="checkbox" role="switch" checked={owner.referral.enabled} disabled={saving} onChange={async event => { const enabled = event.target.checked; setSaving(true); setError(""); try { await owner.referral!.save(enabled); announce("Referral preference saved."); } catch { setError("Could not save. Try again."); } finally { setSaving(false); } }} />Show the venue’s referral link</label>{saving ? <p role="status">Saving…</p> : null}{error ? <p className={styles.error} role="alert">{error}</p> : null}</div>;
}

export function TimelineArtifact({ timeline, compact = false, embedded = false, showProductHeader = true, privatePreview = false,
  className, onShare, shareLabel, owner, guestServices, theme }: TimelineArtifactProps) {
  const root = useRef<HTMLElement>(null), dialog = useRef<HTMLDialogElement>(null), allButton = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false), [lastVisit, setLastVisit] = useState<string>(), [live, setLive] = useState("");
  const board = useBoard(root, compact, embedded), id = useId(), isOwner = !!owner || privatePreview;
  const model = useMemo(() => buildMaster3Model(timeline, { lastVisit, expanded, viewer: isOwner ? "owner" : "guest" }), [timeline, lastVisit, expanded, isOwner]);
  const p = model.presentation, title = model.title, followCopy = master3FollowCopy(timeline, model);
  const passedProgress = p.market === "school" || p.progressNoun?.includes("passed");
  const progressCount = passedProgress ? model.progress.passed : model.milestones.filter(item => item.sourceState === "covered").length;
  const progressNoun = p.progressNoun || (passedProgress ? "dates passed" : "milestones done");
  useEffect(() => {
    if (isOwner || !timeline.publicationId) return;
    const timer = window.setTimeout(() => {
      try { const key = `signal:timeline:last-visit:${timeline.publicationId}`, previous = localStorage.getItem(key);
        if (previous && /^\d{4}-\d{2}-\d{2}$/.test(previous) && Number.isFinite(Date.parse(`${previous}T12:00:00Z`)) && new Date(`${previous}T12:00:00Z`).toISOString().slice(0, 10) === previous) setLastVisit(previous);
        localStorage.setItem(key, timeline.today);
      } catch { /* Optional local preference; no tracking or network. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [timeline.publicationId, timeline.today, isOwner]);
  const day = model.hero.targetDate;
  const time = !model.after ? model.milestones.find(item => item.date === day && (p.countTo === "next" ? item.isNext : item.isFinal))?.presentation.time : undefined;
  const panelLabel = p.countTo === "next" && !model.after ? "Next date" : p.panelLabel || model.final?.title || "Timeline dates";
  const place = p.locationConsent ? p.place : undefined, address = p.locationConsent ? p.address : undefined;
  const maps = place || address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || place || "")}` : undefined;
  const nearDay = model.dayBefore || model.onDay, editHref = safeActionHref(owner?.editHref), canEdit = owner?.onEdit || editHref;
  const share = !privatePreview && (!!onShare || !!safeActionHref(guestServices?.shareUrl));
  const primaryAction = isOwner ? canEdit ? owner?.onEdit ? <button className={styles.solidButton} onClick={owner.onEdit}><Icon kind="edit" /><span className={styles.editFull}>Edit this timeline</span><span className={styles.editShort}>Edit</span></button> : <a className={styles.solidButton} href={editHref}><Icon kind="edit" /><span className={styles.editFull}>Edit this timeline</span><span className={styles.editShort}>Edit</span></a> : null : nearDay && maps ? <a className={styles.solidButton} href={maps} target="_blank" rel="noopener noreferrer"><Icon kind="pin" />Get directions</a> : !model.noDates && !model.after ? <CalendarAction timeline={timeline} model={model} service={guestServices?.calendar} announce={setLive} /> : null;
  const gift = !privatePreview && p.giftName ? <span>{p.giftLead || "Gifted by"} {safeActionHref(p.giftUrl) ? <a href={p.giftUrl} target="_blank" rel="noopener noreferrer"><strong>{p.giftName}</strong></a> : <strong>{p.giftName}</strong>}</span> : null;
  const openAll = () => dialog.current?.showModal();
  const expand = () => { const first = model.phone.hidden[0]?.publicId; setExpanded(true); setLive("All timeline dates shown."); requestAnimationFrame(() => { if (first) document.getElementById(`m-${first}`)?.focus(); }); };
  return <article ref={root} className={[styles.artifact, className].filter(Boolean).join(" ")} data-timeline-artifact data-master3-artifact data-layout={board.stage ? "stage" : "stack"} data-theme={theme} data-compact={compact ? "true" : undefined} data-embedded={embedded ? "true" : undefined} style={{ "--x-m3-board-scale": board.scale } as CSSProperties}>
    <a className={styles.skipLink} href={`#${id}-milestones`}>Skip to timeline</a><p className={styles.screenReaderOnly} role="status" aria-live="polite" aria-atomic="true">{live}</p>
    <div className={styles.board}>
      <header className={styles.productHeader}>
        {showProductHeader ? <a href={PRODUCT_MARKETING_URLS.timeline} className={styles.productMark} data-timeline-wordmark aria-label="Signal Timeline" target="_blank" rel="noopener noreferrer">timeline<span>.</span></a> : <span />}
        <div className={styles.headerActions}>{share ? <ShareAction title={title} date={day} url={guestServices?.shareUrl} onShare={onShare} label={shareLabel} phone={!board.stage} iconOnly={isOwner && !board.stage} announce={setLive} /> : null}<div className={styles.phoneEdit}>{isOwner ? primaryAction : null}</div>{owner ? <OwnerMenu owner={owner} announce={setLive} /> : null}</div>
      </header>
      <section className={styles.hero} aria-label="Timeline countdown"><p className={styles.eyebrow}>{privatePreview ? "Your current project timeline" : p.eyebrow || "A shared timeline"}</p><Name title={title} stage={board.stage} /><p className={styles.count}><span className={styles.screenReaderOnly}>{model.noDates ? "No dates yet. Dates to follow." : `${model.hero.value} ${model.hero.line1} ${model.hero.line2}.`}</span><span className={styles.countValue} aria-hidden="true" data-word={model.hero.kind !== "countdown" || undefined}>{model.hero.value}</span><span className={styles.countUnit} aria-hidden="true"><span>{model.hero.line1}</span><span>{model.hero.line2}</span></span></p></section>
      <section className={styles.dayPanel} aria-label={panelLabel}>
        <h2 className={styles.eyebrow}>{panelLabel}</h2><PanelDate date={day} time={time} stage={board.stage} />
        {!model.after && (place || time) ? <p className={styles.placeLine}>{time ? <span className={styles.desktopTime}>{timeText(time)}{place ? " · " : ""}</span> : null}{place ? <a href={maps} target="_blank" rel="noopener noreferrer"><Icon kind="pin" />{place}</a> : null}</p> : null}
        {model.progress.show ? <div className={styles.progress}><p>{progressCount} of {model.progress.total} {progressNoun}</p><div role="progressbar" aria-label="Timeline progress" aria-valuemin={0} aria-valuemax={model.progress.total} aria-valuenow={progressCount} aria-valuetext={`${progressCount} of ${model.progress.total} ${progressNoun}`}><span style={{ width: `${model.progress.total ? progressCount / model.progress.total * 100 : 0}%` }} /></div></div> : null}<div className={styles.panelAction}>{primaryAction}</div>
      </section>
      <div className={styles.desktopRail} id={board.stage ? `${id}-milestones` : undefined}><Rail model={model} owner={isOwner} /></div>
      <section className={styles.phoneTimeline} id={!board.stage ? `${id}-milestones` : undefined}><div className={styles.sectionHeading}><h2>Milestones</h2>{!model.noDates ? <span>{progressCount} of {model.progress.total} {passedProgress ? "passed" : "done"}</span> : null}</div>{model.returningHint ? <p className={styles.since}><strong>Since you were here:</strong> {model.returningHint.text}</p> : null}{model.noDates && !model.milestones.length ? <div className={styles.emptyPhone}><span className={styles.emptyFlag}><Icon kind="flag" /></span><div><strong>Dates to follow</strong><p>Dates appear here when {timeline.ownerDisplayLabel || "the owner"} adds them.</p></div></div> : <TimelineList model={model} owner={isOwner} expanded={expanded} expand={expand} />}</section>
      <div className={styles.phoneActions}>{isOwner ? share ? <ShareAction title={title} date={day} url={guestServices?.shareUrl} onShare={onShare} label="Share this timeline" announce={setLive} /> : null : nearDay ? null : primaryAction}{!isOwner && !model.after && !nearDay ? <div className={styles.gift}>{gift}</div> : null}</div>
      {nearDay ? <section className={styles.onDayPhone}><h2 className={styles.eyebrow}>On the day</h2>{!isOwner ? primaryAction : null}{p.onDayNote ? <p>{p.onDayNote}</p> : null}{p.venueNote ? <p className={styles.quiet}>{p.giftName ? <strong>From {p.giftName} · </strong> : null}{p.venueNote}</p> : null}{!isOwner ? <div className={styles.gift}>{gift}</div> : null}</section> : null}
      <section className={styles.comingUp} data-phase={model.after ? "after" : nearDay ? "day" : undefined}><div className={styles.sectionHeading}><h2>{nearDay ? "On the day" : model.after ? `From ${timeline.ownerDisplayLabel || "the owner"}` : "Coming up"}</h2><div>{!nearDay && !model.after && model.progress.total > 3 ? <span>{model.milestones.filter(item => !item.datePassed).length} to go</span> : null}{model.milestones.length > 10 ? <button ref={allButton} className={styles.textButton} onClick={openAll}>See all {model.milestones.length} dates</button> : null}</div></div>{model.returningHint?.showInComingUp ? <p className={styles.since}><strong>Since you were here:</strong> {model.returningHint.text}</p> : null}{nearDay || model.after ? p[nearDay ? "onDayNote" : "afterNote"] ? <p className={styles.ownerNote}>{p[nearDay ? "onDayNote" : "afterNote"]}</p> : null : model.noDates ? <p className={styles.emptyCopy}>Dates appear here when {timeline.ownerDisplayLabel || "the owner"} adds them.</p> : null}
        <ul className={styles.upcomingRows}>{[...model.comingUp, ...model.then.slice(0, 1)].map(item => <li key={item.publicId} data-next={item.isNext || undefined}><span className={styles.rowCount}>{item.isPostFinal ? item.isToday ? "Today" : "Then" : item.isToday ? "Today" : <>{item.daysUntil}<small>{item.daysUntil === 1 ? "day" : "days"}</small></>}</span><div><p className={item.isNext || item.presentation.forYou ? styles.strong : undefined}>{item.title}{item.isNext && !item.isToday ? <span className={styles.nextWord}>Next</span> : null}{item.presentation.forYou ? <span className={styles.tag}>{isOwner ? "For guests" : "For you"}</span> : null}</p>{item.presentation.note ? <small>{item.presentation.note}</small> : null}</div><time dateTime={item.date ?? undefined}>{dateText(item.date)}{item.presentation.time ? ` · ${timeText(item.presentation.time)}` : ""}</time></li>)}</ul>
      </section>
      <aside className={styles.sidePanel} data-near-day={nearDay && !isOwner || undefined}>{isOwner ? <><h2 className={styles.eyebrow}>Guest updates</h2>{owner?.followerCount !== undefined ? <p className={styles.followerCount}>{owner.followerCount > 0 ? <><strong>{owner.followerCount}</strong> guests get email updates</> : "No guests follow yet."}</p> : null}{owner?.nextEmail ? <p>{owner.nextEmail}</p> : null}{owner?.shareCue ? <p>{owner.shareCue}</p> : null}{privatePreview ? <p className={styles.quiet}>This current preview is private. Your tasks stay private.</p> : null}{owner && model.after ? <ReferralControl owner={owner} announce={setLive} /> : null}</> : nearDay ? <><h2 className={styles.eyebrow}>Getting there</h2>{maps ? <a className={styles.address} href={maps} target="_blank" rel="noopener noreferrer">{address || place}</a> : null}{p.venueNote ? <p>{p.giftName ? <strong>From {p.giftName} · </strong> : null}{p.venueNote}</p> : null}</> : model.after && p.photosUrl ? <><h2 className={styles.eyebrow}>The photos</h2><a className={styles.outlineButton} href={safeActionHref(p.photosUrl)} target="_blank" rel="noopener noreferrer">Open the album</a></> : model.after && !model.duringNow && model.allDone && p.next ? <><h2 className={styles.eyebrow}>Next year</h2><a className={styles.textButton} href={safeActionHref(p.next.url)}>{p.next.label}</a></> : followCopy.offer && guestServices?.follow ? <><h2 className={styles.eyebrow}>{followCopy.offer === "photos" ? "The photos" : "Follow along"}</h2>{guestServices.follow}</> : followCopy.closedText ? <><h2 className={styles.eyebrow}>Thank you</h2><p>{followCopy.closedText}</p></> : null}</aside>
      <footer className={styles.footer}><div className={styles.footerCredit}>{board.stage || isOwner || model.after ? gift : null}{!privatePreview && model.after && p.referral !== false && p.giftUrl ? <a className={styles.textButton} href={safeActionHref(p.giftUrl)} target="_blank" rel="noopener noreferrer">Planning your own day?</a> : null}</div><p>{model.updated ? <><span>Updated {dateText(model.updated)}</span><span aria-hidden="true">·</span></> : null}{!privatePreview ? <a href={`${PRODUCT_MARKETING_URLS.timeline}?src=shared-timeline`} target="_blank" rel="noopener noreferrer">Made with <strong>signal<span className={styles.accentDot}>.</span></strong></a> : <span>Private current preview</span>}</p></footer>
    </div>
    <dialog ref={dialog} className={styles.allDatesDialog} aria-label="All timeline dates" onClose={() => allButton.current?.focus()} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}><header><h2>All {model.milestones.length} dates</h2><button className={styles.outlineButton} autoFocus onClick={() => dialog.current?.close()}>Close</button></header><TimelineList model={model} owner={isOwner} expanded expand={() => {}} all /></dialog>
  </article>;
}
