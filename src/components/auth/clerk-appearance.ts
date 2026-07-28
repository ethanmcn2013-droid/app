/**
 * The Signal Studio appearance for Clerk's <SignIn /> and <SignUp />.
 *
 * Why Clerk's component rather than a hand-built form: a sign-in screen earns
 * its last mark in the states you only meet when something is slow or wrong.
 * Wrong password, unverified email, expired code, rate limit, OAuth handoff,
 * MFA, bot check. Clerk owns all of those and keeps owning them as they
 * change. Reimplementing the happy path and shipping the rest half-built
 * would look better in a screenshot and be worse for a real person at 7am.
 *
 * So the deal is: Clerk keeps the behaviour, the design system keeps the
 * surface. Every value below is a var() reference; nothing is a literal
 * colour, so the theme flip works here exactly as it does everywhere else.
 * The one exception is the accent, and the reason is documented on
 * `variables` below. Read that before adding a colour to this file.
 *
 * The stage (src/components/auth/auth-stage.tsx) already renders the card,
 * the headline, and the border, so Clerk's own card chrome is switched off
 * rather than restyled.
 *
 * ── One config, deliberately ──────────────────────────────────────────
 *
 * This file is the ONLY Clerk appearance in the repo. ClerkRuntimeProvider
 * feeds `base` to every Clerk surface (the auth forms, the UserButton in the
 * app shell and the marketing nav); the auth pages add `authPage` on top for
 * the structural bits that only apply when the stage is drawing the card.
 *
 * It used to be two: Tailwind class strings on the provider and style objects
 * on the page. Clerk applies the first as `className` and compiles the second
 * into its own class, so the two fought on the same elements and the primary
 * button lost its fill entirely, rendering near-white text on no background.
 * Do not reintroduce a second appearance. Extend this one.
 *
 * Longhands only (`backgroundColor`, not `background`): the shorthand loses
 * to Clerk's own internal longhand rules on some elements, and the failure
 * mode is a silently invisible button.
 */

import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/nextjs";

/**
 * Derived from the component rather than imported from @clerk/types, which
 * is a transitive dependency here and not one this repo declares.
 */
type ClerkAppearance = NonNullable<
  ComponentProps<typeof SignIn>["appearance"]
>;

/**
 * The base. Fed to ClerkRuntimeProvider, so it reaches every Clerk surface
 * in the app, not only the auth pages.
 */
export const signalClerkAppearance: ClerkAppearance = {
  layout: {
    // The stage owns the wordmark, in the top bar.
    logoPlacement: "none",
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    // The stage's own footer carries these, at the bottom of the page.
    privacyPageUrl: "/privacy",
    termsPageUrl: "/terms",
    shimmer: false,
  },
  /**
   * ── Two rules, both learned the hard way ────────────────────────────
   *
   * 1. NEVER reference --accent (or --accent-hover / --accent-soft) inside
   *    anything Clerk renders. Clerk ships its own design token literally
   *    named --accent, and it redefines it on its own subtree as a
   *    light-dark() pair of near-black and white.
   *
   *    So var(--accent) inside a Clerk component silently resolves to
   *    Clerk's near-black, not Signal's indigo. The primary button rendered
   *    dark grey instead of indigo and nothing errored. Reference the
   *    indigo ramp directly here: --indigo-600 is what --accent aliases to,
   *    the value is identical, and Clerk has no token by that name.
   *
   * 2. `variables` stays empty of var() values. Clerk hoists a variables
   *    entry into the same generated rule as the element styles, keyed by
   *    the referenced property's own name, so `colorPrimary: "var(--accent)"`
   *    emits `--accent: var(--accent)`. Self-referential custom properties
   *    are invalid at computed-value time, which wipes the property for that
   *    element and every descendant. All token references live in `elements`,
   *    which Clerk passes through as ordinary CSS.
   *
   * Both failures are invisible in review and only appear on the real auth
   * pages, which is exactly why they are written down here.
   */
  variables: {},
  elements: {
    // Geist reaches Clerk's subtree by inheritance from here.
    rootBox: { width: "100%", fontFamily: "var(--font-sans)" },

    socialButtonsBlockButton: {
      minHeight: "44px",
      borderRadius: "var(--radius-pill)",
      border: "1px solid var(--hairline)",
      backgroundColor: "transparent",
      color: "var(--ink)",
      fontSize: "var(--text-body)",
      fontWeight: "var(--weight-medium)",
      transition:
        "border-color var(--motion-fast) var(--ease-out), background-color var(--motion-fast) var(--ease-out)",
      "&:hover": {
        backgroundColor: "var(--paper-deep)",
        borderColor: "var(--ink-ghost)",
      },
      "&:focus": {
        outline: "2px solid var(--indigo-600)",
        outlineOffset: "2px",
      },
    },
    socialButtonsBlockButtonText: {
      fontSize: "var(--text-body)",
      fontWeight: "var(--weight-medium)",
      color: "var(--ink)",
    },

    dividerLine: { backgroundColor: "var(--hairline-soft)" },
    dividerText: {
      color: "var(--ink-faint)",
      fontSize: "var(--text-caption)",
    },

    formFieldLabel: {
      fontSize: "var(--text-body-sm)",
      fontWeight: "var(--weight-medium)",
      color: "var(--ink-soft)",
    },
    formFieldInput: {
      minHeight: "44px",
      padding: "0 var(--space-4)",
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--hairline)",
      backgroundColor: "transparent",
      color: "var(--ink)",
      fontSize: "var(--text-body)",
      "&:hover": { borderColor: "var(--ink-ghost)" },
      "&:focus": {
        borderColor: "var(--indigo-600)",
        // Mixed from the ramp rather than --accent-soft, same reason.
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--indigo-600) 12%, transparent)",
        outline: "none",
      },
    },

    // The one earned indigo moment on the page.
    formButtonPrimary: {
      minHeight: "48px",
      borderRadius: "var(--radius-pill)",
      backgroundColor: "var(--indigo-600)",
      backgroundImage: "none",
      // indigo-50, not --paper: paper flips near-black in dark and the
      // label would sink into the indigo.
      color: "var(--indigo-50)",
      fontSize: "var(--text-body)",
      fontWeight: "var(--weight-medium)",
      textTransform: "none",
      boxShadow: "none",
      transition: "background-color var(--motion-fast) var(--ease-out)",
      "&:hover": { backgroundColor: "var(--indigo-700)" },
      "&:focus": {
        outline: "2px solid var(--indigo-600)",
        outlineOffset: "2px",
      },
    },

    formFieldAction: { color: "var(--ink-soft)" },
    identityPreviewText: { color: "var(--ink)" },
    identityPreviewEditButton: { color: "var(--indigo-600)" },
    formFieldErrorText: {
      color: "var(--status-blocked)",
      fontSize: "var(--text-body-sm)",
    },
    alertText: { color: "var(--ink)" },
    formResendCodeLink: { color: "var(--indigo-600)" },
    otpCodeFieldInput: {
      border: "1px solid var(--hairline)",
      color: "var(--ink)",
    },
    // Clerk's own branding line, off. The stage's footer is the page's.
    logoBox: { display: "none" },
  },
};

/**
 * The auth-page layer. Clerk merges this over the provider's base, so it
 * carries only what is true when AuthStage is drawing the card around it:
 * the card chrome comes off, and Clerk's header and footer come off because
 * the stage already renders a headline and a footer.
 *
 * Everything here is structural. Colour and type stay in the base so the
 * UserButton and the auth forms cannot drift apart.
 */
export const signalAuthPageAppearance: ClerkAppearance = {
  elements: {
    cardBox: {
      width: "100%",
      boxShadow: "none",
      border: "none",
      borderRadius: "0",
      backgroundColor: "transparent",
    },
    card: {
      width: "100%",
      boxShadow: "none",
      border: "none",
      borderRadius: "0",
      backgroundColor: "transparent",
      padding: "0",
      gap: "var(--space-4)",
    },
    // The stage renders the headline; Clerk's would be a second one.
    header: { display: "none" },
    // Terms and privacy live in the stage footer, at the bottom of the page.
    footer: { display: "none" },
    footerAction: { display: "none" },
  },
};
