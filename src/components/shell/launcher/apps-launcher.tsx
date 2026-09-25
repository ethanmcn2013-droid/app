"use client";

/**
 * The top bar's Apps and tools button, and what it opens: a popover on wide
 * screens with a fine pointer, a bottom sheet on phones and touch screens
 * (chosen when it opens, so there is no hydration guess). The popover is
 * non-modal: no scrim, no trap; it closes on Escape (after clearing a
 * query), an outside pointer, focus leaving it, or a route change (compared
 * during render, the drawer's pattern). `G` then `A` opens it from anywhere
 * outside a field or a dialog.
 *
 * Messages is asked about once per page load, on idle or as soon as a hand
 * reaches the button, so the tile slot is decided before anyone looks at it.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { launcherMessagesEnabled } from "@/app/app/tools/launcher-actions";
import { projectDriveUiEnabled } from "@/lib/project-drive-ui";
import { ShellIcon } from "../shell-icons";
import shellStyles from "../shell.module.css";
import { LAUNCHER_NAME } from "./launcher-catalog";
import { LauncherPanel } from "./launcher-panel";
import { LauncherSheet } from "./launcher-sheet";
import styles from "./launcher.module.css";

type Phase = "closed" | "open" | "closing";
type Presentation = "popover" | "sheet";

const CLOSE_MS = 120;
const SHEET_QUERY = "(max-width: 599px), (pointer: coarse)";
const SEQUENCE_MS = 400;

// ── The Messages gate, once per page load ─────────────────────────────

let messagesAnswer: boolean | null = null;
let messagesRequest: Promise<void> | null = null;
const messagesListeners = new Set<() => void>();

function askMessages() {
  if (messagesRequest) return;
  messagesRequest = launcherMessagesEnabled()
    .then((allowed) => allowed === true)
    .catch(() => false)
    .then((allowed) => {
      messagesAnswer = allowed;
      messagesListeners.forEach((listener) => listener());
    });
}

function subscribeMessages(listener: () => void) {
  messagesListeners.add(listener);
  return () => {
    messagesListeners.delete(listener);
  };
}

/** Tiles rise in on the first open per page load, and never again. */
let tilesShown = false;

function blockedByContext(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return true;
  return Boolean(
    document.querySelector('[role="dialog"][aria-modal="true"], [data-suite-command-layer], [data-notes-overlay]'),
  );
}

/** The shell's useDismiss pattern: an outside pointer closes without moving focus. */
function useOutsidePointer(active: boolean, onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onOutside();
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [active, onOutside]);
  return ref;
}

/**
 * `messagesEnabled` overrides the lookup when the caller already knows the
 * answer. Without it, the gate is prefetched and fails closed.
 */
export function AppsLauncher({ messagesEnabled: messagesOverride }: { messagesEnabled?: boolean }) {
  const pathname = usePathname() ?? "";
  const [phase, setPhase] = useState<Phase>("closed");
  const [presentation, setPresentation] = useState<Presentation>("popover");
  const [stagger, setStagger] = useState(false);
  const answered = useSyncExternalStore(
    subscribeMessages,
    () => messagesAnswer,
    () => null,
  );
  const messagesEnabled = messagesOverride ?? answered;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<number | null>(null);

  // A navigation closes the launcher (adjusted during render, not in an effect).
  const [openPath, setOpenPath] = useState(pathname);
  if (openPath !== pathname) {
    setOpenPath(pathname);
    if (phase !== "closed") setPhase("closed");
  }

  const prefetch = useCallback(() => {
    if (messagesOverride === undefined) askMessages();
  }, [messagesOverride]);

  // Ask on idle, so the answer is in before the first open.
  useEffect(() => {
    if (messagesOverride !== undefined) return;
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => askMessages(), { timeout: 3000 })
      : window.setTimeout(() => askMessages(), 1500);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [messagesOverride]);

  const openLauncher = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    prefetch();
    setPresentation(window.matchMedia(SHEET_QUERY).matches ? "sheet" : "popover");
    setStagger(!tilesShown);
    tilesShown = true;
    setPhase("open");
  }, [prefetch]);

  const close = useCallback((returnFocus: boolean) => {
    setPhase((current) => (current === "open" ? "closing" : current));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPhase("closed"), CLOSE_MS);
    // A frame later: the sheet lifts `inert` from the shell on commit.
    if (returnFocus) window.setTimeout(() => triggerRef.current?.focus({ preventScroll: true }), 0);
  }, []);

  const closeQuietly = useCallback(() => close(false), [close]);
  const closeToTrigger = useCallback(() => close(true), [close]);
  const open = phase === "open";
  const anchorRef = useOutsidePointer(open && presentation === "popover", closeQuietly);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  // Opening moves focus: the search in the popover, the title in the sheet
  // (so a touch screen does not raise its keyboard unasked).
  useEffect(() => {
    if (phase !== "open") return;
    if (presentation === "popover") searchRef.current?.focus({ preventScroll: true });
    else titleRef.current?.focus({ preventScroll: true });
  }, [phase, presentation]);

  // G then A, from anywhere that is not a field, a dialog or the palette.
  const openRef = useRef(openLauncher);
  useEffect(() => {
    openRef.current = openLauncher;
  }, [openLauncher]);
  useEffect(() => {
    let armedAt = 0;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      const key = event.key.toLowerCase();
      if (key === "g") {
        armedAt = blockedByContext(event.target) ? 0 : event.timeStamp;
        return;
      }
      if (key === "a" && armedAt && event.timeStamp - armedAt <= SEQUENCE_MS) {
        armedAt = 0;
        if (blockedByContext(event.target)) return;
        event.preventDefault();
        openRef.current();
        return;
      }
      armedAt = 0;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const panelProps = {
    messagesEnabled,
    driveFlag: projectDriveUiEnabled(),
    currentPath: pathname,
    stagger,
    onNavigate: closeQuietly,
    onEscapeEmpty: closeToTrigger,
  };

  return (
    <div
      ref={anchorRef}
      className={styles.anchor}
      onBlur={(event) => {
        if (!open || presentation !== "popover") return;
        const next = event.relatedTarget as Node | null;
        if (next && !anchorRef.current?.contains(next)) close(false);
      }}
      onKeyDown={(event) => {
        // Escape with focus on the trigger itself.
        if (event.key === "Escape" && open && event.target === triggerRef.current) {
          event.preventDefault();
          close(true);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${shellStyles.iconButton} ${styles.trigger}`}
        aria-label="Apps and tools"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? "apps-launcher" : undefined}
        aria-keyshortcuts="G A"
        data-open={open ? "" : undefined}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onClick={() => {
          if (open) close(false);
          else openLauncher();
        }}
      >
        <ShellIcon.apps />
        <span className={styles.tooltip} aria-hidden="true">
          {LAUNCHER_NAME}
          <kbd className={styles.kbd}>G</kbd>
          <kbd className={styles.kbd}>A</kbd>
        </span>
      </button>
      {phase !== "closed" && presentation === "popover" ? (
        <div
          id="apps-launcher"
          role="dialog"
          aria-label="Apps and tools"
          aria-modal="false"
          className={styles.popover}
          data-phase={phase}
        >
          <LauncherPanel variant="popover" searchRef={searchRef} {...panelProps} />
        </div>
      ) : null}
      {phase !== "closed" && presentation === "sheet" ? (
        <LauncherSheet phase={phase} onClose={closeToTrigger}>
          <LauncherPanel variant="sheet" titleRef={titleRef} onClose={closeToTrigger} {...panelProps} />
        </LauncherSheet>
      ) : null}
    </div>
  );
}
