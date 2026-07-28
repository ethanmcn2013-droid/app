"use client";

/**
 * Review chrome. Sits over whichever direction is on screen so the set can be
 * flipped between without going back to the index. Not part of any design.
 *
 * Press 1 to 4 to jump, 0 for the index, and D to switch light and dark.
 *
 * The theme switch writes data-theme on the document element, which is where
 * the design system's dark mapping is keyed. Directions built on semantic
 * tokens follow it for free; anything painted with a --x- chrome value stays
 * where it is, and seeing which is which is part of the review.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LOGIN_DIRECTIONS, type DirectionSlug } from "./directions";
import styles from "./lab-switcher.module.css";

type Theme = "light" | "dark";

function SunMark() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden focusable="false">
      <circle cx={8} cy={8} r={3.1} fill="currentColor" />
      <g stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
        <path d="M8 1.4v1.6M8 13v1.6M14.6 8H13M3 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4 3.3 3.3" />
      </g>
    </svg>
  );
}

function MoonMark() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden focusable="false">
      <path
        d="M13.4 9.9A5.8 5.8 0 0 1 6.1 2.6a5.9 5.9 0 1 0 7.3 7.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LabSwitcher({ current }: { current: DirectionSlug }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("light");
  const [hidden, setHidden] = useState(false);
  const [newDevice, setNewDevice] = useState(false);

  // Review state, not design state: a device that has never seen an
  // account. Directions opt in by styling against [data-lab-device="new"]
  // (Spine v2 does); the others ignore it.
  const applyDevice = useCallback((next: boolean) => {
    setNewDevice(next);
    if (next) {
      document.documentElement.setAttribute("data-lab-device", "new");
    } else {
      document.documentElement.removeAttribute("data-lab-device");
    }
  }, []);

  const applyTheme = useCallback((next: Theme) => {
    setTheme(next);
    const root = document.documentElement;

    // Surfaces that transition background would otherwise cross-fade for
    // 140ms while everything else snaps, so the theme change arrives in two
    // stages. Suppress transitions for one frame and the swap is atomic.
    root.setAttribute("data-theme-switching", "true");
    const release = () => root.removeAttribute("data-theme-switching");
    requestAnimationFrame(() => requestAnimationFrame(release));
    // rAF does not fire in a tab that is not painting, and the attribute
    // would stick, leaving every transition on the page dead. The timer is
    // the floor, not the mechanism.
    window.setTimeout(release, 120);

    if (next === "dark") {
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.removeAttribute("data-theme");
      root.style.colorScheme = "light";
    }
  }, []);

  // The root layout paints an inline white background on html and body, which
  // would sit under a dark direction. Neutralise it for the lab only.
  useEffect(() => {
    const root = document.documentElement;
    const { body } = document;
    const previous = { html: root.style.background, body: body.style.background };
    root.style.background = "transparent";
    body.style.background = "transparent";

    // Global, so it can reach every element. Scoped to the lab by living on
    // this component rather than in globals.css.
    const suppress = document.createElement("style");
    suppress.textContent =
      "[data-theme-switching] *, [data-theme-switching] *::before, " +
      "[data-theme-switching] *::after { transition: none !important; }";
    document.head.append(suppress);

    return () => {
      suppress.remove();
      root.style.background = previous.html;
      body.style.background = previous.body;
      root.removeAttribute("data-theme");
      root.removeAttribute("data-lab-device");
      root.style.colorScheme = "";
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key.toLowerCase() === "h") {
        setHidden((value) => !value);
        return;
      }
      if (event.key.toLowerCase() === "n") {
        applyDevice(
          document.documentElement.getAttribute("data-lab-device") !== "new",
        );
        return;
      }
      if (event.key.toLowerCase() === "d") {
        applyTheme(
          document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark",
        );
        return;
      }
      if (event.key === "0") {
        router.push("/lab/login");
        return;
      }
      const index = Number(event.key) - 1;
      const next = LOGIN_DIRECTIONS[index];
      if (next) router.push(`/lab/login/${next.slug}`);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, applyTheme, applyDevice]);

  return (
    <div
      className={styles.bar}
      data-hidden={hidden ? "true" : undefined}
      role="navigation"
      aria-label="Login directions"
    >
      <Link href="/lab/login" className={styles.index}>
        Directions
      </Link>
      <span className={styles.rule} aria-hidden />
      {LOGIN_DIRECTIONS.map((direction) => (
        <Link
          key={direction.slug}
          href={`/lab/login/${direction.slug}`}
          className={styles.item}
          data-current={direction.slug === current ? "true" : undefined}
        >
          <span className={styles.letter}>{direction.letter}</span>
          {direction.name}
        </Link>
      ))}
      <span className={styles.rule} aria-hidden />
      <button
        type="button"
        className={styles.theme}
        onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
        aria-pressed={theme === "dark"}
      >
        {theme === "dark" ? <MoonMark /> : <SunMark />}
        {theme === "dark" ? "Dark" : "Light"}
      </button>
      <button
        type="button"
        className={styles.theme}
        onClick={() => applyDevice(!newDevice)}
        aria-pressed={newDevice}
        data-active={newDevice ? "true" : undefined}
      >
        {newDevice ? "New device" : "Known device"}
      </button>
    </div>
  );
}
