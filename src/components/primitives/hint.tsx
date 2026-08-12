"use client";

/**
 * Hint — a description that reaches keyboard users.
 *
 * The `title` attribute is a pointer-only affordance: it appears on hover
 * and nowhere else, so any meaning stored there is mute to someone
 * tabbing through the interface, and mute to a screen reader unless it
 * happens to fall back to it. The project-header panel review (2026-08-12)
 * found three load-bearing explanations living in `title` alone.
 *
 * This wraps a single control and shows its description on hover AND on
 * keyboard focus, wired as `aria-describedby` so assistive technology
 * reads it as a description rather than a name. Presentation is pure CSS
 * (`:hover` / `:focus-within`) — no state, no positioning library, and
 * nothing to get stuck open.
 *
 * Coarse pointers get no hover, so a hint is never the ONLY carrier of a
 * fact on touch: the caller keeps a visible carrier there (the way the
 * Planning badge spells "5 undated" on phones). A hint enriches; it does
 * not rescue.
 */

import { cloneElement, isValidElement, useId, type ReactElement } from "react";
import styles from "./hint.module.css";

export function Hint({
  children,
  align = "center",
  text,
}: {
  /** The control being described. `aria-describedby` is applied to it. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  /** Which edge the bubble hangs from when space is tight. */
  align?: "start" | "center" | "end";
  text: string;
}) {
  const id = useId();
  // The description must land on the CONTROL, not on a wrapper: an
  // aria-describedby on a plain span describes nothing a screen reader
  // will ever announce, because nothing focusable carries the reference.
  const described = isValidElement(children)
    ? cloneElement(children, { "aria-describedby": id })
    : children;
  return (
    <span className={styles.hintWrap} data-align={align}>
      {described}
      <span className={styles.hintBubble} id={id} role="tooltip">
        {text}
      </span>
    </span>
  );
}
