"use client";

import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { SuiteLauncher } from "@/components/app/suite-launcher";
import { SuiteHeader, type SuiteNavItem } from "@/components/chrome/suite-header";
import { UserButton } from "@clerk/nextjs";
import { isDemoMode } from "@/lib/access-mode";

const UMBRELLA_PRICING = "https://signalstudio.ie/pricing";
const UMBRELLA_DESIGN = "https://signalstudio.ie/design";

// One header contract (product-header-contract.md, 2026-07-06): the marketing
// header nav is exactly Pricing · Design, both umbrella links. Demo, Anatomy
// and App stay reachable from the page body and footer, not the header.
const NAV: SuiteNavItem[] = [
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
  const demoMode = isDemoMode();
  return (
    <SuiteHeader
      launcher={
        <SuiteLauncher current="tasks" isAuthed={isAuthed || demoMode} />
      }
      wordmark={<Wordmark size="md" />}
      nav={NAV}
      account={
        demoMode ? (
          <Link
            href="/app/board"
            className="inline-flex min-h-8 items-center rounded-full bg-ink px-3.5 text-[12px] font-medium text-white transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Demo workspace
          </Link>
        ) : isAuthed ? (
          <UserButton
            appearance={{ elements: { avatarBox: "h-8 w-8 rounded-full" } }}
          />
        ) : (
          <Link
            href="/waitlist?source=header&product=tasks"
            className="inline-flex min-h-8 items-center rounded-full px-3.5 text-[13px] font-medium text-white transition-transform hover:-translate-y-px"
            style={{ background: "var(--ink)" }}
          >
            Join the waitlist
          </Link>
        )
      }
    />
  );
}
