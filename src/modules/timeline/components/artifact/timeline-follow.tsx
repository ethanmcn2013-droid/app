"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { AudienceTimelineDto } from "../../lib/audience-timeline";
import type { GuestTimelineServices } from "../../lib/master3-calendar";
import { master3FollowCopy, master3FollowEmailError } from "./master3-follow-copy";
import styles from "./timeline-follow.module.css";

type State = "idle" | "pending" | "confirmed" | "unsubscribed" | "check_email" | "unknown";
type Operation = "subscribe" | "resend" | "change_email" | "status" | "unsubscribe" | "undo";
type Result = {
  ok: boolean; code?: string; state?: "pending" | "confirmed" | "unsubscribed" | "check_email";
  emailHint?: string; message?: string; confirmationSent?: boolean; managementToken?: string;
  undoToken?: string; undoUntil?: string; retryAfterSeconds?: number;
};
type Undo = { key: string; until: number };
type FollowProps = { shareToken?: string | null; timeline?: AudienceTimelineDto; className?: string; compact?: boolean };

async function post(endpoint: string, body: Record<string, string>): Promise<Result> {
  const response = await fetch(endpoint, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  const result: Result = await response.json();
  if (!result || typeof result.ok !== "boolean" ||
    (result.ok && !["pending", "confirmed", "unsubscribed", "check_email"].includes(result.state ?? ""))) {
    throw new Error("This request could not be confirmed.");
  }
  return result;
}

const focusAfterRender = (node: () => HTMLElement | null) => requestAnimationFrame(() => node()?.focus());
function undoFrom(result: Result): Undo | null {
  const until = result.undoUntil ? Math.min(Date.parse(result.undoUntil), Date.now() + 10_000) : NaN;
  return result.undoToken && Number.isFinite(until) && until > Date.now() ? { key: result.undoToken, until } : null;
}

export function TimelineFollow(props: FollowProps) {
  return props.shareToken ? <TimelineFollowBody key={props.shareToken} {...props} /> : null;
}

function TimelineFollowBody({ shareToken, timeline, className = "", compact = false }: FollowProps) {
  const inputId = useId(), helpId = `${inputId}-help`, errorId = `${inputId}-error`;
  const input = useRef<HTMLInputElement>(null), pending = useRef<HTMLParagraphElement>(null);
  const following = useRef<HTMLParagraphElement>(null), undoButton = useRef<HTMLButtonElement>(null);
  const resultMessage = useRef<HTMLParagraphElement>(null), busyNow = useRef(false);
  const [available, setAvailable] = useState<boolean | null>(null), [email, setEmail] = useState("");
  const [management, setManagement] = useState(""), [emailHint, setEmailHint] = useState("");
  const [state, setState] = useState<State>("idle"), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [change, setChange] = useState(false), [invalid, setInvalid] = useState("");
  const [undo, setUndo] = useState<Undo | null>(null), [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const base = shareToken ? `/api/timeline/share/${encodeURIComponent(shareToken)}` : "";
  const copy = master3FollowCopy(timeline), activeUndo = undo && clock < undo.until;

  useEffect(() => {
    if (!shareToken) return;
    const controller = new AbortController();
    fetch(`${base}/services`, { signal: controller.signal, cache: "no-store" })
      .then(response => response.json()).then((result: GuestTimelineServices) => {
        if (controller.signal.aborted) return;
        setAvailable(result.available === true && result.followAvailable === true);
        if (result.followStatus && ["confirmed", "pending", "unsubscribed"].includes(result.followStatus.state)) {
          setState(result.followStatus.state); setEmailHint(result.followStatus.emailHint);
        }
      }).catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, [shareToken, base]);

  useEffect(() => {
    if (!undo && retryAt <= Date.now()) return;
    const timer = setInterval(() => {
      const now = Date.now(); setClock(now);
      if (undo && now >= undo.until) {
        const heldFocus = document.activeElement === undoButton.current;
        setUndo(null); setState("idle"); setMessage("Undo closed. You can follow again here.");
        if (heldFocus) focusAfterRender(() => input.current ?? resultMessage.current);
      }
      if (now >= retryAt && (!undo || now >= undo.until)) clearInterval(timer);
    }, undo ? 250 : 1000);
    return () => clearInterval(timer);
  }, [undo, retryAt]);

  async function act(operation: Operation, body: Record<string, string> = {}) {
    if (busyNow.current) return;
    busyNow.current = true; setBusy(true); setMessage(""); setInvalid("");
    try {
      const endpoint = operation === "unsubscribe" || operation === "undo" ? operation : "follow";
      const result = await post(`${base}/${endpoint}`, { ...(endpoint === "follow" ? { operation } : {}), ...body });
      if (result.managementToken) setManagement(result.managementToken);
      if (result.emailHint) setEmailHint(result.emailHint);
      if (!result.ok) {
        if (result.code === "email_invalid") {
          setInvalid(result.message ?? "Enter a valid email address."); focusAfterRender(() => input.current);
        } else {
          setMessage(result.message ?? "This request could not be completed.");
          if (result.code === "delivery_unknown" || result.code === "request_conflict") {
            setState("unknown"); setChange(false); setEmail("");
            focusAfterRender(() => resultMessage.current);
          }
        }
        return;
      }
      if (result.retryAfterSeconds) setRetryAt(Date.now() + result.retryAfterSeconds * 1000);
      const nextUndo = undoFrom(result);
      setUndo(nextUndo); setClock(Date.now()); setState(result.state!); setChange(false); setEmail("");
      if (result.state === "pending") focusAfterRender(() => pending.current);
      else if (result.state === "confirmed") focusAfterRender(() => following.current);
      else if (result.state === "unsubscribed") {
        if (nextUndo) focusAfterRender(() => undoButton.current);
        else setMessage("Unfollowed. No more emails.");
      } else {
        setMessage("Use the link in your last email to manage this follow. You are not following yet.");
        focusAfterRender(() => resultMessage.current);
      }
    } catch {
      // A lost mutation response is not evidence that sending or saving failed.
      // Offer only a status check; never issue a replacement send automatically.
      setMessage("This change could not be confirmed. Use the email link if it arrives, or check its status.");
      if (operation !== "status") { setState("unknown"); setChange(false); setEmail(""); }
      focusAfterRender(() => resultMessage.current);
    } finally { busyNow.current = false; setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const error = master3FollowEmailError(email);
    if (error) { setInvalid(error); input.current?.focus(); return; }
    void act(change ? "change_email" : "subscribe", { email, ...(management ? { managementToken: management } : {}) });
  }
  const managed: Record<string, string> = management ? { managementToken: management } : {};
  const showForm = copy.offer && !activeUndo && (state === "idle" || state === "unsubscribed" || change);
  if (!shareToken) return null;

  return <section data-master3-follow data-follow-state={state} data-compact={compact || undefined}
    className={`${styles.root} ${className}`} aria-label="Follow this timeline" aria-busy={busy}>
    {available === null ? <p className={styles.status}>Checking email updates...</p>
      : available === false && state !== "confirmed" ? <p className={styles.status}>Email updates are unavailable right now.</p>
        : <>
          {showForm ? <>
            <p className={styles.invitation}>{copy.invitation}</p>
            <form onSubmit={submit} noValidate className={styles.form}>
              <label className={styles.label} htmlFor={inputId}>Email address</label>
              <input ref={input} id={inputId} type="email" autoComplete="email" maxLength={254} required
                value={email} onChange={event => { setEmail(event.target.value); setInvalid(""); }} placeholder="Your email address"
                aria-invalid={!!invalid} aria-describedby={`${invalid ? `${errorId} ` : ""}${helpId}`} disabled={busy} />
              <button type="submit" disabled={busy}>{busy ? "Sending..." : change ? "Change email" : copy.buttonLabel}</button>
            </form>
            {invalid ? <p id={errorId} role="alert" className={styles.error}>{invalid}</p> : null}
          </> : null}
          {state === "pending" && !change ? <>
            <p ref={pending} tabIndex={-1} className={styles.pending}>Check your inbox for “<strong>{copy.confirmationSubject}</strong>” and open the link inside.</p>
            <p className={styles.status}>{emailHint ? `For ${emailHint}. ` : ""}Not following yet. Check spam if it’s missing.</p>
            <div className={styles.actions}>
              <button disabled={busy} onClick={() => void act("status", managed)}>Check confirmation</button>
              <button disabled={busy || clock < retryAt} onClick={() => void act("resend", managed)}>{clock < retryAt ? `Resend in ${Math.ceil((retryAt - clock) / 60000)} min` : "Resend confirmation"}</button>
              <button aria-label="Use a different email" disabled={busy} onClick={() => { setChange(true); setInvalid(""); focusAfterRender(() => input.current); }}>Change email</button>
            </div>
          </> : null}
          {state === "confirmed" ? <>
            <div className={styles.following}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor" /><path d="m5.5 10 3 3 6-6" fill="none" stroke="var(--x-m3-bg, #fff)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <p ref={following} tabIndex={-1}>Following as <strong>{emailHint || "your confirmed email"}</strong></p>
              <button disabled={busy} onClick={() => void act("unsubscribe", management ? { key: management } : {})}>Unfollow</button>
            </div>
            <p className={styles.caption}>{copy.nextEmail}</p>
          </> : null}
          {activeUndo ? <div className={styles.undo}><span>Unfollowed. No more emails.</span><button ref={undoButton} disabled={busy} onClick={() => void act("undo", { key: undo.key })}>Undo</button></div> : null}
          {state === "unknown" ? <div className={styles.actions}><button disabled={busy} onClick={() => void act("status", managed)}>Check confirmation</button></div> : null}
          {!copy.offer && state !== "confirmed" && !activeUndo && copy.closedText ? <p className={styles.invitation}>{copy.closedText}</p> : null}
        </>}
    {available && (showForm || state === "pending" || state === "confirmed") ? <p id={helpId} className={styles.help}>Sent via Signal · Unsubscribe anytime · <a href="https://signalstudio.ie/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></p> : null}
    <p ref={resultMessage} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className={styles.status}>{message}</p>
  </section>;
}

export function TimelineFollowAction({ endpoint, undoEndpoint, linkKey, proof, label, actionLabel, inline = false, timeline }: {
  endpoint: string; undoEndpoint?: string; linkKey?: string; proof?: string; label: string; actionLabel: string; inline?: boolean; timeline?: AudienceTimelineDto;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [done, setDone] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null), [clock, setClock] = useState(() => Date.now());
  const busyNow = useRef(false), undoButton = useRef<HTMLButtonElement>(null), status = useRef<HTMLParagraphElement>(null), currentLabel = useRef<HTMLParagraphElement>(null);
  const copy = master3FollowCopy(timeline);
  useEffect(() => {
    if (!undo) return;
    const timer = setInterval(() => {
      const now = Date.now(); setClock(now);
      if (now >= undo.until) {
        const heldFocus = document.activeElement === undoButton.current;
        setUndo(null); setMessage("Undo closed. You have stopped following this timeline.");
        if (heldFocus) focusAfterRender(() => status.current);
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [undo]);
  async function submit(isUndo = false) {
    if (busyNow.current) return;
    busyNow.current = true; setBusy(true);
    try {
      const result = await post(isUndo ? undoEndpoint! : endpoint, { ...(proof ? { proof } : {}), ...(isUndo ? { key: undo!.key } : linkKey ? { key: linkKey } : {}) });
      if (!result.ok) {
        if (result.code === "delivery_unknown" || result.code === "request_conflict") setDone(true);
        setMessage(result.message ?? "This link is unavailable."); focusAfterRender(() => status.current); return;
      }
      setDone(!(inline && result.state === "confirmed")); setMessage(result.state === "confirmed" ? inline ? "" : "Following this timeline." : result.state === "unsubscribed" ? "Unfollowed. No more emails." : "Your follow has been updated.");
      const nextUndo = undoFrom(result); setUndo(nextUndo); setClock(Date.now());
      focusAfterRender(() => nextUndo && undoEndpoint ? undoButton.current : inline && result.state === "confirmed" ? currentLabel.current : status.current);
    } catch { setDone(true); setMessage("This change could not be confirmed. Use the email link if it arrives; do not repeat the request."); focusAfterRender(() => status.current); }
    finally { busyNow.current = false; setBusy(false); }
  }
  const Tag = inline ? "section" : "main";
  return <Tag className={inline ? styles.root : styles.confirmation} data-master3-follow data-inline={inline || undefined}>
    {inline ? !done ? <p ref={currentLabel} tabIndex={-1}>{label}</p> : null : <><h1>{label}</h1>{!done ? <p>Choose the button below to confirm this change.</p> : null}</>}
    {!done ? <button disabled={busy} onClick={() => void submit()}>{busy ? "Saving..." : actionLabel}</button> : null}
    {undo && undoEndpoint && clock < undo.until ? <button ref={undoButton} disabled={busy} onClick={() => void submit(true)}>Undo</button> : null}
    {inline && !done && timeline ? <p className={styles.caption}>{copy.nextEmail}</p> : null}
    <p ref={status} tabIndex={-1} role="status" aria-live="polite">{message}</p>
  </Tag>;
}
