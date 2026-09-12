---
name: Project Conversation Prototype
description: A compact, audience-explicit messaging workspace inside Signal Studio's operating shell.
colors:
  chrome: "#17171a"
  paper: "#ffffff"
  surface: "#f7f7f8"
  line: "#e4e4e7"
  ink: "#18181b"
  quiet-ink: "#52525b"
  indigo: "#4f46e5"
  indigo-on: "#ffffff"
  danger-paper: "#fff1f2"
  danger-ink: "#9f1239"
typography:
  headline:
    fontFamily: "Geist, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0.07em"
rounded:
  control: "8px"
  row: "10px"
  field: "12px"
  workspace: "15px"
  pill: "999px"
spacing:
  compact: "8px"
  control: "12px"
  section: "24px"
  canvas: "28px"
components:
  send-button:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.indigo-on}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  composer-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  conversation-row-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "7px 9px"
  audience-status:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.quiet-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
---

# Design System: Project Conversation Prototype

## Overview

**Creative North Star: "The Explicit Operating Room"**

This scoped prototype extends the existing Signal Studio operating surface: a compact charcoal rail surrounds a white workspace, while ink typography and a restrained indigo accent keep the conversation legible and task-oriented. Information density is deliberate, with authorship, delivery state, Project scope, and audience kept close to the message they qualify.

The system recorded here describes `/lab/project-conversation` only. Its data and receipts are synthetic, and the implementation does not establish production messaging behavior, backend guarantees, or human acceptance.

**Key Characteristics:**

- White working canvas inside compact charcoal chrome.
- Geist throughout, with a small and practical type ramp.
- Indigo reserved for selection, action, unread, and focus.
- Audience and access state remain visible above conversation content.
- Mobile reflows to one usable conversation pane with bottom navigation.

## Colors

The palette is neutral and operational, with one indigo action voice and narrow semantic colors for blocked or failed states.

### Primary

- **Signal Indigo:** Used for current navigation, project avatars, unread counts, primary actions, directed-message marks, and focus.

### Neutral

- **Charcoal Chrome:** Frames the lab bar and studio rail.
- **Paper White:** Carries the workspace, feed, composer, panels, and active rows.
- **Quiet Surface:** Separates conversation navigation, banners, root messages, and low-emphasis controls.
- **Hairline Gray:** Divides regions and outlines neutral controls.
- **Ink:** Supplies primary text; **Quiet Ink** supplies metadata and supporting copy.
- **Rose Alert:** Appears only for blocked, unavailable, failed, or audience-change semantics.

**The One Accent Rule.** Indigo carries interaction and attention; do not introduce a second decorative accent within this prototype surface.

## Typography

**Display Font:** Geist (with sans-serif fallback)  
**Body Font:** Geist (with sans-serif fallback)  
**Label/Mono Font:** Geist Mono for keyboard hints only

**Character:** Compact, plainspoken, and highly legible. Weight and spacing establish hierarchy without a separate display face.

### Hierarchy

- **Headline:** Used for the Messages list heading.
- **Title:** Used for the selected conversation and compact panel headings.
- **Body:** Used for message text with a readable maximum line length of 68ch.
- **Label:** Used for Project grouping and compact control copy; uppercase is limited to the Project group label.

**The Conversation First Rule.** Message text stays at body size and relaxed leading; metadata remains smaller so it cannot compete with the conversation.

## Layout

Desktop uses a 60px studio rail, a 58px lab bar, and a white workspace split into a 290px conversation list plus a flexible feed. Context view narrows the workspace to at most 720px and removes the list. Feed content centers at 760px; the composer centers at 808px.

At 760px and below, the rail becomes a fixed 60px bottom navigation bar, the conversation list becomes a 66px avatar switcher, and the audience header, feed, and composer share the remaining pane. Touch actions become at least 44px high where the mobile layout exposes them.

**The Visible Audience Rule.** Every usable conversation pane begins with the Project scope and reader/access description; scrolling content and narrow layouts must not erase that context.

## Elevation & Depth

The prototype is flat by default. Borders and tonal surfaces define structure; restrained shadows appear only on the selected desktop conversation row, menus, and fixed side panels.

### Shadow Vocabulary

- **Selected row:** `0 6px 18px -16px rgba(24,24,27,.45)` gives the active desktop row a slight lift.
- **Floating menu:** `0 16px 36px -18px rgba(24,24,27,.38)` separates a temporary action menu.
- **Side panel:** `-18px 0 42px -32px rgba(24,24,27,.5)` marks thread and work-preview overlays.

**The Flat Canvas Rule.** Persistent surfaces use tone and hairlines; shadow is reserved for selection or temporary layers.

## Shapes

Controls use gently rounded rectangles from 7px to 12px. Statuses, counts, and primary actions use full pills; avatars remain circular. The desktop workspace alone uses a 15px upper-left corner to soften the boundary against the charcoal frame. Mobile removes that corner and uses a 2px ink outline inset by 4px to make the selected avatar unambiguous.

## Components

### Buttons

- **Primary:** Indigo pill, white label, 36px high on desktop and 44px for the mobile Send action.
- **Icon / ghost:** Transparent with quiet ink; hover uses the quiet surface and full ink.
- **Focus:** A 2px indigo outline with 2px offset.
- **Disabled:** Retains shape and drops to 42% opacity.

### Chips

- **Audience status:** Compact pill with neutral fill by default, pale indigo for active access, and rose for blocked or unavailable access.
- **Unread count:** Indigo pill with white tabular numerals.

### Cards / Containers

- **Conversation list:** Quiet surface with a hairline boundary.
- **Temporary panels:** Paper with a hairline left edge and restrained side shadow.
- **Message rows:** Open on the canvas; they are not boxed into chat bubbles.

### Inputs / Fields

- **Composer:** Paper field, 1px control border, 12px radius, and 12px by 14px padding.
- **Preview fields:** Slightly tighter 7px corners and a 40px minimum height.
- **Focus:** Uses the shared 2px indigo outline.

### Navigation

The charcoal rail uses line icons and a pale indigo active state. On mobile it becomes bottom navigation while the conversation list reduces to avatars; the active avatar carries the ink selection outline.

### Audience Header

The header pairs a concise title and status pill with an explicit sentence naming Project scope and readership. It remains the semantic anchor for every scenario, including blocked, archived, pending, and unavailable states.

### Message Feed

Messages are open text rows with circular initials, compact author/time metadata, and inline delivery or reply actions. Directed attention is a small indigo dot, never a per-person read receipt.

## Do's and Don'ts

### Do:

- **Do** keep Project scope and audience language explicit in the conversation header.
- **Do** use indigo sparingly for action, focus, selection, unread, and directed attention.
- **Do** preserve the one-pane mobile reflow and touch-sized exposed controls.
- **Do** describe prototype receipts, work handoffs, and message histories as synthetic behavior.

### Don't:

- **Don't** replace the existing charcoal rail and white operating canvas with a broad shell redesign.
- **Don't** turn messages into decorative speech bubbles or add ornamental color.
- **Don't** imply that the prototype proves persistence, authorization, delivery, task creation, Notes storage, or user acceptance.
- **Don't** hide audience context behind a details action or an off-canvas panel.
