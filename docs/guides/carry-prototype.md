# The carry — the exact change, as prototyped

Applied to a duplicate of the composed suite artifact and verified working:
`startViewTransition` fires once per switch, both names resolve, no console
errors, and the departing product's scroll, focus and state survive intact.

Live prototype (toggle CARRY / CUT bottom-right):
https://claude.ai/code/artifact/04b8af94-c7eb-4a39-a7ff-1978078be2f8

The whole change is below. Nothing else in the suite was touched.

## 1 · `app.js` — wrap the mutation, never postpone it

Rename the existing `apply()` to `applyNow()`, and add:

```js
function apply() {
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !document.startViewTransition) return applyNow();
  document.startViewTransition(applyNow);
}
```

It **wraps** the mutation and never delays it. A transition that postponed
the switch would trade away the thing the mount-all-three architecture
exists to provide. No support, or reduced motion, and it is exactly the
current hard cut.

## 2 · Two names, and the timing

```css
.sheet                 { view-transition-name: sheet; }
.railTile[data-active] { view-transition-name: rail-active; }

::view-transition-group(sheet),
::view-transition-group(rail-active) {
  animation-duration: 220ms;                              /* --t-slow */
  animation-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
}

/* Fade THROUGH, not across. The browser's default runs both snapshots at
   50% through the middle; two dense text layouts at half opacity read as
   mud rather than as a change. Outgoing gone by 40%, incoming from 40% on,
   so they never overlap. The sheet and rail tile still carry for the full
   220ms underneath — only the genuinely-new content fades. */
::view-transition-old(sheet) { animation: carry-out  88ms cubic-bezier(.4,0,1,1) both; }
::view-transition-new(sheet) { animation: carry-in  132ms cubic-bezier(0,0,.2,1) 88ms both; }
@keyframes carry-out { to   { opacity: 0; } }
@keyframes carry-in  { from { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .sheet, .railTile[data-active] { view-transition-name: none; }
}
```

Only one sheet is rendered at a time — the other two products are `hidden`,
so they are not painted and cannot collide on the name. That is what makes a
single static name safe here.

## Why it is this cheap

Because the composed suite already mounts all three products at once and
never tears one down, both the outgoing and incoming sheets are in the same
document at the moment of the switch. That makes this the *same-document*
form of a shared-element transition: no navigation, no `@view-transition`
at-rule, no two-page opt-in, no same-origin question, and none of the
programmatic-navigation exclusion that would have blocked the previous
`window.location.href` architecture.

The redesign did the expensive part. This is the cheap part nobody has spent
yet.
