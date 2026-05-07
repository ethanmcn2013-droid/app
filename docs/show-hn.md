# Show HN draft · Tasks

**Status:** Draft, ready when the user is. Time it for Tuesday morning,
9–10am ET (the slot HN's front page tends to reward).

**Posting checklist before submission:**

- [ ] `/principles` returns 200 in production
- [ ] `/changelog` is current (latest cycle pinned to top)
- [ ] `/pricing` shows the five tiers including Studio
- [ ] At least one published workspace at `/p/{slug}` for visitors to land on
- [ ] Sentry pager set; an unexpected front-page load shouldn't 500
- [ ] User is around to answer comments for the first 90 minutes

---

## Title (under 80 chars)

> Show HN: We rebuilt project management for the 80% who don't work in tech

**Alternates if the first one feels too on-the-nose:**

> Show HN: Tasks – the productivity app for everyone Linear isn't for
>
> Show HN: Tasks – per-workspace pricing, no sprints, free where it counts

Pick one. Don't A/B-test on Hacker News; just commit.

---

## Post body

Hi HN — I'm a designer who got tired of watching the people I know
bounce off productivity tools. The college student, the wedding
planner, the freelance developer juggling four clients, my mom
running a 200-guest event from a Google Sheet. They all need the
same thing the engineering teams underneath all the jargon really
need: a place to write what's on their plate, who's doing it,
when it's due, and a few clean ways to look at the same list.

So I built Tasks. It's at https://tasks.app. The pitch is short:

- **No vocabulary tax.** No sprints, no epics, no tickets, no story
  points. If you can name what you have to do, you can use the app.
- **Per-workspace pricing, never per-seat.** Inviting people is free.
  A wedding workspace fits the bride, groom, both moms, and the DJ
  for $9.95/mo flat — not $9.95 × 5.
- **Free where it counts.** One workspace, all four views (board /
  list / timeline / calendar), three editing guests, the daily digest,
  magic-link sharing — no time limit, no card, no degradation. We make
  money on depth, not on basics.
- **A real refusal list.** We publish what we will never build at
  /principles. No Gantt. No SSO as marketing copy. No AI agent that
  runs your tasks for you. No real-time push notifications. We took
  twenty years of productivity-software conventions and asked which
  ones the user actually wants. The answer was: surprisingly few.

A few things you can poke at:

- **The strikethrough manifesto:** /about. Sprints, epics, tickets,
  story points — the whole jargon liturgy with a line through it.
- **Twelve template URLs that double as SEO landings:** /templates.
  Each one is a destination page targeting a long-tail query
  ("wedding 3-month checklist", "freelancer tax season", "final paper
  outline"). The copy is in our voice; not Pinterest-spam.
- **Publishable workspaces:** /p/legacy. Any workspace can be
  published as a beautiful read-only page, branded by domain pack
  (wedding has serif and blush florals; freelance has code-on-paper
  mono; student has marker-on-corkboard sticky notes; marketing has
  Stripe-Press editorial). The point: every shared workspace is a
  marketing asset.
- **A self-aware changelog:** /changelog. Reads `CHANGELOG.md` at
  request time, parses the cycles, renders them. Built it that way
  so we'd never get caught with a stale "what's new" page. Latest
  entry: cycle 22 — a five-feature parallel-agent ship.
- **Pricing honesty:** /pricing. Free / $4.99 Pro / $9.95 per
  workspace Team (no per-seat tax) / $14.95 Studio (per-operator,
  unlimited workspaces — for the freelance dev with five clients) /
  $79 once for weddings.

The whole thing is a Next.js 16 app on Vercel, Drizzle + SQLite in
dev with a Postgres path planned, Clerk for auth, Stripe for
billing, Resend for the daily digest, Anthropic Haiku 4.5 for the
nudges that surface stuck cards (no AI agent that *closes* tasks —
that's on the refusal list).

It's free to try. The free tier is honest: one workspace, every view,
three editing guests, no card, no trial. If you're a college student
with a `.edu` address, Pro lands automatically for the semester.

Happy to answer questions about: the per-workspace pricing math, why
SSO is on the refusal list, what cycle 22's five-feature parallel-
agent ship actually looked like in practice, or anything else.

— [your handle]

---

## First-90-minutes comment plan

Don't pre-write canned answers. But know which questions you expect
and have one specific anecdote ready for each:

**"Won't the per-workspace model lose money on big teams?"**
> Yes — and that's the point. We chose the audience that wins under
> per-workspace pricing (small groups, individual operators) and
> accepted that we'll lose 200-person companies to Linear. Linear
> already has them.

**"Why no Gantt?"**
> Timeline view is the friendly cousin — visual sequencing without
> the cascading-dependencies-and-percent-complete-bars language of
> consultants. Gantt is enterprise theater. The audience we built
> for doesn't need it; the audience that needs it isn't us.

**"How is this different from Notion?"**
> Notion is a Lego set. Tasks is a tool. If you want to build a
> custom database with seven views and a Wiki, use Notion. If you
> want to write down what you have to do and look at it four ways,
> use Tasks. Both can be right; we picked the second job.

**"Will you build SSO?"**
> Maybe. Quietly. We won't put it on the pricing page. Companies
> that sell SSO are companies that sell fear. We may eventually
> build it for teams that need it, but it'll never be the upsell.

**"Where's the catch on free?"**
> There isn't one. Free is one workspace, every view, three editing
> guests, the daily digest, magic-link sharing — no time limit, no
> card, no degradation. We make money when teams scale up; we don't
> make money by squeezing solos. Manifesto pinned at /principles.

---

## What NOT to do

- Don't lead with the tech stack. The post isn't for engineers
  evaluating Next.js 16 vs. Remix; it's for engineers who'll forward
  the link to their non-engineer friend.
- Don't claim the tool is "AI-powered." It uses AI for nudges,
  that's it. The headline isn't AI.
- Don't argue with the inevitable "looks like Notion / Linear / Asana"
  comments. Acknowledge it's a crowded space; point to /principles.
- Don't reply within 30 seconds to every comment — you'll look
  desperate. Wait 5–10 minutes between replies for the first hour.
- Don't link "subscribe to my newsletter" at the bottom. The link
  to the app IS the call to action.
