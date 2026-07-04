"use client";

import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { SuiteLauncher } from "@/components/app/suite-launcher";
import { SuiteHeader, type SuiteNavItem } from "@/components/chrome/suite-header";
import { UserButton } from "@clerk/nextjs";

const UMBRELLA_PRICING = "https://signalstudio.ie/pricing";
const UMBRELLA_DESIGN = "https://signalstudio.ie/design";

const NAV: SuiteNavItem[] = [
  { href: "/#demo", label: "Demo" },
  { href: "/#anatomy", label: "Anatomy" },
  { href: "/app/board", label: "App" },
  { href: UMBRELLA_PRICING, label: "Pricing", external: true },
  { href: UMBRELLA_DESIGN, label: "Design", external: true },
];

/**
 * Tasks marketing header — a thin wrapper over the shared SuiteHeader shell.
 * Auth wiring stays here (the account slot); the shell, lockup, nav, and
 * mobile menu are the one shared component. §14 auth-aware: authed replaces
 * "Sign in" with the account menu.
 */
export function SiteNav({ isAuthed = false }: { isAuthed?: boolean }) {
  return (
    <SuiteHeader
      launcher={<SuiteLauncher current="tasks" isAuthed={isAuthed} />}
      wordmark={<Wordmark size="md" />}
      nav={NAV}
      account={
        isAuthed ? (
          <UserButton
            appearance={{ elements: { avatarBox: "h-8 w-8 rounded-full" } }}
          />
        ) : (
          <Link
            href="/sign-in"
            className="inline-flex min-h-8 items-center rounded-full px-3.5 text-[13px] font-medium"
            style={{ color: "var(--ink-soft)", transition: "color 140ms ease" }}
          >
            Sign in
          </Link>
        )
      }
    />
  );
}
