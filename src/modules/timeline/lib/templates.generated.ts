// AUTO-GENERATED, do not edit by hand.
// Source: studio/src/lib/templates/ (canonical workspace templates).
// Refresh: pnpm sync:templates
// Strategy: studio/docs/TEMPLATES_STRATEGY.md (locked 2026-05-12)

export type SyncedTemplateRoadmap = {
  id: string;
  name: string;
  roadmap: {
    projects: Array<{
      slug: string;
      name: string;
      oneLiner: string;
      accent?: string;
    }>;
    items: Array<{
      projectSlug: string;
      title: string;
      description: string;
      status: "shipped" | "in-flight" | "next" | "waiting" | "refused";
      targetDate?: string;
      /** Days from the seed's anchor date, negative meaning before it. */
      anchorOffsetDays?: number;
    }>;
    /** Declared when this template's plan points at one known day. */
    anchor?: {
      label: string;
      prompt: string;
      hint?: string;
    };
  };
};

export const SYNCED_TEMPLATE_ROADMAPS: SyncedTemplateRoadmap[] = [
  {
    "id": "wedding-planning-workspace",
    "name": "Wedding planning workspace",
    "roadmap": {
      "anchor": {
        "label": "The wedding day",
        "prompt": "When is the wedding?",
        "hint": "Every milestone below is placed relative to this day. You can move any of them afterwards."
      },
      "projects": [
        {
          "slug": "planning",
          "name": "Planning Roadmap",
          "oneLiner": "What is decided, what is moving, and what needs attention before the day.",
          "accent": "rgb(190 24 93)" // ds-allow: CSS variables cannot safely cross the generated serialization boundary.
        }
      ],
      "items": [
        {
          "projectSlug": "planning",
          "title": "Venue contract and deposit schedule",
          "description": "Locked at booking. Final-week walkthrough date confirmed.",
          "status": "shipped",
          "anchorOffsetDays": -300
        },
        {
          "projectSlug": "planning",
          "title": "Ceremony room layout agreed",
          "description": "Venue, couple, and officiant have signed off on aisle direction, seating block, and signing-table placement.",
          "status": "shipped",
          "anchorOffsetDays": -150
        },
        {
          "projectSlug": "planning",
          "title": "Confirm final guest numbers",
          "description": "Couple to confirm the final headcount before the venue locks table layout and catering quantities.",
          "status": "in-flight",
          "anchorOffsetDays": -45
        },
        {
          "projectSlug": "planning",
          "title": "Supplier arrival times need confirmation",
          "description": "Photographer, florist, and band arrival times are not all confirmed yet. This is the main planning risk.",
          "status": "waiting",
          "anchorOffsetDays": -30
        },
        {
          "projectSlug": "planning",
          "title": "Menu decisions sent to catering",
          "description": "Venue has sent the couple's menu decisions to catering and is waiting for final dietary notes.",
          "status": "in-flight",
          "anchorOffsetDays": -25
        },
        {
          "projectSlug": "planning",
          "title": "Final-week walkthrough",
          "description": "Venue, planner, and couple walk through room setup, ceremony flow, supplier access, and backup weather plan.",
          "status": "next",
          "anchorOffsetDays": -6
        },
        {
          "projectSlug": "planning",
          "title": "Day-of timeline shared with suppliers",
          "description": "One-page run of show with arrival windows, ceremony cue, meal service, and band start time. Goes to every supplier.",
          "status": "next",
          "anchorOffsetDays": -4
        },
        {
          "projectSlug": "planning",
          "title": "Weather backup plan confirmed",
          "description": "Indoor ceremony fallback + supplier coverage if outdoor ceremony moves inside. Venue holds the final call.",
          "status": "next",
          "anchorOffsetDays": -2
        }
      ]
    }
  },
  {
    "id": "local-business-monthly-rhythm",
    "name": "Monthly business rhythm",
    "roadmap": {
      "projects": [
        {
          "slug": "monthly-rhythm",
          "name": "Monthly rhythm",
          "oneLiner": "What is closed, what is paying, what is moving, and what is owed before month-end.",
          "accent": "rgb(14 116 144)" // ds-allow: CSS variables cannot safely cross the generated serialization boundary.
        }
      ],
      "items": [
        {
          "projectSlug": "monthly-rhythm",
          "title": "Revenue close",
          "description": "All takings reconciled. Bank deposits checked against till totals. Variance under one percent.",
          "status": "shipped"
        },
        {
          "projectSlug": "monthly-rhythm",
          "title": "Payroll run",
          "description": "Staff paid on the agreed date. Tax filings updated. Holiday accruals current.",
          "status": "shipped"
        },
        {
          "projectSlug": "monthly-rhythm",
          "title": "Supplier invoices approved",
          "description": "All supplier invoices for the month reviewed and queued for payment before the 28th.",
          "status": "in-flight"
        },
        {
          "projectSlug": "monthly-rhythm",
          "title": "Stock reorder",
          "description": "Items running low this week reordered. Lead times confirmed for next month's promotions.",
          "status": "in-flight"
        },
        {
          "projectSlug": "monthly-rhythm",
          "title": "Marketing post for the month",
          "description": "One post that names what is on this month, scheduled for the audience. Not all of them at once.",
          "status": "in-flight"
        },
        {
          "projectSlug": "monthly-rhythm",
          "title": "Renewal review",
          "description": "Supplier or service contract coming up for renewal. Terms reviewed before any auto-renew kicks in.",
          "status": "waiting"
        },
        {
          "projectSlug": "monthly-rhythm",
          "title": "Rota for next month",
          "description": "Next month's staffing pattern locked. Cover lined up for holidays. Training session date held.",
          "status": "next"
        },
        {
          "projectSlug": "monthly-rhythm",
          "title": "Staff one-to-ones",
          "description": "Thirty minutes with each staff member. What is going well, what is hard, one ask. Not skipped this month.",
          "status": "next"
        },
        {
          "projectSlug": "monthly-rhythm",
          "title": "Accountant summary",
          "description": "Month's revenue, payroll, supplier spend, and any one-off costs sent to the accountant in plain English.",
          "status": "next"
        }
      ]
    }
  }
];

export const SYNCED_TEMPLATE_IDS = new Set<string>(
  SYNCED_TEMPLATE_ROADMAPS.map((t) => t.id),
);

export function getSyncedTemplateRoadmap(id: string): SyncedTemplateRoadmap | undefined {
  return SYNCED_TEMPLATE_ROADMAPS.find((t) => t.id === id);
}
