/**
 * The /app theme resolver — the ~230 bytes of inline script that decide what
 * `data-theme` says before the app paints.
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

/**
 * The smallest browser the resolver needs: one element that remembers
 * attributes, one media query whose `matches` we can flip, and window-level
 * event plumbing. Nothing here is a jsdom — the resolver touches exactly five
 * globals and each one is modelled by hand, so a test failure names a real
 * behaviour rather than a stub's shortcoming.
 */
function makeDocument(options: { prefersDark: boolean; mode?: string }) {
  const attributes = new Map<string, string>();
  if (options.mode !== undefined) attributes.set("data-theme-mode", options.mode);

  const mediaChangeListeners: Listener[] = [];
  const globalListeners = new Map<string, Listener[]>();
  const mediaQueriesAsked: string[] = [];

  const query = {
    matches: options.prefersDark,
    addEventListener(type: string, fn: Listener) {
      if (type === "change") mediaChangeListeners.push(fn);
    },
  };

  const sandbox = {
    document: {
      documentElement: {
        getAttribute: (name: string) => attributes.get(name) ?? null,
        setAttribute: (name: string, value: string) => {
          attributes.set(name, String(value));
        },
      },
    },
    matchMedia: (q: string) => {
      mediaQueriesAsked.push(q);
      return query;
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
    /** The settings control's move: rewrite the choice. */
    chooseMode: (m: string) => {
      attributes.set("data-theme-mode", m);
    },
    /** The OS's move: change the scheme. */
    setOsDark: (value: boolean) => {
      query.matches = value;
    },
    fireOsChange: () => {
      for (const fn of [...mediaChangeListeners]) fn();
    },
    mediaQueriesAsked,
    mediaChangeListenerCount: () => mediaChangeListeners.length,
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
    assert.deepEqual(dom.mediaQueriesAsked, ["(prefers-color-scheme:dark)"]);
    assert.equal(dom.mediaChangeListenerCount(), 1);
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
