"use client";

/**
 * Direction D · Spine
 *
 * The fusion the review asked for: C's chrome and containment, B's line.
 *
 * What changed from B. The line is no longer decoration. It carries the four
 * products as stations, so the horizontal rule is the suite itself, and the
 * indigo dot travels it once on arrival before settling on Signal, where the
 * day starts. The auth is a full card with weight on it, not a column of text
 * floating in white space, so there is never a question about what the page is.
 *
 * Light and dark are both first-class. Every surface here is a semantic token,
 * so the theme is one attribute on the root and nothing else moves. Flip it
 * from the review bar.
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
import styles from "./direction-spine.module.css";

/**
 * Stations sit clear of the centred card at every width we support, so all
 * four stay readable instead of disappearing behind it.
 */
const STATIONS = [
  { name: "notes", at: 8 },
  { name: "tasks", at: 22 },
  { name: "timeline", at: 78 },
  { name: "signal", at: 92 },
] as const;

/** Stand-in for the account the browser last used. */
const KNOWN_ACCOUNT = {
  name: "Ethan McNamara",
  email: "ethanmcn2013@gmail.com",
  initial: "E",
} as const;

export function DirectionSpine() {
  const [email, setEmail] = useState("");
  const [useKnown, setUseKnown] = useState(true);

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
          {STATIONS.map((station) => (
            <span
              key={station.name}
              className={styles.station}
              style={{ left: `${station.at}%` }}
            >
              <span className={styles.stationTick} />
              <span className={styles.stationName}>{station.name}</span>
            </span>
          ))}
          <span className={styles.spineDot} />
        </div>

        <section className={styles.card}>
          <h1 className={styles.headline}>Sign in.</h1>
          <p className={styles.sub}>
            Notes, Tasks, Timeline, and Signal. One account.
          </p>

          {useKnown ? (
            <div className={styles.known}>
              <span className={styles.knownLabel}>Last used on this device</span>
              <button type="button" className={styles.account}>
                <span className={styles.avatar} aria-hidden>
                  {KNOWN_ACCOUNT.initial}
                </span>
                <span className={styles.accountText}>
                  <span className={styles.accountName}>{KNOWN_ACCOUNT.name}</span>
                  <span className={styles.accountEmail}>
                    {KNOWN_ACCOUNT.email}
                  </span>
                </span>
                <span className={styles.accountGo} aria-hidden>
                  Continue
                </span>
              </button>
            </div>
          ) : null}

          <div className={styles.divider}>
            <span>
              {useKnown ? "or use another account" : "use another account"}
            </span>
          </div>

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

          {/* Review affordance, not part of the design: the same screen for
              somebody the device has never seen. */}
          <button
            type="button"
            className={styles.stateToggle}
            onClick={() => setUseKnown((value) => !value)}
          >
            {useKnown ? "Preview as a new device" : "Preview as a known device"}
          </button>
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
