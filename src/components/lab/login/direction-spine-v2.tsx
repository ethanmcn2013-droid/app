"use client";

/**
 * Direction E · Spine v2
 *
 * D rebuilt to the panel review (2026-07-28). The findings it answers:
 *
 *   F1  A stage grid. Wordmark, footer, and QR anchor to the --container
 *       grid instead of flying to the viewport corners.
 *   F2  The spine is committed. Stations pulled inward onto the stage,
 *       real ticks, and the travelled segment stays lit behind the dot.
 *   F3  Hierarchy inverted. "Continue as Ethan" is the page's indigo
 *       moment. Providers second. Email folds away until asked for.
 *   F4  One axis, one card job. The mono label soup is gone and the
 *       new-device preview lives in the review bar (press n), not here.
 *   F5  The line and the card acknowledge each other: socket ticks sit
 *       where the line enters and leaves the card.
 *   F6  The signal station sits exactly above the QR card, by
 *       construction, so the dot's journey ends at the product that
 *       ends up in your pocket.
 *
 * Light and dark are both first-class: semantic tokens only, plus the
 * accent ramp where a value must hold identical in both themes.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AppleMark,
  GoogleMark,
  IosQrCard,
  LegalLine,
  LoginFooter,
  StudioWordmark,
} from "./shared";
import styles from "./direction-spine-v2.module.css";

/**
 * notes and signal mirror each other on the stage edges (signal is pinned
 * over the QR card's centre; notes takes the same inset on the left).
 * tasks and timeline hold a fixed offset from the card's edges, so the
 * four keep their rhythm at any viewport width.
 */
const STATIONS: readonly {
  name: string;
  left: string;
  /** Where the dot ends its travel; the label holds its own weight. */
  resting?: boolean;
}[] = [
  { name: "notes", left: "var(--x-notes-x)" },
  { name: "tasks", left: "calc(50% - 356px)" },
  { name: "timeline", left: "calc(50% + 356px)" },
  { name: "signal", left: "var(--x-signal-x)", resting: true },
];

/** Stand-in for the account the browser last used. */
const KNOWN_ACCOUNT = {
  name: "Ethan McNamara",
  email: "ethanmcn2013@gmail.com",
} as const;

export function DirectionSpineV2() {
  const [email, setEmail] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (emailOpen) emailRef.current?.focus();
  }, [emailOpen]);

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/lab/login" className={styles.wordmarkLink}>
          <StudioWordmark />
        </Link>
        <p className={styles.switch}>
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      </header>

      <main className={styles.canvas}>
        <div className={styles.spine} aria-hidden>
          <span className={styles.spineRule} />
          <span className={styles.spineTrace} />
          {STATIONS.map((station) => (
            <span
              key={station.name}
              className={styles.station}
              data-resting={station.resting ? "true" : undefined}
              style={{ left: station.left }}
            >
              <span className={styles.stationTick} />
              <span className={styles.stationName}>{station.name}</span>
            </span>
          ))}
          <span className={styles.spineDot} />
        </div>

        <section className={styles.card}>
          {/* No sub. The spine already names the suite; saying it twice in
              two registers was the fluff the review cut. */}
          <h1 className={styles.headline}>Sign in to Signal Studio.</h1>

          {/* The common case is you, on your own laptop. It gets the indigo. */}
          <div className={styles.known}>
            <button type="button" className={styles.primary}>
              Continue as {KNOWN_ACCOUNT.name.split(" ")[0]}
            </button>
            <p className={styles.knownEmail}>{KNOWN_ACCOUNT.email}</p>
          </div>

          <div className={styles.divider}>
            <span>or</span>
          </div>

          <div className={styles.providers}>
            <button
              type="button"
              className={styles.provider}
              aria-label="Continue with Google"
            >
              <GoogleMark />
              Google
            </button>
            <button
              type="button"
              className={styles.provider}
              aria-label="Continue with Apple"
            >
              <AppleMark />
              Apple
            </button>
          </div>

          {emailOpen ? (
            <form
              className={styles.form}
              onSubmit={(event) => event.preventDefault()}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Email address</span>
                <input
                  ref={emailRef}
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
          ) : (
            <button
              type="button"
              className={styles.emailReveal}
              onClick={() => setEmailOpen(true)}
            >
              Continue with email
            </button>
          )}

          <div className={styles.legalSlot}>
            <LegalLine />
          </div>
        </section>

        <div className={styles.qrSlot}>
          <IosQrCard tone="paper" qrSize={148} />
        </div>

        <div className={styles.footSlot}>
          <LoginFooter />
        </div>
      </main>
    </div>
  );
}
