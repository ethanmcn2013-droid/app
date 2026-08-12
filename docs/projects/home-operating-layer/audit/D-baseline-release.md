# D — Baseline, browser, accessibility, performance and release audit

**Worktree** `_wt-home-layer` · **Branch** `feat/home-operating-layer` · **Base SHA** `a849fc40e46787a39e499fc94b171a5dfb898821`
**Method** static read of the harness. No installs, no builds, no dev servers, no state-mutating git.
Three read-only commands were executed to observe current verdicts and are marked as such inline.
Every path below is repo-relative to the worktree.

---

## 0. The one-paragraph answer

The harness is unusually honest for its size: it self-tests its own rules, refuses to
report a green from an empty population, hashes its evidence, and bans automation from
awarding taste scores. But **it has never certified anything, the 9.5 gate cannot block a
merge, there is no visual-regression baseline anywhere in the repo, and every rendered
proof it produces comes from one browser engine, in demo mode, at one theme, no narrower
than 390 px.** A later wave that says "the harness certified it" will be wrong. What the
harness proves is listed in §1–§9; what it cannot is listed in §10.

---

## 1. package.json scripts — what each actually runs

Source: `package.json:6-61`. 55 scripts. The verification-related ones:

### 1.1 Static / type / lint

| Script | Line | What it actually runs |
|---|---|---|
| `lint` | `package.json:10` | bare `eslint` — flat config `eslint.config.mjs:5-46`, `next/core-web-vitals` + `next/typescript`, whole repo minus `.next/`, `out/`, `build/`, `.vercel/`, `experience/output/`. Five Notes files carry warn-level grandfathered debt (`eslint.config.mjs:32-38`). |
| `typecheck` | `package.json:11` | `tsc --noEmit --incremental false` |
| `ds:check` | `package.json:12` | `scripts/ds/ds-check.mjs` — vendored SDS 2.0 drift gate. Hard-fails on 3 retired hex values, local redefinition of system tokens, rogue `cubic-bezier`, non-Geist font stacks (`scripts/ds/ds-check.mjs:29-46`); raw-hex debt ratchets per file via `.ds-grandfather.json`, which may only shrink. |
| `first-contact:language` | `package.json:13` | `scripts/check-first-contact-language.mjs` — bans 22 discipline terms and 16 stack terms in JSX text and screen-reaching string props (`scripts/check-first-contact-language.mjs:23-38`). Baseline may only shrink; a *removed* baselined occurrence also fails. |

### 1.2 The test suite

`pretest` (`package.json:45`) runs `test:truth`, so **`pnpm test` always implies `pnpm test:truth` first**.

- `test:truth` (`:47`) → `test:calendar-truth` + `test:signal-ledger` + `test:timeline-owner` + `test:suite-url-and-switcher` + two UI-wave contract tests.
- `test` (`:46`) is a single 12-KB command line. It runs, in order: node `--test` mjs suites, then **nine standalone contract gates** —
  `check-module-boundaries` (cross-module import ban), `check-route-manifest` (guards route dirs against silent deletion, `scripts/check-route-manifest.mjs:3-12`), `check-frame-headers` (AD-012 `X-Frame-Options: DENY` + `/embed` exception, `scripts/check-frame-headers.mjs:3-12`), `check-suite-switcher-contract`, `check-chrome-contract` (56 px sticky chrome, 1240 px grid, `scripts/check-chrome-contract.mjs:4-11`), `check-tap-target-scale`, `check-marketing-waitlist-contract`, `check-loading-contract`, `check-suiteloader-identity` (exact SHA-256 pin of `src/components/system/SuiteLoader.tsx`, `scripts/check-suiteloader-identity.mjs:5`), `check-first-contact-language`
  — then four large `node --test` batches over `.mjs` and `--import tsx` `.ts` suites.

**Trap for later waves:** `check-suiteloader-identity.mjs:5` pins one file to the literal digest `c7a6ed22…7f3b6c`. Any edit to `SuiteLoader.tsx` fails `pnpm test` until that constant is updated in the same change.

### 1.3 The experience harness

| Script | Line | Runs |
|---|---|---|
| `experience:self-test` | `:19` | five self-tests: `validate`, `critical-fixtures`, `review-materiality`, `attest-playwright`, `quality-council`, plus `runtime-policy.self-test.ts` |
| `experience:validate` | `:23` | `scripts/experience/validate.mjs` — registry schema + route coverage |
| `experience:fixtures` | `:20` | `scripts/experience/critical-fixtures.mjs` — fixture↔registry parity, byte-compares regenerated registry |
| `experience:test` | `:24` | `playwright test --config experience/playwright.config.ts` **and then** `attest-playwright.mjs --verify-receipts` |
| `experience:test:timeline-switcher` | `:25` | separate config, same 4 viewport projects |
| `experience:attest` | `:26` | builds `experience/output/evidence-attestation.json` |
| `experience:council:prepare` | `:28` | writes the non-certifying review matrix |
| `experience:council` | `:27` | the 50/52 gate |
| `experience:quality` | `:29` | the aggregate: `self-test && fixtures && validate && ds:check && experience:test && council:prepare && council` |

### 1.4 Budgets, coverage, DB

`perf:budgets` `:14` · `perf:budgets:self-test` `:16` · `journey:coverage` `:17` · `journey:coverage:self-test` `:18` · `db:contract` `:38` (`check-migration-contract.mjs` + `node --test migration-ledger.test.mjs`).

### 1.5 Gates that exist but are wired into nothing

- **`check:contrast`** (`package.json:55`). The only references in the whole repo are the script entry, its own source, and one doc line (`docs/design/timeline-world-class-redesign.md:366`, which already says it does not run in CI). It is in **no** workflow and **not** in `pnpm test`.
- **`test:smoke`** (`package.json:56`) — `e2e/marketing-golden-path.smoke.ts:17-19` states in its own header that it is intentionally not run in CI.
- **`experience/notes-hybrid.playwright.config.ts`** and **`experience/timeline-qa.playwright.config.ts`** have no npm script and appear in no workflow.

### 1.6 The exact ordered command list a full local gate would use

Derived from `ci.yml`, `verify.yml` and `design-quality.yml` combined, in the order CI runs them:

```
pnpm install --frozen-lockfile
pnpm db:contract
pnpm typecheck
pnpm lint
pnpm ds:check
pnpm test                        # pretest → test:truth runs first, automatically
pnpm build
pnpm journey:coverage:self-test
pnpm journey:coverage
pnpm perf:budgets:self-test
pnpm perf:budgets                # requires the build above
pnpm experience:self-test
pnpm experience:validate
pnpm experience:fixtures
pnpm exec playwright install --with-deps chromium
pnpm experience:test             # builds + starts its own server on :4342
pnpm experience:test:timeline-switcher
pnpm experience:council:prepare
pnpm experience:council          # non-blocking in CI — see §2.3
```

Not in that list, and not in CI, but part of an honest local pass:

```
pnpm check:contrast              # needs a live server on :3499
pnpm test:smoke                  # needs a live server on :3000
```

---

## 2. CI workflows

Six files in `.github/workflows/`. Six jobs total.

### 2.1 Job inventory

| Workflow (file) | Job id / name | Triggers | Path filters | Blocking steps |
|---|---|---|---|---|
| `ci` (`ci.yml:1`) | `verify` / "typecheck · test" (`ci.yml:23-24`) | `push` → main, `pull_request` → main (`ci.yml:10-14`) | none | `db:contract`, `typecheck`, `ds:check`, `test`, `lint` |
| `Verify Tasks` (`verify.yml:1`) | `verify` (`verify.yml:13`) | `pull_request` (**no branch filter**), `push` → main (`verify.yml:3-6`) | none | `db:contract`, `lint`, `typecheck`, `test`, `build`, `journey:coverage(+self-test)`, `perf:budgets(+self-test)` |
| `Design quality` (`design-quality.yml:1`) | `registry-and-drift` (`design-quality.yml:56`) | `pull_request` and `push` → main | **yes — see 2.2** | `experience:self-test`, `experience:validate`, `experience:fixtures`, `ds:check`, playwright install, `experience:test`, `experience:test:timeline-switcher`, `experience:council:prepare` |
| `db-migration-drift` (`db-migration-drift.yml:1`) | `drift` / "prod migrations current" (`:21-22`) | `pull_request` → main, `push` → main, cron `0 7 * * *`, dispatch (`:7-14`) | none | `check-prod-migrated.mjs` against production secrets |
| `db-migrate` (`db-migrate.yml:1`) | `run` (`:34`) | `workflow_dispatch` only (`:20-27`) | n/a | status / execute / measure / backup |
| `deploy` (`deploy.yml:1`) | `noop` / "placeholder" (`:19-20`) | `workflow_dispatch` only | n/a | echoes two lines. Vercel's GitHub app does all deploys (`deploy.yml:3-13`). |

### 2.2 Path filters — the reporting hazard

`design-quality.yml:4-46` filters both `pull_request` and `push` to a 15-entry allow-list:
`src/app/**`, `src/components/**`, `src/ds/**`, `src/lib/**`, `src/server/**`, `src/proxy.ts`, `src/env.ts`, `src/instrumentation*.ts`, `src/preview/**`, `public/**`, `next.config.*`, `.ds-grandfather.json`, `experience/**`, `package.json`, `pnpm-lock.yaml`, `scripts/ds/**`, `scripts/experience/**`, and the two `.github` files.

Consequences:

- **A docs-only PR does not trigger `Design quality` at all.** If that job is a required status check, such a PR sits permanently pending and cannot merge. This audit's own deliverable (`docs/projects/**`) is exactly that shape.
- **`src/modules/**` is NOT in the filter.** A PR that only touches `src/modules/notes/**`, `src/modules/timeline/**` or `src/modules/signal/**` — i.e. most product work in this repo — **skips the entire experience harness**, including Axe, overflow, keyboard and the four-viewport render. `ci` and `Verify Tasks` still run, so the PR is not unchecked, but it is un-*rendered*.
- **`scripts/**` outside `scripts/ds/` and `scripts/experience/` is not in the filter**, so a change to `check-tap-target-scale.mjs` or `check-performance-budgets.mjs` does not re-run design quality.

`verify.yml:4` uses bare `pull_request` with no `branches:` key, while `ci.yml:13-14` restricts to `branches: [main]`. **A PR targeting any base other than `main` runs `Verify Tasks` but not `ci`.**

### 2.3 The quality gate is reported, not enforced

`design-quality.yml:97-99`:

```yaml
      - name: Report the 50 of 52 council certification status
        continue-on-error: true
        run: pnpm experience:council
```

`continue-on-error: true` means the 9.5 / 50-of-52 gate **cannot fail a build**. Every other step in that job is blocking; this one is advisory. Any later wave claiming "the council gate passed in CI" is claiming something CI does not test.

### 2.4 A CI step that always fails, silently

`ci.yml:77-79` runs `pnpm run test:parser`. **No `test:parser` script exists** — the only occurrence of that string in the entire repository is that workflow line (verified by repo-wide grep; `package.json:6-61` has no such key). The step is `continue-on-error: true`, so it fails on every single run and is invisible. Dead step, not a dead test.

### 2.5 Which checks are REQUIRED

**Not determinable from this repository.** Required-status-check selection is GitHub branch-protection configuration, stored server-side, not in the tree. There is no `CODEOWNERS`, no rulesets file, and no doc naming required checks (repo-wide grep for "required status", "branch protection", "required check" returns nothing). *Inference, stated as such:* the four candidate check names a maintainer would see are `typecheck · test` (ci), `verify` (Verify Tasks), `registry-and-drift` (Design quality) and `prod migrations current` (db-migration-drift). Confirming which are enforced needs `gh api repos/.../branches/main/protection` — outside this audit's read boundary.

### 2.6 Secret-dependent job on PRs

`db-migration-drift.yml:44-47` reads `secrets.TASKS_DATABASE_URL` / `TASKS_AUTH_TOKEN` on **pull_request**. `check-prod-migrated.mjs:10-15` exits **2** when either is absent. Any PR context without those secrets (a fork PR) makes this job red for a reason unrelated to the change.

---

## 3. The experience harness

### 3.1 `experience/registry.json`

`schemaVersion: signal-experience/1`, `generatedAt: 2026-07-26`, **78 experiences**.
Breakpoints declared once at the top: `mobile 390×844`, `tablet 768×1024`, `desktop 1280×900`, `wide 1440×960`.

Review tiers: **critical 37 · supporting 30 · core 11**.
Implementation status: legacy 39 · live 20 · preview 19.
`auditStatus` is `"registered"` for all 78. `auditScore` is `null` for all 78.
**`approvedBaselineReference` is `null` for all 78** — there is not one approved visual baseline in the repo.

Home is registered as four critical page entries plus four supporting state entries:
`tasks.page.app-home` `/app/home` · `tasks.page.app-home-briefing` `/app/home/briefing` ·
`…-briefing-onboarding` · `…-briefing-settings-notifications` · plus `tasks.state.app-home-{loading,error}` and the two briefing state entries.

Observed (read-only run of `node scripts/experience/validate.mjs`):
`experience:validate: clean - 78 Tasks experiences, 403 required state variants, 312 breakpoint variants`.

### 3.2 `experience/critical-fixtures.json`

37 fixture entries: **28 `evidence: "rendered"`, 9 `evidence: "source-contract"`**. 30 route cases.
Determinism block: `accessMode demo`, `deploymentEnvironment preview`, `locale en-GB`, `timezoneId Europe/London`, `colorScheme light`, `reducedMotion reduce`, `animationPolicy disabled`.

`operatorBlocked` (4 declared exclusions, verbatim scope): production Clerk sign-in/sign-up states; production invite acceptance and redemption mutations; **visual baseline approval, which is founder-owned — "generated screenshots are evidence, not approval"**; and full authed `/app/timeline` states.

Assertions are one of three kinds only (`experience/tests/critical-experiences.spec.ts:24-36`): `url` pathname, exact `text`, or `role` with optional name/count/disabled/value/href. Every assertion carries a `proves[]` array naming the states it evidences.

### 3.3 What one evidence run actually executes

`expectedTitles()` (`scripts/experience/attest-playwright.mjs:25-34`) = one title per rendered-entry case, plus one per `interaction` entry.
28 rendered entries → 30 route-case titles + 3 interaction titles (`command-palette`, `quick-create`, `task-detail-panel`) = **33 spec titles × 4 viewport projects = 132 test outcomes**.

Per outcome, `auditCurrentSurface` (`critical-experiences.spec.ts:377-409`) runs, in order:
`main`/`dialog` visible → 500 ms settle → no document overflow → Axe → optional keyboard entry → state assertions → full-page screenshot **attached** → Timeline contract (route-specific) → runtime issue buffer must be empty.

### 3.4 The attestation mechanism

`scripts/experience/attest-playwright.mjs`:

- **Refuses to attest anything but a perfectly green run.** `:96-98` throws if the report's (project, title) pairs do not *exactly* equal manifest × browser-contract. `:99-108` throws on any non-`passed` outcome, any error, and on `stats.unexpected !== 0` **or `stats.skipped !== 0`** — a skipped test is a failure here.
- **Two digests, deliberately.** `rawArtifactSha256` = exact bytes. `canonicalEvidenceSha256` (`:61-78`) = SHA-256 over `{browserContract, fixtureManifest, playwrightConfig, playwrightSpec}` hashes plus the sorted outcome tuples — stable across timestamps, durations and attachment bytes. `runId` is derived from the canonical digest.
- **Receipt linkage.** `verifyReceipts` (`:138-156`) walks every `experience/reviews/*.json` and throws if a receipt's `runId` or `canonicalEvidenceSha256` does not reproduce from the current run. `experience:test` (`package.json:24`) runs this with `--verify-receipts`, so a stale materiality receipt fails the browser step.
- **Self-test** (`:158-283`) proves the raw digest changes with volatile bytes, the canonical digest does not, a changed outcome *does* change it, and a tampered receipt is rejected.

16 materiality receipts currently live in `experience/reviews/`, all dated `2026-08-12`.

### 3.5 The quality-council gate — exact scoring contract

`experience/quality-council-gate.json`:

| Rule | Value | Line |
|---|---|---|
| Dimensions | **13**, listed at `:100-166` with owner and evidence mode | `:82` |
| Dimension scale | integers **0–4 only** | `:79-81` |
| Maximum raw score | **52** | `:83` |
| Minimum passing raw score | **50 of 52** | `:84` |
| Normalisation | `(raw / 52) × 10` | `:86` |
| Requested 10-point threshold | 9.5 | `:87` |
| **Effective** minimum 10-point score | **9.6153846154** | `:88` |
| Minimum any single dimension | **3** | `:89` |
| Max dimensions allowed at 3 | **2** | `:90` |
| Assessment unit | **required-state × required-viewport** | `:91` |
| Surface score | minimum of every assessment unit | `:92` |
| Product score | minimum of every required surface | `:93` |
| Suite score | minimum of all products **and** the cross-suite journey | `:94` |
| Missing evidence | **fail** | `:95` |
| Rounding | display-only, cannot create a pass | `:96` |
| Averaging across units | **false** | `:97` |

Per-unit required states: **notes 7** (`:14-21`), **tasks 10** (`:31-39`), **timeline 9** (`:49-57`) = **26 states × 4 viewports = 104 assessment units**, × 13 dimensions = **1,352 evidenced taste scores**, plus ≥3 independent council reviews per receipt and 4 journey receipts (`QUALITY_COUNCIL_EVIDENCE.md:126-131`).

14 hard blockers (`:167-182`) include: any dimension below 3; any unit below 50/52; missing state or viewport; missing or hash-mismatched evidence; **unapproved or missing visual baseline**; screenshot diff beyond policy without an approved intentional-change receipt; any serious/critical Axe violation; any uncaught page error, console error, failed request or unexpected HTTP status; document overflow at a required viewport; primary job not completable by keyboard alone; reduced-motion contract failure; **primary mobile touch target below 44 CSS px**; any release-blocking or high-severity open finding; canonical route or cross-suite context contract failure.

Visual-diff policy (`:215-221`): pixelmatch, threshold `0.1`, max diff pixel ratio `0.0025`, `baselineStatusRequired: "approved"`, `missingBaselineBehavior: "fail"`.
Receipt integrity (`:222-236`): eight required hashes; `automationMayAwardTasteScores: false`; `changedHashInvalidatesReceipt: true`.
Source integrity (`:188-200`): sha256 over `src`, `public`, `drizzle`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`.

**Current certification state, declared in the contract itself** (`:238-242`):
`status: "not-assessed"`, `achieved: false`.

**Observed** (read-only run of `node scripts/experience/quality-council.mjs`, this worktree, base SHA):

```
experience:council: 9 failure(s)
  x product receipt notes|tasks|timeline: evidence file does not exist
  x journey receipt mobile|tablet|desktop|wide: evidence file does not exist
  x quality council: suite score is unavailable; every product and journey viewport must reach 50/52
  x quality council B0 baseline.sources.app.sourceTreeSha256 must match the current product/backend source tree
```

`experience/council-reviews/products/` and `experience/council-reviews/journeys/` **do not exist**. Zero certification receipts have ever been authored.

### 3.6 The Wave-0 B0 external baseline

`experience/council-reviews/baselines/wave-0-b0.json`, reviewed 2026-08-09, bound to app commit `d1af9ae…`, deployment `dpl_Eb1He…`, plus the Studio SHA and deployment. Gate: 10 directors, floor 9.5, `any-veto-is-no-pass`. Seven surfaces, all `decision: "no-pass"`:

| Surface | Lowest lens | Council index | Vetoes |
|---|---|---|---|
| tasks-views | 6.8 | 7.80 | none |
| task-cards-detail | 7.4 | 8.04 | none |
| notes | 6.7 | 7.85 | **director-01, director-10** |
| timeline | 7.7 | 8.15 | none |
| landing | 6.8 | 7.67 | **director-01, director-06** |
| about | 6.8 | 8.11 | none |
| pricing | 6.6 | 7.56 | none |

`validateBaselineCouncil` (`scripts/experience/quality-council.mjs:1206-1212`) errors when
`baseline.sources.app.sourceTreeSha256 !== sourceTree.sha256`. **That is already the case at the base SHA** — `a849fc4` is not `d1af9ae`, and the tracked source tree has moved. So the "external-baseline NO PASS" reporting path (`:1392-1416`) does not even engage; the baseline simply reads as stale. **The B0 numbers above are the last real quality reading anyone took, and the gate can no longer verify they describe today's code.**

The gate's own doc is blunt about why the strict path has never run (`QUALITY_COUNCIL_EVIDENCE.md:121-136`): 1,352 + reviews ≈ 1,560 evidenced human judgements, and "a solo operator cannot produce" them, so "the gate as specified does not fail — it simply never runs". Narrowing it is recorded as an open founder decision (`:138-140`).

---

## 4. The browser matrix

**One engine. Four viewports. One theme. Demo mode.**

`experience/playwright.config.ts:44-54`:
- `browserName: "chromium"` — hard-coded.
- `channel: process.env.CI ? undefined : "chrome"` — locally it drives installed Chrome; in CI it uses the bundled Chromium (`design-quality.yml:86` installs `chromium` only).
- `colorScheme` / `locale` / `timezoneId` from `browser-contract.json`: **light**, `en-GB`, `Europe/London`.
- `fullyParallel: false`, `workers: 1`, test timeout 45 s, expect timeout 8 s.

`experience/browser-contract.json:12-29` — the four Playwright projects, viewport-only (no `browserName` override, no device descriptor):

| Project | Viewport |
|---|---|
| `mobile` | **390 × 844** |
| `tablet` | 768 × 1024 |
| `desktop` | 1280 × 900 |
| `wide` | 1440 × 960 |

**The narrowest viewport the harness currently proves is 390 CSS px wide.**
**Firefox does not run. WebKit / Safari does not run.** Repo-wide grep across `experience/*.ts` and `experience/*.json` returns zero occurrences of `firefox`, `webkit` or `Safari`, and `@playwright/test` is the only browser dependency (`package.json:94`).

The web server the harness measures (`playwright.config.ts:59-76`) is a **production build started on port 4342** with
`VERCEL_ENV=preview`, `SIGNAL_ACCESS_MODE=demo`, `NEXT_PUBLIC_TASKS_FIRST_COMPLETION=off`, **`SIGNAL_ANALYTICS_V1_ENABLED=false`**, telemetry disabled.

`experience/timeline-switcher.playwright.config.ts` spreads the base config, so it inherits the same four projects and the same single engine.
`experience/notes-hybrid.playwright.config.ts:20-24` is **desktop-only** (1440 × 1000, `Desktop Chrome`, `en-IE`/`Europe/Dublin`) and runs `next dev`, not a production build — and is wired into no script or workflow.
`experience/timeline-qa.playwright.config.ts` deliberately has no `webServer` and targets an already-running dev server on 3520 — also unwired.

### 4.1 There is no visual-regression testing

`playwright.config.ts:25-26` sets a `snapshotPathTemplate` and `:32-37` configures `toHaveScreenshot` (animations disabled, caret hidden, `maxDiffPixelRatio 0.0025`, `threshold 0.1`). **No spec calls `toHaveScreenshot` or `toMatchSnapshot`** — repo-wide grep across `experience/**/*.ts` finds the string only in the config. The spec instead takes `page.screenshot({fullPage:true})` and `testInfo.attach()`es it (`critical-experiences.spec.ts:229-244`). No `experience/baselines/` directory exists.

So: screenshots are **collected as artefacts**, never **compared**. Combined with `approvedBaselineReference: null` on all 78 registry entries and the council's `missingBaselineBehavior: "fail"`, **a visual regression cannot currently be detected by any automated gate in this repo.**

---

## 5. Accessibility tooling

### 5.1 Axe

`experience/tests/critical-experiences.spec.ts:124-140`:

```ts
const result = await new AxeBuilder({ page }).analyze();
const blocking = result.violations.filter(
  (v) => v.impact === "critical" || v.impact === "serious",
);
expect(blocking...).toEqual([]);
```

- `@axe-core/playwright@^4.12.1` (`package.json:93`), **default ruleset** — no `withTags(['wcag2a','wcag2aa'])`, no `include`/`exclude`, no `disableRules`.
- **Only `critical` and `serious` fail.** `moderate` and `minor` violations are collected and discarded.
- **`incomplete` results are never inspected.** `scripts/check-contrast.mjs:8-13` records precisely why that matters here: axe marks this design's translucent glass panels and dimmed ancestors as *incomplete*, not *failed*, "so a clean axe run proves nothing here".
- Runs once per (title × viewport) on the settled state — 132 Axe passes per full run.

### 5.2 Contrast

`scripts/check-contrast.mjs` computes WCAG 2.1 SC 1.4.3 ratios itself rather than trusting axe: 4.5:1 normal, 3:1 large (≥24 px any weight, or ≥18.66 px at ≥700). It resolves `color(srgb …)` (the form `color-mix` computes to in Chromium), composites ancestor `opacity` down the chain, and alpha-composites every ancestor `background-color` from `<html>` down (`:16-31`). Default sweep is `/app/tasks · /app/notes · /app/timeline × light · dark` (`:38-45`). **No baseline, no waiver list** (`:60-66`) — it exits non-zero on any AA violation *and* on any colour it could not parse.

Its own declared blind spots (`:33-37`): cannot see through `background-image` (photos/gradients), cannot simulate `backdrop-filter` blur, cannot inspect `::before`/`::after` generated content.

**It is in no workflow and not in `pnpm test`** (§1.5). It needs a live server on `:3499`. In the in-flight baseline capture at this base SHA (`docs/projects/home-operating-layer/verification/BASELINE.json:15` and `baseline-logs/check_contrast.log`) it exited **1** with `ERR_CONNECTION_REFUSED` on all six surface/theme combinations — `0 contrast failure(s), 0 unparseable colour(s), 6 unmeasurable surface(s)`. That is a "no server", not a "no violations": **there is currently no contrast measurement of this codebase at all.**

### 5.3 Tap targets

Two different things, both narrow:

1. **`scripts/check-tap-target-scale.mjs`** (in `pnpm test`) is a **source-text** gate, not a measurement. This repo remaps Tailwind's numeric spacing scale — `--space-11: 80px`, so `min-h-11` renders **80 px, not the 44 px every developer reads** (`:3-13`). The gate bans index-11 *sizing* utilities and tells you to write `min-h-[44px]` instead. Its scope note (`:19-23`) is explicit: it covers sizing utilities only; the same divergence at indices 7–10 and 12 affects ~185 more sizing utilities and ~270 spacing utilities and is *not* enforced. One grandfathered file remains (`src/app/invite/[token]/page.tsx`, 1 hit).
2. **One real rendered measurement exists**, and only one: `critical-experiences.spec.ts:360-365` measures the minimum button height inside `[data-timeline-scroll-viewport]` on the `mobile` project for the `/s/[token]` couple artifact and asserts ≥ 44.

Everything else the gate contract calls a "primary mobile touch target below 44 CSS pixels" hard blocker (`quality-council-gate.json:179`) is unmeasured.

### 5.4 Keyboard and reduced motion

- **Keyboard** (`:185-218`): presses `Tab` up to 24 times and passes as soon as **one** visible element matches `:focus-visible`. This proves *a focus target is reachable* — nothing more. It is not the gate contract's "primary job cannot be completed with keyboard only" (`quality-council-gate.json:178`), which no automated check implements.
- **Reduced motion** (`:220-227`): waits for `load`, waits 300 ms, then `page.emulateMedia({reducedMotion:"reduce"})`. This is the *audit condition*, applied so screenshots are stable — it is not a test that a reduced-motion variant exists or differs.
- **Overflow** (`:142-147`): `documentElement.scrollWidth - clientWidth <= 1` per viewport. Real, and the only automated responsive assertion.
- **Runtime hygiene** (`:60-122`, `:408`): page errors, console errors, HTTP ≥ 400 and failed requests are all collected and must be empty, with narrow declared allowances in `experience/runtime-policy.ts` (intentional EventSource teardown, completed qualified-view write, and an expected-404 main document).

---

## 6. Performance ratchets and bundle budgets

**Where:** `contracts/venue-surface-performance-budgets.v1.json` (v1, set 2026-08-03 by E08.10).
**Checker:** `scripts/check-performance-budgets.mjs`. **Runs in:** `verify.yml:61-64` only.

Four measured budgets, each carrying `budget` (target) and `ceiling` (**the ratchet — this is what fails**):

| id | Metric | Unit | Budget | Ceiling | Population |
|---|---|---|---|---|---|
| `shared_runtime` | `build-manifest` `rootMainFiles` + `polyfillFiles`, gzipped | KB gzip | **170** | **247** | count of shared chunk files |
| `total_client_js` | every `.js` under `.next/static/chunks`, gzipped | KB gzip | **936** | **940** | count of client chunks |
| `largest_chunk` | single heaviest chunk, gzipped | KB gzip | **63** | **63** | count of client chunks |
| `repo_images` | heaviest raster in `public/`, on disk uncompressed | KB | **200** | **200** | count of raster images |

Ceilings may only be lowered; raising one is recorded as a founder decision, not an edit (`:8`, and the `total_client_js` history at `:26` records an explicit 930→940 raise by T·134). `shared_runtime` is **currently over target by 76 KB** and says so (`:17`).

**Empty-population semantics** — the whole point of the script (`scripts/check-performance-budgets.mjs:40-46`, `:99-120`): a budget whose population is 0 **exits 3** unless the contract declares `emptyPopulation: {expected, reason}`, and even when declared it prints `no data (declared)`, never `ok`. `repo_images` is exactly that case: `public/` holds five SVGs and no raster image at all (`:44-48`). Exit codes: `0` pass · `2` ceiling breached · `3` nothing measured / contract-script disagreement. A missing `.next/build-manifest.json` is a hard exit 3, not a zero reading (`:247-253`).

**Declared unmeasured, with reasons** (`:51-88`) — and explicitly *not* claimed as passing:
`lcp_p75_ms` (target 2500), `inp_p75_ms` (200), `cls_p75` (0.1), `server_p75_ms` (800), `per_route_first_load_js` (Next 16 + Turbopack no longer emits `app-build-manifest.json`), `uploaded_image_delivery` (Vercel Blob, 10 MB free-tier cap in `src/lib/storage-config.ts`, no delivery budget set).

Reason given for the first four: **no RUM provider is wired anywhere** — no `@vercel/speed-insights`, no `@vercel/analytics`, no `web-vitals`, no `useReportWebVitals`, and no Lighthouse job in any workflow (verified 2026-08-03 in the contract, and consistent with `package.json:63-105` today).

In the in-flight baseline capture at this base SHA, `perf:budgets` exited **3** with "no production build found" (`BASELINE.json:17`, `baseline-logs/perf_budgets.log`) — i.e. correct refusal, not a breach.

**Journey coverage** (`scripts/check-journey-coverage.mjs`, contract `contracts/sponsored-journey-coverage.v1.json`) is the sibling ratchet: it expands `pretest` + `test` (following `pnpm <script>` chains) into the set of files CI actually executes and fails when a file named as covering a journey segment is not in that set (`:20-27`). It exists because on 2026-08-03 seven well-written test files were executed by nothing. It asserts coverage *exists*, explicitly not that the tests are good (`:29-31`). Exit `0` / `2` (segment lost coverage) / `3` (malformed manifest). The `couple_publishes` segment carries an open-risk note that R-031 and R-033 are undecided product questions no test here closes.

---

## 7. Feature flags

**Two independent server-side mechanisms. No client-side flag system, no flag provider, no runtime flag store.**

### 7.1 `SIGNAL_ANALYTICS_V1_ENABLED` — yes, it exists

`src/modules/signal/server/analytics/feature-flag.ts` — `import "server-only"` at line 1:

```ts
export function isSignalAnalyticsEnabled(): boolean {
  const configured = process.env.SIGNAL_ANALYTICS_V1_ENABLED?.trim().toLowerCase();
  if (configured === "true" || configured === "1") return true;
  if (configured === "false" || configured === "0") return false;
  return false;                       // :15 — closed by default, everywhere
}
```

- **Default: off in every environment**, including dev and test. An explicit `false` always wins (`:5-9`).
- **Exactly one consumer** in the whole repo: `src/modules/signal/app/signal-brief-page.tsx:6`. It switches the progressive analytics surface on the Full Briefing page and nothing else.
- **The evidence harness pins it off**: `experience/playwright.config.ts:73` sets `SIGNAL_ANALYTICS_V1_ENABLED: "false"`. Every rendered proof in the harness is therefore a proof of the flag-**off** surface. There is no evidence run for the flag-on state.

### 7.2 The planning flag family

`src/lib/planning/flags.ts` — six flags (`planningPeriods`, `contextualOnboarding`, `crossWorkspaceSignal`, `audienceTimeline`, `schoolPilot`, `lifecycleDuplication`), each backed by one `SIGNAL_*_ENABLED` env var (`:11-18`). Truthy set is `1|true|yes|on` (`:20-23`).

**The default is inverted relative to §7.1**: `const defaultEnabled = env.NODE_ENV !== "production"` (`:33`) — **on in dev and test, off in production**. Documented intent: "New writes default off in production and on in test/development. Disabling them never removes access to an existing workspace or changes membership checks" (`:25-29`). Covered by `src/lib/planning/flags-analytics.test.ts` in `pnpm test`.

**Trap:** the two conventions disagree. A new flag copied from `flags.ts` is on in dev; one copied from `feature-flag.ts` is off in dev. Pick deliberately and say which in the PR.

### 7.3 Environment validation

`src/env.ts` (server-only) runs once from `instrumentation.ts:12-15`. Four vars are fatal in real production (`TASKS_DATABASE_URL`, `TASKS_AUTH_TOKEN`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `:14-20`); ten more warn (`:22-45`). It **skips entirely** when `NODE_ENV !== production` or demo mode (`:53-54`) — so the harness's demo-mode production build never exercises it.

---

## 8. Migration tooling

### 8.1 The ledger

`drizzle/migration-ledger.json` (`schemaVersion: tasks-migration-ledger/1`) — **28 entries**:

- `0000`–`0013`: **`legacy-adopt-only`** — reached production through a mix of migration SQL and historical schema pushes. **They must never be replayed** (`drizzle/MIGRATIONS.md:15-20`).
- `0014_current_schema_baseline`: **`baseline`** — the supported fresh-database baseline (24 tables, 27 named indexes, two guard triggers).
- `0015`–`0027`: **`forward`** (13 migrations). Latest: `0027_share_link_token_hash`.

16 receipts in `drizzle/receipts/`. The DB keeps an exact row per migration in `signal_schema_migrations`; Drizzle's `__drizzle_migrations` is maintained only as a compatible high-water mirror, and the runner "verifies every exact row and hash; it never trusts only the greatest timestamp" (`MIGRATIONS.md:8-12`).

### 8.2 `pnpm db:contract` — the pre-flight gate

`package.json:38` → `scripts/check-migration-contract.mjs` + `node --test scripts/db/migration-ledger.test.mjs`.
The checker asserts the *scripts themselves* have not been loosened (`check-migration-contract.mjs:12-31`): `dev` must not run `drizzle-kit push`; `db:migrate` must be **exactly** `node scripts/db/migrate.mjs migrate`; `db:bootstrap` must start with `${migrate} &&`; `db:adopt` must be exactly the receipt-backed path; `db:contract` must itself run the fail-closed ledger tests. Then `loadAndValidateLedger()` validates the ledger and prints `ok (N SQL files, N receipts, baseline <id>)`.
It runs first in **both** `ci.yml:45-46` and `verify.yml:26`.

### 8.3 The safe production path

Only two ways in (`AGENTS.md` "Database release gate", `DEPLOY.md:93-125`, `MIGRATIONS.md:70-94`):

1. **Locally / operator:**
   `pnpm db:contract` → `pnpm db:status -- --environment=production --confirm-production=tasks` → create a `tasks-migration-execution/1` receipt containing verified backup hash, isolated-copy dry-run result, exact target database identity, environment, current ledger hash and pending migration ids/hashes → `pnpm db:migrate -- --environment=production --confirm-production=tasks --receipt=<file>`.
2. **CI:** the `db-migrate` workflow with `command=execute` (`db-migrate.yml:76-82`), which runs `scripts/db/execute-production-migration.mjs`. That script does, in order (`:1-21`): logical backup (schema DDL + every row, JSONL, hashed) → restore into a local file DB and apply the pending forwards there via the ordinary runner → write the execution receipt → the real apply through `migrate.mjs`, which re-validates all of it inside one write transaction. Evidence is retained 90 days as the `db-migration-evidence` artifact (`:91-99`).

`migrate.mjs:493` enforces `--confirm-production=tasks` for any production command; `db-migrate.yml:61-64` documents that the human confirmation this stands in for is the deliberate `workflow_dispatch`.

### 8.4 Explicitly forbidden

- **Never `drizzle-kit push` or `drizzle-kit migrate` against production.** `drizzle-kit migrate`'s pinned LibSQL runner checks only the latest timestamp and does not validate historical hashes (`MIGRATIONS.md:43-46`).
- **Never paste an individual `drizzle/*.sql` into production** (`DEPLOY.md:95-97`).
- **Never replay `0000`–`0013`.**
- `db:push:unsafe` (`package.json:34`) is for disposable local schema forensics only — "not part of development startup, CI, preview, production, or recovery" (`MIGRATIONS.md:97-99`).
- An existing unledgered database **fails closed** with `adoption-required` (`migrate.mjs:449`); adoption needs its own target-bound production receipt, refuses an empty database (`:397`) and refuses an unreceipted Drizzle high-water history (`:421`).

### 8.5 The module-database gap

`pnpm db:migrate` and the `db-migration-drift` alarm **cover the Tasks database only** (`DEPLOY.md:126-137`). Notes, Timeline and the legacy-named Signal DB (which now carries the Home briefing capability and user preferences) keep tracked baselines in `drizzle-notes/`, `drizzle-timeline/`, `drizzle-signal/` and have **no drift alarm**. Stated verbatim in the runbook: *"A SQL file in the repository is not proof that a module database was changed in production."*

**This matters directly to Home.** Home's briefing data lives in the `SIGNAL_*` database, which is on the un-alarmed side of that boundary.

---

## 9. Telemetry / Sentry

Three `Sentry.init` call sites. **`sendDefaultPii: false` on all three.**

| Where | Line | Notes |
|---|---|---|
| Browser | `src/instrumentation-client.ts:34` | `tracesSampleRate 0.1`, `replaysSessionSampleRate 0`, `replaysOnErrorSampleRate 0.1`, `beforeSend: scrubEvent` |
| Node server | `src/instrumentation.ts:25` | `tracesSampleRate 0.1`, `beforeSend: scrubEvent` |
| Edge | `src/instrumentation.ts:35` | same |

All three no-op when the DSN is unset (`instrumentation-client.ts:27`, `instrumentation.ts:17`).

**Couple-facing surfaces initialise Sentry not at all.** `instrumentation-client.ts:11-27` gates init on `isAnalyticsExcludedPath(window.location.pathname)` — the *same* boundary GA4 uses, deliberately not a second list. The comment records why this changed: the file previously excluded only `/s`, so `/p`, `/share` and `/embed` still initialised it, which did not satisfy the ratified R-032 / D-033 Option A sentence. Suppressing init (rather than filtering in `beforeSend`) also kills **transactions**, "and on these surfaces the URL is the disclosure" (`:20-22`).

**Scrubbing** (`src/lib/sentry-scrub.ts`): `user` reduced to `{id}` only; `request.cookies`, `request.data`, `request.query_string` deleted; headers `cookie`/`set-cookie`/`authorization`/`x-forwarded-for`/`x-real-ip`/`stripe-signature` plus any `x-clerk-*` or `svix-*` dropped (`:14-21`, `:96`); URL path segments `/s|share|invite|redeem|oauth/<value>` rewritten to `[redacted]` and `code|token|access_token|refresh_token|id_token|state` query values redacted (`:25-34`); keys matching `/(token|code|secret|authorization|cookie|password|credential)/i` stripped from `tags`, `extra`, `contexts` (depth 3); message and exception values text-redacted; breadcrumbs to `clerk.`, `stripe.com`, `svix.com`, `/api/webhooks/`, `/api/auth/` dropped entirely (`:67-75`).

Covered by `src/lib/sentry-scrub.test.ts` and `src/server/public-surface-analytics-contract.test.mjs`, both in `pnpm test` (`package.json:46`).

---

## 10. What this harness does NOT prove

Ordered by how likely a later wave is to over-claim it.

### Certification
1. **It has never certified anything.** `quality-council-gate.json:238-242` says `status: "not-assessed", achieved: false`; `experience/council-reviews/products/` and `.../journeys/` do not exist; the observed run returns 9 failures. No product or journey receipt has ever been authored.
2. **The 9.5 gate cannot block a merge.** `design-quality.yml:98` — `continue-on-error: true`.
3. **The last real quality reading is stale.** The B0 baseline is bound to source-tree `864cc0d0…` at commit `d1af9ae…`; the base SHA no longer matches, so the gate reports the binding as broken rather than reporting the 6.6–7.7 floors it contains.
4. **"Deterministic gates green" ≠ "quality proven".** The gate's own doc says so (`QUALITY_COUNCIL_EVIDENCE.md:103-104`): *the machinery works and has never certified anything.*

### Browser and rendering
5. **No Firefox. No WebKit/Safari.** Chromium only. Zero coverage of Safari-specific layout, `-webkit-` behaviour, iOS Safari viewport units, or Firefox focus/scroll semantics.
6. **Nothing narrower than 390 px.** No 320 px, no 360 px. Small-Android and split-screen widths are unproven.
7. **No real browser zoom and no reflow test.** WCAG 1.4.10 (400 % zoom / 320 CSS px reflow) is checked by nothing. `emulateMedia` and viewport resizing are not zoom.
8. **No visual regression at all.** `toHaveScreenshot` is configured and never called; no `experience/baselines/` exists; `approvedBaselineReference` is `null` on all 78 registry entries. Screenshots are attachments, never comparisons. A pixel regression ships silently.
9. **Dark mode is not rendered by the harness.** `browser-contract.json:9` pins `colorScheme: "light"`. The only dark-mode instrument is `check:contrast`, which runs nowhere.
10. **One locale, one timezone.** `en-GB` / `Europe/London`. No RTL, no long-string/translation overflow, no other date formats.
11. **No motion evidence.** Animations are disabled for capture. Nothing proves an animation looks right, respects `prefers-reduced-motion` by rendering differently, or does not jank.

### Accessibility
12. **No real screen reader.** No NVDA, JAWS, VoiceOver or TalkBack, ever. Axe reads the accessibility tree; it does not prove an announcement is comprehensible or correctly ordered.
13. **Axe moderate/minor violations are discarded**, and **axe `incomplete` results are never read** — which `check-contrast.mjs:8-13` documents is exactly where this design's translucent surfaces land.
14. **There is currently no contrast measurement of this codebase.** The gate exists, is good, is in no CI job, and last exited 1 with six unmeasurable surfaces because no server was up.
15. **Keyboard coverage is one Tab-reachable focus target**, not "the primary job can be completed with keyboard only" — which is a declared hard blocker with no implementation.
16. **Tap targets are a lint on class names, not a measurement.** One rendered ≥44 px assertion exists, on one component, at one viewport. The spacing-scale trap that motivated it still affects ~185 sizing and ~270 spacing utilities outside the gate's scope.
17. **No focus-order, focus-trap, skip-link, live-region or heading-hierarchy assertions** beyond whatever default Axe rules happen to catch.

### Performance
18. **No field Core Web Vitals. No lab Core Web Vitals either.** LCP, INP and CLS are declared unmeasured with reasons; no RUM provider and no Lighthouse job exists anywhere. INP additionally cannot be produced synthetically at all.
19. **No per-route JS weight.** Next 16 + Turbopack emits no `app-build-manifest.json`; `shared_runtime` is the only measurable floor.
20. **`total_client_js` sums every chunk under `.next/static/chunks` whether it loads eagerly or lazily.** Recorded in the contract (`:26`): dynamic-importing the Share panel made the number *worse*. Code-splitting relocates bytes here; it does not reduce this metric.
21. **No server latency.** `server_p75_ms` requires production traffic; there is none.
22. **No uploaded-image budget.** Couple-uploaded Timeline images live in Vercel Blob with a 10 MB per-file cap and no resizing rule or format policy recorded.

### Data, tenancy and environment
23. **Every rendered proof is demo mode.** `SIGNAL_ACCESS_MODE=demo`, `VERCEL_ENV=preview`. Demo mode short-circuits auth, so **no live cross-tenant permission behaviour is exercised in a browser**. Cross-tenant isolation is proven only by `node --test` suites against test databases (`cross-tenant-isolation`, `cross-tenant-negative`, `tenant-scope`, `security-membership-regression`, …).
24. **Production Clerk sign-in/sign-up and real invite/redeem mutations are declared out of scope** by the fixture manifest's own `operatorBlocked` list.
25. **The cross-suite journey fixture is read-only and says so.** `experience/cross-suite-journey.json:11-14`: the traversal "must not be cited as evidence that a mutation persisted between products"; mutation, idempotency, replay and provenance need separately hashed reports from real server actions against isolated temp DBs — which do not exist yet (`status: "required-not-yet-evidenced"`).
26. **`src/env.ts` validation is never exercised by the harness** — it skips whenever `NODE_ENV !== production` or demo mode is on.
27. **`SIGNAL_ANALYTICS_V1_ENABLED=true` has no rendered evidence.** The harness pins it false.
28. **No module-database drift alarm.** `db-migration-drift` covers Tasks only. Notes, Timeline and the Signal/Home briefing DB are unwatched; a SQL file in the repo is not proof a module DB changed in production.
29. **No end-to-end deploy verification.** `deploy.yml` is an explicit no-op stub; `test:smoke` is explicitly not in CI; nothing checks a preview or production URL after deploy.

### Process and reporting
30. **`src/modules/**` changes skip the entire experience harness** because of the `design-quality.yml` path filter. Most Notes/Timeline/Signal product work falls here.
31. **Docs-only PRs never report `Design quality`** — a merge-blocking hazard if it is a required check.
32. **PRs to a non-`main` base skip `ci` but run `Verify Tasks`** (`ci.yml:13-14` vs `verify.yml:4`).
33. **`ci.yml:78` runs a script that does not exist** and has been failing invisibly under `continue-on-error` since it was written.
34. **Automation may never award taste scores** (`quality-council-gate.json:234`) — correctly. Any "the panel scored it 9.x" claim from an agent is not gate evidence.

---

## 11. Two traps that will bite the next wave

### 11.1 CRLF makes `experience:fixtures` fail on Windows and pass in CI

`scripts/experience/critical-fixtures.mjs:506-511` regenerates the registry and byte-compares:

```js
const expectedRegistry = `${JSON.stringify(nextRegistry, null, 2)}\n`;
... else if (readFileSync(registryFile, "utf8") !== expectedRegistry) {
  console.error("experience:critical-fixtures: registry coverage or materiality hashes are stale; run with --write");
```

Verified in this worktree: `git config core.autocrlf` is **`true`**, the committed blob for `experience/registry.json` has **zero CR bytes**, and the working copy has **3,638 CRLFs**. The comparison is LF-generated, so it can never match on Windows.

Independently verified that the content is *not* actually stale: recomputing every entry's materiality hash (SHA-256 of LF-normalised source, first 16 hex) against `registry.json` gives **78/78 match, 0 missing sources**; `generatedAt`, `lastReviewedAt`, all four coverage flags and `approvedBaselineReference` on every mapped entry already equal what the script would write.

**Therefore:** the `experience:fixtures exitCode 1` recorded in the in-flight `docs/projects/home-operating-layer/verification/BASELINE.json:22` is a **Windows line-ending artefact, not a red gate on `main`.** On `ubuntu-latest` this step passes. Do not "fix" it by running `--write` and committing — that produces a no-op diff at best and churns a 118 KB file at worst.

### 11.2 Editing any registered surface's source invalidates the fixture gate

`applyMappedFixtureEvidence` (`critical-fixtures.mjs:309-338`) rewrites `materialityHash` from the source file for every mapped critical fixture. So **any edit to a registered source under a mapped fixture requires `pnpm experience:fixtures:write` in the same change**, or `design-quality.yml:80` fails on Linux too. Separately, `experience:test` runs `attest-playwright --verify-receipts`, and `attest-playwright.mjs:148-154` throws when a checked-in `experience/reviews/*.json` receipt no longer reproduces the current canonical run — so a source edit can also invalidate the 16 materiality receipts dated 2026-08-12. This is the "fixture-manifest edits invalidate all receipts → rebind procedure" trap, now confirmed in code.

---

## 12. Evidence provenance for this report

- All file:line citations are reads of the worktree at base SHA `a849fc4`.
- Three **read-only** commands were executed and are labelled "Observed" where used:
  `node scripts/experience/quality-council.mjs`, `node scripts/experience/validate.mjs`, `node scripts/experience/critical-fixtures.mjs` (no `--write`).
  None writes to the repository on those code paths.
- Materiality-hash and CRLF verification were done with in-memory `node -e` reads; nothing was written.
- Baseline exit codes for `check:contrast`, `perf:budgets` and `experience:fixtures` are quoted from
  `docs/projects/home-operating-layer/verification/BASELINE.json` and `verification/baseline-logs/`, produced by another in-flight session in this same worktree at the same base SHA.
- No install, build, migration, deploy or dev server was run.
