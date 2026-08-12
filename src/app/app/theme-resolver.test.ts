/**
 * The /app theme resolver — the 577 bytes of inline script that decide what
 * `data-theme` says before the app paints, and how the document crosses when
 * it changes.
 *
 * WHY THIS FILE EXISTS. Dark mode shipped (D-013, 2026-08-11) with no
 * automated coverage at all. The resolver is the one piece of the theme system
 * that no other kind of test in this repo can reach: it is a string, not a
 * module; it never runs in a renderer; and a source-text assertion on a
 * minified one-liner proves the characters survived, not that the resolution
 * table is right. So these tests execute the exact string src/app/app/
 * theme-runtime.tsx ships, inside a `node:vm` context holding the smallest
 * document it can run against.
 *
 * WHAT IS BEING PROTECTED. Two attributes, one job each — the contract written
 * out in theme-runtime.tsx:
 *
 *   data-theme-mode   what the user CHOSE — system | light | dark
 *   data-theme        what that resolves to NOW — light | dark
 *
 * Keeping them apart is the whole design: "system" stays live because the
 * resolver re-reads the OS query on every change without anything re-rendering,
 * and the settings control changes the choice by rewriting one attribute and
 * firing one event. A resolver that collapsed the two — writing the mode, or
 * reading only the media query — would still look correct on a first paint and
 * would quietly break System.
 *
 * WHAT ELSE IS BEING PROTECTED, SINCE WAVE 7. The resolver also owns the
 * switching frame: on a change to a live document it lends <html> the
 * `theme-resolving` class for one brief colour transition and takes it back
 * (globals.css turns the class into the transition). Four of the cases below
 * are about when that class must NOT appear — first paint, the streamed
 * correction, a no-op re-resolve, reduced motion — because each of them is a
 * moment where an animation would be a page-load animation rather than a
 * response, and the contract's budget is that route and representation
 * changes are immediate.
 *
 * Run:
 *   node --import tsx --import ./src/test/register-server-only.mjs --test \
 *     src/app/app/theme-resolver.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, it } from "node:test";
import { RESOLVER, applyMode } from "@/app/app/theme-runtime";

type Listener = () => void;

const COLOUR_SCHEME_QUERY = "(prefers-color-scheme:dark)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion:reduce)";

/**
 * The smallest browser the resolver needs: one element that remembers
 * attributes and classes, two media queries whose `matches` we can flip, a
 * clock we advance by hand, and window-level event plumbing. Nothing here is
 * a jsdom — the resolver touches a short list of globals and each one is
 * modelled here, so a test failure names a real behaviour rather than a
 * stub's shortcoming.
 *
 * `readyState` defaults to "complete" because that is the document every
 * interactive theme change happens on; the parsing document is its own case
 * and asks for it explicitly.
 */
function makeDocument(options: {
  prefersDark: boolean;
  mode?: string;
  prefersReducedMotion?: boolean;
  readyState?: "loading" | "interactive" | "complete";
}) {
  const attributes = new Map<string, string>();
  if (options.mode !== undefined) attributes.set("data-theme-mode", options.mode);

  const classes = new Set<string>();
  let themeWrites = 0;
  const globalListeners = new Map<string, Listener[]>();
  const mediaQueriesAsked: string[] = [];
  const changeListeners = new Map<string, Listener[]>();

  const queries = new Map(
    [
      [COLOUR_SCHEME_QUERY, Boolean(options.prefersDark)],
      [REDUCED_MOTION_QUERY, Boolean(options.prefersReducedMotion)],
    ].map(([text, matches]) => [
      text as string,
      {
        matches: matches as boolean,
        addEventListener(type: string, fn: Listener) {
          if (type !== "change") return;
          const list = changeListeners.get(text as string) ?? [];
          list.push(fn);
          changeListeners.set(text as string, list);
        },
      },
    ]),
  );

  // A clock, not a wait. The class the resolver adds is removed on a timer,
  // and a test that slept for it would be slow and flaky; this one asks the
  // question directly — what is true at 199ms, and at 200ms.
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map<number, { at: number; fn: Listener }>();

  const sandbox = {
    document: {
      readyState: options.readyState ?? "complete",
      documentElement: {
        getAttribute: (name: string) => attributes.get(name) ?? null,
        setAttribute: (name: string, value: string) => {
          if (name === "data-theme") themeWrites += 1;
          attributes.set(name, String(value));
        },
        classList: {
          add: (name: string) => classes.add(name),
          remove: (name: string) => classes.delete(name),
          contains: (name: string) => classes.has(name),
        },
      },
    },
    matchMedia: (q: string) => {
      mediaQueriesAsked.push(q);
      const query = queries.get(q);
      if (!query) throw new Error(`the resolver asked for an unmodelled query: ${q}`);
      return query;
    },
    setTimeout: (fn: Listener, ms: number) => {
      const id = nextTimerId;
      nextTimerId += 1;
      timers.set(id, { at: now + (Number(ms) || 0), fn });
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
    addEventListener(type: string, fn: Listener) {
      const list = globalListeners.get(type) ?? [];
      list.push(fn);
      globalListeners.set(type, list);
    },
    dispatchEvent: (event: { type: string }) => {
      for (const fn of [...(globalListeners.get(event.type) ?? [])]) fn();
      return true;
    },
    Event: class StubEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  };
  vm.createContext(sandbox);

  return {
    /** Run a script string the way the document would — as a bare inline script. */
    run: (code: string) => vm.runInContext(code, sandbox),
    /** What the resolver decided. */
    theme: () => attributes.get("data-theme") ?? null,
    /** What the user chose. */
    mode: () => attributes.get("data-theme-mode") ?? null,
    /** Is the document wearing the transition class right now. */
    resolving: () => classes.has("theme-resolving"),
    /** Every class the resolver has ever put on the document. */
    classNames: () => [...classes],
    /** The settings control's move: rewrite the choice. */
    chooseMode: (m: string) => {
      attributes.set("data-theme-mode", m);
    },
    /** The OS's move: change the scheme. */
    setOsDark: (value: boolean) => {
      queries.get(COLOUR_SCHEME_QUERY)!.matches = value;
    },
    /** The other OS move: turn motion off mid-session. */
    setReducedMotion: (value: boolean) => {
      queries.get(REDUCED_MOTION_QUERY)!.matches = value;
    },
    /** The document finishing its parse. */
    setReadyState: (value: "loading" | "interactive" | "complete") => {
      sandbox.document.readyState = value;
    },
    fireOsChange: () => {
      for (const fn of [...(changeListeners.get(COLOUR_SCHEME_QUERY) ?? [])]) fn();
    },
    /** Move the clock, running whatever the resolver scheduled. */
    advance: (ms: number) => {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    pendingTimers: () => timers.size,
    /** How many times data-theme has been written at all. */
    themeWrites: () => themeWrites,
    mediaQueriesAsked,
    changeListenerCount: (query: string) => (changeListeners.get(query) ?? []).length,
    globalListenerTypes: () => [...globalListeners.keys()],
  };
}

const themeRuntimeSource = readFileSync(
  path.join(process.cwd(), "src", "app", "app", "theme-runtime.tsx"),
  "utf8",
);

describe("the /app theme resolver", () => {
  it("resolves every (chosen mode × OS scheme) pair to the right data-theme", () => {
    const table: Array<{ mode: string | undefined; osDark: boolean; expected: string }> = [
      // No attribute yet: the first paint for every user who has never opened
      // settings. The resolver must read this as "system", not as a blank.
      { mode: undefined, osDark: true, expected: "dark" },
      { mode: undefined, osDark: false, expected: "light" },
      // Explicit system: follows the OS in both directions.
      { mode: "system", osDark: true, expected: "dark" },
      { mode: "system", osDark: false, expected: "light" },
      // An explicit choice outranks the OS, both ways round. These two rows
      // are the ones a "just read the media query" regression would break.
      { mode: "light", osDark: true, expected: "light" },
      { mode: "light", osDark: false, expected: "light" },
      { mode: "dark", osDark: true, expected: "dark" },
      { mode: "dark", osDark: false, expected: "dark" },
    ];

    for (const row of table) {
      const dom = makeDocument({ prefersDark: row.osDark, mode: row.mode });
      dom.run(RESOLVER);
      assert.equal(
        dom.theme(),
        row.expected,
        `mode ${row.mode ?? "(absent)"} + OS ${row.osDark ? "dark" : "light"}`,
      );
    }
  });

  it("falls back to system for a mode it does not recognise, never to a guess", () => {
    // A stale cookie, a hand-edited attribute or a future mode that shipped to
    // the database before it shipped to this script must degrade to "follow the
    // OS" — the safe answer — not to a hard-coded theme.
    for (const junk of ["sepia", "", "SYSTEM", "Dark", "auto"]) {
      const onDarkOs = makeDocument({ prefersDark: true, mode: junk });
      onDarkOs.run(RESOLVER);
      assert.equal(onDarkOs.theme(), "dark", `"${junk}" on a dark OS`);

      const onLightOs = makeDocument({ prefersDark: false, mode: junk });
      onLightOs.run(RESOLVER);
      assert.equal(onLightOs.theme(), "light", `"${junk}" on a light OS`);
    }
  });

  it("writes the resolution and never touches the choice", () => {
    // The two-attribute contract, from the resolver's side: data-theme-mode is
    // input only. A resolver that wrote it back would freeze "system" into
    // whatever the OS happened to say at first paint.
    const chosen = makeDocument({ prefersDark: true, mode: "light" });
    chosen.run(RESOLVER);
    assert.equal(chosen.mode(), "light");
    assert.equal(chosen.theme(), "light");

    const unset = makeDocument({ prefersDark: true });
    unset.run(RESOLVER);
    assert.equal(unset.mode(), null, "the resolver must not materialise a choice");
    assert.equal(unset.theme(), "dark");
  });

  it("subscribes exactly once, to the query it names and the event it owns", () => {
    const dom = makeDocument({ prefersDark: false, mode: "system" });
    dom.run(RESOLVER);
    assert.deepEqual(dom.mediaQueriesAsked, [
      "(prefers-color-scheme:dark)",
      "(prefers-reduced-motion:reduce)",
    ]);
    assert.equal(
      dom.changeListenerCount("(prefers-color-scheme:dark)"),
      1,
      "the colour scheme is the one query the resolver follows over time",
    );
    assert.equal(
      dom.changeListenerCount("(prefers-reduced-motion:reduce)"),
      0,
      "the motion preference is read at the moment of a change, never subscribed to — " +
        "a listener here would re-resolve the theme because someone turned animation off",
    );
    assert.deepEqual(dom.globalListenerTypes(), ["signal:theme"]);
  });

  it("re-resolves when the OS scheme changes under a system user", () => {
    const dom = makeDocument({ prefersDark: false, mode: "system" });
    dom.run(RESOLVER);
    assert.equal(dom.theme(), "light");

    dom.setOsDark(true);
    dom.fireOsChange();
    assert.equal(dom.theme(), "dark", "sundown must flip the app with no re-render");

    dom.setOsDark(false);
    dom.fireOsChange();
    assert.equal(dom.theme(), "light", "and back again");
  });

  it("leaves an explicit choice alone when the OS scheme changes", () => {
    for (const mode of ["light", "dark"]) {
      const dom = makeDocument({ prefersDark: mode === "dark", mode });
      dom.run(RESOLVER);
      assert.equal(dom.theme(), mode);

      dom.setOsDark(mode !== "dark");
      dom.fireOsChange();
      assert.equal(dom.theme(), mode, `${mode} must survive the OS changing under it`);
    }
  });

  it("re-resolves on signal:theme when the choice changes", () => {
    const dom = makeDocument({ prefersDark: false, mode: "system" });
    dom.run(RESOLVER);
    assert.equal(dom.theme(), "light");

    dom.chooseMode("dark");
    dom.run('dispatchEvent(new Event("signal:theme"));');
    assert.equal(dom.theme(), "dark", "the theme changes under the click");

    dom.chooseMode("system");
    dom.run('dispatchEvent(new Event("signal:theme"));');
    assert.equal(dom.theme(), "light", "choosing System hands the answer back to the OS");
  });

  it("carries nothing that could close the script tag it is injected into", () => {
    // Both strings reach the document through dangerouslySetInnerHTML.
    assert.doesNotMatch(RESOLVER, /<\/script/i);
    assert.doesNotMatch(applyMode("dark"), /<\/script/i);
    assert.doesNotMatch(applyMode("light"), /<\/script/i);
  });
});

/**
 * The switching frame (wave 7). `theme-resolving` is a class the resolver
 * lends the document for the length of one colour transition and then takes
 * back; globals.css is what turns it into the transition. These tests own the
 * lending, which is the half a stylesheet cannot check: WHEN the class is
 * there, and — four times over — when it must not be.
 */
describe("the theme resolve, as a movement", () => {
  it("dresses the change the viewer asked for", () => {
    const dom = makeDocument({ prefersDark: false, mode: "system" });
    dom.run(RESOLVER);
    assert.equal(dom.resolving(), false, "the first paint is not a change");

    dom.chooseMode("dark");
    dom.run('dispatchEvent(new Event("signal:theme"));');
    assert.equal(dom.theme(), "dark", "the theme still changes");
    assert.equal(dom.resolving(), true, "and the document is dressed to cross");
    assert.deepEqual(dom.classNames(), ["theme-resolving"]);
  });

  it("dresses the OS crossing sundown under a system user", () => {
    const dom = makeDocument({ prefersDark: false, mode: "system" });
    dom.run(RESOLVER);

    dom.setOsDark(true);
    dom.fireOsChange();
    assert.equal(dom.theme(), "dark");
    assert.equal(dom.resolving(), true, "an OS change is a change on a live document too");
  });

  it("never dresses the first paint, in either scheme", () => {
    for (const prefersDark of [true, false]) {
      const dom = makeDocument({ prefersDark });
      dom.run(RESOLVER);
      assert.equal(dom.theme(), prefersDark ? "dark" : "light");
      assert.equal(
        dom.resolving(),
        false,
        "there is no previous theme to leave, so there is nothing to animate",
      );
      assert.equal(dom.pendingTimers(), 0, "and nothing scheduled to undo");
    }
  });

  it("never dresses the streamed correction, which lands while the document is parsing", () => {
    // The chosen-mode script streams in behind a Suspense boundary and can
    // legitimately flip data-theme a beat after the first paint. That is the
    // app booting, not a viewer changing their mind, and a 140ms wash across
    // a document that is still arriving is a page-load animation.
    const booting = makeDocument({ prefersDark: false, readyState: "loading" });
    booting.run(RESOLVER);
    assert.equal(booting.theme(), "light", "the OS answers first");

    booting.run(applyMode("dark"));
    assert.equal(booting.theme(), "dark", "the correction still lands, instantly");
    assert.equal(booting.resolving(), false, "and lands without a transition");
    assert.equal(booting.pendingTimers(), 0);

    // Same document, same script, once parsing is done: now it is a change.
    booting.setReadyState("complete");
    booting.run(applyMode("light"));
    assert.equal(booting.theme(), "light");
    assert.equal(booting.resolving(), true);
  });

  it("stays away entirely under prefers-reduced-motion, including one turned on mid-session", () => {
    const reduced = makeDocument({
      prefersDark: false,
      mode: "system",
      prefersReducedMotion: true,
    });
    reduced.run(RESOLVER);
    reduced.chooseMode("dark");
    reduced.run('dispatchEvent(new Event("signal:theme"));');
    assert.equal(reduced.theme(), "dark", "the theme change itself is never withheld");
    assert.equal(reduced.resolving(), false, "only the movement is");
    assert.equal(reduced.pendingTimers(), 0);

    // The preference is read at the moment of the change, so a viewer who
    // turns motion off in the OS is obeyed on their very next flip.
    const live = makeDocument({ prefersDark: false, mode: "system" });
    live.run(RESOLVER);
    live.setReducedMotion(true);
    live.chooseMode("dark");
    live.run('dispatchEvent(new Event("signal:theme"));');
    assert.equal(live.theme(), "dark");
    assert.equal(live.resolving(), false, "a cached preference would have missed this");
  });

  it("takes the class back off, and a second flip cannot strand it", () => {
    const dom = makeDocument({ prefersDark: false, mode: "system" });
    dom.run(RESOLVER);

    dom.chooseMode("dark");
    dom.run('dispatchEvent(new Event("signal:theme"));');
    dom.advance(199);
    assert.equal(dom.resolving(), true, "the transition is still running at 199ms");
    dom.advance(1);
    assert.equal(dom.resolving(), false, "and the document is undressed the moment it is over");
    assert.equal(dom.pendingTimers(), 0, "leaving no timer behind");

    // Flip, then flip back mid-resolve: the first timer must be cancelled, or
    // it fires under the second change and strips the class mid-transition.
    dom.chooseMode("light");
    dom.run('dispatchEvent(new Event("signal:theme"));');
    dom.advance(150);
    dom.chooseMode("dark");
    dom.run('dispatchEvent(new Event("signal:theme"));');
    assert.equal(dom.pendingTimers(), 1, "one resolve, one timer — never two racing");
    dom.advance(100);
    assert.equal(dom.resolving(), true, "the first flip's timer must not end the second's");
    dom.advance(100);
    assert.equal(dom.resolving(), false);
  });

  it("does nothing at all when the resolution has not changed", () => {
    const dom = makeDocument({ prefersDark: false, mode: "light" });
    dom.run(RESOLVER);
    assert.equal(dom.themeWrites(), 1, "the first paint writes once");

    // Choosing "system" on a light OS while already light, or firing the
    // event twice, resolves to the same answer. A resolver that dressed the
    // document anyway would flash a transition over a theme that never moved.
    dom.chooseMode("system");
    dom.run('dispatchEvent(new Event("signal:theme"));');
    dom.run('dispatchEvent(new Event("signal:theme"));');
    dom.setOsDark(false);
    dom.fireOsChange();
    assert.equal(dom.theme(), "light");
    assert.equal(dom.themeWrites(), 1, "and the attribute is never rewritten with its own value");
    assert.equal(dom.resolving(), false);
    assert.equal(dom.pendingTimers(), 0);
  });
});

describe("applyMode — the streamed correction", () => {
  it("writes the choice and fires the signal the resolver is listening for", () => {
    for (const mode of ["light", "dark"] as const) {
      // Start on the OS scheme opposite the stored choice: the interesting
      // case, and the one a user sees settle.
      const dom = makeDocument({ prefersDark: mode === "light" });
      dom.run(RESOLVER);
      assert.equal(dom.theme(), mode === "light" ? "dark" : "light", "the OS answers first");

      dom.run(applyMode(mode));
      assert.equal(dom.mode(), mode, "the choice lands on data-theme-mode");
      assert.equal(dom.theme(), mode, "and the resolver corrects data-theme off the same event");
    }
  });

  it("is the same move the settings control makes", () => {
    // The control (src/components/app/settings/sections/appearance.tsx) and
    // this script must set the same attribute and fire the same event name, or
    // one of the two paths silently stops re-resolving.
    assert.match(applyMode("dark"), /setAttribute\("data-theme-mode","dark"\)/);
    assert.match(applyMode("dark"), /new Event\("signal:theme"\)/);
    assert.doesNotMatch(applyMode("dark"), /"data-theme"/);
  });

  it("is only ever handed an already-resolved mode", () => {
    // "system" has no fixed value, so it must never reach applyMode — the
    // server component returns null instead, leaving the resolver in charge.
    assert.match(themeRuntimeSource, /if \(mode === "system"\) return null;/);
    assert.ok(
      themeRuntimeSource.indexOf('if (mode === "system") return null;') <
        themeRuntimeSource.indexOf("applyMode(mode)"),
      "the system guard must sit ahead of the applyMode call",
    );
    assert.match(themeRuntimeSource, /applyMode = \(mode: "light" \| "dark"\)/);
  });
});
