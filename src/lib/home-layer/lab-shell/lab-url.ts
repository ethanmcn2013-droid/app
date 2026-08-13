/**
 * The lab URL contract.
 *
 * ONE parser, ONE builder, for the whole lab. Pure, synchronous, total: every
 * input produces a state plus a list of notices, and nothing here throws on a
 * hand-typed URL. It authorizes nothing and reads no clock, which is what lets
 * `lab-url.test.ts` run it without a server.
 *
 * WHY THE LAB HAS ITS OWN PARSER RATHER THAN REUSING `home-url.ts`. The
 * production Home URL carries five parameters this one does not need and
 * misses four this one requires — `v`, `mode`, `scenario`, `theme`, `capture`.
 * More decisively, the production parser is entitled to issue a canonicalising
 * replace-redirect (HOME_ROUTE_AND_RETURN_CONTEXT §6.4) and the lab is not:
 * `lab-isolation-contract.test.mjs` forbids a redirect call anywhere under the
 * lab route family, because the lab's only refusal is a 404 and a redirect
 * confirms the route exists. So the lab absorbs a bad parameter, renders at
 * the default and SAYS SO in the review drawer, rather than rewriting the URL
 * under the reviewer.
 *
 * Every combination below is directly linkable and survives reload, because
 * the whole of the lab's view state is in the URL and nothing in the render
 * path holds client state.
 */

import {
  HOME_MODES,
  SCENARIO_IDS,
  type HomeMode,
  type LabDirection,
  type ScenarioId,
} from "../fixtures";

export const LAB_ROUTE_PATH = "/lab/home-operating-layer";

// ── The four variants ───────────────────────────────────────────────────────

/**
 * Picker order is variant order is candidate-folder order. The labels are the
 * neutral review labels — a director never sees "wildcard", and never sees the
 * structural thesis names from the lab brief.
 */
export const LAB_VARIANTS = Object.freeze([
  Object.freeze({ v: 1 as const, slug: "editorial" as const, label: "Editorial", direction: "editorial-line" as const }),
  Object.freeze({ v: 2 as const, slug: "rail" as const, label: "Rail", direction: "context-rail" as const }),
  Object.freeze({ v: 3 as const, slug: "index" as const, label: "Index", direction: "reading-index" as const }),
  Object.freeze({ v: 4 as const, slug: "desk" as const, label: "Desk", direction: "signal-desk" as const }),
]);

export type LabVariant = (typeof LAB_VARIANTS)[number];
export type LabVariantNumber = LabVariant["v"];
export type LabVariantSlug = LabVariant["slug"];

export const LAB_VARIANT_NUMBERS: readonly LabVariantNumber[] = Object.freeze(
  LAB_VARIANTS.map((variant) => variant.v),
);

export function labVariant(v: LabVariantNumber): LabVariant {
  const found = LAB_VARIANTS.find((variant) => variant.v === v);
  if (!found) throw new Error(`lab-shell/lab-url: unknown variant ${String(v)}`);
  return found;
}

export function labVariantBySlug(slug: string): LabVariant | null {
  return LAB_VARIANTS.find((variant) => variant.slug === slug) ?? null;
}

export function labVariantByDirection(direction: string): LabVariant | null {
  return LAB_VARIANTS.find((variant) => variant.direction === direction) ?? null;
}

// ── The rest of the vocabulary ──────────────────────────────────────────────

export const LAB_SCOPES = Object.freeze(["all", "project", "planning-period"] as const);
export type LabScope = (typeof LAB_SCOPES)[number];

/** `ANALYTICS_PERIODS` minus `custom`, per HOME_ROUTE_AND_RETURN_CONTEXT §4.3. */
export const LAB_PERIODS = Object.freeze([
  "four_weeks",
  "twelve_weeks",
  "six_months",
  "twelve_months",
] as const);
export type LabPeriod = (typeof LAB_PERIODS)[number];

export const LAB_THEMES = Object.freeze(["light", "dark"] as const);
export type LabTheme = (typeof LAB_THEMES)[number];

export const DEFAULT_VARIANT: LabVariantNumber = 1;
export const DEFAULT_MODE: HomeMode = "today";
export const DEFAULT_SCENARIO: ScenarioId = "owner_signature";
export const DEFAULT_PERIOD: LabPeriod = "four_weeks";
export const DEFAULT_THEME: LabTheme = "light";

/**
 * The id grammar, adopted unchanged from `src/lib/suite-context.ts:8` by way
 * of HOME_ROUTE_AND_RETURN_CONTEXT §4.1 / D-HR03. The lab fails closed on the
 * narrowest grammar in the estate so a value that survives a lab URL also
 * survives a production Home URL.
 */
export const CONTEXT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

// ── The state ───────────────────────────────────────────────────────────────

/**
 * THE CANDIDATE-VISIBLE STATE — everything in the URL except which candidate is
 * on screen.
 *
 * `v` is deliberately absent, and the absence is the fairness rule made
 * structural. The assembly takes this type, so it cannot read the variant, so
 * it cannot vary by it: the four directions are handed one object built from
 * one input. Navigation still stays on the chosen candidate, because the shell
 * appends `v` to every lab link at render time (`withCandidateVariant`), after
 * the data is assembled and outside anything a candidate can influence.
 */
export type LabViewState = Readonly<{
  mode: HomeMode;
  scenario: ScenarioId;
  /** Home Read Scope: what the modes may read together. */
  homeScope: LabScope;
  /** Active Project: where a product link lands. Never narrows an aggregate. */
  workspaceId: string | null;
  planningPeriodId: string | null;
  period: LabPeriod;
  /** Overlay. On neither axis (HOME_ROUTE_AND_RETURN_CONTEXT §3.2). */
  lensProjectId: string | null;
  /**
   * Selection. A view parameter: it opens or focuses a row, mutates nothing,
   * and moves neither axis. `event` is Inbox's, `item` is Today's, the full
   * briefing's and My work's — the split is the production contract's, adopted
   * rather than invented, so a lab link and a Home link mean the same thing.
   *
   * A direction is free to ignore both and disclose detail in place: detail
   * behaviour is one of the axes the four directions are meant to differ on.
   * They exist so that a direction which DOES route to detail can survive
   * reload and the Back button, which journeys 4, 10 and 14 require.
   */
  event: string | null;
  item: string | null;
  theme: LabTheme;
  /** True removes every piece of review chrome from the document. */
  capture: boolean;
  /**
   * True when the caller named none of the three scope parameters, so the
   * scenario's own scope stands. It is the difference between "the reviewer
   * is looking at this world as authored" and "the reviewer changed scope",
   * and the assembly needs to know which.
   */
  scopeFromScenario: boolean;
}>;

/** The whole URL: the view state plus the candidate the reviewer is looking at. */
export type LabUrlState = LabViewState & Readonly<{ v: LabVariantNumber }>;

/**
 * The view state, built field by field.
 *
 * A `LabUrlState` is assignable to a `LabViewState`, so the type system is
 * happy to let a whole URL state through — and then `v` is still on the object
 * at runtime, and the props a candidate receives name the candidate after all.
 * That is not a hypothetical: it is what the first attempt at this shipped.
 *
 * Naming every field is the point. Adding one to `LabViewState` and forgetting
 * it here is a compile error, which is the failure direction that can be
 * caught, rather than a value quietly travelling that should not.
 */
export function labViewState(state: LabViewState): LabViewState {
  return Object.freeze({
    mode: state.mode,
    scenario: state.scenario,
    homeScope: state.homeScope,
    workspaceId: state.workspaceId,
    planningPeriodId: state.planningPeriodId,
    period: state.period,
    lensProjectId: state.lensProjectId,
    event: state.event,
    item: state.item,
    theme: state.theme,
    capture: state.capture,
    scopeFromScenario: state.scopeFromScenario,
  });
}

export type LabUrlNotice = Readonly<{
  parameter: string;
  code:
    | "invalid-value"
    | "duplicate-parameter"
    | "unknown-parameter"
    | "not-valid-here"
    | "period-unsupported"
    | "planning-period-missing"
    | "query-discarded";
  /** Plain English, shown in the review drawer. Never rendered to a candidate. */
  text: string;
}>;

export type ParsedLabUrl = Readonly<{
  state: LabUrlState;
  notices: readonly LabUrlNotice[];
}>;

/** Guards a pathological URL from becoming a rendering decision. §4.2 rule 2. */
const MAX_QUERY_LENGTH = 2_048;
const MAX_PARAMETERS = 24;

const KNOWN_KEYS: readonly string[] = Object.freeze([
  "v",
  "direction",
  "mode",
  "scenario",
  "homeScope",
  "workspaceId",
  "planningPeriodId",
  "period",
  "lensProjectId",
  "event",
  "item",
  "theme",
  "capture",
]);

const SCOPE_KEYS: readonly string[] = Object.freeze([
  "homeScope",
  "workspaceId",
  "planningPeriodId",
]);

/**
 * Next hands a page `searchParams` as `Record<string, string | string[]>`; a
 * browser hands a `URLSearchParams`; a test hands a raw string. One parser
 * takes all three, because three call sites parsing three ways is how a lab
 * URL and a capture filename stop agreeing.
 */
export type LabSearchInput =
  | string
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | undefined>>;

type ReadResult = Readonly<{ value: string | null; duplicate: boolean }>;

function toReader(input: LabSearchInput): {
  read: (key: string) => ReadResult;
  keys: readonly string[];
  count: number;
  length: number;
} {
  if (typeof input === "string" || input instanceof URLSearchParams) {
    const params =
      typeof input === "string"
        ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
        : input;
    const keys: string[] = [];
    let count = 0;
    for (const key of params.keys()) {
      count += 1;
      if (!keys.includes(key)) keys.push(key);
    }
    return {
      read: (key) => {
        const all = params.getAll(key);
        if (all.length === 0) return { value: null, duplicate: false };
        if (all.length > 1) return { value: null, duplicate: true };
        return { value: all[0] ?? null, duplicate: false };
      },
      keys,
      count,
      length: params.toString().length,
    };
  }

  const record = input;
  const keys = Object.keys(record);
  let count = 0;
  for (const key of keys) {
    const held = record[key];
    count += Array.isArray(held) ? held.length : 1;
  }
  return {
    read: (key) => {
      const held = record[key];
      if (held === undefined) return { value: null, duplicate: false };
      if (Array.isArray(held)) {
        if (held.length === 0) return { value: null, duplicate: false };
        if (held.length > 1) return { value: null, duplicate: true };
        return { value: held[0] ?? null, duplicate: false };
      }
      return { value: held as string, duplicate: false };
    },
    keys,
    count,
    length: keys.reduce((total, key) => {
      const held = record[key];
      const text = Array.isArray(held) ? held.join("") : String(held ?? "");
      return total + key.length + text.length + 2;
    }, 0),
  };
}

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function clean(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (CONTROL_CHARACTERS.test(trimmed)) return null;
  return trimmed;
}

export const DEFAULT_LAB_STATE: LabUrlState = Object.freeze({
  v: DEFAULT_VARIANT,
  mode: DEFAULT_MODE,
  scenario: DEFAULT_SCENARIO,
  homeScope: "planning-period",
  workspaceId: null,
  planningPeriodId: null,
  period: DEFAULT_PERIOD,
  lensProjectId: null,
  event: null,
  item: null,
  theme: DEFAULT_THEME,
  capture: false,
  scopeFromScenario: true,
});

/**
 * Total. Never throws on user input, never authorizes, never guesses.
 *
 * `scenarioScope` supplies the three scope values the chosen world was
 * authored with. It is a parameter rather than a fixture read so this module
 * stays free of the fixture graph and the test can drive it directly.
 */
export function parseLabUrl(
  input: LabSearchInput,
  scenarioScope?: (id: ScenarioId) => Readonly<{
    homeScope: LabScope;
    workspaceId: string | null;
    planningPeriodId: string | null;
    lensProjectId: string | null;
  }>,
): ParsedLabUrl {
  const notices: LabUrlNotice[] = [];
  const reader = toReader(input);

  if (reader.length > MAX_QUERY_LENGTH || reader.count > MAX_PARAMETERS) {
    return Object.freeze({
      state: DEFAULT_LAB_STATE,
      notices: Object.freeze([
        {
          parameter: "(query)",
          code: "query-discarded" as const,
          text: `The query string was discarded whole: ${reader.count} parameters, ${reader.length} characters. The limits are ${MAX_PARAMETERS} and ${MAX_QUERY_LENGTH}.`,
        },
      ]),
    });
  }

  for (const key of reader.keys) {
    if (!KNOWN_KEYS.includes(key)) {
      notices.push({
        parameter: key,
        code: "unknown-parameter",
        text: `The lab does not read ${key}. It was ignored.`,
      });
    }
  }

  const take = (key: string): string | null => {
    const held = reader.read(key);
    if (held.duplicate) {
      notices.push({
        parameter: key,
        code: "duplicate-parameter",
        text: `${key} was given more than once, so it took no value. First-wins and last-wins are both guesses about intent.`,
      });
      return null;
    }
    return clean(held.value);
  };

  // — v, with `direction` accepted as an input alias ————————————————
  //
  // `labUrl()` in the fixture universe emits `direction=<slug>` and no `v`, so
  // the capture harness that already exists would land on variant 1 for all
  // four directions if the alias were refused. It is accepted on input and
  // never emitted (see `buildLabUrl`).
  let v: LabVariantNumber = DEFAULT_VARIANT;
  const rawV = take("v");
  const rawDirection = take("direction");
  if (rawV !== null) {
    const parsed = Number.parseInt(rawV, 10);
    const found = LAB_VARIANT_NUMBERS.find((candidate) => candidate === parsed);
    if (found === undefined) {
      notices.push({
        parameter: "v",
        code: "invalid-value",
        text: `v must be 1, 2, 3 or 4. "${rawV}" is not, so the lab is showing variant ${DEFAULT_VARIANT}.`,
      });
    } else {
      v = found;
    }
  } else if (rawDirection !== null) {
    const found =
      labVariantByDirection(rawDirection) ?? labVariantBySlug(rawDirection);
    if (found === null) {
      notices.push({
        parameter: "direction",
        code: "invalid-value",
        text: `"${rawDirection}" is not one of the four directions, so the lab is showing variant ${DEFAULT_VARIANT}.`,
      });
    } else {
      v = found.v;
    }
  }

  // — mode ————————————————————————————————————————————————————————
  let mode: HomeMode = DEFAULT_MODE;
  const rawMode = take("mode");
  if (rawMode !== null) {
    const found = HOME_MODES.find((candidate) => candidate === rawMode);
    if (found === undefined) {
      notices.push({
        parameter: "mode",
        code: "invalid-value",
        text: `mode must be one of ${HOME_MODES.join(", ")}. "${rawMode}" is not, so the lab is showing ${DEFAULT_MODE}.`,
      });
    } else {
      mode = found;
    }
  }

  // — scenario ————————————————————————————————————————————————————
  let scenario: ScenarioId = DEFAULT_SCENARIO;
  const rawScenario = take("scenario");
  if (rawScenario !== null) {
    const found = SCENARIO_IDS.find((candidate) => candidate === rawScenario);
    if (found === undefined) {
      notices.push({
        parameter: "scenario",
        code: "invalid-value",
        text: `"${rawScenario}" is not one of the thirteen worlds, so the lab is showing ${DEFAULT_SCENARIO}.`,
      });
    } else {
      scenario = found;
    }
  }

  // — the scope axis ——————————————————————————————————————————————
  const authored = scenarioScope?.(scenario) ?? {
    homeScope: DEFAULT_LAB_STATE.homeScope,
    workspaceId: null,
    planningPeriodId: null,
    lensProjectId: null,
  };

  const scopeNamed = SCOPE_KEYS.some((key) => reader.keys.includes(key));

  let homeScope: LabScope = authored.homeScope;
  /**
   * True once the URL has NAMED a scope the lab accepted. It decides one thing
   * only, and it is the subject of HOME_ROUTE_AND_RETURN_CONTEXT §4.3: whether
   * the world's own `planningPeriodId` may still travel.
   *
   * The Planning Period id is the OPERAND of `homeScope`, meaningless without
   * it. It belongs to the scope the world was authored at, not to a scope the
   * reader has just asked for. So when the reader names the scope, the operand
   * has to come from the URL as well, and `?homeScope=planning-period` with no
   * id is a genuine missing operand: the notice fires and Read Scope falls
   * inward to `project`, never outward to `all` (§4.3, §9.6).
   *
   * Backfilling it here is what made that rule unreachable: every world with an
   * authored period silently supplied one, so the fallback could not be
   * observed and a reader who asked for a season they had not named was shown
   * the world's own season instead.
   */
  let scopeNamedInUrl = false;
  const rawScope = take("homeScope");
  if (rawScope !== null) {
    const found = LAB_SCOPES.find((candidate) => candidate === rawScope);
    if (found === undefined) {
      notices.push({
        parameter: "homeScope",
        code: "invalid-value",
        text: `homeScope must be all, project or planning-period. "${rawScope}" is not, so the lab is reading at ${authored.homeScope}.`,
      });
    } else {
      homeScope = found;
      scopeNamedInUrl = true;
    }
  }

  const readId = (key: string, fallback: string | null): string | null => {
    const raw = take(key);
    if (raw === null) return fallback;
    if (!CONTEXT_ID.test(raw)) {
      notices.push({
        parameter: key,
        code: "invalid-value",
        text: `${key} is not a well-formed identifier, so it was dropped.`,
      });
      return fallback;
    }
    return raw;
  };

  // `workspaceId` and `lensProjectId` DO still fall back to the world's own.
  // They are not operands of `homeScope`: the Active Project is the other axis
  // entirely (§3.1) and the Lens is on neither (§3.2), so naming a Read Scope
  // says nothing about either, and a world always has an Active Project the way
  // a real reader always resolves one (§9.2).
  const workspaceId = readId("workspaceId", authored.workspaceId);
  let planningPeriodId = readId(
    "planningPeriodId",
    scopeNamedInUrl ? null : authored.planningPeriodId,
  );
  const lensProjectId = readId("lensProjectId", authored.lensProjectId);

  // Selection is per mode. `event` on Inbox, `item` on Today, the briefing
  // and My work. A selection named on the wrong mode is dropped with a notice
  // rather than silently carried, because a carried selection reappears when
  // the reader switches back and looks like state the lab is holding.
  let event = readId("event", null);
  let item = readId("item", null);

  if (homeScope !== "planning-period" && reader.keys.includes("planningPeriodId")) {
    notices.push({
      parameter: "planningPeriodId",
      code: "not-valid-here",
      text: "planningPeriodId only means something with homeScope=planning-period. It was dropped.",
    });
    planningPeriodId = null;
  }
  if (homeScope === "planning-period" && planningPeriodId === null) {
    notices.push({
      parameter: "planningPeriodId",
      code: "planning-period-missing",
      text: "homeScope=planning-period needs a planningPeriodId. Read Scope fell back to the one Project, never outward to everything.",
    });
    homeScope = "project";
  }

  if (event !== null && mode !== "inbox") {
    notices.push({
      parameter: "event",
      code: "not-valid-here",
      text: "event only means something on Inbox. It was dropped.",
    });
    event = null;
  }
  if (item !== null && mode === "inbox") {
    notices.push({
      parameter: "item",
      code: "not-valid-here",
      text: "item does not mean anything on Inbox. It was dropped.",
    });
    item = null;
  }
  if (item !== null && mode === "analytics") {
    notices.push({
      parameter: "item",
      code: "not-valid-here",
      text: "item does not mean anything on Analytics. It was dropped.",
    });
    item = null;
  }

  // — period ——————————————————————————————————————————————————————
  let period: LabPeriod = DEFAULT_PERIOD;
  const rawPeriod = take("period");
  if (rawPeriod !== null) {
    if (rawPeriod === "custom") {
      notices.push({
        parameter: "period",
        code: "period-unsupported",
        text: `A custom window needs a start and an end the lab does not carry. The window shown is ${DEFAULT_PERIOD.replace("_", " ")}.`,
      });
    } else {
      const found = LAB_PERIODS.find((candidate) => candidate === rawPeriod);
      if (found === undefined) {
        notices.push({
          parameter: "period",
          code: "invalid-value",
          text: `"${rawPeriod}" is not a window the lab reads. The window shown is ${DEFAULT_PERIOD.replace("_", " ")}.`,
        });
      } else {
        period = found;
      }
    }
  }

  // — theme and capture ——————————————————————————————————————————
  let theme: LabTheme = DEFAULT_THEME;
  const rawTheme = take("theme");
  if (rawTheme !== null) {
    const found = LAB_THEMES.find((candidate) => candidate === rawTheme);
    if (found === undefined) {
      notices.push({
        parameter: "theme",
        code: "invalid-value",
        text: `theme must be light or dark. "${rawTheme}" is neither, so the lab is showing light.`,
      });
    } else {
      theme = found;
    }
  }

  let capture = false;
  const rawCapture = take("capture");
  if (rawCapture !== null) {
    if (rawCapture === "1") capture = true;
    else if (rawCapture !== "0") {
      notices.push({
        parameter: "capture",
        code: "invalid-value",
        text: `capture must be 0 or 1. "${rawCapture}" is neither, so review chrome is showing.`,
      });
    }
  }

  return Object.freeze({
    state: Object.freeze({
      v,
      mode,
      scenario,
      homeScope,
      workspaceId,
      planningPeriodId,
      period,
      lensProjectId,
      event,
      item,
      theme,
      capture,
      scopeFromScenario: !scopeNamed,
    }),
    notices: Object.freeze(notices),
  });
}

// ── The builder ─────────────────────────────────────────────────────────────

/**
 * A lab URL with no candidate in it.
 *
 * This is what the assembly writes. It has to be candidate-free, because a
 * link built from the variant is a per-candidate difference in the props, and
 * the whole point of the scaffold is that the four candidates are handed the
 * same object. `withCandidateVariant` puts `v` back at render time, so a
 * director clicking a link inside candidate 3 stays in candidate 3.
 *
 * `mode` and `scenario` are always emitted even at their defaults: a lab link
 * is quoted in a ballot, a bug report and a capture manifest, and an implicit
 * value in any of those is a link that means something different after the
 * default changes. Everything else is omitted at its default.
 */
export function buildLabHref(
  state: Partial<LabViewState> & Readonly<{ mode: HomeMode; scenario: ScenarioId }>,
): string {
  const params = new URLSearchParams();
  params.set("mode", state.mode);
  params.set("scenario", state.scenario);
  if (state.homeScope) params.set("homeScope", state.homeScope);
  if (state.planningPeriodId) params.set("planningPeriodId", state.planningPeriodId);
  if (state.workspaceId) params.set("workspaceId", state.workspaceId);
  if (state.period && state.period !== DEFAULT_PERIOD) params.set("period", state.period);
  if (state.lensProjectId) params.set("lensProjectId", state.lensProjectId);
  if (state.event) params.set("event", state.event);
  if (state.item) params.set("item", state.item);
  if (state.theme && state.theme !== DEFAULT_THEME) params.set("theme", state.theme);
  if (state.capture) params.set("capture", "1");
  return `${LAB_ROUTE_PATH}?${params.toString()}`;
}

/**
 * Put a candidate back into a lab href. Total, and a no-op on anything that is
 * not a lab link, so the shell can run it over the whole props tree without
 * having to know which strings are hrefs.
 *
 * `v` goes first, which is the order `buildLabHref` leaves room for, so the
 * decorated string is byte-identical to what `buildLabUrl` would have written
 * for the same state. Two URLs for one state stay comparable in a test, a diff
 * and a capture filename.
 */
export function labHrefWithVariant(href: string, v: LabVariantNumber): string {
  if (href === LAB_ROUTE_PATH) return `${LAB_ROUTE_PATH}?v=${String(v)}`;
  if (!href.startsWith(`${LAB_ROUTE_PATH}?`)) return href;
  return `${LAB_ROUTE_PATH}?v=${String(v)}&${href.slice(LAB_ROUTE_PATH.length + 1)}`;
}

/**
 * The ONLY way a complete lab URL is written: a href with its candidate named.
 * The picker, the review drawer and every test use it.
 */
export function buildLabUrl(
  state: Partial<LabUrlState> & Readonly<{ v: LabVariantNumber; mode: HomeMode; scenario: ScenarioId }>,
): string {
  return labHrefWithVariant(buildLabHref(state), state.v);
}

/** The same URL with one field replaced. Every control in the lab uses this. */
export function labUrlWith(
  state: LabUrlState,
  patch: Partial<LabUrlState>,
): string {
  return buildLabUrl({ ...state, ...patch });
}

/** The production Home route each mode maps to, for the return-path rows. */
export const LAB_MODE_TO_HOME_ROUTE: Readonly<Record<HomeMode, string>> =
  Object.freeze({
    today: "/app/home",
    inbox: "/app/home/inbox",
    "my-work": "/app/home/my-work",
    analytics: "/app/home/analytics",
    briefing: "/app/home/briefing",
  });

export type { HomeMode, ScenarioId, LabDirection };
