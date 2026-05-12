// AUTO-GENERATED — do not edit by hand.
// Source: studio/src/lib/templates/ (canonical workspace templates).
// Refresh: pnpm sync:templates
// Strategy: studio/docs/TEMPLATES_STRATEGY.md (locked 2026-05-12)

import type { Template } from "./templates";

export const SYNCED_TEMPLATES: Template[] = [
  {
    "id": "wedding-planning-workspace",
    "name": "Wedding planning workspace",
    "description": "The venue, supplier, guest, decision, and final-week work in one calm list.",
    "icon": "target",
    "domain": "wedding",
    "tasks": [
      {
        "title": "Venue contract and deposit schedule recorded",
        "lane": "done",
        "priority": "p1",
        "tags": [
          "venue",
          "decision"
        ]
      },
      {
        "title": "Ceremony room layout agreed with venue",
        "lane": "done",
        "priority": "p1",
        "tags": [
          "venue",
          "ceremony"
        ]
      },
      {
        "title": "Confirm final guest numbers",
        "lane": "doing",
        "priority": "p0",
        "due": "Today",
        "tags": [
          "guests"
        ]
      },
      {
        "title": "Confirm supplier arrival times",
        "lane": "doing",
        "priority": "p0",
        "due": "Tomorrow",
        "tags": [
          "suppliers",
          "blocked"
        ]
      },
      {
        "title": "Send menu decisions to catering",
        "lane": "doing",
        "priority": "p1",
        "due": "Fri",
        "tags": [
          "catering"
        ]
      },
      {
        "title": "Book final-week venue walkthrough",
        "lane": "doing",
        "priority": "p1",
        "due": "Fri",
        "tags": [
          "venue",
          "final-week"
        ]
      },
      {
        "title": "Review seating chart with venue",
        "lane": "review",
        "priority": "p1",
        "tags": [
          "guests",
          "venue"
        ]
      },
      {
        "title": "Review ceremony order with officiant",
        "lane": "review",
        "priority": "p1",
        "tags": [
          "ceremony",
          "decision"
        ]
      },
      {
        "title": "Confirm weather backup plan",
        "lane": "review",
        "priority": "p1",
        "tags": [
          "risk",
          "venue"
        ]
      },
      {
        "title": "Build supplier contact sheet",
        "lane": "todo",
        "priority": "p1",
        "tags": [
          "suppliers"
        ]
      },
      {
        "title": "Collect final dietary notes",
        "lane": "todo",
        "priority": "p1",
        "tags": [
          "catering",
          "guests"
        ]
      },
      {
        "title": "Confirm family photo list owner",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "photo",
          "owner"
        ]
      },
      {
        "title": "Share draft day-of timeline with suppliers",
        "lane": "todo",
        "priority": "p1",
        "tags": [
          "suppliers",
          "timeline"
        ]
      },
      {
        "title": "List final supplier payments",
        "lane": "todo",
        "priority": "p1",
        "tags": [
          "payments"
        ]
      },
      {
        "title": "Prepare wedding morning kit list",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "final-week"
        ]
      },
      {
        "title": "Write one-page update for couple and suppliers",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "update"
        ]
      },
      {
        "title": "Capture decisions still open",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "decision"
        ]
      },
      {
        "title": "Create post-wedding collection list",
        "lane": "todo",
        "priority": "p3",
        "tags": [
          "after"
        ]
      }
    ]
  }
];

export const SYNCED_TEMPLATE_IDS = new Set<string>(
  SYNCED_TEMPLATES.map((t) => t.id),
);
