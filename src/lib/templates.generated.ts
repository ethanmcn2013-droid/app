// AUTO-GENERATED, do not edit by hand.
// Source: studio/src/lib/templates/ (canonical workspace templates).
// Canonical revision: studio@ed02bc831894eb93b36f69f5b820a4727a9e2bb3
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
  },
  {
    "id": "local-business-monthly-rhythm",
    "name": "Monthly business rhythm",
    "description": "Month-end close, payroll, suppliers, marketing, staff one-to-ones, a cadence that holds a small operation together.",
    "icon": "calendar",
    "domain": "marketing",
    "tasks": [
      {
        "title": "Month-end revenue close, all takings reconciled",
        "lane": "done",
        "priority": "p1",
        "tags": [
          "close",
          "books"
        ]
      },
      {
        "title": "Payroll run for the team",
        "lane": "done",
        "priority": "p1",
        "tags": [
          "payroll",
          "people"
        ]
      },
      {
        "title": "Approve supplier invoices for this month",
        "lane": "doing",
        "priority": "p0",
        "due": "Today",
        "tags": [
          "suppliers",
          "books"
        ]
      },
      {
        "title": "Send marketing post for the month",
        "lane": "doing",
        "priority": "p1",
        "due": "Fri",
        "tags": [
          "marketing"
        ]
      },
      {
        "title": "Reorder the supplies running low",
        "lane": "doing",
        "priority": "p0",
        "due": "Tomorrow",
        "tags": [
          "suppliers",
          "stock"
        ]
      },
      {
        "title": "Pay the bills due before the 28th",
        "lane": "doing",
        "priority": "p0",
        "due": "Mon",
        "tags": [
          "books"
        ]
      },
      {
        "title": "Review the rota for next month",
        "lane": "review",
        "priority": "p1",
        "tags": [
          "people",
          "rota"
        ]
      },
      {
        "title": "Walk the floor with the front-of-house lead",
        "lane": "review",
        "priority": "p1",
        "tags": [
          "people",
          "ops"
        ]
      },
      {
        "title": "Renewal coming up, review terms before signing",
        "lane": "review",
        "priority": "p1",
        "tags": [
          "renewal",
          "books"
        ]
      },
      {
        "title": "Staff one-to-ones for the month",
        "lane": "todo",
        "priority": "p1",
        "tags": [
          "people"
        ]
      },
      {
        "title": "Update the till float and weekly cash limit",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "ops",
          "books"
        ]
      },
      {
        "title": "Email the accountant the month's summary",
        "lane": "todo",
        "priority": "p1",
        "tags": [
          "books"
        ]
      },
      {
        "title": "Schedule next month's marketing posts",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "marketing"
        ]
      },
      {
        "title": "Refresh the menu / window display / waiting-room board",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "ops"
        ]
      },
      {
        "title": "Plan the staff training session for the quarter",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "people",
          "training"
        ]
      },
      {
        "title": "Review last month's reviews and complaints",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "ops",
          "customer"
        ]
      },
      {
        "title": "Confirm cover for owner days off",
        "lane": "todo",
        "priority": "p2",
        "tags": [
          "people",
          "rota"
        ]
      },
      {
        "title": "Write the one-line update for the staff group",
        "lane": "todo",
        "priority": "p3",
        "tags": [
          "update"
        ]
      }
    ]
  }
];

export const SYNCED_TEMPLATE_IDS = new Set<string>(
  SYNCED_TEMPLATES.map((t) => t.id),
);
