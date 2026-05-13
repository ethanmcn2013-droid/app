"use client";

import { UserButton } from "@clerk/nextjs";
import {
  ANALYTICS_URL,
  NOTES_URL,
  ROADMAP_URL,
  TASKS_URL,
} from "@/lib/product-urls";

type ProductSlug = "tasks" | "roadmap" | "notes" | "analytics";

const PRODUCTS: { slug: ProductSlug; label: string; url: string }[] = [
  { slug: "tasks", label: "Open Tasks", url: TASKS_URL },
  { slug: "roadmap", label: "Open Roadmap", url: ROADMAP_URL },
  { slug: "notes", label: "Open Notes", url: NOTES_URL },
  { slug: "analytics", label: "Open Analytics", url: ANALYTICS_URL },
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

/**
 * Tasks-flavoured Clerk UserButton — same h-8 avatar + soft popover
 * shadow as before, plus three "Open <Sibling>" links above the
 * Manage account / Sign out rows. Each link opens the sibling product
 * in a new tab so the user keeps their current Tasks workspace.
 */
export function UserButtonWithSuite({ current }: { current: ProductSlug }) {
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
      </UserButton.MenuItems>
    </UserButton>
  );
}
