# The first-contact test

The instrument for priority 3 of the north star (`AGENTS.md` §North star):

> Someone who has never used a project-management tool must be able to pick
> this up and understand it unaided. No jargon, no technical lock-out; a
> surface that needs explaining is not done.

## Why this exists separately from the 9.5 gate

The 13-dimension rubric is good and it does not cover this. Its closest
dimensions — `purpose-and-task-clarity` and `information-architecture` — are
scored by specialists who already know the product. A specialist rating
clarity at 4 is a different claim from a newcomer succeeding alone, and only
the second one is the bar the operator set.

The rubric also cannot absorb a fourteenth dimension: the receipt schema at
`experience/schemas/quality-council-product-receipt.schema.json` pins
dimensions at `minItems: 13, maxItems: 13`, so extending it would invalidate
every receipt ever written. This test therefore stands beside the gate, not
inside it.

It is deliberately cheap. The 9.5 gate needs 120 assessment units, hash-bound
evidence, and at least three independent reviewers per receipt. This needs one
person, forty-five minutes, and no lab.

## Two halves

**The automated half** — `pnpm first-contact:language`, run in CI on every
change. It scans rendered copy for vocabulary that assumes the discipline
(backlog, sprint, WIP) or the stack (payload, endpoint, boolean). It reads JSX
text, string props, template literals, and strings inside JSX expressions;
identifiers and types are out of scope, because `assigneeId` is not copy.

It understands refusal: "Nothing here says sprint or stakeholder" is the brand
voice working, not a violation, and is not reported. Known debt is baselined
in the script and may only shrink — a new occurrence fails, and so does a
baselined one that quietly disappears without the list being updated.

What it cannot see: copy assembled at runtime by server modules (Signal's
briefing prose is generated in `src/modules/signal/lib/briefing/prose.ts`),
and words that are individually plain but collectively confusing. Those are
the human half's job.

**The human half** — the eight-step walk below. Automation cannot tell you
whether someone understood; it can only tell you whether you used a word they
would not know.

## Recruiting

One participant. The qualification is negative, and it is the whole point:

- has never used Jira, Asana, Monday, Linear, Trello, Notion, or ClickUp;
- does not work in software, design, or product;
- is not a friend who will be kind about it.

A person who has used any of those tools is testing recognition, not
comprehension, and will pass surfaces a true newcomer fails.

## The walk

Eight steps, in this order, mirroring the cross-suite journey the quality
council already recognises (Notes → Tasks → Timeline → Signal). Give the goal
in the participant's language, never the product's. Never say the name of the
button.

| # | Say this | Passing looks like |
|---|---|---|
| 1 | "Have a look. What do you think this is for?" | Describes something like organising work, without reading the marketing. |
| 2 | "Write down something you need to remember." | Reaches capture without being shown where. |
| 3 | "Turn that into something you'll actually do." | Finds the path from a note to a task unaided. |
| 4 | "Say when it needs doing." | Sets a date without opening the wrong control twice. |
| 5 | "Show me everything you've got on." | Reaches a view of all work and can say what the columns mean. |
| 6 | "Move that one along." | Changes state by drag or control, and can tell you what changed. |
| 7 | "What's coming up, and what needs you today?" | Distinguishes Timeline from Signal by what they answer, not by name. |
| 8 | "Send this to someone else." | Completes a share and can say who will see what. |

## Rules for whoever runs it

1. **Do not help.** Not a hint, not a glance at the right corner. The moment
   you help, that step is a fail and the rest of the walk is contaminated.
2. **Ask them to think aloud.** Silence is data you cannot read later.
3. **Write the hesitation, not just the outcome.** "Found it, after hunting
   the top bar for nine seconds" is the finding. "Pass" is not.
4. **Collect every word they query.** Any word they stop on goes into the
   script's term list, or the copy changes. This is how the automated half
   gets smarter.
5. **Stop at forty-five minutes** even if steps remain. Where you stopped is
   itself a result.

## Verdict

Each step is scored one of four ways:

- **Unaided** — completed without help.
- **Recovered** — went wrong, noticed, and fixed it without help. Passes.
- **Needed help** — required a hint. **Fails.**
- **Failed** — could not complete.

Fail closed, matching the 9.5 gate's posture: **any step scored Needed help or
Failed fails the surface it belongs to.** There is no averaging and no partial
credit, because a newcomer who needs one hint is a newcomer who would have
left.

A surface that fails gets a finding recorded here with the participant's own
words, and the fix ships before the surface is called done.

## Cadence

Run the human half when a first-contact surface changes materially, and at
minimum once per north-star review period (~six months, per
`studio/content/hq/decisions/product-north-star.md`). The automated half runs
on every change with no cadence to remember.

## Results

No walk has been run yet. The instrument was built 2026-08-01, the same cycle
the north star was set; the automated half is green at a 15-occurrence
baseline, of which 10 are correct refusals and 5 are recorded debt awaiting an
operator ruling on the plainer word. Findings land below, newest first.
