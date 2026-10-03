"use client";

import { motion, type Transition, type Variants } from "motion/react";
import { useMemo, type ReactNode } from "react";
import { CoverArt, coverDetail } from "./cover-art";
import type { Project } from "./data";
import s from "./shelf.module.css";

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
  p: Pick<Project, "id" | "kind" | "hue" | "name" | "purpose" | "status" | "artSeed">;
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
  p: Pick<Project, "id" | "kind" | "hue" | "name" | "purpose" | "status" | "artSeed">;
  transition?: Transition;
}) {
  const detail = useMemo(() => coverDetail({ name: p.name, purpose: p.purpose }), [p.name, p.purpose]);
  return (
    <motion.div layout transition={transition} className={s.artBox}>
      <CoverArt
        kind={p.kind}
        hue={p.hue}
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
