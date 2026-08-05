"use client";

/**
 * Signal Studio product rail — the vertical stroke of the L-frame (T·95
 * lab parity). Ported 1:1 from the Option B lab's SignalProductRail;
 * in production every tile is a real destination, never a preview stub:
 *
 *   home     → the Signal Studio umbrella
 *   products → each product's canonical module route within this app,
 *              carrying allowlisted workspace context as navigation hints
 *   more     → the umbrella (all products)
 *   inbox    → /app/inbox (the daily digest surface)
 *   help     → a compact menu retaining support, workspace/team, and
 *              account-settings access
 *   account  → the profile avatar + full account menu, docked at the foot
 *              of the rail (the L-frame's bottom-left corner). Relocated
 *              from the Studio Bar's top-right cluster.
 *
 * Hidden below md, where the bottom tab bar owns navigation (and the bar
 * keeps the account avatar, since the rail is not painted there).
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSuiteContext } from "@/components/app/use-suite-context";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";
import {
  PRODUCT_APP_PATHS,
  STUDIO_URL,
  suiteSurfaceFromAppPath,
} from "@/lib/product-urls";
import { withSuiteContext } from "@/lib/suite-context";
import { RailIcon, type RailIconName } from "./rail-icons";
import styles from "./signal-shell.module.css";

/**
 * Rail destinations: the three PRODUCTS, nothing else — the rail is a
 * product switcher, not a place list (board pass 4, 2026-08-05).
 * "Project" left in pass 2; Home follows now: it is a suite landing,
 * reachable as the first destination of the local Tasks navigation and
 * from each product's own surfaces, not a sibling product. /app/home and
 * /app/project both remain routable.
 */
export const RAIL_DESTINATIONS: Array<{
  key: "notes" | "tasks" | "timeline";
  label: string;
  path: string;
}> = [
  { key: "notes", label: "Notes", path: PRODUCT_APP_PATHS.notes },
  { key: "tasks", label: "Tasks", path: PRODUCT_APP_PATHS.tasks },
  { key: "timeline", label: "Timeline", path: PRODUCT_APP_PATHS.timeline },
];

function activeRailKey(pathname: string): string {
  return suiteSurfaceFromAppPath(pathname);
}

function ProductTile({ icon, label }: { icon: RailIconName; label: string }) {
  return (
    <>
      <span aria-hidden="true" className={styles.railTile}>
        <RailIcon name={icon} size={20} />
      </span>
      <span className={styles.railLabel}>{label}</span>
    </>
  );
}

function RailHelpMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    });
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      className={styles.railHelpMenuHost}
      data-open={open ? "true" : undefined}
      ref={rootRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Help and settings"
        className={styles.railUtility}
        data-tip="Help and settings"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true" className={styles.helpGlyph}>?</span>
      </button>
      {open ? (
        <div
          aria-label="Help and settings"
          className={styles.railHelpMenu}
          ref={menuRef}
          role="menu"
        >
          <span className={styles.railHelpEyebrow}>Help and settings</span>
          <Link href="/app/settings" role="menuitem">
            <span>Project and team</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/settings/profile" role="menuitem">
            <span>Account settings</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <a
            href="mailto:hello@signalstudio.ie?subject=Signal%20Studio%20help"
            role="menuitem"
          >
            <span>Contact support</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function StudioRail() {
  const pathname = usePathname() ?? "";
  const suiteContext = useSuiteContext();
  const activeKey = activeRailKey(pathname);
  const activeProduct = suiteSurfaceFromAppPath(pathname);

  return (
    <aside aria-label="Signal Studio navigation" className={`${styles.signalRail} hidden md:flex`} data-signal-product-rail="true">
      {/* The Signal Studio home mark lives once, in the Studio Bar's
          top-left cell directly above this rail — no second dot here. */}
      <nav aria-label="Products" className={styles.railProducts}>
        {RAIL_DESTINATIONS.map((destination) => {
          const active = destination.key === activeKey;
          const href = withSuiteContext(destination.path, suiteContext);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={styles.railProduct}
              data-active={active ? "true" : undefined}
              data-product={destination.key}
              data-tip={active ? `${destination.label} · current` : `Open ${destination.label}`}
              href={href}
              key={destination.key}
            >
              <ProductTile icon={destination.key} label={destination.label} />
            </Link>
          );
        })}
      </nav>
      <span aria-hidden="true" className={styles.railDivider} />
      {/* The only rail tile that leaves the app for the public site — new
          tab, explicit rel, and an accessible name that says so. */}
      <a
        aria-label="More Signal Studio products (opens in a new tab)"
        className={styles.railProduct}
        data-product="more"
        data-tip="More products · Signal Studio ↗"
        href={STUDIO_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span aria-hidden="true" className={styles.railTile}>
          <RailIcon name="more" size={20} />
        </span>
        <span className={styles.railLabel}>More</span>
      </a>
      <span className={styles.railSpacer} />
      <Link aria-label="Inbox" className={styles.railUtility} data-tip="Inbox · daily digest" href="/app/inbox">
        <RailIcon name="updates" size={18} />
      </Link>
      <RailHelpMenu />
      {/* Account lives here at the foot of the rail — the bottom-left corner
          of the Signal Studio L-frame. The profile avatar (with its full
          account menu) was relocated from the Studio Bar's top-right cluster
          so the top chrome reads as product identity, not account. The menu
          flies up-and-right via placement="rail" so it never clips. */}
      <span className={styles.railAccountSlot} data-tip="Account">
        <UserButtonWithSuite current={activeProduct} placement="rail" />
      </span>
    </aside>
  );
}
