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
