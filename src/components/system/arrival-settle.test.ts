import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { ArrivalSettle } from "./arrival-settle";

const source = readFileSync(new URL("./arrival-settle.tsx", import.meta.url), "utf8");
const markup = renderToStaticMarkup(createElement(ArrivalSettle));
const script = markup.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, "execute the exact parser script emitted by the component");

function browser(options: { reduced?: boolean; duration?: string; missingSurface?: boolean } = {}) {
  let now = 1000;
  let disconnected = 0;
  let cancelled = 0;
  const callbacks: (() => void)[] = [];
  const animations: { frames: unknown; options: { duration: number; easing: string }; id: string }[] = [];
  const parent = {};
  const marker = { isConnected: true, parentNode: parent };
  const parserScript = { isConnected: true, previousElementSibling: marker };
  const surface = {
    __signalSettledAt: 0,
    getAnimations: () => [{ id: "surface-arrival", cancel() { cancelled += 1; } }],
    animate(frames: unknown, options: { duration: number; easing: string }) {
      const animation = { frames, options, id: "" }; animations.push(animation); return animation;
    },
  };
  const host = {
    document: { currentScript: parserScript, documentElement: {}, querySelector: () => options.missingSurface ? null : surface },
    matchMedia: () => ({ matches: options.reduced ?? false }),
    performance: { now: () => now },
    getComputedStyle: () => ({ getPropertyValue: (name: string) => name === "--motion-fast" ? options.duration ?? ".14s" : "ease-in-out" }),
    MutationObserver: class {
      constructor(callback: () => void) { callbacks.push(callback); }
      observe(target: unknown, config: unknown) { assert.equal(target, parent); assert.deepEqual(JSON.parse(JSON.stringify(config)), { childList: true }); }
      disconnect() { disconnected += 1; }
    },
  };
  const context = vm.createContext({ ...host, window: host });
  return {
    context, marker, parserScript, surface, animations, callbacks,
    advance(ms: number) { now += ms; },
    mutations() { for (const callback of callbacks) callback(); },
    disconnected: () => disconnected, cancelled: () => cancelled,
    runParser() { vm.runInContext(script!, context); },
  };
}

/** Execute the shipped component with a client hook dispatcher, capturing its
 * real layout-effect cleanup without requiring another browser/test renderer. */
function clientEntry(context: vm.Context) {
  let cleanup: (() => void) | undefined;
  const compiledModule = { exports: {} as { ArrivalSettle: () => { props: { children: unknown[] } } } };
  Object.assign(context, {
    module: compiledModule, exports: compiledModule.exports,
    require(name: string) {
      if (name === "react/jsx-runtime") return jsxRuntime;
      assert.equal(name, "react");
      return {
        useSyncExternalStore(_subscribe: unknown, getSnapshot: () => boolean) { return getSnapshot(); },
        useLayoutEffect(effect: () => () => void) { cleanup = effect(); },
      };
    },
  });
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInContext(`(function(){${compiled}\n})()`, context);
  return { tree: compiledModule.exports.ArrivalSettle(), unmount: () => cleanup?.() };
}

test("SSR retains the parser script immediately after its stable hidden marker", () => {
  assert.match(markup, /^<span hidden="" aria-hidden="true" data-arrival-settle=""><\/span><script>/);
  assert.doesNotMatch(source, /\beval\(|new Function\(/);
});

test("client fallback renders only its marker and settles from the real layout cleanup", () => {
  const dom = browser(); const entry = clientEntry(dom.context);
  const [marker, parser] = entry.tree.props.children as [{ type: string; props: Record<string, unknown> }, unknown];
  assert.equal(marker.type, "span"); assert.equal(marker.props.hidden, true); assert.equal(parser, null);
  assert.equal(dom.animations.length, 0);
  entry.unmount();
  assert.equal(dom.animations.length, 1); assert.equal(dom.animations[0].options.duration, 140);
  assert.equal(dom.animations[0].id, "surface-arrival");
});

test("hydration script removal cannot announce arrival before fallback marker removal", () => {
  const dom = browser(); dom.runParser();
  dom.parserScript.isConnected = false; dom.mutations();
  assert.equal(dom.animations.length, 0); assert.equal(dom.disconnected(), 0);
  dom.marker.isConnected = false; dom.mutations();
  assert.equal(dom.animations.length, 1); assert.equal(dom.disconnected(), 1);
  assert.equal(dom.cancelled(), 1); assert.equal(dom.animations[0].options.easing, "ease-in-out");
});

test("parser and client cleanup deduplicate the same arrival, then allow the next one", () => {
  const dom = browser(); dom.runParser(); const entry = clientEntry(dom.context);
  entry.unmount(); dom.marker.isConnected = false; dom.mutations();
  assert.equal(dom.animations.length, 1);
  dom.advance(401); clientEntry(dom.context).unmount(); assert.equal(dom.animations.length, 2);
});

test("reduced motion starts neither a parser observer nor a client animation", () => {
  const dom = browser({ reduced: true }); dom.runParser(); clientEntry(dom.context).unmount();
  assert.equal(dom.callbacks.length, 0); assert.equal(dom.animations.length, 0);
});

test("parser cleanup disconnects even when no surface is available", () => {
  const dom = browser({ missingSurface: true }); dom.runParser(); dom.marker.isConnected = false; dom.mutations();
  assert.equal(dom.disconnected(), 1); assert.equal(dom.animations.length, 0);
  clientEntry(dom.context).unmount(); assert.equal(dom.animations.length, 0);
});

test("both entry paths obey millisecond tokens and zero-motion tokens", () => {
  for (const duration of ["180ms", "0s"]) {
    for (const path of ["parser", "client"]) {
      const dom = browser({ duration });
      if (path === "parser") { dom.runParser(); dom.marker.isConnected = false; dom.mutations(); }
      else clientEntry(dom.context).unmount();
      assert.equal(dom.animations.length, duration === "0s" ? 0 : 1);
      if (dom.animations.length) assert.equal(dom.animations[0].options.duration, 180);
    }
  }
});
