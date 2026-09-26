"use client";

/* "Get the next update": follow along by email or WhatsApp with no
   account. Concept only: nothing is sent anywhere. */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import s from "./c5.module.css";

export type Channel = "email" | "whatsapp";
export type Sub = { status: "idle" | "sent" | "on"; channel: Channel; value: string };

type FormProps = {
  sub: Sub;
  finished: boolean;
  onSubmit: (channel: Channel, value: string) => void;
  autoFocus?: boolean;
  headingId?: string;
};

export function SubscribeForm({ sub, finished, onSubmit, autoFocus, headingId }: FormProps) {
  const [channel, setChannel] = useState<Channel>(sub.channel);
  const [value, setValue] = useState(sub.value);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError(v ? "That email doesn't look quite right. Check for a missing @ or dot." : "Add your email and we'll do the rest.");
      inputRef.current?.focus();
      return;
    }
    if (channel === "whatsapp" && v.replace(/\D/g, "").length < 7) {
      setError(v ? "That number looks a little short. Include the full mobile number." : "Add your mobile number and we'll do the rest.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    onSubmit(channel, v);
  }

  return (
    <form className={s.subForm} onSubmit={submit} noValidate>
      <h2 id={headingId} className={s.subTitle}>
        {finished ? "Get the last update" : "Get the next update"}
      </h2>
      <p className={s.subText}>
        {finished
          ? "We'll send one final note with the photos. No account needed."
          : "We'll send a short note when something changes. No account needed."}
      </p>
      <div className={s.channels} role="radiogroup" aria-label="How should we reach you?">
        {(["email", "whatsapp"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={channel === c}
            className={s.channel}
            onClick={() => {
              setChannel(c);
              setError(null);
              setValue("");
              inputRef.current?.focus();
            }}
          >
            {c === "email" ? <MailGlyph /> : <ChatGlyph />}
            {c === "email" ? "Email" : "WhatsApp"}
          </button>
        ))}
      </div>
      <label htmlFor={`${uid}-v`} className={s.srOnly}>
        {channel === "email" ? "Your email" : "Your mobile number"}
      </label>
      <div className={s.fieldRow}>
        <input
          ref={inputRef}
          id={`${uid}-v`}
          className={s.field}
          type={channel === "email" ? "email" : "tel"}
          inputMode={channel === "email" ? "email" : "tel"}
          autoComplete={channel === "email" ? "email" : "tel"}
          placeholder={channel === "email" ? "you@example.com" : "087 123 4567"}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-e` : `${uid}-h`}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
        />
        <button type="submit" className={s.subButton}>
          Send me updates
        </button>
      </div>
      {error ? (
        <p id={`${uid}-e`} className={s.fieldError} role="alert">
          {error}
        </p>
      ) : (
        <p id={`${uid}-h`} className={s.fieldHint}>
          About one note a fortnight. Every note has a one-tap way to stop.
        </p>
      )}
    </form>
  );
}

function MailGlyph() {
  return (
    <svg viewBox="0 0 16 16" className={s.glyph} aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1.8" />
      <path d="M2.8 4.6 L 8 8.6 L 13.2 4.6" />
    </svg>
  );
}
function ChatGlyph() {
  return (
    <svg viewBox="0 0 16 16" className={s.glyph} aria-hidden="true">
      <path d="M8 2.5 a5.5 5.5 0 0 1 0 11 a5.6 5.6 0 0 1 -2.6 -.65 L 2.5 13.5 l .7 -2.7 A5.5 5.5 0 0 1 8 2.5 z" />
    </svg>
  );
}

export function Check({ size = 40 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={s.check} aria-hidden="true">
      <motion.circle
        cx="20"
        cy="20"
        r="17"
        className={s.checkRing}
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <motion.path
        d="M12.5 20.5 L 17.8 25.5 L 27.5 14.8"
        className={s.checkMark}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.38, delay: reduce ? 0 : 0.42, ease: [0.3, 0.7, 0.2, 1] }}
      />
    </svg>
  );
}

const shown = (sub: Sub) => (sub.channel === "email" ? sub.value : `WhatsApp ${sub.value}`);

/** Desktop: the sticky card in the right margin. */
export function SubscribeCard({
  sub,
  finished,
  onSubmit,
  onChange,
}: {
  sub: Sub;
  finished: boolean;
  onSubmit: (c: Channel, v: string) => void;
  onChange: () => void;
}) {
  const reduce = useReducedMotion();
  const fade = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
      };
  return (
    <motion.section
      layout={!reduce}
      className={s.subCard}
      data-state={sub.status}
      aria-label="Get the next update"
      transition={{ layout: { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] } }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {sub.status === "idle" ? (
          <motion.div key="form" {...fade} transition={{ duration: 0.22 }}>
            <SubscribeForm sub={sub} finished={finished} onSubmit={onSubmit} />
          </motion.div>
        ) : sub.status === "sent" ? (
          <motion.div key="sent" className={s.subSent} {...fade} transition={{ duration: 0.22 }} role="status">
            <Check />
            <p className={s.subSentTitle}>You&rsquo;ll hear from us next time</p>
            <p className={s.subSentText}>
              {sub.channel === "email" ? "A short note will land in " : "A short message will come to "}
              <span className={s.subValue}>{sub.value}</span>
              {" when something changes."}
            </p>
          </motion.div>
        ) : (
          <motion.div key="on" className={s.subOn} {...fade} transition={{ duration: 0.22 }}>
            <span className={s.subOnDot} aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <path d="M4 8.4 L 6.8 11 L 12 5.2" />
              </svg>
            </span>
            <span className={s.subOnText}>
              <span className={s.subOnTitle}>You&rsquo;re on the list</span>
              <span className={s.subOnValue}>{shown(sub)}</span>
            </span>
            <button type="button" className={s.linkButton} onClick={onChange}>
              Change
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/** Phone: a quiet bar at the bottom that opens a sheet. */
export function PhoneFollow({
  sub,
  finished,
  onSubmit,
  onChange,
}: {
  sub: Sub;
  finished: boolean;
  onSubmit: (c: Channel, v: string) => void;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sheetOpen = open && sub.status !== "on";

  return (
    <>
      <div className={s.phoneBar} data-state={sub.status}>
        {sub.status === "on" ? (
          <>
            <span className={s.subOnDot} aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <path d="M4 8.4 L 6.8 11 L 12 5.2" />
              </svg>
            </span>
            <span className={s.phoneBarText}>
              <span className={s.phoneBarTitle}>You&rsquo;re on the list</span>
              <span className={s.phoneBarSub}>{shown(sub)}</span>
            </span>
            <button
              type="button"
              className={s.phoneBarGhost}
              onClick={() => {
                onChange();
                setOpen(true);
              }}
            >
              Change
            </button>
          </>
        ) : (
          <>
            <span className={s.phoneBarText}>
              <span className={s.phoneBarTitle}>{finished ? "Get the last update" : "Get the next update"}</span>
              <span className={s.phoneBarSub}>No account needed</span>
            </span>
            <button type="button" className={s.phoneBarButton} onClick={() => setOpen(true)} aria-haspopup="dialog">
              Follow
            </button>
          </>
        )}
      </div>
      <AnimatePresence>
        {sheetOpen ? (
          <>
            <motion.div
              key="scrim"
              className={s.scrim}
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              key="sheet"
              className={s.sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
              initial={reduce ? { opacity: 0 } : { y: "100%" }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "100%" }}
              transition={{ type: "spring", damping: 34, stiffness: 360 }}
            >
              <span className={s.sheetGrip} aria-hidden="true" />
              <button type="button" className={s.sheetClose} onClick={() => setOpen(false)} aria-label="Close">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 4 L 12 12 M12 4 L 4 12" />
                </svg>
              </button>
              {sub.status === "sent" ? (
                <div className={s.subSent} role="status">
                  <Check size={48} />
                  <p className={s.subSentTitle} id={headingId}>
                    You&rsquo;ll hear from us next time
                  </p>
                  <p className={s.subSentText}>
                    {sub.channel === "email" ? "A short note will land in " : "A short message will come to "}
                    <span className={s.subValue}>{sub.value}</span>
                    {" when something changes."}
                  </p>
                  <button type="button" className={s.subButtonWide} onClick={() => setOpen(false)}>
                    Back to the updates
                  </button>
                </div>
              ) : (
                <SubscribeForm sub={sub} finished={finished} onSubmit={onSubmit} autoFocus headingId={headingId} />
              )}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
