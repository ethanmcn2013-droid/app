# Home aggregate destinations

Reviewed 4 September 2026 against a dirty task branch based on 9105c81a; source-receipt.json pins the actual changed production files rendered. The implementation commit is recoverable from this file's Git history.

An overload or crowded-week observation describes a reading scope. Home now opens the full briefing for that same authorised workspace or planning period. It labels the scope rather than the first contributing project. Individual task observations retain encoded object routes. The visible aggregate action reads “Read”; its accessible name includes “Read full briefing”. Ranking and analytics producers are unchanged.

Seven focused tests execute the actual engine/projection, actual briefing route with explicit framework/auth/DB boundaries, and rendered Home. They cover overload, crowded week, a multi-project planning scope, path encoding, loss of project access at the destination, visible action semantics and new-user behavior. Typecheck, focused lint, module boundaries and first-contact checks pass.

The reproducible fixture renders the actual engine, Home projection and HomeView with repository CSS. It substitutes the authenticated briefing orchestrator, analytics and Next link boundary. Desktop 1440×1000 and mobile390×844 were inspected in the Codex browser. Keyboard Enter and pointer click both navigated to /app/home/briefing?contextVersion=2&workspaceId=project-b. Mobile scroll width equals390; console warning/error collection is empty. The fixture destination explicitly records navigation only; it is not an authenticated App response. The source test separately executes the actual briefing handler and scope authorization with synthetic identity/catalog boundaries.

Desktop/mobile images and browser-receipt.json are observed outputs. The first fixture lacked an explicit UTF-8 declaration and rendered punctuation incorrectly; that fixture defect was corrected and the page reloaded before these retained captures. A fullPage screenshot call was unavailable; normal viewport captures succeeded. No full-suite shell, live session, analytics delivery, four-breakpoint registry completion, council approval or human comprehension is claimed. The existing tasks.page.app-home registry remains partially covered.

Reproduce from the App checkout, using its pinned dependencies:

    node docs/guides/evidence/home-aggregate-links/build-fixture.mjs . <scratch-output>
    node docs/guides/evidence/home-aggregate-links/serve-fixture.mjs <scratch-output> . 4403
    pnpm exec tsx --import ./src/test/register-server-only.mjs --test src/app/app/home/home-data.test.tsx

Open http://127.0.0.1:4403 with the existing browser preview workflow. The server binds loopback, serves only the generated fixture/public assets, and uses no credentials or database.

## Follow-up: preserve explicit read scope at both receiving pages

The deeper destination review found a separate existing substitution: the real briefing orchestrator used the saved scope when an explicit scope was unavailable. Home also ignored an incoming workspaceId, and its footer could return to the saved briefing. These paths now share a pure hint parser. Home and Full Briefing honor an explicit authorised workspace or enabled planning period without changing the Active Project cookie. Unsupported, malformed or unavailable explicit scopes reach the existing neutral not-found boundary. A bare visit retains the saved reading scope and normal first-use behavior. Canonical links carrying both workspace and parent period retain the narrower workspace scope.

Thirteen checks pass: the previous projection/component cases plus actual Home/Briefing route and real orchestrator cases for saved A versus explicit B, removed/missing project, both period flag states, disabled/missing period, malformed arrays, and bare-entry recovery. The orchestrator tests use its real scope authorization and data-loading control flow, substituting only analytics preferences, membership catalog, task reads and read-state stores. They prove no task read occurs after an unavailable explicit scope; no live membership/database request is claimed. A demo regression also passes. Typecheck, focused ESLint and module boundaries pass.

The final retained screenshots/source receipt were rebuilt and recaptured after the footer/projection change. Desktop keyboard activation of “Open full briefing” and mobile activation of the aggregate row both retain project-b; mobile has no page overflow and the console error/warning collection is empty. Prior captures remain in commit08550fa1. The inherited generic not-found screen was not visually accepted in this slice. Full authenticated suite, four-breakpoint Home coverage and human comprehension remain open.

## Independent challenge: alternate analytics engine

Independent review of a16b2651 reproduced HOME-01: with SIGNAL_ANALYTICS_V1_ENABLED enabled, the real dispatcher could ignore canonical workspaceId B without a sourceProduct marker and authorize saved A. Malformed or disabled scope hints also bypassed the legacy parser. The review did not demonstrate unauthorized disclosure; it demonstrated incorrect project selection in a supported configuration.

The dispatcher now validates the shared hint before choosing its engine and maps canonical workspaceId to the analytics workspace claim. Conflicting claims are refused. The analytics context authorizes an explicit requested project directly rather than treating the bounded navigation catalog as authority; saved scope is used only for a bare visit. Typed invalid/forbidden/missing-scope responses use the existing not-found boundary. Legacy Label filters and planning-period engine selection remain compatible.

Fifteen Home-file tests plus the separately retained demo regression pass (16 total); TypeScript and focused ESLint pass. The new tests execute the actual dispatcher, page-data helper, analytics context, URL normalizer and parser with synthetic identity/catalog boundaries. They verify the exact project delivered to the policy, including an authorized candidate outside the bounded catalog, and neutral refusal before policy for malformed/conflicting hints. The policy itself is a boundary stub in these new cases; these checks are not a complete authenticated analytics rendering or preference-storage receipt. Existing actual-orchestrator tests and a16 rendered Home captures remain separately scoped evidence. Fresh independent verification of this repair is required before integration.
