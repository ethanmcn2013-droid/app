## Design intent

<!-- State the user problem, intended outcome, and why this implementation is appropriate. -->

## Experience-quality evidence

- Experience IDs affected:
- Routes or triggers affected:
- Before evidence:
- After evidence:
- Approved baseline or review record:

## Customer-facing quality checklist

<!-- If an item is not applicable, mark it N/A and explain why. -->

- [ ] Every new or changed route and meaningful non-route surface is registered.
- [ ] Loading, empty, populated, error, success, restricted, disabled, read-only, dense, and long-content states were reviewed where applicable.
- [ ] Mobile (390x844), tablet (768x1024), desktop (1280x900), and wide (1440x960) evidence is attached where required.
- [ ] Keyboard-only operation, visible focus, semantic structure, labels, contrast, zoom/reflow, and reduced motion were checked.
- [ ] Before/after screenshots or an approved review reference are linked above.
- [ ] Existing design-system tokens and primitives were reused; no unapproved arbitrary styles or duplicate components were introduced.
- [ ] Runtime, console, layout-stability, and perceived-performance regressions were checked.
- [ ] Saving, destructive actions, permissions, and user-work safety remain clear and reliable.
- [ ] Any intentional exception names an owner, approval source, remediation plan, and expiry date.

## Verification

<!-- List exact commands and results. -->

- [ ] `node scripts/experience/validate.mjs --self-test`
- [ ] `node scripts/experience/validate.mjs`
- [ ] `node scripts/ds/ds-check.mjs`
- [ ] Relevant typecheck, tests, build, and browser checks
