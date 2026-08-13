import { requireLabReviewer } from "@/lib/home-layer/lab/guard";
import { HOME_FIXTURE_SCENARIOS, HOME_MODES } from "@/lib/home-layer/fixtures";
import {
  assembleCandidateProps,
  buildLabUrl,
  labVariant,
  LAB_SCOPES,
  LAB_THEMES,
  LAB_VARIANTS,
  MODE_NAMES,
  parseLabUrl,
  scenarioScopeOf,
  withCandidateVariant,
  type LabUrlState,
} from "@/lib/home-layer/lab-shell";
import { loadCandidate } from "./candidates/registry";
import { ReviewChrome, type DrawerGroup, type PickerEntry } from "./review-chrome";
import "./lab-chrome.css";

/**
 * The protected Home operating-layer lab. One page, one candidate at a time.
 *
 * ── Why the guard is called here as well as in the layout ──────────────────
 *
 * Measured on this route at this base: with `requireLabReviewer()` in the
 * layout ONLY, `GET /lab/home-operating-layer` returned a correct 404 whose
 * body still carried the complete React Server Component payload of the page
 * beneath it. The layout threw; the page had already rendered beside it. A
 * layout guard withholds the rendered screen, not the render. This page
 * renders fixture worlds in permission-limited, revoked and partial states, so
 * it awaits the guard itself and never produces a payload at all.
 * `lab-isolation-contract.test.mjs` enforces it on every page added here.
 *
 * ── Why there is one page and not five ─────────────────────────────────────
 *
 * `?v=` has to be the switch. A route segment per candidate would need a
 * redirect from the canonical URL, and the isolation contract forbids a
 * redirect anywhere in this family — the lab's only refusal is a 404, and a
 * redirect confirms the route exists. One page also keeps
 * `experience/registry.json` at one entry for this family, which matters
 * because that file is not this programme's to write.
 *
 * ── Why the candidate is a Server Component ────────────────────────────────
 *
 * `total_client_js` counts lazy chunks, so a four-direction lab cannot be
 * code-split out of the measurement, and the last multi-shell lab cost 19.1 KB
 * and was deleted for it. Four candidate trees on the client would spend the
 * programme's entire headroom on a surface that never ships. Switching costs a
 * server round trip; on the review machine that is a few milliseconds, and the
 * picker highlight moves at once either way.
 */

export const dynamic = "force-dynamic";

export default async function HomeOperatingLayerLab({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireLabReviewer();

  const parsed = parseLabUrl(await searchParams, scenarioScopeOf);
  const state: LabUrlState = parsed.state;
  const variant = labVariant(state.v);

  /**
   * Assemble once, candidate-blind, then name the candidate in the links.
   *
   * `assembleCandidateProps` takes a state with no `v` in it, so the four
   * directions are provably handed one object built from one input.
   * `withCandidateVariant` then appends the chosen variant to every lab href,
   * which is what keeps a director inside candidate 3 when they open the full
   * briefing from candidate 3. Data first, navigation second, never mixed.
   */
  const props = withCandidateVariant(assembleCandidateProps({ state }), variant.v);
  const candidate = await loadCandidate(variant.slug);

  const stage = (
    <div
      className="lab-stage"
      data-theme={state.theme === "dark" ? "dark" : undefined}
      style={{ colorScheme: state.theme }}
    >
      {candidate.found ? (
        candidate.render(props)
      ) : (
        <main className="lab-missing" id="app-main-content" tabIndex={-1}>
          <h1>{variant.label} is not built yet</h1>
          <p>
            The shell, the data and the controls are ready. This direction has
            no folder under <code>candidates/{variant.slug}/</code> yet, so
            there is nothing to render here.
          </p>
          <p>
            The other three directions are unaffected. Use the picker, the
            number keys or the arrow keys to move between them.
          </p>
        </main>
      )}
    </div>
  );

  // Capture mode removes every piece of review chrome from the document, not
  // just from the screen: the picker, the drawer and the replay wrapper are
  // never rendered, so a capture holds the candidate and nothing else.
  if (state.capture) return stage;

  const linkTo = (patch: Partial<LabUrlState>) => buildLabUrl({ ...state, ...patch });

  const entries: readonly PickerEntry[] = LAB_VARIANTS.map((variant) => ({
    v: variant.v,
    label: variant.label,
    href: linkTo({ v: variant.v }),
    built: true,
  }));

  const groups: readonly DrawerGroup[] = [
    {
      legend: "Mode",
      options: HOME_MODES.map((mode) => ({
        label: MODE_NAMES[mode],
        href: linkTo({ mode, item: null, event: null }),
        current: mode === state.mode,
      })),
      note: "The full briefing is depth from Today, not a fifth mode.",
    },
    {
      legend: "World",
      options: HOME_FIXTURE_SCENARIOS.map((world) => ({
        label: world.label,
        href: linkTo({
          scenario: world.id,
          homeScope: scenarioScopeOf(world.id).homeScope,
          workspaceId: scenarioScopeOf(world.id).workspaceId,
          planningPeriodId: scenarioScopeOf(world.id).planningPeriodId,
          lensProjectId: scenarioScopeOf(world.id).lensProjectId,
          item: null,
          event: null,
        }),
        current: world.id === state.scenario,
      })),
      note: props.world.proves,
    },
    {
      legend: "What Home reads",
      options: LAB_SCOPES.map((scope) => ({
        label:
          scope === "project"
            ? "One project"
            : scope === "planning-period"
              ? "This season"
              : "Every project",
        // The Planning Period id is the operand of the scope, so the link that
        // asks for the season carries the season. Without it the parser reads a
        // scope with no operand and falls inward to one project, and the
        // control looks broken rather than refused.
        href: linkTo({
          homeScope: scope,
          planningPeriodId:
            scope === "planning-period"
              ? (state.planningPeriodId ?? scenarioScopeOf(state.scenario).planningPeriodId)
              : null,
        }),
        current: scope === state.homeScope,
      })),
      note: props.chrome.scope.helpLine,
    },
    {
      legend: "Theme",
      options: LAB_THEMES.map((theme) => ({
        label: theme === "light" ? "Light" : "Dark",
        href: linkTo({ theme }),
        current: theme === state.theme,
      })),
      note: null,
    },
    {
      legend: "Capture",
      options: [
        {
          label: "Open with no review chrome",
          href: linkTo({ capture: true }),
          current: false,
        },
      ],
      note: "Every control here is in the URL, so a capture and a review look at the same screen.",
    },
  ];

  return (
    <ReviewChrome
      entries={entries}
      activeV={state.v}
      pickerPosition={candidate.found ? candidate.pickerPosition : "bottom"}
      groups={groups}
      notices={parsed.notices.map((notice) => notice.text)}
    >
      {stage}
    </ReviewChrome>
  );
}
