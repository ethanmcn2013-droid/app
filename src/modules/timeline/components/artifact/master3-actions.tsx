"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AudienceTimelineDto } from "../../lib/audience-timeline";
import type { Master3Model } from "./master3-model";
import styles from "./timeline-artifact.module.css";

export type TimelineShareOutcome = "shared" | "copied" | "dismissed";
export type Master3OwnerControls = Readonly<{
  initial?: string; editHref?: string; onEdit?: () => void;
  menu?: readonly Readonly<{ label: string; href?: string; onSelect?: () => void | Promise<void> }>[];
  followerCount?: number; nextEmail?: string; shareCue?: string;
  referral?: Readonly<{ enabled: boolean; save: (enabled: boolean) => Promise<void> }>;
}>;
export type Master3GuestServices = Readonly<{
  shareUrl?: string;
  calendar?: Readonly<{ googleHref?: string; icsHref?: string; feedHref?: string; fileName?: string; copyText?: string; label?: string }>;
  follow?: ReactNode;
}>;

export function Icon({ kind }: { kind: "share" | "calendar" | "pin" | "edit" | "flag" | "check" | "chevron" }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill={kind === "flag" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "share" ? <><path d="M12 3v12m-4.5-7.5L12 3l4.5 4.5" /><path d="M8 11H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18 11h-2" /></> : null}
    {kind === "calendar" ? <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4m8-4v4" /></> : null}
    {kind === "pin" ? <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10" r="2.4" /></> : null}
    {kind === "edit" ? <><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3" /></> : null}
    {kind === "flag" ? <path d="M5 21V3.5M5 4h13l-3 4.5 3 4.5H5z" /> : null}
    {kind === "check" ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : null}
    {kind === "chevron" ? <path d="m6 9 6 6 6-6" /> : null}
  </svg>;
}

export function safeActionHref(value?: string): string | undefined {
  if (!value || /[\u0000-\u0020]/.test(value)) return undefined;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try { const url = new URL(value); return ["https:", "webcal:"].includes(url.protocol) && !url.username && !url.password ? value : undefined; } catch { return undefined; }
}

function menuKeys(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === "Escape" || event.key === "Tab") { close(); if (event.key === "Escape") event.preventDefault(); return; }
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
  items[next]?.focus();
}

function ManualCopy({ value, label }: { value: string; label: string }) {
  const input = useRef<HTMLInputElement>(null), id = useId();
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  return <div className={styles.manualCopy}><label htmlFor={id}>{label}</label><input id={id} ref={input} readOnly value={value} onFocus={event => event.currentTarget.select()} /><p>Copy the selected text by hand.</p></div>;
}

export function ShareAction({ title, date, url, onShare, label, phone = false, iconOnly = false, announce }: {
  title: string; date: string | null; url?: string; onShare?: () => Promise<TimelineShareOutcome>; label?: string;
  phone?: boolean; iconOnly?: boolean; announce: (text: string) => void;
}) {
  const [state, setState] = useState<"idle" | "working" | "copied" | "manual" | "error">("idle");
  const actualUrl = safeActionHref(url);
  if (!onShare && !actualUrl) return null;
  const run = async () => {
    setState("working");
    try {
      if (phone && actualUrl && navigator.share) {
        await navigator.share({ title, text: date ? `${title} · ${date}` : title, url: new URL(actualUrl, window.location.origin).href });
        setState("idle"); return;
      }
      if (actualUrl) { await navigator.clipboard.writeText(new URL(actualUrl, window.location.origin).href); setState("copied"); announce("Timeline link copied."); }
      else { const outcome = await onShare!(); setState(outcome === "copied" ? "copied" : "idle"); if (outcome === "copied") announce("Timeline link copied."); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") { setState("idle"); return; }
      setState(actualUrl ? "manual" : "error"); announce(actualUrl ? "Copy the selected timeline link by hand." : "Sharing did not complete. Try again.");
    }
  };
  return <div className={styles.actionWrap}>
    <button type="button" className={styles.outlineButton} data-icon-only={iconOnly || undefined} aria-label={label ?? "Share this timeline"} aria-expanded={state === "manual"} disabled={state === "working"} onClick={() => void run()}>
      <Icon kind={state === "copied" ? "check" : "share"} /><span>{state === "copied" ? "Link copied" : state === "working" ? "Sharing…" : label ?? (phone ? "Share" : "Share this timeline")}</span>
    </button>
    {state === "manual" && actualUrl ? <div className={styles.popover}><ManualCopy value={actualUrl} label="Copy this link" /><button className={styles.textButton} onClick={() => setState("idle")}>Close</button></div> : null}
    {state === "error" ? <p className={styles.error} role="alert">Sharing did not complete. Try again.</p> : null}
  </div>;
}

function fallbackCalendar(timeline: AudienceTimelineDto, model: Master3Model): string | null {
  const entries = timeline.presentation?.calAll ? model.milestones.filter(item => item.date && !item.datePassed) :
    model.milestones.filter(item => item.isFinal || item.isPostFinal);
  const dated = entries.map(item => ({ title: item.title, date: item.date, id: item.publicId }));
  if (!dated.length && model.final) dated.push({ title: model.final.title, date: model.final.date, id: "final" });
  if (!dated.length) return null;
  const escape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\r", "");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Signal Studio//Timeline//EN", ...dated.flatMap(item => {
    if (!item.date) return [];
    const end = new Date(Date.parse(`${item.date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    return ["BEGIN:VEVENT", `UID:${escape(timeline.publicationId)}-${escape(item.id)}@timeline.signalstudio.ie`,
      `DTSTAMP:${new Date(timeline.lastUpdatedAt).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART;VALUE=DATE:${item.date.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${end.replaceAll("-", "")}`,
      `SUMMARY:${escape(`${timeline.label}: ${item.title}`)}`, "END:VEVENT"];
  }), "END:VCALENDAR", ""].join("\r\n");
}

export function CalendarAction({ timeline, model, service, announce }: { timeline: AudienceTimelineDto; model: Master3Model;
  service?: Master3GuestServices["calendar"]; announce: (value: string) => void }) {
  const [open, setOpen] = useState(false), [manual, setManual] = useState(false), [receipt, setReceipt] = useState("");
  const trigger = useRef<HTMLButtonElement>(null), wrap = useRef<HTMLDivElement>(null);
  const file = fallbackCalendar(timeline, model);
  const google = safeActionHref(service?.googleHref), hosted = safeActionHref(service?.icsHref ?? service?.feedHref);
  const copyText = service?.copyText ?? [model.final?.date, timeline.presentation?.place].filter(Boolean).join(", ");
  const close = () => { setOpen(false); setManual(false); trigger.current?.focus(); };
  useEffect(() => { if (open && !manual) wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); }, [open, manual]);
  if (!file && !hosted && !google) return null;
  const download = () => {
    try {
      if (!file) return;
      const url = URL.createObjectURL(new Blob([file], { type: "text/calendar;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = service?.fileName ?? "timeline.ics"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReceipt("Opening your calendar"); announce("Calendar file downloaded. Open it to add the dates."); close();
    } catch { setReceipt("Download unavailable"); announce("The calendar file could not be downloaded. Copy the date instead."); }
  };
  return <div ref={wrap} className={styles.actionWrap} onKeyDown={event => menuKeys(event, close)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={styles.solidButton} aria-haspopup="menu" aria-expanded={open} onKeyDown={event => { if (event.key.startsWith("Arrow")) { event.preventDefault(); setOpen(true); } }} onClick={() => setOpen(!open)}><Icon kind="calendar" />{receipt || service?.label || "Add to my calendar"}</button>
    {open ? <div className={styles.popover}>
      {manual ? <ManualCopy value={copyText} label="Copy the date and place" /> : <div role="menu" aria-label="Add to my calendar">
        {google ? <a role="menuitem" tabIndex={-1} className={styles.menuItem} href={google} target="_blank" rel="noopener noreferrer" onClick={() => { setReceipt("Opened in a new tab"); announce("Google Calendar opened in a new tab. Save it there."); close(); }}>Google Calendar<small>Opens in a new tab; save it there</small></a> : null}
        {hosted ? <a role="menuitem" tabIndex={-1} className={styles.menuItem} href={hosted} download={service?.feedHref ? undefined : service?.fileName ?? "timeline.ics"} onClick={() => { setReceipt("Opening your calendar"); announce("Opening the calendar. Confirm the dates there."); close(); }}>Apple or Outlook<small>{service?.feedHref ? "Subscribe so changes reach you" : "Download a calendar file to open"}</small></a> : file ? <button role="menuitem" tabIndex={-1} className={styles.menuItem} onClick={download}>Apple or Outlook<small>Download an all-day calendar file</small></button> : null}
        {copyText ? <button role="menuitem" tabIndex={-1} className={styles.menuItem} onClick={async () => { try { await navigator.clipboard.writeText(copyText); setReceipt("Date copied"); announce("Date and place copied."); close(); } catch { setManual(true); announce("Copy the selected date and place by hand."); } }}>Copy the date and place<small>To paste anywhere</small></button> : null}
      </div>}
      <button type="button" className={styles.textButton} onClick={close}>Close</button>
    </div> : null}
  </div>;
}

export function OwnerMenu({ owner, announce }: { owner: Master3OwnerControls; announce: (text: string) => void }) {
  const [open, setOpen] = useState(false), trigger = useRef<HTMLButtonElement>(null), wrap = useRef<HTMLDivElement>(null);
  const items = owner.menu?.filter(item => item.onSelect || safeActionHref(item.href)) ?? [];
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => { if (open) wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(); }, [open]);
  if (!items.length) return null;
  return <div ref={wrap} className={styles.actionWrap} onKeyDown={event => menuKeys(event, close)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={styles.ownerButton} aria-label="Timeline owner menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key.startsWith("Arrow")) { event.preventDefault(); setOpen(true); } }}><span>{owner.initial?.slice(0, 1) ?? timelineInitial(owner)}</span><Icon kind="chevron" /></button>
    {open ? <div className={styles.popover} role="menu" aria-label="Timeline owner">{items.map(item => item.onSelect ? <button key={item.label} role="menuitem" className={styles.menuItem} onClick={async () => { try { await item.onSelect?.(); close(); } catch { announce(`${item.label} did not complete. Try again.`); } }}>{item.label}</button> : <a key={item.label} role="menuitem" className={styles.menuItem} href={safeActionHref(item.href)}>{item.label}</a>)}</div> : null}
  </div>;
}
function timelineInitial(owner: Master3OwnerControls) { return owner.initial ? owner.initial[0] : ""; }
