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
