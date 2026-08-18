# The paid-for defect library

490 findings were raised across the two proving engagements; 321 survived
adversarial refutation and were fixed. This file is the distillation. Use
it two ways: seed every seat with it (the BAR links here so no round
rediscovers these classes from scratch), and treat it as the checklist a
master must survive BEFORE its first panel round — every class below cost
real score once already.

## Interaction and keyboard

- **Repaints that annihilate place.** Any state change that rebuilds the
  surface must capture and restore, in the same frame: every scroller's
  position, the horizontal scroll, and the exact element that held focus.
  One tick on a phone once threw the board from Done back to To Do.
- **Keyboard models advertised but not implemented.** If the accessible
  name says "movable" and the specimen sheet draws a picked-up state, the
  keys must exist. Advertising is a promise; the panel checks promises.
- **Hijacked contract keys.** Space on a role=checkbox ticks it. Enter on
  a menu button opens the menu. A labelled control performing an
  unrelated, unannounced, irreversible action is the worst keyboard
  defect class there is.
- **Invisible-but-focusable controls.** A control at zero opacity must be
  inert. A keyboard user tabbing onto an invisible button is lost.
- **Roving tab stops.** A dense surface is one tab stop per region with
  arrows inside, or crossing it costs a hundred presses. And the roving
  model must reach EVERY item — a per-column rover once made 27 of 32
  cards unreachable.
- **Nothing reversible.** The surface's most frequent action needs an
  undo with a keyboard binding, and a place it lives (one reversibility
  surface, not toasts scattered about). Anything committed without a way
  back is a defect, not a design choice.
- **Dead-end filters.** A filter that can empty the screen must state
  itself, offer the way out, release itself when moot, and never destroy
  the control that would undo it. Header counts must say what they still
  describe while a filter hides things.
- **Focus that leaves the screen.** Keep the focused element scrolled
  into view through every move; play animations inside the visible area.

## Typography

- **Mid-word clamps.** Browser line-clamp cuts at the character
  ("dinner 5.30p…"). Trim to the last whole word, keep the full string in
  the accessible name and tooltip.
- **Silent content deletion.** A trim that runs once at first paint —
  before webfonts swap — and never again produces complete-looking
  sentences with the middle missing. Trims must be idempotent (restore
  from the full string first) and re-run on fonts.ready, resize, and
  every repaint. Zero silent clips is an assertable property.
- **Simultaneous truncation.** When a row overflows, its parts must yield
  in a stated order; three items each shrinking proportionally produces
  "Mara & …  High pri…". The identity item never shrinks.
- **The measure has a floor AND a ceiling.** A card documented at 254px
  that renders at 105px when a drawer opens is broken at a width nobody
  screenshotted. Check 1280 as well as 1440; frames only at one width hide
  this class entirely.
- **A person's words outrank the machine's.** Wherever user content
  appears beside metadata, the person's words get the larger, denser type
  and the first line.

## Information and honesty

- **Self-contradicting counts.** Every fact on the surface derives from
  the rendered data through ONE accessor. A header saying "5 of 32 done"
  above a tray labelled 9 is the credibility of the whole product spent.
- **One grammar per fact.** One scan once carried four grammars for one
  fact (elapsed, deictic, weekday, date). Pick one; the fill or weight
  carries the condition, the text carries the value.
- **Unanchored time.** If anything shows a date, somewhere on screen
  states today. "14 Jul" must never require arithmetic to feel.
- **State carried only visually.** Ink density, fill, and position are
  presentational; the same fact must exist in words in the accessible
  name. Named regions, real headings, a true accessibility tree.
- **Empty states with one first move.** An empty surface offers exactly
  one instruction, once — not four templated "Nothing here" lines. Every
  other empty region says something true about what belongs there.
- **Loading that promises the truth.** Skeletons show only sections that
  will actually render, sized to their real geometry, honouring the
  reserve floor (one row, never two). Shimmer and invented sections lie.

## Composition

- **Floating objects erase what is under them.** A dock, drawer, or pill
  gets its band reserved in real layout, or it will eat controls at some
  density. Scrims that blur the damage are not a fix.
- **Overflow is designed or it is a guillotine.** Any edge that can clip
  gets a measured fade or snap — measured after layout, so a fade means
  something is actually hidden — never an always-on decoration, never a
  mid-word slice.
- **Panels that open must not delete columns.** Opening a drawer re-lays
  the surface; the surface must state what no longer fits (scroll + snap)
  rather than silently cropping a region out of existence.
- **The undesigned edge.** The bottom of a scrolling region, the
  1000–1279px band, the state after the last item is removed — the places
  nobody screenshots are where the panel looks first.

## Craft plumbing (the Measured seat's classics)

- State rules declared after interaction rules at equal specificity
  silently kill hover and focus for those states. Route every ring through
  one custom property; declare interactions last.
- Anchors without href have no role. Navigation is buttons or real links,
  with aria-current.
- Global focus rules must set outline and NOTHING else (one once squared
  every pill in the product for keyboard users).
- Overflow:hidden creates a formatting context; a float will stand beside
  the whole block, stealing width from every line, not just the first.
- Fixture names leak ("DO" initials for "Demo operator"). Content is a
  named person or it is a bug.

## Process lessons (encoded in the method, listed for why)

- Gates before round 1; the round-5 crash of the first engagement was the
  cost of building them at round 6.
- Grade by driving from round 1; frames alone hide every place-keeping,
  announcement and dead-control defect above.
- Verify each fix rendered; one fix aimed at the wrong file was recorded
  as done and double-billed the next round.
- Push after every round; a full engagement once existed only on one
  machine for three hours.
- Republish both artifacts every round; the timestamps are the only
  progress signal a founder can read remotely.
- Scores may fall. Round 3 of the first engagement dropped UI composition
  while UX rose; the panel finding a new dominant defect is the system
  working. A round where every seat rises is a round where nobody looked.
