"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton, useUser, useClerk } from "@clerk/nextjs";
import { isDemoMode } from "@/lib/access-mode";
import { useHydrated } from "@/lib/use-hydrated";
import {
  SIGNAL_URL,
  NOTES_URL,
  TIMELINE_URL,
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
 * Cross-product links, IA_COHERENCE.md §1G + §4B canon.
 *
 * Order: notes → tasks → roadmap → analytics (operator-directed 2026-05-18).
 * Labels: "Open [product]" where [product] is the lowercase wordmark name.
 * "Open Tasks" / "Open Roadmap" (Title Case) are retired; lowercase is canon.
 * The current product is excluded via the filter below.
 */
const PRODUCTS: { slug: ProductSlug; label: string; url: string }[] = [
  { slug: "notes",     label: "Open notes",     url: `${NOTES_URL}/app` },
  { slug: "tasks",     label: "Open tasks",     url: `${TASKS_URL}/app` },
  { slug: "roadmap",   label: "Open timeline",   url: `${TIMELINE_URL}/app` },
  { slug: "analytics", label: "Open signal", url: `${SIGNAL_URL}/app` },
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

function CameraIcon() {
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
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
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
 * Tasks-flavoured Clerk UserButton, same h-8 avatar + soft popover
 * shadow as before, plus "Open <Sibling>" links (L3: deep-linking to
 * /app entries per DESIGN.md §14), and the owner-only escape hatch
 * "View public site" / "Exit preview" (L3: DESIGN.md §14).
 *
 * The escape hatch sets `signal_preview_public=1` as a short-lived
 * same-site cookie + sessionStorage mirror so the proxy allows an
 * authed user to view the marketing site without being redirected.
 */
function DemoUserButton() {
  return (
    <Link
      href="/"
      aria-label="Demo workspace. Open the public Tasks site"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-semibold text-white transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      DE
    </Link>
  );
}

function ClerkUserButtonWithSuite({ current }: { current: ProductSlug }) {
  const hydrated = useHydrated();
  const [previewCookie] = useState(readPreviewCookie);
  const isPreview = hydrated && previewCookie;
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  // hasImage is true once the user has uploaded a custom avatar. When false
  // (default Clerk-generated initials avatar), we surface an "Add a photo"
  // shortcut that opens the built-in Clerk profile editor.
  // Clerk API: user.hasImage (boolean, @clerk/nextjs useUser hook).
  // openUserProfile() from useClerk() opens the <UserProfile> modal.
  const hasPhoto = user?.hasImage ?? true; // default true so no flicker on load

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
        {/* Item 4: when the user hasn't uploaded a photo, surface a direct
            "Add a photo" entry that opens the built-in Clerk profile editor.
            Clerk API: openUserProfile() from useClerk() opens <UserProfile>
            modal, avatar upload is on the first tab. hasImage from useUser()
            detects whether a custom photo has been uploaded. */}
        {!hasPhoto ? (
          <UserButton.Action
            label="Add a photo"
            labelIcon={<CameraIcon />}
            onClick={() => openUserProfile()}
          />
        ) : null}
        <UserButton.Action label="manageAccount" />
        {PRODUCTS.filter((p) => p.slug !== current).map((p) => (
          <UserButton.Link
            key={p.slug}
            label={p.label}
            href={p.url}
            labelIcon={<ArrowIcon />}
          />
        ))}
        {/* L3 escape hatch, DESIGN.md §14. Owner-only: sets the
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

export function UserButtonWithSuite({ current }: { current: ProductSlug }) {
  if (isDemoMode()) return <DemoUserButton />;
  return <ClerkUserButtonWithSuite current={current} />;
}
