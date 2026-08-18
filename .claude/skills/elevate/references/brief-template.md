# The engagement brief

The brief is the single carrier of context. The skill hard-codes no project
contracts, no brand, no product knowledge — everything an engagement needs
to know arrives through this one page, written with the operator before any
work starts. `scripts/scaffold.mjs` copies the template below into the lab
as `brief.md`; fill every section, delete nothing silently.

Two rules about restraint:

1. **Nothing binds unless the brief says it binds.** If the repo has design
   contracts, token laws, naming rules, review gates — they apply to this
   engagement only if listed under "What binds". Yesterday's decisions are
   inputs to choose, not walls to inherit.
2. **The method itself is not up for negotiation via the brief.** Blind
   seats, refuters defaulting to refuted, gates before round 1, driving
   from round 1, the unanimous gate, scores allowed to fall — these are the
   engine, and a brief that removes them has left the skill. What the brief
   controls is everything contextual: target, register, states, gate
   height, protected objects.

---

## brief.md template

```markdown
# Elevation brief · {name} · {yyyy-mm}

## Target
What is being elevated, in one paragraph. The product, the surface, and
the single job it does.

## Audience
Who operates this, in one sentence usable inside a review lens.
(This sentence is injected verbatim into the UX seat's lens.)

## Fixture
The real content the lab renders — named people, real dates, a pinned
clock. Never placeholder text. State where the fixture data comes from.

## States
The canonical list this engagement designs and grades (aim for 6–10; fold
from the product's full state space and record the folds):
- resting · dense · empty · loading · {…}

## Register and materials
Palette (exact hexes), families, weights, ladders — or "the default
register" (references/register.md). These values are copied into
elevate.config.json at the lock and enforced mechanically from then on.

## The gate
Default 9.5, unanimous, across the seven standard seats. State it here so
the number is a choice, not an inheritance.

## Decided — inherit, do not re-explore
Architecture or decisions this engagement starts from (a locked chrome, a
house composition). Empty for greenfield.

## Protected — elevate with a scalpel, never re-imagine
Objects that may be polished but not redesigned, with the reason and what
any change must survive. Empty if nothing is protected.

## Open — the actual exploration
What the directions phase genuinely explores.

## What binds
Project contracts that apply to THIS engagement, each with a pointer:
- (example) tokens file is vendored — propose additive tokens only
- (example) URL/naming contract — no retired route names in copy
Empty means: only the method binds.

## What is out of scope
Explicitly not this engagement's problem, so seats do not spend findings
on it.

## Delivery
Branch name · lab directory · artifact titles (console + log) · what
happens at lock-in (records, PRs, syncs — per the operator's process).
```

---

## Interviewing for the brief

When invoked conversationally ("elevate our pricing page"), draft the
brief FROM the conversation and the repo, then show it and ask only the
questions the draft cannot answer — typically: audience sentence, fixture
source, protected objects, gate height, and what binds. Do not interrogate
the operator through a form; arrive with the brief mostly written and let
them correct it. When the operator hands over a written brief, verify it
covers every section and proceed.
