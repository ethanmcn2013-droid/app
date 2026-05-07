# CHANGELOG syndication · cross-post templates

The /changelog renders itself by reading `CHANGELOG.md` at request
time. Each cycle is its own narrative entry, voice-matched, ~600
words. The syndication play: **cross-post one cycle entry to Hacker
News and Indie Hackers each Friday.** The angle is *"how we ship,"*
not *"what we shipped."* HN and IH respond to behind-the-scenes
operating notes, not feature lists.

## Cadence

- **Friday, 9–10am ET.** That's the slot most likely to land on the
  HN / IH front page through the weekend. Avoid Mondays (saturated)
  and Thursdays (HN gets defensive about back-to-back submissions
  from the same author).
- **One channel per cycle.** Don't cross-post the same week to both
  HN and IH; alternate. Saves you from looking like a spam bot.
- **Pick the cycle that has a real operating insight.** Not every
  cycle deserves a cross-post. Phase H wave 1 (CSV import + bulk-
  select) was tactical; Cycle 22 (five-feature parallel-agent ship)
  has an actual lesson worth posting.

## HN format

**Title (under 80 chars):**

> How we shipped 5 features in one cycle with parallel sub-agents
>
> 22 cycles, 27 sub-agent dispatches, 0 broken builds. What we learned.

Lead with the number. HN clicks on numbers.

**Body (~250-400 words):**

Stay terse. Open with one specific concrete moment. Avoid corporate
voice. End with a question (HN comments engage with questions far
more than declarations).

```
We've been shipping a small productivity tool [tasks.app] in weekly
cycles. This week's was the first time we ran 5 sub-agents in
parallel on non-overlapping file scopes — and it held.

Here's what made the difference:

1. **File-scope discipline.** Each agent owned exactly one or two
   files. The agent dispatching the iOS share-sheet feature couldn't
   touch the schema; the schema-touching agent couldn't touch any
   other agent's UI. No collisions in 27 dispatches across the
   sprint.

2. **A "trap" file in every domain.** When an agent stepped into a
   surface where we'd already learned a hard lesson (Turbopack
   doesn't pipe `next/og` Response under nodejs route handlers, only
   under the OG image file convention), we documented the trap
   in-file as a comment. Next agent inherits the lesson.

3. **Parallel-but-staggered for rate limits.** Five at once worked.
   Eight at once tripped the rate limit in an earlier cycle. Sweet
   spot was 4-then-4 batches with vertical-landing work in between.

The whole codebase is open: tasks.app/changelog reads itself, so
every cycle's full narrative is at /changelog.

Curious what others are doing with parallel sub-agents — what's
your file-scope pattern? Anyone running >5 agents reliably?
```

## Indie Hackers format

IH responds to commercial honesty. The post should foreground
*pricing, customer math, and revenue mechanics* more than HN.

**Title:**

> Why we charge per workspace, not per seat — and the math behind it

**Body (~300-500 words):**

```
We launched a productivity tool a few months ago [tasks.app]. The
single biggest call we made was per-workspace pricing instead of
per-seat. Here's what that means in practice — and where the math
held up vs. broke.

The pricing today:
- Free — 1 workspace, 3 editing guests
- Pro — $4.99/mo, unlimited workspaces (for one user)
- Team — $9.95/workspace/mo, unlimited members in that workspace
- Studio — $14.95/mo, unlimited workspaces YOU own (for operators)
- Wedding — $79 once, lifetime, for the workspace that matters most

The thinking: per-seat pricing makes inviting people a budget
decision, which kills group adoption. We'd rather a wedding
workspace fit the bride, groom, both moms, MOH, and DJ for $9.95
than charge them 6× $9.95 to do the same thing.

What worked:
- The wedding workspace is the clearest product-market fit we've
  found. Couples buy the $79 tier without needing convincing.
- Three free editing guests on every workspace (including the free
  tier) cut our paid-conversion friction. Study groups, couples,
  freelancer-and-client pairs all fit free.

What broke:
- Freelancers running 5 clients hit 5× $9.95 immediately on Team —
  $49.75/mo for what's structurally one operator's work. They were
  bouncing.
- Wedding planners running 10 weddings/year would need 10× $79 to
  use the product they already knew. Same problem.

The fix was a new tier: Studio at $14.95/mo, unlimited workspaces
the user owns as sole admin, full Team capabilities on every one.
We modeled it as a single user-level entitlement row that layers on
top of the per-workspace lookup. No per-workspace bookkeeping at
purchase or cancellation.

The lesson I'd hand to anyone building per-tenant pricing: name
your "operator" persona before you launch. They're the audience
that breaks per-tenant math.

Full pricing math + the reasoning is at tasks.app/pricing.

What's your per-tenant pricing edge case? What broke when you
launched it, and how did you fix it?
```

## What NOT to do

- Don't auto-post via API. The cycle entry should be hand-picked,
  not the latest one by default.
- Don't link to your own posts within the post. One CTA at the
  bottom (the URL of the relevant page) is enough.
- Don't reply to every comment within 30 seconds. Same rule as the
  Show HN.
- Don't cross-post to LinkedIn the same day. Spread it out.
