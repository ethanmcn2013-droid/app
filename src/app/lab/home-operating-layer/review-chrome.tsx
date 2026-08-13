"use client";

/**
 * The only client island in the lab, and the only JavaScript a director's
 * browser runs that is not the candidate's own.
 *
 * It holds three things: the picker, the review drawer, and the stage wrapper
 * whose key is how replay works.
 *
 * IT CARRIES NO DATA AND BUILDS NO URL. Every link it renders was built on the
 * server by `buildLabUrl` and handed down as a string. That is deliberate:
 * `buildLabUrl` sits on top of the fixture universe, and importing it here
 * would pull the whole fixture graph into the client bundle. The programme has
 * 0.9 KB of shared-runtime headroom and a previous multi-shell lab cost 19.1
 * KB, so the lab's client surface is a picker, a disclosure and a key.
 *
 * THE PICKER IS NOT A DESIGN DECISION. Its markup, its CSS and its behaviour
 * are copied verbatim from the installed prototype skill's PICKER.md, so it
 * reads as harness chrome in every project it appears in. The one permitted
 * modification is `data-position="top"`, used when a candidate occupies the
 * bottom centre of the screen.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type PickerEntry = Readonly<{
  v: number;
  label: string;
  href: string;
  /** False until that direction's folder exists. Still switchable: the lab
   *  renders a named absence rather than hiding one of the four. */
  built: boolean;
}>;

export type DrawerOption = Readonly<{
  label: string;
  href: string;
  current: boolean;
}>;

export type DrawerGroup = Readonly<{
  legend: string;
  options: readonly DrawerOption[];
  note: string | null;
}>;

export type ReviewChromeProps = Readonly<{
  entries: readonly PickerEntry[];
  activeV: number;
  pickerPosition: "bottom" | "top";
  groups: readonly DrawerGroup[];
  notices: readonly string[];
  children: React.ReactNode;
}>;

export function ReviewChrome({
  entries,
  activeV,
  pickerPosition,
  groups,
  notices,
  children,
}: ReviewChromeProps) {
  const router = useRouter();
  const pickerRef = useRef<HTMLElement | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [replay, setReplay] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const index = Math.max(
    0,
    entries.findIndex((entry) => entry.v === activeV),
  );

  const moveHighlight = useCallback(() => {
    const element = itemRefs.current[index];
    const highlight = highlightRef.current;
    if (!element || !highlight) return;
    highlight.style.width = `${element.offsetWidth}px`;
    highlight.style.transform = `translateX(${element.offsetLeft}px)`;
  }, [index]);

  useLayoutEffect(() => {
    moveHighlight();
  }, [moveHighlight]);

  useEffect(() => {
    window.addEventListener("resize", moveHighlight);
    return () => window.removeEventListener("resize", moveHighlight);
  }, [moveHighlight]);

  // The slide is enabled only after first paint, so arriving on the page does
  // not animate. Two frames, exactly as the picker spec has it.
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => picker.setAttribute("data-ready", ""));
    });
    return () => cancelAnimationFrame(outer);
  }, []);

  const select = useCallback(
    (position: number) => {
      const entry = entries[position];
      if (!entry || entry.v === activeV) return;
      // `replace`, never `push`: walking Back through four variants is not
      // what Back should mean in a comparison, and the URL still carries the
      // choice so a reload lands on the same one.
      router.replace(entry.href, { scroll: false });
    },
    [activeV, entries, router],
  );

  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const target = keyEvent.target as HTMLElement | null;
      if (
        target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
      ) {
        return;
      }
      if (keyEvent.metaKey || keyEvent.ctrlKey || keyEvent.altKey) return;
      const number = Number.parseInt(keyEvent.key, 10);
      if (number >= 1 && number <= entries.length) select(number - 1);
      else if (keyEvent.key === "ArrowRight") select((index + 1) % entries.length);
      else if (keyEvent.key === "ArrowLeft")
        select((index - 1 + entries.length) % entries.length);
      else if (keyEvent.key === "r" || keyEvent.key === "R")
        setReplay((count) => count + 1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [entries.length, index, select]);

  return (
    <>
      {/* The key is the whole replay mechanism: changing it re-mounts the
          candidate, so every entrance animation runs again. */}
      <div key={replay}>{children}</div>

      <nav
        className="proto-picker"
        aria-label="Prototype variants"
        data-position={pickerPosition === "top" ? "top" : undefined}
        ref={pickerRef}
      >
        <span className="proto-picker-highlight" aria-hidden="true" ref={highlightRef} />
        {entries.map((entry, position) => (
          <button
            key={entry.v}
            type="button"
            className="proto-picker-item"
            data-active={position === index ? "" : undefined}
            aria-current={position === index ? "true" : undefined}
            ref={(node) => {
              itemRefs.current[position] = node;
            }}
            onClick={() => select(position)}
          >
            {entry.label}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button
          type="button"
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={() => setReplay((count) => count + 1)}
        >
          ↻
        </button>
      </nav>

      <div className="lab-drawer">
        <div className="lab-drawer-panel" id="lab-review-drawer" hidden={!drawerOpen}>
          {groups.map((group) => (
            <div className="lab-drawer-group" key={group.legend}>
              <p className="lab-drawer-legend">{group.legend}</p>
              <ul className="lab-drawer-options">
                {group.options.map((option) => (
                  <li key={option.href}>
                    <a
                      className="lab-drawer-option"
                      href={option.href}
                      aria-current={option.current ? "true" : undefined}
                    >
                      {option.label}
                    </a>
                  </li>
                ))}
              </ul>
              {group.note ? <p className="lab-drawer-note">{group.note}</p> : null}
            </div>
          ))}
          <div className="lab-drawer-group">
            <p className="lab-drawer-legend">Motion</p>
            <ul className="lab-drawer-options">
              <li>
                <button
                  type="button"
                  className="lab-drawer-option"
                  onClick={() => setReplay((count) => count + 1)}
                >
                  Replay this screen
                </button>
              </li>
            </ul>
            <p className="lab-drawer-note">
              Reduced motion follows your system setting. Turn it on there to see
              what a reader with it on sees.
            </p>
          </div>
          {notices.length > 0 ? (
            <div className="lab-drawer-group">
              <p className="lab-drawer-legend">About this link</p>
              {notices.map((notice) => (
                <p className="lab-drawer-notice" key={notice}>
                  {notice}
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="lab-drawer-toggle"
          aria-expanded={drawerOpen}
          aria-controls="lab-review-drawer"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          {drawerOpen ? "Hide review controls" : "Review controls"}
        </button>
      </div>
    </>
  );
}
