"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  ANALYTICS_URL,
  NOTES_URL,
  ROADMAP_URL,
  TASKS_URL,
} from "@/lib/product-urls";

type ProductSlug = "tasks" | "roadmap" | "notes" | "analytics";

/**
 * L3 escape hatch cookie name (DESIGN.md §14).
 * Set as a short-lived SameSite=Strict cookie; the proxy reads it
 * to suppress the M→/app redirect for the bearer.
 */
const PREVIEW_COOKIE = "signal_preview_public";
const PREVIEW_COOKIE_VALUE = "1";
const PREVIEW_COOKIE_MAX_AGE = 86400; // 24h

function readPreviewCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((c) => c === `${PREVIEW_COOKIE}=${PREVIEW_COOKIE_VALUE}`);
}

function setPreviewCookie() {
  document.cookie = `${PREVIEW_COOKIE}=${PREVIEW_COOKIE_VALUE}; path=/; max-age=${PREVIEW_COOKIE_MAX_AGE}; SameSite=Strict`;
  sessionStorage.setItem(PREVIEW_COOKIE, PREVIEW_COOKIE_VALUE);
}

function clearPreviewCookie() {
  document.cookie = `${PREVIEW_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
  sessionStorage.removeItem(PREVIEW_COOKIE);
}

/**
 * Cross-product links — IA_COHERENCE.md §1G + §4B canon.
 *
 * Order: tasks → roadmap → notes → analytics (ratified hierarchy §1I).
 * Labels: "Open [product]" where [product] is the lowercase wordmark name.
 * "Open Tasks" / "Open Roadmap" (Title Case) are retired; lowercase is canon.
 * The current product is excluded via the filter below.
 */
const PRODUCTS: { slug: ProductSlug; label: string; url: string }[] = [
  { slug: "roadmap",   label: "Open roadmap",   url: `${ROADMAP_URL}/app` },
  { slug: "tasks",     label: "Open tasks",     url: `${TASKS_URL}/app` },
  { slug: "notes",     label: "Open notes",     url: `${NOTES_URL}/app` },
  { slug: "analytics", label: "Open analytics", url: `${ANALYTICS_URL}/app` },
];

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17L17 7M17 7H8M17 7v9" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Tasks-flavoured Clerk UserButton — same h-8 avatar + soft popover
 * shadow as before, plus "Open <Sibling>" links (L3: deep-linking to
 * /app entries per DESIGN.md §14), and the owner-only escape hatch
 * "View public site" / "Exit preview" (L3: DESIGN.md §14).
 *
 * The escape hatch sets `signal_preview_public=1` as a short-lived
 * same-site cookie + sessionStorage mirror so the proxy allows an
 * authed user to view the marketing site without being redirected.
 */
export function UserButtonWithSuite({ current }: { current: ProductSlug }) {
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    setIsPreview(readPreviewCookie());
  }, []);

  function handleViewPublic() {
    setPreviewCookie();
    window.location.href = "/";
  }

  function handleExitPreview() {
    clearPreviewCookie();
    window.location.reload();
  }

  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: "h-8 w-8 rounded-full",
          userButtonPopoverCard:
            "shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Settings"
          href="/settings/profile"
          labelIcon={<GearIcon />}
        />
        <UserButton.Action label="manageAccount" />
        {PRODUCTS.filter((p) => p.slug !== current).map((p) => (
          <UserButton.Link
            key={p.slug}
            label={p.label}
            href={p.url}
            labelIcon={<ArrowIcon />}
          />
        ))}
        {/* L3 escape hatch — DESIGN.md §14. Owner-only: sets the
            signal_preview_public cookie so the proxy skips M→/app
            redirect, letting the operator demo the public marketing
            site while signed in. Not linked anywhere else. */}
        <UserButton.Action
          label={isPreview ? "Exit preview" : "View public site"}
          labelIcon={<EyeIcon />}
          onClick={isPreview ? handleExitPreview : handleViewPublic}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
