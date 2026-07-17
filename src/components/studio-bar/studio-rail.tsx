"use client";

/**
 * Signal Studio product rail — the vertical stroke of the L-frame (T·94).
 *
 * 60px charcoal column under the Studio Bar's mark cell, carrying the
 * suite's four products in canonical rail geometry (34×34 r10 tiles,
 * 20px glyphs, indigo Signal Point accent on the active product).
 * Promoted from the Option B design lab shell; in production every
 * product is a real cross-product link into its authed /app.
 *
 * The rail is product navigation and nothing else — Tasks-local nav
 * stays in the light sidebar, actions stay in the Studio Bar. Hidden
 * below md, where the bottom tab bar owns navigation.
 */

import Link from "next/link";
import {
  NOTES_URL,
  SIGNAL_URL,
  TIMELINE_URL,
} from "@/lib/product-urls";
import { RailIcon, type RailIconName } from "./rail-icons";

const PRODUCTS: Array<{
  key: RailIconName;
  label: string;
  href: string | null; // null = the current product (Tasks)
}> = [
  { key: "notes", label: "Notes", href: `${NOTES_URL}/app` },
  { key: "tasks", label: "Tasks", href: null },
  { key: "timeline", label: "Timeline", href: `${TIMELINE_URL}/app` },
  { key: "signal", label: "Signal", href: `${SIGNAL_URL}/app` },
];

function ProductTile({
  icon,
  label,
  active,
}: {
  icon: RailIconName;
  label: string;
  active?: boolean;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={
          "flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] transition-colors " +
          (active
            ? "bg-[color-mix(in_srgb,var(--x-studio-accent)_16%,transparent)] text-[var(--x-studio-ink-strong)]"
            : "text-[var(--x-studio-ink-soft)] group-hover:text-[var(--x-studio-ink)]")
        }
      >
        <RailIcon
          name={icon}
          size={20}
          accentClassName={active ? "text-[var(--x-studio-accent)]" : undefined}
        />
      </span>
      <span
        className={
          "text-[10px] font-medium leading-none tracking-[0.01em] transition-colors " +
          (active
            ? "font-semibold text-[var(--x-studio-ink-strong)]"
            : "text-[var(--x-studio-ink-quiet)] group-hover:text-[var(--x-studio-ink-hover)]")
        }
      >
        {label}
      </span>
    </>
  );
}

export function StudioRail() {
  const tileClass =
    "group flex w-[52px] flex-none flex-col items-center gap-1 rounded-[10px] py-1.5 outline-none transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05]";
  return (
    <aside
      aria-label="Signal Studio products"
      className="hidden h-full w-[60px] flex-none flex-col items-center border-r border-white/[0.06] bg-[var(--x-studio-chrome)] pb-3 pt-2.5 md:flex"
    >
      <nav aria-label="Products" className="flex flex-col items-center gap-0.5">
        {PRODUCTS.map((p) =>
          p.href ? (
            <a key={p.key} href={p.href} title={`Open ${p.label}`} className={tileClass}>
              <ProductTile icon={p.key} label={p.label} />
            </a>
          ) : (
            <Link
              key={p.key}
              href="/app/board"
              aria-current="page"
              title={`${p.label} · current product`}
              className={tileClass}
            >
              <ProductTile icon={p.key} label={p.label} active />
            </Link>
          ),
        )}
      </nav>
      <span aria-hidden="true" className="my-2.5 h-px w-6 flex-none bg-white/[0.08]" />
      <span className="min-h-3 flex-1" />
      <Link
        href="/app/settings"
        aria-label="Settings"
        title="Settings"
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] text-[var(--x-studio-ink-quiet)] outline-none transition-colors hover:bg-white/[0.05] hover:text-[var(--x-studio-ink)] focus-visible:bg-white/[0.05]"
      >
        <RailIcon name="settings" size={18} />
      </Link>
    </aside>
  );
}
