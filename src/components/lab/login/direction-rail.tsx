"use client";

/**
 * Direction C · Rail
 *
 * The sign-in happens inside the app's own chrome. The charcoal Studio Bar
 * L-frame is already on screen, the four product tiles wake one after another
 * down the rail, and the auth card floats on paper in the middle of it.
 *
 * The argument: you are not at a marketing page waiting to be let in. You are
 * already standing at the edge of the workspace, and the card is the last step.
 */

import { useState } from "react";
import Link from "next/link";
import {
  AppleMark,
  GoogleMark,
  IosQrCard,
  LegalLine,
  LoginFooter,
  StudioWordmark,
} from "./shared";
import styles from "./direction-rail.module.css";

/* Each product's rail mark is its brand gesture, drawn small:
   Notes caret, Tasks pulse, Timeline slide, Signal tick. */

function NotesMark() {
  return (
    <svg viewBox="0 0 16 16" width={15} height={15} aria-hidden focusable="false">
      <path
        d="M4.5 9.5 8 6l3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TasksMark() {
  return (
    <svg viewBox="0 0 16 16" width={15} height={15} aria-hidden focusable="false">
      <circle cx={8} cy={8} r={3.1} fill="currentColor" />
    </svg>
  );
}

function TimelineMark() {
  return (
    <svg viewBox="0 0 16 16" width={15} height={15} aria-hidden focusable="false">
      <path
        d="M3 8h10"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={10.5} cy={8} r={2.1} fill="currentColor" />
    </svg>
  );
}

function SignalMark() {
  return (
    <svg viewBox="0 0 16 16" width={15} height={15} aria-hidden focusable="false">
      <path
        d="M2.5 8.5h3L7.5 5l2 6 1.5-2.5h2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const RAIL = [
  { name: "Notes", Mark: NotesMark },
  { name: "Tasks", Mark: TasksMark },
  { name: "Timeline", Mark: TimelineMark },
  { name: "Signal", Mark: SignalMark },
] as const;

export function DirectionRail() {
  const [email, setEmail] = useState("");

  return (
    <div className={styles.page}>
      <aside className={styles.rail} aria-hidden>
        <span className={styles.railDot} />
        <div className={styles.railTiles}>
          {RAIL.map((item, index) => (
            <span
              key={item.name}
              className={styles.tile}
              style={{ animationDelay: `${240 + index * 110}ms` }}
            >
              <item.Mark />
            </span>
          ))}
        </div>
      </aside>

      <header className={styles.bar}>
        <Link href="/lab/login" className={styles.wordmarkLink}>
          <StudioWordmark tone="inverse" size="sm" />
        </Link>
        <p className={styles.switch}>
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      </header>

      <main className={styles.canvas}>
        <section className={styles.card}>
          <h1 className={styles.headline}>
            Everything you left open is still open.
          </h1>
          <p className={styles.sub}>
            One account for Notes, Tasks, Timeline, and Signal.
          </p>

          <div className={styles.providers}>
            <button type="button" className={styles.provider}>
              <GoogleMark />
              Continue with Google
            </button>
            <button type="button" className={styles.provider}>
              <AppleMark />
              Continue with Apple
            </button>
          </div>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <form
            className={styles.form}
            onSubmit={(event) => event.preventDefault()}
          >
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Email address</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                className={styles.input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button type="submit" className={styles.submit}>
              Continue
            </button>
          </form>

          <LegalLine />
        </section>

        <div className={styles.qrSlot}>
          <IosQrCard tone="charcoal" />
        </div>

        <div className={styles.canvasFoot}>
          <LoginFooter tone="inverse" />
        </div>
      </main>
    </div>
  );
}
