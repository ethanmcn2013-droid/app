/**
 * The review index for /lab/login. Three directions, what each is arguing, and
 * a wireframe glyph so the shape reads before you open it.
 */

import Link from "next/link";
import { LOGIN_DIRECTIONS, type DirectionSlug } from "./directions";
import { SignalQr } from "@/components/brand/signal-qr";
import { IOS_URL, StudioWordmark } from "./shared";
import styles from "./login-index.module.css";

function Glyph({ slug }: { slug: DirectionSlug }) {
  if (slug === "spine-v2") {
    return (
      <span className={styles.glyph} aria-hidden>
        <span className={styles.gPaneFull}>
          <i className={styles.gRule} />
          <i className={styles.gTrace} />
          <i className={styles.gDot} />
          <i className={styles.gCardHeavy} />
          <i className={styles.gQrBig} />
        </span>
      </span>
    );
  }

  if (slug === "spine") {
    return (
      <span className={styles.glyph} aria-hidden>
        <span className={styles.gBarTopFull} />
        <span className={styles.gPaneFull}>
          <i className={styles.gRule} />
          <i className={styles.gDot} />
          <i className={styles.gCardHeavy} />
          <i className={styles.gQrBig} />
        </span>
      </span>
    );
  }

  if (slug === "desk") {
    return (
      <span className={styles.glyph} aria-hidden>
        <span className={styles.gPaneLeft}>
          <i className={styles.gBarWide} />
          <i className={styles.gBar} />
          <i className={styles.gBar} />
        </span>
        <span className={styles.gPaneRight}>
          <i className={styles.gCard} />
          <i className={styles.gQr} />
        </span>
      </span>
    );
  }

  if (slug === "line") {
    return (
      <span className={styles.glyph} aria-hidden>
        <span className={styles.gPaneFull}>
          <i className={styles.gRule} />
          <i className={styles.gStack} />
          <i className={styles.gQr} />
        </span>
      </span>
    );
  }

  return (
    <span className={styles.glyph} data-dark aria-hidden>
      <span className={styles.gRail} />
      <span className={styles.gBarTop} />
      <span className={styles.gPaneFull}>
        <i className={styles.gCardFloat} />
        <i className={styles.gQr} data-dark />
      </span>
    </span>
  );
}

export function LoginIndex() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <StudioWordmark />
        <span className={styles.tag}>Login lab</span>
      </header>

      <main className={styles.main}>
        <p className={styles.eyebrow}>Three directions</p>
        <h1 className={styles.headline}>
          Pick the door Signal Studio opens with.
        </h1>
        <p className={styles.sub}>
          Same brand, same tokens, same copy discipline. Three different
          arguments about what a sign-in screen is for. Every one carries the
          iPhone QR in the corner, pointing at the iOS page. Open one and press{" "}
          <kbd className={styles.kbd}>1</kbd> <kbd className={styles.kbd}>2</kbd>{" "}
          <kbd className={styles.kbd}>3</kbd> to flip between them.
        </p>

        <ul className={styles.grid}>
          {LOGIN_DIRECTIONS.map((direction) => (
            <li key={direction.slug} className={styles.cell}>
              <Link href={`/lab/login/${direction.slug}`} className={styles.card}>
                <Glyph slug={direction.slug} />
                <span className={styles.cardHead}>
                  <span className={styles.letter}>{direction.letter}</span>
                  <span className={styles.name}>{direction.name}</span>
                </span>
                <span className={styles.claim}>{direction.claim}</span>
                <span className={styles.note}>{direction.note}</span>
                <span className={styles.move}>{direction.move}</span>
                <span className={styles.open}>Open</span>
              </Link>
            </li>
          ))}
        </ul>

        <section className={styles.qrNote}>
          <a
            href={IOS_URL}
            target="_blank"
            rel="noreferrer"
            className={styles.qrNoteMark}
          >
            <SignalQr size={92} />
          </a>
          <div>
            <h2 className={styles.qrNoteTitle}>The mark in the corner</h2>
            <p className={styles.qrNoteBody}>
              One QR, drawn from the design system rather than generated as an
              image: rounded modules, drawn finder rings, and the indigo dot in
              the middle. It points at{" "}
              <span className={styles.mono}>signalstudio.ie/ios</span>, the page
              that says the iPhone app is in build. It moves to the App Store
              listing the day there is one, and nothing else has to change.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
