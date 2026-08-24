Round 8 notes — what changed since you last saw this, and what not to
report as an oversight.

Round 7 fixed eighteen confirmed findings. The ones most likely to look
new to you:

- The field labelled WHEN in the owner's editor is now written by
  setAway(), the single writer of an item's distance, guarded on focus.
  A confirm on an unchanged field is a deliberate no-op.
- Undo of a move no longer throws; it restores focus to the stepper and
  returns the owner to the place they were standing when they made the
  change. Rename, hide and delete now restore focus too.
- The count in the gutter travels with the words it names; only the tick
  stays on the true pixel. Where a row is crowded, a leader runs down the
  rail to say which mark belongs to which row. This is a deliberate
  answer to a real question - argue with it if you disagree, but it is a
  decision, not an oversight.
- The two-column composition now begins at 1024 rather than 1280. The
  geometry inside it is unchanged.
- The contents of the docked editing sheet are capped to a 480px measure
  below 1024.
- "Try again" on the stalled load is wired, with its own live region.
- The ended link says "This link has ended", and its tense follows the
  clock.
- The printed sheet states the ceremonial date once.
- data-spacing is GONE. The console publishes three named decisions, not
  four, because the fourth was never implemented. Do not report its
  absence as a missing feature.
- There is a THIRTEENTH state, owner-undone. It exists so the
  reversibility bar renders filled and can be graded. It is a test
  fixture for the gate as much as a screen; judge it, but know why it is
  there.

Deliberately OPEN, carried from round 6, not an oversight and not a
regression: the owner cannot edit a moment once it has passed. It is a
build, and the last rounds are the wrong place for it. Do not spend a
finding on it.

Refuted in round 7, with reasons - do not simply re-raise these unless
you have new evidence the refuter missed:
- Moving the editor's reserved band to the foot (it puts the undo bar
  off screen and behind Delete in tab order).
- Adding a type breakpoint between 391 and 766 (the real breakpoint is
  701, and the proposed sizes are off the declared ramp).
- Demoting the today rule to spend indigo elsewhere (both the rule and
  the lead tick are named, ratified uses in the lock).
- Deleting one of the two statements of today (it reintroduces the
  unanchored-time defect a prior round paid for).
- Scrolling the measure to follow a move at desk width (the steppers do
  NOT hold still under scroll; it seats Delete under a repeat-press
  point).
- Raising the edit field to the row's type (the field is a single-line
  input; it cannot show a break at any size).
