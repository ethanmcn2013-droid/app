# Combined App browser checkpoint

Runtime candidate ca95830e, built locally with the repository's deterministic demo/preview Playwright contract on port 4350. The actual declared 132-case matrix passed across mobile, tablet, desktop and wide. Canonical run: tasks-playwright-eaebc5221a2ebebcaa062ab8. Raw artifact SHA-256: 3dd3e7388ce4997bedc26b4e68b1610d9c584d6be28389dc06dd3df308978a6d.

The new expired/unconfirmed redemption copy is visible in final desktop/mobile captures. Receipt verification and the experience registry pass. Thirty-two previous materiality receipts are preserved byte-for-byte under experience/reviews/history/pre-january-fixture-contract; 23 active scoped reviews cite this new run. Current UI/component/source tests remain separate evidence for states the generic browser cases do not exercise. No old verdict/date was rewritten and no gate was altered.

Performance on the same build: shared runtime 246.1 KB gzip against 247 KB ceiling (170 KB target remains unmet); total client 924.8 KB against 940 KB ceiling; largest chunk 62.5 KB against 63 KB. Production user performance remains unmeasured. The registry reports 83 experiences and 458 required state variants; passing these 132 cases is not full experience or golden-story closure.

Commands: pnpm exec playwright test --config experience/playwright.config.ts; node scripts/experience/attest-playwright.mjs --write-record; node scripts/experience/critical-fixtures.mjs --write; exact per-surface review-materiality calls; node scripts/experience/attest-playwright.mjs --verify-receipts; node scripts/experience/validate.mjs; node scripts/check-performance-budgets.mjs.

No Google, real database, Stripe, email or production release operation was performed. Earlier failed Linux visual runs are retained in GitHub, including 33924047875's stale-receipt rejection. Receiving Linux engineering, locale/switcher and design gates must still pass the exact committed integration candidate.
