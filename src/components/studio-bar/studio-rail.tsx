"use client";

/**
 * Signal Studio product rail — the vertical stroke of the L-frame (T·95
 * lab parity). Ported 1:1 from the Option B lab's SignalProductRail;
 * in production every tile is a real destination, never a preview stub:
 *
 *   home     → the Signal Studio umbrella
 *   products → each sibling's authed /app (Tasks is the lit current tile)
 *   more     → the umbrella (all products)
 *   search   → the universal command palette
 *   updates  → /app/inbox (the daily digest surface)
 *   team     → workspace settings (members live there)
 *   settings → /app/settings
 *   account  → the profile avatar + full account menu, docked at the foot
 *              of the rail (the L-frame's bottom-left corner). Relocated
 *              from the Studio Bar's top-right cluster.
 *
 * Hidden below md, where the bottom tab bar owns navigation (and the bar
 * keeps the account avatar, since the rail is not painted there).
 */

import Link from "next/link";
import {
  NOTES_URL,
  SIGNAL_URL,
  STUDIO_URL,
  TIMELINE_URL,
} from "@/lib/product-urls";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";
import { STUDIO_PALETTE_EVENT } from "./studio-chrome-context";
import { RailIcon, type RailIconName } from "./rail-icons";
import styles from "./signal-shell.module.css";

const CORE_PRODUCTS: Array<{ key: RailIconName; label: string; href: string | null }> = [
  { key: "notes", label: "Notes", href: `${NOTES_URL}/app` },
  { key: "tasks", label: "Tasks", href: null },
  { key: "timeline", label: "Timeline", href: `${TIMELINE_URL}/app` },
  { key: "signal", label: "Signal", href: `${SIGNAL_URL}/app` },
];

function ProductTile({ icon, label, active }: { icon: RailIconName; label: string; active?: boolean }) {
  return (
    <>
      <span aria-hidden="true" className={styles.railTile}>
        <RailIcon accentClassName={active ? styles.iconAccent : undefined} name={icon} size={20} />
      </span>
      <span className={styles.railLabel}>{label}</span>
    </>
  );
}

export function StudioRail() {
  return (
    <aside aria-label="Signal Studio products" className={`${styles.signalRail} hidden md:flex`} data-signal-product-rail="true">
      {/* The Signal Studio home mark lives once, in the Studio Bar's
          top-left cell directly above this rail — no second dot here. */}
      <nav aria-label="Products" className={styles.railProducts}>
        {CORE_PRODUCTS.map((product) =>
          product.href ? (
            <a
              className={styles.railProduct}
              data-product={product.key}
              data-tip={`Open ${product.label}`}
              href={product.href}
              key={product.key}
            >
              <ProductTile icon={product.key} label={product.label} />
            </a>
          ) : (
            <Link
              aria-current="page"
              className={styles.railProduct}
              data-active="true"
              data-product={product.key}
              data-tip={`${product.label} · current product`}
              href="/app/board"
              key={product.key}
            >
              <ProductTile active icon={product.key} label={product.label} />
            </Link>
          ),
        )}
      </nav>
      <span aria-hidden="true" className={styles.railDivider} />
      <a
        className={styles.railProduct}
        data-product="more"
        data-tip="More products · Signal Studio"
        href={STUDIO_URL}
      >
        <span aria-hidden="true" className={styles.railTile}>
          <RailIcon name="more" size={20} />
        </span>
        <span className={styles.railLabel}>More</span>
      </a>
      <span className={styles.railSpacer} />
      <button
        aria-label="Search"
        className={styles.railUtility}
        data-tip="Search, jump or create · ⌘K"
        onClick={() => window.dispatchEvent(new CustomEvent(STUDIO_PALETTE_EVENT))}
        type="button"
      >
        <RailIcon name="search" size={18} />
      </button>
      <Link aria-label="Updates" className={styles.railUtility} data-tip="Updates · daily digest" href="/app/inbox">
        <RailIcon name="updates" size={18} />
      </Link>
      <Link aria-label="Team" className={styles.railUtility} data-tip="Team · workspace members" href="/app/settings">
        <RailIcon name="team" size={18} />
      </Link>
      <Link aria-label="Settings" className={styles.railUtility} data-tip="Settings" href="/app/settings">
        <RailIcon name="settings" size={18} />
      </Link>
      {/* Account lives here at the foot of the rail — the bottom-left corner
          of the Signal Studio L-frame. The profile avatar (with its full
          account menu) was relocated from the Studio Bar's top-right cluster
          so the top chrome reads as product identity, not account. The menu
          flies up-and-right via placement="rail" so it never clips. */}
      <span className={styles.railAccountSlot} data-tip="Account">
        <UserButtonWithSuite current="tasks" placement="rail" />
      </span>
    </aside>
  );
}
