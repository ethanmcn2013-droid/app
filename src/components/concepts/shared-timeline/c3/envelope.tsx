"use client";

/* The sealed envelope and its opening: the seal cracks into two halves,
   the flap turns over in 3D, the card rises. 1.1s in all, skippable by any
   key, scroll or tap (the parent listens), and never shown at all when the
   visitor prefers reduced motion. */

import { motion } from "motion/react";
import type { Suite } from "./data";
import { MainFront, Paper } from "./cards";
import { WaxSeal } from "./art";
import { StudioMark } from "./mark";
import s from "./c3.module.css";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Envelope({
  suite,
  opening,
  onOpen,
}: {
  suite: Suite;
  opening: boolean;
  onOpen: () => void;
}) {
  const { world } = suite;
  const open = opening ? "open" : "shut";
  return (
    <div className={s.envStage} data-ink={world.ink}>
      <motion.div
        className={s.greeting}
        animate={opening ? { opacity: 0, y: -16 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <h1 className={s.greetTitle} data-long={suite.title.length > 28 || undefined}>
          {suite.title}
        </h1>
        <p className={s.greetLine}>{world.greeting}</p>
      </motion.div>

      <div className={s.envPersp}>
        <div className={s.env}>
          <div className={s.envInside} />
          {/* the card, waiting in the pocket */}
          <div className={s.envClip}>
            <motion.div
              className={s.envCard}
              initial={false}
              animate={opening ? { y: "-54%" } : { y: "0%" }}
              transition={{ delay: 0.52, duration: 0.58, ease: EASE }}
              aria-hidden="true"
            >
              <Paper format="main" shape="native">
                <MainFront suite={suite} asHeading={false} />
              </Paper>
            </motion.div>
          </div>
          <svg className={s.envPocket} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 0 L50 57 L100 0 V100 H0 Z" fill="var(--is-env)" />
            <path d="M0 0 L50 57 L0 100 Z" fill="var(--is-env-side)" />
            <path d="M100 0 L50 57 L100 100 Z" fill="var(--is-env-side)" />
            <path d="M0 100 L50 52 L100 100 Z" fill="var(--is-env-bottom)" />
            <path d="M0 100 L50 52 L100 100" fill="none" stroke="var(--is-env-seam)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          </svg>
          <motion.span
            className={s.flapShadow}
            initial={false}
            animate={{ opacity: opening ? 0 : 1 }}
            transition={{ delay: opening ? 0.18 : 0, duration: 0.2 }}
            aria-hidden="true"
          />
          <span className={s.envGrain} aria-hidden="true" />
          <div className={s.envMark}>
            <StudioMark />
          </div>
          {/* the flap: outside first, liner once it passes upright */}
          <motion.div
            className={s.flap}
            initial={false}
            animate={{ rotateX: opening ? 180 : 0, zIndex: opening ? 1 : 4 }}
            transition={{
              rotateX: { delay: 0.18, duration: 0.46, ease: [0.45, 0, 0.2, 1] },
              zIndex: { delay: opening ? 0.4 : 0, duration: 0 },
            }}
            data-state={open}
          >
            <div className={s.flapFace}>
              <svg className={s.flapSeam} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 0 L45 92 Q50 100 55 92 L100 0" fill="none" stroke="var(--is-env-seam)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className={`${s.flapFace} ${s.flapLiner}`} />
          </motion.div>

          {/* the seal: a real button, then two halves that fall away */}
          <div className={s.sealSpot}>
            {opening ? (
              <>
                <motion.span
                  className={s.sealHalf}
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  animate={{ x: -18, y: 26, rotate: -24, opacity: 0 }}
                  transition={{ duration: 0.42, ease: EASE }}
                >
                  <WaxSeal monogram={suite.monogram} half="left" />
                </motion.span>
                <motion.span
                  className={s.sealHalf}
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  animate={{ x: 20, y: 30, rotate: 20, opacity: 0 }}
                  transition={{ duration: 0.42, ease: EASE }}
                >
                  <WaxSeal monogram={suite.monogram} half="right" />
                </motion.span>
              </>
            ) : (
              <button type="button" className={s.seal} onClick={onOpen} aria-label={`Open the envelope from ${suite.host}`}>
                <WaxSeal monogram={suite.monogram} />
              </button>
            )}
          </div>
        </div>
      </div>

      <motion.p
        className={s.hint}
        animate={opening ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <span className={s.hintTap}>Tap the seal to open</span>
        <span className={s.hintKey}> · or press Enter</span>
      </motion.p>
    </div>
  );
}
