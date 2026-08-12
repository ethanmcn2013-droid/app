# Home operating-layer evidence harness

An extension of the existing `experience/` harness, not a parallel QA stack. It
reads the same fixture universe, produces the same kind of receipts, and its
Playwright config is a sibling of `experience/playwright.config.ts` for reasons
recorded at the top of that config.

## Run it

```bash
# The harness proving itself against surfaces that serve today. Green now.
npx playwright test --config experience/home-layer/home-lab.playwright.config.ts \
                    --project harness-self-proof

# Every pure check, no browser, under a second.
node --import tsx scripts/home-layer/capture-home-lab.mjs --self-test

# What a plan would do, without launching anything.
node --import tsx scripts/home-layer/capture-home-lab.mjs --plan council --dry-run

# Capture. Refuses, loudly, unless the lab is open.
node --import tsx scripts/home-layer/capture-home-lab.mjs --plan full
```

Exit codes: `0` clean · `1` an invariant, axe or forbidden-string failure ·
`2` the lab is not open · `3` usage.

## What is here

| File | What it is |
|---|---|
| `capture-contract.json` | Every viewport, variant, browser, plan and threshold. Nothing else hardcodes a size. |
| `dom-audit.mjs` | The probes that run inside the page. Facts only, never verdicts. |
| `harness.mjs` | The page driver and the seven invariant verdicts. One implementation, shared. |
| `capture-key.mjs` | The ten-axis capture key, its filesystem slug and its digest. |
| `preflight.mjs` | Open · closed · unreachable · degraded, and the reason. |
| `invariants.ts` | The Playwright `expect` wrapper over `harness.mjs`. |
| `home-lab.playwright.config.ts` | 19 projects, generated from the contract. |
| `global-setup.ts` | Runs preflight once, writes it where the specs can read it. |
| `harness-self-proof.spec.ts` | Proves the instrument works. Runs today. |
| `home-lab-invariants.spec.ts` | The behavioural suite. Needs the lab open. |
| `../../scripts/home-layer/capture-home-lab.mjs` | The capture pipeline. |

## The seven standing invariants

1. no horizontal overflow on non-exempt content
2. no indefinite spinner
3. no console or hydration error
4. exactly one `main`
5. exactly one `h1`
6. no nested interactive control inside a wrapping link
7. focus visible and unobscured

Each returns `pass`, `fail` or **`unknown`**, and `unknown` is never a pass. An
empty focus sweep, a missing console collector, an overflow nobody could
attribute — all report `unknown`, and `unknown` fails the assertion helper. An
invariant that was not measured has not been met.

## Opening the lab

The lab is refused in demo and review access mode by design, so the local dev
server and every default Vercel preview answer 404 (`contracts/LAB_ISOLATION.md`
§3, `RISK_REGISTER.md` R-H17). To capture anything real:

```
HOME_REVIEW_LAB_ENABLED=true
SIGNAL_ACCESS_MODE=production
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=…   CLERK_SECRET_KEY=…
HOME_REVIEW_LAB_REVIEWERS=<the reviewer's email>
HOME_LAB_BASE_URL=<that server>
HOME_LAB_STORAGE_STATE=<a Playwright storage state for a signed-in reviewer>
```

Until then preflight reports `closed`, the capture pipeline writes zero
screenshots, and every lab project fails its gate test. That is the harness
working.

## Known limits, stated rather than discovered later

- **Forced colours is Chromium and Firefox only.** Playwright does not emulate
  it on WebKit. Recorded in the contract; those captures do not exist rather
  than existing and being wrong.
- **WebKit does not Tab to links** without full keyboard access, so its focus
  sweep reaches fewer controls than the page offers. The verdict reports
  `unknown` with the shortfall named, never a pass for controls it never
  visited.
- **Cross-engine screenshots are evidence, not baselines.** Text rendering
  differs between engines; a pixel diff across them is not a defect.
- **axe `incomplete` results are recorded, never counted as passes.** Under
  forced-colours emulation the colour-contrast rule reads the page's own CSS
  rather than substituted system colours, so its results there need a human
  before they are called defects.
