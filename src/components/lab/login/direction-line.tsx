"use client";

/**
 * Direction B · Line
 *
 * One centred column on paper, sitting on a single hairline that crosses the
 * whole viewport. The indigo dot rides that line and moves when the flow moves.
 *
 * The argument: most sign-ins are the same person on the same laptop. So the
 * page opens knowing you, with one button. The providers and the email field
 * fold away behind "Use a different account" and only come back when they are
 * actually needed.
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
import styles from "./direction-line.module.css";

/** Stand-in for the account the browser last used. */
const KNOWN_ACCOUNT = {
  name: "Ethan McNamara",
  email: "ethanmcn2013@gmail.com",
  initial: "E",
} as const;

type Step = "known" | "choose";

export function DirectionLine() {
  const [step, setStep] = useState<Step>("known");
  const [email, setEmail] = useState("");

  return (
    <div className={styles.page} data-step={step}>
      <header className={styles.head}>
        <Link href="/lab/login" className={styles.wordmarkLink}>
          <StudioWordmark />
        </Link>
        <p className={styles.switch}>
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      </header>

      <main className={styles.main}>
        <div className={styles.rule} aria-hidden>
          <span className={styles.ruleDot} />
        </div>

        <div className={styles.column}>
          <h1 className={styles.headline}>Sign in.</h1>
          <p className={styles.sub}>
            One account. Notes, Tasks, Timeline, Signal.
          </p>

          {step === "known" ? (
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
              <button
                type="button"
                className={styles.quiet}
                onClick={() => setStep("choose")}
              >
                Use a different account
              </button>
            </div>
          ) : (
            <div className={styles.choose}>
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

              <button
                type="button"
                className={styles.quiet}
                onClick={() => setStep("known")}
              >
                Back to {KNOWN_ACCOUNT.name.split(" ")[0]}
              </button>
            </div>
          )}

          <LegalLine />
        </div>
      </main>

      <footer className={styles.foot}>
        <LoginFooter />
        <div className={styles.qrSlot}>
          <IosQrCard tone="bare" qrSize={84} />
        </div>
      </footer>
    </div>
  );
}
