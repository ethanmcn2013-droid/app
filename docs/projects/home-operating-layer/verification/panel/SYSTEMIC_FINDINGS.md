# Systemic findings — what two panel rounds proved is not a direction's fault

**Rounds:** 1 (`90f71e5`) and 2 (`dd94bec`), ten sealed directors each, blind labels, no shared
ballots, no threshold disclosed.

## Where the two rounds landed

| Direction | R1 floor → R2 floor | R1 mean → R2 mean | R2 verdicts | Admitted |
|---|---|---|---|---|
| Editorial Line | 6.4 → **7.6** (+1.2) | 8.17 → **8.41** | 5 pass / 5 revise | no |
| Signal Desk | 6.8 → **7.4** (+0.6) | 7.97 → **8.46** | 4 pass / 6 revise | no |
| Reading Index | 7.7 → **6.9** (−0.8) | 8.37 → 8.12 (−0.25) | 3 pass / 7 revise | no |
| Context Rail | 5.0 → 6.1 (+1.1) | 6.81 → 7.71 | **0 pass / 9 revise / 1 veto** | no |

Remediation moved means. It did not move floors to 8.5. Reading Index went **backwards**, which
is its own signal: it was the round-1 leader and the changes cost it more than they bought.

## Four concerns hit all four directions independently

A fault found by ten independent directors in **every** candidate is not something four separate
teams each got wrong. It is in the shared material: the shell, the fixtures, or the brief.

| Theme | Mentions | Directions affected | Whose fault |
|---|---:|---|---|
| The new-user screen | 21 | **4 of 4** | The **shell**. See below. |
| Unused width at 1440 | 44 | **4 of 4** | The **lab brief**. See below. |
| Mobile composition | 30 | **4 of 4** | Shared — the brief set the bar but gave no worked example. |
| Page length / becomes a task wall | 19 | **4 of 4** | Shared — no cap was specified below the ranked three. |
| Unlabelled marks needing a legend | 18 | 4 of 4 (Desk 11) | Mostly Desk's own. |

### 1. The new-user screen is a shell defect, not a design failure

All four render a person's first ever screen as a **failed read** — "Could not be read", "Home
could not read any project at this scope" — because `assembleCandidateProps` resolves the
`new_user` world to `state: "unavailable"`. Scope resolution finds nothing and reports that as an
error.

It is not an error. A person with no Projects has not suffered a failed read; they have not
started yet. Rendering absence-of-setup as failure-of-read is the same class of mistake this
programme exists to prevent, pointed the other way: it renders **not yet** as **broken**.

Editorial Line alone wrote around it, adding a "Where to start" section with one plain sentence
and an Open Tasks control. A director called that *"the single best decision anyone made in this
lab"* and said the other three should be made to match it. They should not have had to work
around the shell to get there.

**Owner: lead.** The shell must distinguish *nothing configured yet* from *a read that failed*,
and the `HOME_EXPERIENCE` contract must name it as a distinct state.

### 2. Unused width at 1440 is the brief's fault

Forty-four mentions across every direction: dead space to the right, "never earns its width",
"behaves identically at 740px and 1440px".

`LAB_BRIEF.md` told them Today is "a narrow authored read", Analytics is "prose-led, widening once
for the Project ledger", and cited a 720–780px measure from the approved architecture. Four teams
followed the brief and ten directors marked all four down for following it.

The brief was right that Today should not be a task wall and wrong to leave "what the other 600
pixels are for" unanswered. A narrow measure is a decision about *text*; it is not a decision
about the *page*.

**Owner: lead.** The brief needs amending to say what the full width is for, rather than implying
it should stay empty.

## Consequence for Context Rail

Vetoed in round 1 and again in round 2, with **zero Pass votes across twenty ballots**. Directors
say that stripped of content it is any competent SaaS shell, and that it has no signature of its
own — a criticism about what the direction *is*, not about defects it could fix.

The master brief §12.9 anticipates exactly this: *"If one cannot pass after principled iteration
without converging on another, replace it with a new structural direction rather than omit it or
lower the gate."*

Two principled iterations have happened. Rail is the candidate to replace, not to repair again.

## What does not change

The gate. Every director at least 8.5 overall and at least 8.5 on their own lens, zero vetoes.
Two failed rounds are an argument for fixing the shared material and replacing a spent direction,
never for moving the bar.
