"use client";

/**
 * Direction A · Desk
 *
 * Split canvas. Sign-in on the left, on paper. On the right, the thing you are
 * signing in to: a Signal briefing assembling itself, then the four-product
 * spine underneath it. The QR sits in the corner of the stage.
 *
 * The argument: the login screen is the last chance to say what this is for.
 * Nobody signs in to an empty box.
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
import styles from "./direction-desk.module.css";

const BRIEFING_ROWS = [
  { text: "Confirm the new time with Aoife", where: "Tasks" },
  { text: "Move the florist deposit", where: "Tasks" },
  { text: "Tell the couple what changed", where: "Timeline" },
] as const;

const SPINE = ["Notes", "Tasks", "Timeline", "Signal"] as const;

export function DirectionDesk() {
  const [email, setEmail] = useState("");

  return (
    <div className={styles.page}>
      <section className={styles.auth}>
        <header className={styles.authHead}>
          <Link href="/lab/login" className={styles.wordmarkLink}>
            <StudioWordmark />
          </Link>
          <p className={styles.switch}>
            New here? <Link href="/sign-up">Create an account</Link>
          </p>
        </header>

        <main className={styles.authBody}>
          <h1 className={styles.headline}>Your morning is already written.</h1>
          <p className={styles.sub}>
            Sign in to today’s briefing, then the work behind it.
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
        </main>

        <footer className={styles.authFoot}>
          {/* Below 1000px the stage is gone, and the QR goes with it. It comes
              back here so the mark is never simply missing on a small screen. */}
          <div className={styles.qrSlotNarrow}>
            <IosQrCard tone="paper" qrSize={96} />
          </div>
          <LoginFooter />
        </footer>
      </section>

      {/* aria-hidden sits on the illustration, not the section: the QR inside
          it is a real focusable link and must stay reachable. */}
      <section className={styles.stage}>
        <div className={styles.stageInner} aria-hidden>
          <article className={styles.brief}>
            <div className={styles.briefHead}>
              <span className={styles.briefEyebrow}>
                <span className={styles.briefDot} />
                Signal · Tuesday briefing
              </span>
              <span className={styles.briefTime}>7:02</span>
            </div>

            <h2 className={styles.briefTitle}>One thing, first.</h2>
            <p className={styles.briefBody}>
              The venue walkthrough moved to Thursday. Three tasks now sit after
              the deadline.
            </p>

            <ul className={styles.briefList}>
              {BRIEFING_ROWS.map((row, index) => (
                <li
                  key={row.text}
                  className={styles.briefRow}
                  style={{ animationDelay: `${420 + index * 140}ms` }}
                >
                  <span className={styles.briefTick} />
                  <span className={styles.briefRowText}>{row.text}</span>
                  <span className={styles.briefWhere}>{row.where}</span>
                </li>
              ))}
            </ul>

            <p className={styles.briefFoot}>
              Then: 4 tasks due today. 1 timeline waiting on you.
            </p>
          </article>

          <div className={styles.spine}>
            {SPINE.map((name) => (
              <span
                key={name}
                className={styles.spineItem}
                data-active={name === "Signal" ? "true" : undefined}
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.qrSlot}>
          <IosQrCard tone="paper" qrSize={104} />
        </div>
      </section>
    </div>
  );
}
