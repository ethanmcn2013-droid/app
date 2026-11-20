"use client";

import { motion, type Transition, type Variants } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { artKind, CoverArt, coverDetail } from "./cover-art";
import type { Project } from "./data";

export type CoverProject = Pick<Project, "id" | "kind" | "tone" | "name" | "purpose" | "status" | "artSeed">;
import s from "./shelf.module.css";
import cv from "./cover.module.css";

/*
 * The shared element. The frame (layoutId) is what grows from card to hero;
 * the art inside is a fixed 1400 × 600 drawing centred in the frame, with its
 * own `layout` so it is scale-corrected and never stretches. Growing the frame
 * simply reveals more of the same drawing.
 */
export function SharedCover({
  p,
  layoutId,
  transition,
  radius,
  className,
  onLayoutAnimationComplete,
  variants,
  custom,
  children,
}: {
  variants?: Variants;
  custom?: number;
  p: CoverProject;
  layoutId?: string;
  transition: Transition;
  radius: number;
  className?: string;
  onLayoutAnimationComplete?: () => void;
  children?: ReactNode;
}) {
  return (
    <motion.div
      layoutId={layoutId}
      transition={transition}
      className={`${s.cover} ${className ?? ""}`}
      style={{ borderRadius: radius }}
      onLayoutAnimationComplete={onLayoutAnimationComplete}
      variants={variants}
      custom={custom}
      initial={variants ? "enter" : undefined}
      animate={variants ? "center" : undefined}
      exit={variants ? "exit" : undefined}
    >
      {children ?? <CoverField p={p} transition={transition} />}
    </motion.div>
  );
}

export function CoverField({
  p,
  transition,
}: {
  p: CoverProject;
  transition?: Transition;
}) {
  const detail = useMemo(() => coverDetail({ name: p.name, purpose: p.purpose }), [p.name, p.purpose]);
  return (
    <motion.div layout transition={transition} className={s.artBox}>
      <CoverArt
        kind={artKind(p.kind)}
        hue={p.tone}
        seed={p.artSeed ?? p.id}
        initial={p.name[0]?.toUpperCase() ?? "A"}
        w={1400}
        h={600}
        detail={detail}
        wrapped={p.status === "wrapped"}
      />
    </motion.div>
  );
}

/**
 * The same cover at thumbnail size, for ledger rows, compare and the peek.
 * At rest it shows a whole little cover. With a layoutId it is also the frame
 * the project home unfolds from: while it flies, the full-scale drawing shows
 * (so nothing stretches) and the thumbnail fades back in once it lands.
 */
export function MiniCover({
  p,
  w = 32,
  h = 22,
  radius = 5,
  layoutId,
  transition,
  returning = false,
  onLayoutAnimationComplete,
}: {
  p: CoverProject;
  w?: number;
  h?: number;
  radius?: number;
  layoutId?: string;
  transition?: Transition;
  /** Mounting as the landing spot of a flight home: start with the thumbnail hidden. */
  returning?: boolean;
  onLayoutAnimationComplete?: () => void;
}) {
  const [settled, setSettled] = useState(!returning);
  const detail = useMemo(() => coverDetail({ name: p.name, purpose: p.purpose }), [p.name, p.purpose]);
  return (
    <motion.span
      layoutId={layoutId}
      transition={transition}
      className={`${s.cover} ${s.mini}`}
      style={{ borderRadius: radius, width: w, height: h }}
      onLayoutAnimationComplete={() => {
        setSettled(true);
        onLayoutAnimationComplete?.();
      }}
      aria-hidden="true"
    >
      <CoverField p={p} transition={transition} />
      <span className={s.miniThumb} style={{ opacity: settled ? 1 : 0 }}>
        <CoverArt
          kind={artKind(p.kind)}
          hue={p.tone}
          seed={p.artSeed ?? p.id}
          initial={p.name[0]?.toUpperCase() ?? "A"}
          w={480}
          h={Math.round((480 * h) / w)}
          detail={detail}
          wrapped={p.status === "wrapped"}
          className={cv.thumb}
        />
      </span>
    </motion.span>
  );
}
