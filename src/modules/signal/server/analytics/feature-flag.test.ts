/**
 * D-011 · the analytics domain gate and the briefing-engine switch are
 * different decisions and must stay separable.
 *
 * `SIGNAL_ANALYTICS_V1_ENABLED` has always had two consumers:
 * `signal-brief-page.tsx`, which chooses WHICH briefing engine renders at
 * `/app/home/briefing`, and the analytics authorization gate. So the only way
 * to open the data domain was to replace a shipped, operator-visible surface.
 * `SIGNAL_HOME_ANALYTICS_ENABLED` exists so the domain can be opened without
 * that side effect — which is only true if the engine flag stays independent,
 * which is what these assertions hold.
 */

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  isAnalyticsDomainEnabled,
  isHomeAnalyticsEnabled,
  isSignalAnalyticsEnabled,
} from "./feature-flag";

const ENGINE = "SIGNAL_ANALYTICS_V1_ENABLED";
const HOME = "SIGNAL_HOME_ANALYTICS_ENABLED";

function set(engine: string | undefined, home: string | undefined): void {
  if (engine === undefined) delete process.env[ENGINE];
  else process.env[ENGINE] = engine;
  if (home === undefined) delete process.env[HOME];
  else process.env[HOME] = home;
}

afterEach(() => set(undefined, undefined));

test("both flags are closed by default, so the domain is closed", () => {
  set(undefined, undefined);
  assert.equal(isSignalAnalyticsEnabled(), false);
  assert.equal(isHomeAnalyticsEnabled(), false);
  assert.equal(isAnalyticsDomainEnabled(), false);
});

test("the Home flag opens the domain without switching the briefing engine", () => {
  set(undefined, "true");
  assert.equal(isAnalyticsDomainEnabled(), true);
  assert.equal(
    isSignalAnalyticsEnabled(),
    false,
    "enabling the Home view must not replace the shipped Full Briefing",
  );
});

test("the engine flag still opens the domain it depends on", () => {
  set("true", undefined);
  assert.equal(isSignalAnalyticsEnabled(), true);
  assert.equal(isAnalyticsDomainEnabled(), true);
});

test("an explicit false wins over an absent value, on both flags", () => {
  set("false", "false");
  assert.equal(isAnalyticsDomainEnabled(), false);
  set("0", "0");
  assert.equal(isAnalyticsDomainEnabled(), false);
});

test("an unrecognised value never opens a gate", () => {
  set("yes", "on");
  assert.equal(isSignalAnalyticsEnabled(), false);
  assert.equal(isHomeAnalyticsEnabled(), false);
  assert.equal(isAnalyticsDomainEnabled(), false);
});

test("1 is accepted as true on both flags", () => {
  set("1", undefined);
  assert.equal(isSignalAnalyticsEnabled(), true);
  set(undefined, "1");
  assert.equal(isHomeAnalyticsEnabled(), true);
});
