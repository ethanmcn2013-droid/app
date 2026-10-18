---
name: Signal Timeline Master 3
description: The shared calendar story in Geist, paper, ink and indigo.
colors:
  paper: "#fff"
  ink: "#0e0e12"
  ink-secondary: "#55555e"
  ink-muted: "#6b6b75"
  line: "#e6e6ea"
  edge: "#8f8f98"
  edge-soft: "#d6d6dc"
  next: "#4b3df2"
  next-soft: "#eceafe"
  chip: "#f1f1f4"
  hover: "#f4f4f7"
  button-hover: "#2a2a33"
  error: "#c0341d"
  dark-paper: "#0b0b10"
  dark-surface: "#14141b"
  dark-ink: "#f2f2f6"
  dark-ink-secondary: "#a9a9b4"
  dark-ink-muted: "#8a8a96"
  dark-line: "#23232c"
  dark-edge: "#6e6e7a"
  dark-edge-soft: "#3a3a46"
  dark-next: "#8e86ff"
  dark-next-soft: "rgb(142 134 255 / 22%)"
  dark-chip: "#1c1c25"
  dark-hover: "#1f1f29"
  dark-button-hover: "#d9d9e0"
  dark-error: "#ff8a78"
typography:
  body:
    fontFamily: "var(--font-geist-sans), Geist, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "var(--font-geist-sans), Geist, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: ".16em"
  action:
    fontFamily: "var(--font-geist-sans), Geist, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
rounded:
  pill: "999px"
  panel: "14px"
spacing:
  inline: "10px"
  gutter: "20px"
components:
  button-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
---

# Design System: Signal Timeline Master 3

## Overview

**Creative North Star: "One shared calendar story"**

Master 3 makes the main day and the next milestone immediately legible. White or near-black paper, Geist, generous countdown numerals and fine rails give the story its structure. Ink carries actions; indigo identifies Next. This document describes the native implementation at the recorded source revision, within this artifact directory only.

The guest surface is Experience: the calendar story leads and the interface recedes. Owner controls are Operate: explicit editing, sharing and guest-update information support a task. Both use the same artifact. The supplied Master 3 final canvas49 world is fixed; its eyebrow labels, large numeral, tight tracking and palette are explicit design choices.

**Key Characteristics:**
- Paper, ink and a precise indigo Next signal.
- A fitted desktop composition with a readable scrolling alternative.
- Thin rails, differentiated milestone marks and restrained motion.
- Pill actions, quiet borders and elevated temporary overlays.

## Colors

The palette combines neutral paper and ink with indigo for temporal emphasis.

### Primary
- **Next indigo:** Next/Today markers, their labels, focus and the brand dot. The soft counterpart supplies the marker halo and selected-text background.

### Neutral
- **Paper and surface:** the artifact background and overlay ground; dark mode separates the overlay surface from its near-black paper.
- **Ink:** titles, countdowns and solid actions; the solid action reverses foreground and background in dark mode.
- **Secondary and muted ink:** supporting copy and dates respectively.
- **Line and edges:** fine structural rails, dividers and differentiated control boundaries.
- **Chip and hover:** quiet pills and interaction feedback.
- **Error:** validation and action failures, paired with text.

**The Ink Action Rule.** Primary actions use ink; indigo identifies Next and focus rather than replacing the action hierarchy.

The frontmatter records light and dark values from the local artifact variables. The sidecar maps their runtime roles; these variables are scoped to the artifact rather than global brand tokens.

## Typography

**Display Font:** Geist with sans-serif fallback.
**Body Font:** Geist with sans-serif fallback.

The type ramp moves from small uppercase labels to a dominant countdown, using weight (600) and tight display tracking rather than additional font families. The shared body, label and action styles are the reusable frontmatter roles; the following sizes describe this composition, not a global type scale.

- The stage title measures to fit between (40px) and (64px); long names wrap when necessary. Its stage line height is (64px), or (44px) when wrapped, with tracking (-.04em).
- The stacked title uses `clamp(30px, 7.5vw, 40px)`, line height (1.12) and tracking (-.035em).
- The stage countdown is (200px) with a (152px) line box; word states use (168px). The stacked number is (112px), or (104px) under (350px); stacked words use `clamp(54px, 17vw, 72px)`. Countdown tracking is (-.065em), with tabular numerals.
- Labels are uppercase with wide tracking; dates and explanatory copy remain sentence case. Milestone text is stronger for Next, the final date and recipient-relevant items.

**The Readable Fit Rule.** Preserve the supplied display hierarchy only while it remains readable; switch to the scrolling layout when fit, zoom or text spacing makes the stage unsuitable.

## Layout

The desktop composition is a centered (1440 by 810px) stage, scaled uniformly. It requires available width at least (1024px), a fitted scale at least (.85), and the component's text-spacing and zoom checks to pass. Compact previews always stack. Embedded stage height is measured from its parent.

The stage has a header, title/countdown on the left, event panel on the right, a full-width ordered milestone rail, Coming up and Follow/owner columns, then the footer. Its main left/right edges sit (64px) inside the board; the side column is (380px) wide. The rail uses equally spaced ordered milestones, not proportional elapsed time. Dense rails stagger labels; wrapped labels suppress month markers.

The scrolling board has a maximum width of (680px), centered with (20px) gutters. Milestones precede calendar/follow actions. Follow switches from a combined pill form to a visible label, bordered email field and full-width action for stacked/compact contexts and at the (680px) media query. The narrow (350px) adjustment retains the gutters and reduces countdown/list geometry. Long names and milestone copy wrap; the full-date dialog and expansion control expose additional dates.

## Elevation & Depth

The page is flat at rest. Fine dividers and marker states carry structure; popovers and the all-dates dialog receive the shared two-layer ambient shadow. Dark mode deepens that shadow. The Next halo expresses temporal state, and the follow focus halo expresses interaction; neither is a card-elevation style. Exact shadow and focus values live in the sidecar.

## Shapes

Actions and follow state containers use pill silhouettes. Popovers and the on-day phone panel use the shared softly curved panel radius. Milestone marks are circles: a hollow upcoming point, filled checked done point, outlined passed point with a dash, indigo Next/Today point, and a larger flag for the final milestone. Text and icon shape accompany color.

## Components

### Actions and menus

Solid and outlined pill actions share a minimum height (44px). Solid actions change their ink background on hover; outlined actions strengthen their border and use the hover ground. Header actions are compact; owner phone sharing can be icon-only with an accessible label. The owner menu renders only real actions. Menus support arrow keys, Home, End, Escape and focus return; manual-copy fallbacks expose selectable text when clipboard sharing fails. Receipts distinguish copying, opening and downloading from a completed save in another application.

### Follow

The email form, pending confirmation, confirmed-following pill, unavailable state, error and undo state share the artifact palette. Focus moves to the relevant result after actions; invalid email receives text feedback. Follow availability is checked from the service. Schedule copy comes from actual dates and phase: wedding updates close after the final date, optional photo updates are separate, and school/launch post-final reminders may continue. A projected next email is never a delivery receipt.

### Milestone story

Desktop rails and stacked lists share the pure model's stable date order and explicit missing-date states. Date passage is distinct from source task completion. Next remains ahead of post-final dates until the final day has passed. Exam intervals suppress completed-plan messaging while the interval is in progress. Owner recipient labels say “For guests”; guest labels say “For you”.

### Panels and footer

Event, Coming up and side panels adapt to the current day and authorized presentation settings. Owner controls and follower information are supplied explicitly. The private current preview suppresses share and guest services and identifies itself as private. The footer's venue/referral content is conditional. No raster image is part of this visual system.

### Interaction and accessibility

Artifact focus uses an indigo outline (2px) offset by (3px). Follow fields additionally emphasize their form; stacked inputs use their own visible outline and soft halo. Reduced motion disables animations and transitions. Next/Today pulses for three cycles (2.4s each), then rests. Forced colors retain system outlines and marker distinctions; the large numeral uses CanvasText on transparent ground to prevent a generated backplate obscuring the title. Menus, status announcements and the all-dates dialog retain their native semantic behavior.

## Do's and Don'ts

### Do:
- **Do** preserve the supplied Master 3 palette, Geist hierarchy and indigo Next signal.
- **Do** use the readable scrolling layout when stage fit, zoom or text spacing fails.
- **Do** distinguish date passage, task completion and confirmed service outcomes.
- **Do** retain visible focus, reduced motion and forced-colors treatments.

### Don't:
- **Don't** invent missing dates, owner actions or sample wedding content for generic projects.
- **Don't** treat a private current preview as a published guest page.
- **Don't** turn the finite Next pulse into continuous decorative motion.
- **Don't** generalize this artifact's composition into a replacement for the Timeline editor.
