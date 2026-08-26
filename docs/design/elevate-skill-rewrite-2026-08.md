# Prompt · rewrite the `elevate` skill from a week of evidence

Hand this to a fresh session. It is written to be pasted whole.

---

You are rewriting the `elevate` design skill. It has just been run hard for a
week across three separate product redesigns — Notes, Tasks and Timeline — in
three isolated sessions, by the same method, against the same bar. Forty-five
rounds of adversarial panel review, 1,358 findings, 919 fixes, and fifteen
published artifacts came out of it. Every one of those sessions rated the
method below 8/10 and named things it would change.

**Your job is not to summarise those opinions. It is to produce a rewritten
skill that a fourth engagement could run tomorrow without inheriting what
went wrong in the first three.**

The evidence is unusually good: three blind runs of one method, three
independent retrospectives, and three machine-readable records of every round.
Treat agreement across three isolated runs as the strongest signal available.
Treat the retrospectives as testimony from interested witnesses — each was
written by the session that ran the method and has a stake in its own work
looking well-governed.

---

## 1 · Read before you write anything

**The skill as it stands**

```
_wt-timeline-redesign/.claude/skills/elevate/
  SKILL.md, INSTALL.md
  references/  method.md · panel.md · gates.md · lessons.md ·
               register.md · artifacts.md · brief-template.md
  scripts/     panel-round.mjs · audit.mjs · interaction-skeleton.mjs ·
               shots.mjs · pack-shots.mjs · build-report.mjs ·
               build-console.mjs · verify-console.mjs · verify-artifact.mjs ·
               scaffold.mjs · lib.mjs
  assets/      report.shell.html · console.shell.html
  evals/       evals.json · RESULTS.md
```

An identical copy sits in `_wt-design-tasks/.claude/skills/elevate/`.

**The machine-readable record — this is the ground truth, not the prose**

```
_wt-design-notes/docs/design/labs/notes-2026-08/panel.json                14 rounds
_wt-design-tasks/docs/design/labs/tasks-2026-08/panel.json                19 rounds
_wt-timeline-redesign/docs/design/labs/timeline-redesign-2026-08/panel.json 12 rounds
```

Each holds every round's per-seat scores, every confirmed finding and every
refutation. Where a report and a `panel.json` disagree, the record wins. They
*do* disagree — one log quoted two different totals for its own work four
inches apart, and one retrospective quoted a third.

**The fifteen artifacts** — five documents per product. Read at minimum the
three retrospectives and the three "9.5 Question" documents.

| | Notes | Tasks | Timeline |
|---|---|---|---|
| CEO Report | `ad46252f-e1d6-48e3-b0cb-ecdd950280d4` | `457fc8fe-4171-41b0-ad45-a3ba8d993b85` | `30aa3dd7-97d7-4e4e-bfac-48d331488862` |
| Design Console | `23178180-3a00-4809-a08b-2c88bc6b1083` | `ec6277a9-49d3-4f69-a568-8fbb0c98f6c6` | `2939f1fe-3139-4e31-8edf-c85538d35d0f` |
| Elevation Log | `ecd1d852-3294-44b3-95e7-4582d57a2b25` | `1da5fc96-aae2-4980-8c79-f417ff30dc88` | `ae236f5f-b80f-4db0-aa51-bcda60090e19` |
| The 9.5 Question | `a70ffa75-d013-4e30-b62e-39cc7715e720` | `e58b1fcc-274d-43bf-9314-2af5bb435d7b` | `4be95a6e-fe0b-46fb-b2f7-c2c41a15f2f6` |
| The Method | `9764061d-9ae6-4a58-858b-b8e54060cd11` | `75144b7c-e8ad-46f8-a6a8-66e3208f12f6` | `cb05ac34-2d21-4cbe-8f6b-4367577a08dd` |

Prefix each with `https://claude.ai/code/artifact/`.

**The one loop that was already rebuilt mid-flight, and its diagnosis**

```
_wt-design-notes/docs/design/notes-gate-method-2026-08.md   why the old loop could not finish
_wt-design-notes/scripts/design/notes-gate-round.js         what replaced it at round 10
_wt-design-notes/scripts/design/notes-gates.mjs             three gates, one command
_wt-design-notes/scripts/design/notes-ledger.mjs            the closed-finding ledger
_wt-design-notes/scripts/design/family/                     the artifact family toolkit and its gate
```

The Notes engagement stopped mid-programme, diagnosed its own loop, and
replaced it. Rounds 12–14 under the new loop moved the floor further than the
nine rounds before it. **That is the single most useful natural experiment in
the whole week — read it closely, and check whether the improvement survives
scrutiny or is confounded by the benchmark change at round 8.**

---

## 2 · What the three engagements actually cost

Read from the three `panel.json` files. Verify these before you rely on them.

| | Notes | Tasks | Timeline |
|---|---|---|---|
| Rounds | 14 | 19 | 12 |
| Floor, first → last | 5.6 → 8.6 | 6.3 → 7.3 *(peak 8.6)* | 6.2 → 9.1 |
| Findings raised | 353 | 639 | 366 |
| Refuted and dropped | 106 (30%) | 218 (34%) | 115 (31%) |
| Confirmed and fixed | 247 | 421 | 251 |
| Behaviour assertions built | 676 | 360 | 845 |
| The method, self-rated | 7/10 | 6/10 | 7.5/10 |

**None of the three met the 9.5 gate. None of the three is in `src/`.** Forty-five
rounds produced three lab masters and zero shipped pixels. Whether that is a
failure of the method or of its scope is a question the rewrite has to answer
explicitly, because it determines whether the skill should own the port at all.

---

## 3 · Findings from the sessions that ran it — verify, do not accept

These are claims with round numbers attached. Check each against `panel.json`
before it earns a place in your rewrite. Where a claim is wrong, say so; that
is a more valuable finding than confirming it.

**A · The gate was arithmetically unreachable for nine rounds.** The seat
schema carried `findings: { minItems: 3 }`. Seven seats × three is 21, and the
observed minimum confirmed count across eight recorded Notes rounds is exactly
21. A seat that believed the work had reached the bar was still contractually
obliged to file three defects. *Check whether Tasks and Timeline carried the
same quota, and whether their floors show the same signature.*

**B · Near the top, the instrument cannot resolve the question.** Between Notes
rounds 13 and 14 the artifact strictly improved — twelve defects closed, the
gate up forty-five assertions, nothing regressed. Seven blind seats returned a
mean change of **+0.01** with individual seats moving **±0.5**, and the floor
did not move. The remaining distance to 9.5 was 0.9. One seat signed off at 9.5
in round 10 and un-signed three times afterwards on strictly better work.
*Only Notes measured this. If it holds, it governs every score in the other two
reports as well.*

**C · The loop manufactured its own defects.** Notes round 9: four of twenty
confirmed findings were caused by round 8's fixes — a 20% self-inflicted rate,
all of it from landing twenty-odd fixes in one batch and running the gates once
at the end. Tasks rounds 12–15: 53%, 39%, 54% and 68% of each round's confirmed
defect cost came from work built since the previous panel — *rising*. Tasks'
final two floors were both set by defects its own remediation introduced.
Timeline: four of the final round's findings were from the previous round's
fixes. **This is the failure mode all three hit independently.**

**D · Most of the fixing could not move the score.** The gate is the lowest
seat. Across eight Notes rounds the floor seat rotated through five different
seats, while every round dutifully fixed the findings of all seven.

**E · A finding was recorded closed that had never landed.** `seam-pick-desync`
was marked fixed at round 9; the patch script threw before writing, the gates
passed because nothing asserted it, and the panel found it again at round 12 —
counted as closed for three rounds. Running a gate after a fix is not the same
as proving the fix exists.

**F · The gate was blind in four ways, each worth more than the defect that
exposed it.** It proved pointer claims with a synthetic `Selection` instead of
real mouse and touch events, and so passed while the primary gesture was
completely broken. It ran no touch contexts. It checked contrast only at desk
widths, and missed a phone readback rendering the user's own dictated words at
**1.00 contrast**. It measured hit-target growth symmetrically only.

**G · It graded and shot work that was not the product.** The Notes shot
harness rendered three "rooms" from a query parameter matching no key in the
preset table, so all three silently fell back to the locked preset. Verified by
checksum: **36 of each room's 40 frames were byte-identical.** The four that
differed did so because the waveform used `Math.random()`. Every round shot and
committed 120 duplicate PNGs — 26MB — for three rooms that did not exist.

**H · The skill's own artifact assets shipped defects into all three
engagements.** `assets/report.shell.html` contained a score row that overflowed
a 390px phone by 222px, a `.askHead` rule outranked by `.brief p` so its margin
never applied, and a set-nav builder that threw on `null` the moment its markup
moved — which silently killed every script after it in the same block. All
three products inherited all three. **The skill's assets have no gate of their
own. That is a structural hole, not three coincidences.**

**I · One skill produced three incompatible report designs.** Two elevation
logs came out on paper and one came out dark; the cross-link block listed three
or four documents depending on who wrote it; two artifacts shipped with
identical titles. A shared identity had to be retrofitted afterwards
(`_wt-design-notes/scripts/design/family/`). Read that toolkit — its `set.json`
map, its generated rail, and especially `verify.mjs`, which is the shape of gate
the skill's artifacts never had.

---

## 4 · Interrogate rather than accept

- **Do the three ratings measure the same thing?** One session appears to have
  rated the method as an idea, one as it was configured, one as it stood at the
  start of the engagement. Compare what each was rating before comparing 6, 7
  and 7.5.
- **Tasks froze the surface to stop the self-inflicted churn.** It halved the
  cost per round and produced no climb — four frozen rounds read 8.3, 8.2, 8.2,
  7.3. Did freezing fail, or did it succeed at stopping decline while something
  else capped the score?
- **Timeline scored highest (9.1) in the fewest rounds (12) and rated the method
  highest.** Is that the method working, or the easiest surface? Compare the
  three products' state at round 1.
- **The bar changed mid-flight.** The benchmark set was swapped to Linear,
  Stripe, Vercel, xAI/Grok and SpaceX at Notes round 8 and the floor fell 8.2 →
  6.4. Should a running engagement's bar ever be mutable, and if so, how is
  score continuity preserved?
- **Is the seven-seat panel the right instrument at every altitude?** It was
  demonstrably excellent at finding defects and demonstrably unable to certify
  their absence. Consider whether the method needs two modes rather than one.

---

## 5 · Two experiments to run before you rewrite

Do not skip these. They are cheap and they settle the two questions everything
else hangs on.

**Experiment 1 — measure the noise floor directly.** Take one *unchanged* lab
master. Score it with fresh blind seats three separate times. Report per-seat
variance and floor variance. This tells you, as a number, the smallest score
difference the method can actually resolve — and therefore what terminating
conditions are legitimate. Only Notes attempted this, on a sample of one.

**Experiment 2 — plant a defect and see if the gate catches it.** Take a known,
serious, previously-found defect class from each product — a broken pointer
gesture, an invisible text colour, a control that does nothing — reintroduce it
deliberately, and run the current gates. Record what passes that should fail.
This is the only honest measure of what the automated half is worth, and it is
how the Notes contrast rule was validated: broken on purpose, watched to fail,
then restored.

---

## 6 · What to produce

1. **A rewritten skill, complete enough to run unchanged.** `SKILL.md`, the
   `references/`, the `scripts/`, the `assets/`. Not a diff, not advice — the
   thing itself, in place, so a fourth engagement can start from it.

2. **A terminating condition the measurement can resolve.** State it, and state
   *how you know* it is resolvable, citing Experiment 1. A method that cannot
   terminate is the most expensive defect any of these three found. Whatever you
   choose must survive the question: "could this be satisfied or missed by an
   unlucky draw of reviewers?"

3. **A gate for the skill's own assets.** Finding H is not three bugs, it is a
   missing gate. `_wt-design-notes/scripts/design/family/verify.mjs` is a
   working model: render every artifact at desk and phone widths, in light and
   dark, and assert on the result. The skill should not be able to ship a report
   shell that overflows a phone.

4. **A seeded defect library**, in the shape of the existing
   `references/lessons.md`, containing every failure mode above that survives
   your verification, so the next run's seats and refuters start where this
   week ended rather than rediscovering it.

5. **A removal list.** What you took out and why, so nothing quietly returns. Be
   specific about anything you are deleting that a session argued for.

6. **A disagreement register.** Where the three sessions conflict, say so
   explicitly and pick, with reasoning. Do not average them.

---

## 7 · Acceptance criteria

The rewrite is done when all of these are true, and you should say plainly
which ones you could not meet:

- [ ] The terminating condition is stated, and Experiment 1's numbers show the
      instrument can resolve it.
- [ ] No schema anywhere obliges a reviewer to invent a finding it does not
      have. A seat that believes the work is finished can say so and return
      nothing.
- [ ] The loop cannot mark a finding closed without something asserting it.
- [ ] Fix batching is bounded, with verification between batches, and the
      self-inflicted defect rate is a recorded metric on every round rather
      than something discovered in a retrospective.
- [ ] Effort is aimed at the binding constraint — the seats that set the floor —
      not spread evenly across seats that cannot move it.
- [ ] The gate proves interaction claims with real input events, on touch as
      well as pointer, and checks colour at every width it ships.
- [ ] The shot harness cannot silently render a state that does not exist, and
      cannot produce frames that differ between identical runs.
- [ ] The skill's own assets pass a gate before an engagement can use them.
- [ ] Two engagements run from this skill produce artifacts that read as one
      family without retrofitting.
- [ ] The skill states explicitly whether it owns the port into `src/`, and if
      not, what it hands over and to whom.
- [ ] `evals/` is updated so the changes are testable rather than asserted.

---

## 8 · Scope

**Do:** rewrite the skill in place, run the two experiments, use the three labs
as read-only evidence and as test subjects for Experiment 2 (revert anything you
break).

**Do not:** re-run the elevations; rewrite history in the three `panel.json`
records; convert the Notes and Tasks bespoke toolchains to the skill's scripts —
they predate it deliberately and converting them would destroy the very score
continuity that makes them evidence; touch `src/`; republish any of the fifteen
artifacts.

**Work from the record.** Every claim in your output should cite a round, a
number, or a file. "The panel felt slow" is worthless; "rounds 12–15 spent 54%
of confirmed defect cost on self-inflicted regressions" is actionable. Where the
evidence is thin, say the evidence is thin rather than reaching.

Report at the end with: the terminating condition and why it is resolvable, the
three most consequential changes, what you removed, where the three sessions
disagreed and how you decided, and which acceptance criteria you could not meet.
