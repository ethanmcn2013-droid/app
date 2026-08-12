/**
 * appearance-radiogroup.test.ts — the theme picker's keyboard contract.
 *
 * The Appearance section announces `role="radiogroup"` with three
 * `role="radio"` cards. That announcement is a promise about the keyboard:
 * one tab stop for the group, arrows that move focus and selection together
 * and wrap, Home/End, Space to select. Wave 6 found the promise unkept —
 * three tab stops, dead arrows, and radios that hard-disabled mid-write and
 * dropped the reader's focus to the body.
 *
 * The two pure helpers carry that contract, so it is provable without a
 * browser. The DOM stub below drives them exactly as handleRadioKeyDown
 * does; the source assertions cover the wiring a pure function cannot see.
 *
 * Run:
 *   node --import tsx --import ./src/test/register-server-only.mjs --test \
 *     src/components/app/settings/sections/appearance-radiogroup.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { radioGroupKeyTarget, rovingTabIndex } from "./appearance";

const SOURCE = readFileSync(
  path.join(
    process.cwd(),
    "src",
    "components",
    "app",
    "settings",
    "sections",
    "appearance.tsx",
  ),
  "utf8",
);

// The real group: system, light, dark.
const COUNT = 3;

describe("theme radiogroup: arrow keys move focus and selection", () => {
  it("steps forward on ArrowDown and ArrowRight, and wraps past the end", () => {
    assert.equal(radioGroupKeyTarget("ArrowDown", 0, COUNT), 1);
    assert.equal(radioGroupKeyTarget("ArrowDown", 1, COUNT), 2);
    assert.equal(radioGroupKeyTarget("ArrowDown", 2, COUNT), 0);
    // Either axis works: the cards stack vertically, but the pattern lets a
    // reader who thinks in rows use the horizontal pair.
    assert.equal(radioGroupKeyTarget("ArrowRight", 0, COUNT), 1);
    assert.equal(radioGroupKeyTarget("ArrowRight", 2, COUNT), 0);
  });

  it("steps back on ArrowUp and ArrowLeft, and wraps past the start", () => {
    assert.equal(radioGroupKeyTarget("ArrowUp", 2, COUNT), 1);
    assert.equal(radioGroupKeyTarget("ArrowUp", 1, COUNT), 0);
    assert.equal(radioGroupKeyTarget("ArrowUp", 0, COUNT), 2);
    assert.equal(radioGroupKeyTarget("ArrowLeft", 0, COUNT), 2);
    assert.equal(radioGroupKeyTarget("ArrowLeft", 2, COUNT), 1);
  });

  it("jumps to the ends on Home and End from anywhere in the group", () => {
    for (let i = 0; i < COUNT; i += 1) {
      assert.equal(radioGroupKeyTarget("Home", i, COUNT), 0);
      assert.equal(radioGroupKeyTarget("End", i, COUNT), COUNT - 1);
    }
  });

  it("selects whatever Space is pressed on, without moving focus", () => {
    assert.equal(radioGroupKeyTarget(" ", 1, COUNT), 1);
    assert.equal(radioGroupKeyTarget("Spacebar", 2, COUNT), 2);
  });

  it("leaves keys the group does not own to the browser", () => {
    for (const key of ["Tab", "Enter", "Escape", "PageDown", "a", "Shift"]) {
      assert.equal(
        radioGroupKeyTarget(key, 1, COUNT),
        null,
        `${key} must fall through`,
      );
    }
  });

  it("refuses to compute a target for an index outside the group", () => {
    assert.equal(radioGroupKeyTarget("ArrowDown", -1, COUNT), null);
    assert.equal(radioGroupKeyTarget("ArrowDown", COUNT, COUNT), null);
    assert.equal(radioGroupKeyTarget("ArrowDown", 0, 0), null);
  });
});

describe("theme radiogroup: one tab stop, not three", () => {
  it("puts the only stop on the checked option", () => {
    const stops = [0, 1, 2].map((i) => rovingTabIndex(i, 1));
    assert.deepEqual(stops, [-1, 0, -1]);
    assert.equal(stops.filter((t) => t === 0).length, 1);
  });

  it("falls back to the first option when nothing is checked", () => {
    const stops = [0, 1, 2].map((i) => rovingTabIndex(i, -1));
    assert.deepEqual(stops, [0, -1, -1]);
  });

  it("never leaves the group with more than one way in", () => {
    for (let checked = -1; checked < COUNT; checked += 1) {
      const zeros = [0, 1, 2]
        .map((i) => rovingTabIndex(i, checked))
        .filter((t) => t === 0);
      assert.equal(zeros.length, 1, `checked=${checked}`);
    }
  });
});

/**
 * A three-radio group with just enough DOM to be wrong in the ways the real
 * one was: which node holds focus, which is checked, and what tabindex each
 * carries. `press` is a line-for-line stand-in for handleRadioKeyDown —
 * compute the target, move focus, then ask for the selection (which the
 * pending guard may refuse).
 */
function stubGroup(initialChecked: number, opts: { pending?: boolean } = {}) {
  let checked = initialChecked;
  let focused = rovingTabIndex(0, checked) === 0 ? 0 : checked;
  const pending = opts.pending ?? false;

  return {
    press(key: string) {
      const target = radioGroupKeyTarget(key, focused, COUNT);
      if (target === null) return false; // browser keeps the key
      focused = target; // focus moves whether or not the write is allowed
      if (!pending) checked = target;
      return true;
    },
    get focused() {
      return focused;
    },
    get checked() {
      return checked;
    },
    get tabStops() {
      return [0, 1, 2].map((i) => rovingTabIndex(i, checked));
    },
  };
}

describe("theme radiogroup: driving the group", () => {
  it("carries selection with focus all the way round and back", () => {
    const g = stubGroup(0);
    g.press("ArrowDown");
    assert.deepEqual([g.focused, g.checked], [1, 1]);
    g.press("ArrowDown");
    assert.deepEqual([g.focused, g.checked], [2, 2]);
    // Third press wraps rather than dead-ending on the last card.
    g.press("ArrowDown");
    assert.deepEqual([g.focused, g.checked], [0, 0]);
    // And the tab stop followed the selection home.
    assert.deepEqual(g.tabStops, [0, -1, -1]);
  });

  it("keeps exactly one tab stop after every keystroke", () => {
    const g = stubGroup(0);
    for (const key of ["ArrowDown", "End", "ArrowUp", "Home", "ArrowLeft"]) {
      g.press(key);
      assert.equal(g.tabStops.filter((t) => t === 0).length, 1, key);
      assert.equal(g.tabStops[g.checked], 0, key);
    }
  });

  it("moves focus but not selection while a save is in flight", () => {
    const g = stubGroup(0, { pending: true });
    assert.equal(g.press("ArrowDown"), true);
    // The reader keeps their place — this is the focus drop the wave found.
    assert.equal(g.focused, 1);
    assert.equal(g.checked, 0);
  });

  it("hands Tab back so the group is one stop on the way through", () => {
    const g = stubGroup(2);
    assert.equal(g.press("Tab"), false);
    assert.deepEqual([g.focused, g.checked], [2, 2]);
  });
});

/** Source assertions print their own message, not 9kB of component. */
function has(re: RegExp, why: string) {
  assert.ok(re.test(SOURCE), `appearance.tsx must ${why} (${re})`);
}
function lacks(re: RegExp, why: string) {
  assert.ok(!re.test(SOURCE), `appearance.tsx must ${why} (${re})`);
}

describe("theme radiogroup: wiring the pure helpers cannot see", () => {
  it("never hard-disables a radio, so focus survives the write", () => {
    // The defect: `disabled={pending}` on a focused radio drops focus to the
    // body the moment the transition starts. `aria-` prefixed is the fix,
    // hence the lookbehind.
    lacks(
      /role="radio"[\s\S]{0,800}?(?<!aria-)disabled=\{pending\}/,
      "not hard-disable the theme radios while the write is in flight",
    );
    has(
      /role="radio"[\s\S]{0,800}?aria-disabled=\{pending\}/,
      "mark the theme radios aria-disabled while pending",
    );
  });

  it("guards re-entry in handleChange instead of in the DOM", () => {
    has(
      /function handleChange[\s\S]{0,500}?if \(pending\) return;/,
      "refuse a second theme write inside handleChange",
    );
  });

  it("gives every radio a roving tabindex and the keydown handler", () => {
    has(/tabIndex=\{rovingTabIndex\(index, checkedIndex\)\}/, "rove the tab stop");
    has(
      /onKeyDown=\{\(event\) => handleRadioKeyDown\(event, index\)\}/,
      "bind the radio keydown handler",
    );
    has(/event\.preventDefault\(\)/, "swallow the keys it handles");
    has(/radioRefs\.current\[target\]\?\.focus\(\)/, "move DOM focus to the target radio");
  });

  it("keeps the pending affordance visible", () => {
    has(/aria-disabled:opacity-60/, "keep dimming the group while pending");
  });

  it("leaves the section's copy and the personality toggles alone", () => {
    for (const copy of [
      /aria-label="Colour scheme"/,
      /Follows your device setting\. Switches automatically\./,
      /Always light, regardless of your device setting\./,
      /Always dark, regardless of your device setting\./,
      /Pages you share by link stay light for whoever opens them\./,
      /Choose a colour scheme\. It applies everywhere you are signed in\./,
    ]) {
      has(copy, "keep its copy verbatim");
    }
    // The toggles are switches, not radios: they keep `disabled`, and their
    // own pending flag, untouched by this pass.
    has(/role="switch"[\s\S]{0,300}?disabled=\{disabled\}/, "leave the switches disabled-able");
    has(/disabled=\{personalityPending\}/, "leave the personality pending flag alone");
  });
});
