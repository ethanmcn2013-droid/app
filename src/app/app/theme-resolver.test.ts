/**
 * The /app theme resolver: the inline script that decides what `data-theme`
 * says before the app paints, and how the document crosses when it changes.
 *
 * WHY THIS FILE EXISTS. The resolver is the one piece of the theme system
 * that no other kind of test in this repo can reach: it is a string, not a
 * module; it never runs in a renderer; and a source-text assertion on a
 * minified one-liner proves the characters survived, not that the resolution
 * table is right. So these tests execute the exact string src/app/app/
 * theme-runtime.tsx ships, inside a `node:vm` context holding the smallest
 * document it can run against.
 *
 * WHAT IS BEING PROTECTED. Dark is the default and Light is a choice
 * (founder instruction, 5 Oct 2026). The contract written out in
 * theme-runtime.tsx and src/lib/theme-mode.ts:
 *
 *   data-theme-mode   what the user CHOSE: light | dark (absent: never chose)
 *   data-theme        what that resolves to: light | dark
 *
 * Only "light" is light. Everything else is dark: no attribute, the stored
 * "system" every account starts with, a value nobody recognises. The
 * operating system's scheme is never asked. A resolver that went back to
 * reading prefers-color-scheme would put every never-chose user on a light
 * phone back on the white app the founder rejected, so the table below pins
 * both OS schemes for every row.
 *
 * WHAT ELSE IS BEING PROTECTED. The resolver also owns the switching frame:
 * on a change to a live document it lends <html> the `theme-resolving` class
 * for one brief colour transition and takes it back (globals.css turns the
 * class into the transition). Several cases below are about when that class
 * must NOT appear (first paint, the streamed correction, a no-op re-resolve,
 * reduced motion) because each is a moment where an animation would be a
 * page-load animation rather than a response. And it owns the phone browser
 * bar: one theme-color meta of its own, in step with the theme.
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
import { APP_BAR_DARK, APP_BAR_LIGHT } from "@/lib/document-paper";
import { THEME_EVENT, THEME_STORAGE_KEY, resolveThemeChoice } from "@/lib/theme-mode";

type Listener = () => void;

const COLOUR_SCHEME_QUERY = "(prefers-color-scheme:dark)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion:reduce)";
const FIRE = `dispatchEvent(new Event("${THEME_EVENT}"));`;

/**
 * The smallest browser the resolver needs: one element that remembers
 * attributes and classes, a head that can hold one meta, a localStorage that
 * can be made to throw, media queries whose `matches` we can flip, a clock we
 * advance by hand, and window-level event plumbing. Nothing here is a jsdom:
 * the resolver touches a short list of globals and each one is modelled here,
 * so a test failure names a real behaviour rather than a stub's shortcoming.
 *
 * `prefersDark` models the operating system. The resolver must not ask for
 * it at all; the query is modelled so that a regression is caught by name.
 */
function makeDocument(options: {
  prefersDark?: boolean;
  mode?: string;
  stored?: string;
  storageThrows?: boolean;
  prefersReducedMotion?: boolean;
  readyState?: "loading" | "interactive" | "complete";
}) {
  const attributes = new Map<string, string>();
  if (options.mode !== undefined) attributes.set("data-theme-mode", options.mode);

  const storage = new Map<string, string>();
  if (options.stored !== undefined) storage.set(THEME_STORAGE_KEY, options.stored);

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
  // question directly: what is true at 199ms, and at 200ms.
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map<number, { at: number; fn: Listener }>();

  // The head: an ordered list of metas. The layout's own static theme-color
  // is already there when the resolver runs, as it is in the real document.
  type Meta = { attrs: Map<string, string> };
  const makeMeta = (): Meta & { setAttribute: (n: string, v: string) => void } => {
    const attrs = new Map<string, string>();
    return { attrs, setAttribute: (n, v) => void attrs.set(n, String(v)) };
  };
  const staticMeta = makeMeta();
  staticMeta.setAttribute("name", "theme-color");
  staticMeta.setAttribute("content", APP_BAR_DARK);
  const head: Meta[] = [staticMeta];

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
      head: {
        get firstChild() {
          return head[0] ?? null;
        },
        insertBefore: (node: Meta, before: Meta | null) => {
          const at = before ? head.indexOf(before) : -1;
          if (at < 0) head.push(node);
          else head.splice(at, 0, node);
          return node;
        },
      },
      querySelector: (selector: string) => {
        if (selector !== "meta[data-app-theme]") {
          throw new Error(`the resolver asked for an unmodelled selector: ${selector}`);
        }
        return head.find((meta) => meta.attrs.has("data-app-theme")) ?? null;
      },
      createElement: (tag: string) => {
        if (tag !== "meta") throw new Error(`the resolver made an unmodelled element: ${tag}`);
        return makeMeta();
      },
    },
    localStorage: {
      getItem: (key: string) => {
        if (options.storageThrows) throw new Error("storage is blocked");
        return storage.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (options.storageThrows) throw new Error("storage is blocked");
        storage.set(key, String(value));
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
    /** Run a script string the way the document would: as a bare inline script. */
    run: (code: string) => vm.runInContext(code, sandbox),
    /** What the resolver decided. */
    theme: () => attributes.get("data-theme") ?? null,
    /** What the user chose. */
    mode: () => attributes.get("data-theme-mode") ?? null,
    /** This browser's copy of the choice. */
    stored: () => storage.get(THEME_STORAGE_KEY) ?? null,
    /** Is the document wearing the transition class right now. */
    resolving: () => classes.has("theme-resolving"),
    /** Every class the resolver has ever put on the document. */
    classNames: () => [...classes],
    /** A control's move: rewrite the choice. */
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
    /** Every theme-color meta, in document order: the browser reads the first. */
    barColours: () =>
      head.filter((meta) => meta.attrs.get("name") === "theme-color").map((meta) => meta.attrs.get("content")),
    ownMetaCount: () => head.filter((meta) => meta.attrs.has("data-app-theme")).length,
  };
}

const source = (...parts: string[]) => readFileSync(path.join(process.cwd(), ...parts), "utf8");
const themeRuntimeSource = source("src", "app", "app", "theme-runtime.tsx");

describe("the /app theme resolver", () => {
  it("is dark unless the choice is light, whatever the operating system says", () => {
    const table: Array<{ mode: string | undefined; expected: string }> = [
      // No attribute: the first paint for every user who has never chosen.
      { mode: undefined, expected: "dark" },
      // The stored default every account starts with. It used to mean "follow
      // the device"; it now means "never chose", and never chose is dark.
      { mode: "system", expected: "dark" },
      { mode: "dark", expected: "dark" },
      // The one way to a light app: choosing it.
      { mode: "light", expected: "light" },
    ];

    for (const row of table) {
      for (const osDark of [true, false]) {
        const dom = makeDocument({ prefersDark: osDark, mode: row.mode });
        dom.run(RESOLVER);
        assert.equal(
          dom.theme(),
          row.expected,
          `mode ${row.mode ?? "(absent)"} + OS ${osDark ? "dark" : "light"}`,
        );
      }
    }
  });

  it("falls back to dark for a mode it does not recognise", () => {
    // A hand-edited attribute or a future mode that shipped to the database
    // before it shipped to this script degrades to the default, never to a
    // light app nobody asked for. "Light" and " light" are not "light".
    for (const junk of ["sepia", "", "SYSTEM", "Light", " light", "auto"]) {
      for (const osDark of [true, false]) {
        const dom = makeDocument({ prefersDark: osDark, mode: junk });
        dom.run(RESOLVER);
        assert.equal(dom.theme(), "dark", `"${junk}" on a ${osDark ? "dark" : "light"} OS`);
      }
    }
  });

  it("never asks the operating system for its colour scheme", () => {
    const dom = makeDocument({ prefersDark: false });
    dom.run(RESOLVER);
    assert.deepEqual(dom.mediaQueriesAsked, [REDUCED_MOTION_QUERY]);
    assert.equal(dom.changeListenerCount(COLOUR_SCHEME_QUERY), 0);
    assert.equal(
      dom.changeListenerCount(REDUCED_MOTION_QUERY),
      0,
      "the motion preference is read at the moment of a change, never subscribed to",
    );
    assert.deepEqual(dom.globalListenerTypes(), [THEME_EVENT]);
    assert.doesNotMatch(RESOLVER, /prefers-color-scheme/);

    // And the OS changing under the app changes nothing.
    dom.setOsDark(true);
    dom.fireOsChange();
    dom.setOsDark(false);
    dom.fireOsChange();
    assert.equal(dom.theme(), "dark");
    assert.equal(dom.themeWrites(), 1);
  });

  it("paints a returning Light chooser light from the first frame", () => {
    // The account's choice streams in behind the shell. This browser's copy
    // is what stops a person who chose Light seeing the dark default first.
    const light = makeDocument({ prefersDark: true, stored: "light" });
    light.run(RESOLVER);
    assert.equal(light.theme(), "light");
    assert.equal(light.mode(), null, "the resolver must not materialise a choice");

    // The attribute, once written, outranks the copy: a control or the
    // streamed correction has spoken more recently than storage.
    const corrected = makeDocument({ mode: "dark", stored: "light" });
    corrected.run(RESOLVER);
    assert.equal(corrected.theme(), "dark");

    // Anything in storage that is not exactly "light" is dark.
    for (const junk of ["system", "dark", "LIGHT", ""]) {
      const dom = makeDocument({ stored: junk });
      dom.run(RESOLVER);
      assert.equal(dom.theme(), "dark", `stored "${junk}"`);
    }
  });

  it("is dark, not broken, when storage is blocked", () => {
    const dom = makeDocument({ storageThrows: true });
    assert.doesNotThrow(() => dom.run(RESOLVER));
    assert.equal(dom.theme(), "dark");
    assert.doesNotThrow(() => dom.run(applyMode("light")));
    assert.equal(dom.theme(), "light", "a blocked copy must not stop the choice applying");
  });

  it("writes the resolution and never touches the choice", () => {
    const chosen = makeDocument({ prefersDark: true, mode: "light" });
    chosen.run(RESOLVER);
    assert.equal(chosen.mode(), "light");
    assert.equal(chosen.theme(), "light");

    const unset = makeDocument({ prefersDark: false });
    unset.run(RESOLVER);
    assert.equal(unset.mode(), null, "the resolver must not materialise a choice");
    assert.equal(unset.stored(), null, "nor write this browser's copy on its own");
    assert.equal(unset.theme(), "dark");
  });

  it("re-resolves on signal:theme when the choice changes", () => {
    const dom = makeDocument({ prefersDark: false });
    dom.run(RESOLVER);
    assert.equal(dom.theme(), "dark");

    dom.chooseMode("light");
    dom.run(FIRE);
    assert.equal(dom.theme(), "light", "the theme changes under the click");

    dom.chooseMode("dark");
    dom.run(FIRE);
    assert.equal(dom.theme(), "dark", "and back again");
  });

  it("keeps the phone browser bar in step with the theme", () => {
    const dom = makeDocument({});
    dom.run(RESOLVER);
    // The resolver's meta goes in FIRST: a browser reads the first
    // theme-color in the document, and the layout's static one is dark.
    assert.deepEqual(dom.barColours(), [APP_BAR_DARK, APP_BAR_DARK]);

    dom.chooseMode("light");
    dom.run(FIRE);
    assert.deepEqual(dom.barColours(), [APP_BAR_LIGHT, APP_BAR_DARK]);

    dom.chooseMode("dark");
    dom.run(FIRE);
    assert.deepEqual(dom.barColours(), [APP_BAR_DARK, APP_BAR_DARK]);
    assert.equal(dom.ownMetaCount(), 1, "one meta, rewritten, never a new one per change");

    const light = makeDocument({ stored: "light" });
    light.run(RESOLVER);
    assert.equal(light.barColours()[0], APP_BAR_LIGHT, "a Light chooser's bar is light from the first frame");
  });

  it("carries nothing that could close the script tag it is injected into", () => {
    // Both strings reach the document through dangerouslySetInnerHTML.
    assert.doesNotMatch(RESOLVER, /<\/script/i);
    assert.doesNotMatch(applyMode("dark"), /<\/script/i);
    assert.doesNotMatch(applyMode("light"), /<\/script/i);
  });
});

/**
 * The switching frame. `theme-resolving` is a class the resolver lends the
 * document for the length of one colour transition and then takes back;
 * globals.css is what turns it into the transition. These tests own the
 * lending, which is the half a stylesheet cannot check: WHEN the class is
 * there, and when it must not be.
 */
describe("the theme resolve, as a movement", () => {
  it("dresses the change the viewer asked for", () => {
    const dom = makeDocument({});
    dom.run(RESOLVER);
    assert.equal(dom.resolving(), false, "the first paint is not a change");

    dom.chooseMode("light");
    dom.run(FIRE);
    assert.equal(dom.theme(), "light", "the theme still changes");
    assert.equal(dom.resolving(), true, "and the document is dressed to cross");
    assert.deepEqual(dom.classNames(), ["theme-resolving"]);
  });

  it("never dresses the first paint, whatever the choice", () => {
    for (const options of [{}, { mode: "light" }, { stored: "light" }, { mode: "dark" }]) {
      const dom = makeDocument(options);
      dom.run(RESOLVER);
      assert.equal(dom.resolving(), false, JSON.stringify(options));
      assert.equal(dom.pendingTimers(), 0, "and schedules nothing");
    }
  });

  it("never dresses the streamed correction while the document is still parsing", () => {
    // A Light chooser on a new browser: the shell paints dark, then the saved
    // choice streams in. That is the document settling, not a response to
    // anything the viewer did, so it must cross at once.
    const dom = makeDocument({ readyState: "loading" });
    dom.run(RESOLVER);
    assert.equal(dom.theme(), "dark");
    dom.run(applyMode("light"));
    assert.equal(dom.theme(), "light");
    assert.equal(dom.resolving(), false);
    assert.equal(dom.pendingTimers(), 0);
  });

  it("changes the theme without the movement under reduced motion", () => {
    const reduced = makeDocument({ prefersReducedMotion: true });
    reduced.run(RESOLVER);
    reduced.chooseMode("light");
    reduced.run(FIRE);
    assert.equal(reduced.theme(), "light", "the theme change itself is never withheld");
    assert.equal(reduced.resolving(), false, "only the movement is");
    assert.equal(reduced.pendingTimers(), 0);

    // The preference is read at the moment of the change, so a viewer who
    // turns motion off in the OS is obeyed on their very next flip.
    const live = makeDocument({});
    live.run(RESOLVER);
    live.setReducedMotion(true);
    live.chooseMode("light");
    live.run(FIRE);
    assert.equal(live.theme(), "light");
    assert.equal(live.resolving(), false, "a cached preference would have missed this");
  });

  it("takes the class back off, and a second flip cannot strand it", () => {
    const dom = makeDocument({});
    dom.run(RESOLVER);

    dom.chooseMode("light");
    dom.run(FIRE);
    dom.advance(199);
    assert.equal(dom.resolving(), true, "the transition is still running at 199ms");
    dom.advance(1);
    assert.equal(dom.resolving(), false, "and the document is undressed the moment it is over");
    assert.equal(dom.pendingTimers(), 0, "leaving no timer behind");

    // Flip, then flip back mid-resolve: the first timer must be cancelled, or
    // it fires under the second change and strips the class mid-transition.
    dom.chooseMode("dark");
    dom.run(FIRE);
    dom.advance(150);
    dom.chooseMode("light");
    dom.run(FIRE);
    assert.equal(dom.pendingTimers(), 1, "one resolve, one timer, never two racing");
    dom.advance(100);
    assert.equal(dom.resolving(), true, "the first flip's timer must not end the second's");
    dom.advance(100);
    assert.equal(dom.resolving(), false);
  });

  it("does nothing at all when the resolution has not changed", () => {
    const dom = makeDocument({ mode: "dark" });
    dom.run(RESOLVER);
    assert.equal(dom.themeWrites(), 1, "the first paint writes once");

    // The stored default and Dark resolve to the same answer, and firing the
    // event twice changes nothing. A resolver that dressed the document
    // anyway would flash a transition over a theme that never moved.
    dom.chooseMode("system");
    dom.run(FIRE);
    dom.run(FIRE);
    assert.equal(dom.theme(), "dark");
    assert.equal(dom.themeWrites(), 1, "and the attribute is never rewritten with its own value");
    assert.equal(dom.resolving(), false);
    assert.equal(dom.pendingTimers(), 0);
  });
});

describe("applyMode: the streamed correction", () => {
  it("writes the choice, this browser's copy, and fires the signal", () => {
    for (const mode of ["light", "dark"] as const) {
      // Start from the opposite copy: the interesting case, a stale browser.
      const dom = makeDocument({ stored: mode === "light" ? "dark" : "light" });
      dom.run(RESOLVER);
      assert.equal(dom.theme(), mode === "light" ? "dark" : "light", "the stale copy answers first");

      dom.run(applyMode(mode));
      assert.equal(dom.mode(), mode, "the choice lands on data-theme-mode");
      assert.equal(dom.stored(), mode, "this browser's copy is corrected for the next visit");
      assert.equal(dom.theme(), mode, "and the resolver corrects data-theme off the same event");
    }
  });

  it("is the same move the controls make", () => {
    // The controls (src/lib/theme-mode.ts applyThemeChoice) and this script
    // must set the same attribute, the same storage key and fire the same
    // event name, or one of the two paths silently stops re-resolving.
    assert.match(applyMode("dark"), /setAttribute\("data-theme-mode","dark"\)/);
    assert.match(applyMode("dark"), /new Event\("signal:theme"\)/);
    assert.match(applyMode("dark"), /localStorage\.setItem\("signal:theme-mode","dark"\)/);
    assert.doesNotMatch(applyMode("dark"), /"data-theme"/);

    const lib = source("src", "lib", "theme-mode.ts");
    assert.match(lib, /setAttribute\("data-theme-mode", choice\)/);
    assert.match(lib, /localStorage\.setItem\(THEME_STORAGE_KEY, choice\)/);
    assert.match(lib, /dispatchEvent\(new Event\(THEME_EVENT\)\)/);
    assert.equal(THEME_EVENT, "signal:theme");
    assert.equal(THEME_STORAGE_KEY, "signal:theme-mode");
  });

  it("always sends the stored preference resolved, so never-chose is dark", () => {
    // What each stored value means to a signed-in user.
    assert.equal(resolveThemeChoice("system"), "dark");
    assert.equal(resolveThemeChoice("dark"), "dark");
    assert.equal(resolveThemeChoice("light"), "light");
    assert.equal(resolveThemeChoice(null), "dark");
    assert.equal(resolveThemeChoice(undefined), "dark");
    assert.equal(resolveThemeChoice("sepia"), "dark");

    // The server component sends the resolved value for every signed-in
    // user, including the default, so a stale copy from another account on
    // a shared browser is corrected rather than trusted.
    assert.match(themeRuntimeSource, /applyMode\(resolveThemeChoice\(stored\)\)/);
    assert.doesNotMatch(themeRuntimeSource, /if \(mode === "system"\) return null;/);
    assert.match(themeRuntimeSource, /applyMode = \(mode: ThemeChoice\)/);
  });
});

describe("the controls offer Dark and Light, and nothing else", () => {
  it("has no Match system or System option anywhere a person can choose", () => {
    const shell = source("src", "components", "shell", "app-shell.tsx");
    const appearance = source("src", "components", "app", "settings", "sections", "appearance.tsx");
    for (const [name, text] of [["sidebar", shell], ["appearance", appearance]] as const) {
      assert.doesNotMatch(text, /Match system/, name);
      assert.doesNotMatch(text, /label: "System"/, name);
      assert.doesNotMatch(text, /value: "system"/, name);
      assert.doesNotMatch(text, /themeMode: "system"/, name);
    }
    assert.match(shell, /const THEME_NAMES: Record<ThemeChoice, string> = \{ dark: "Dark", light: "Light" \};/);
    assert.match(appearance, /value: "dark",\s*label: "Dark"/);
    assert.match(appearance, /value: "light",\s*label: "Light"/);
    assert.ok(appearance.indexOf('value: "dark"') < appearance.indexOf('value: "light"'), "Dark, the default, comes first");
  });

  it("saves the choice through the one preferences action", () => {
    const shell = source("src", "components", "shell", "app-shell.tsx");
    const appearance = source("src", "components", "app", "settings", "sections", "appearance.tsx");
    assert.match(shell, /updateUserPreferencesAction\(\{ themeMode: next \}\)/);
    assert.match(appearance, /updateUserPreferencesAction\(\{ themeMode: next \}\)/);
  });

  it("gives the app segment a dark browser bar that does not follow the device", () => {
    const layout = source("src", "app", "app", "layout.tsx");
    assert.match(layout, /themeColor: APP_BAR_DARK,/);
    assert.doesNotMatch(layout, /prefers-color-scheme: /);
  });
});
