# Recovery record labels — UI successor

2026-09-06. Parent source: `3f276ebd495c23cd5680cfe2e6ad9d13e23f32ba`. This delegated UI repair addresses the principal's retained same-day-row observation. It does not replace the independent API/role/projection review of that parent.

## Changes and boundaries

- Tasks links display their full existing fingerprint; Timeline publications display their full existing ID. These are non-bearer references already present in the projection. No suffix, page index or shortened prefix is treated as unique.
- The reference, precise creation time and state appear together inside the row containing its controls. Long references wrap without clipping. The list item and each action have record-specific accessible names; visible button text and existing operation payloads remain unchanged.
- Creation timestamps use the English App's localized long `en-GB` format, explicit UTC and seconds. Nonzero milliseconds supplied by the DTO are retained; whole seconds do not invent fractional precision. Invalid input says creation time is unavailable. Explicit locale/zone keeps the label independent of browser locale and host time zone.
- No interface/projection field, server writer, authorization, role, schema, batch action or Event content-denial change. No package/CI/module allowlist/registry/HQ edits.
- References and times distinguish these records in the recovery list. They do **not** prove that a customer can match a record to an external URL or establish human comprehension. A stronger identification requirement remains for later acceptance.
- English formatting is deliberate; this is not multilingual UI support. Browser contexts exercise German and English locale preferences with Tokyo time zone to check stability of the English/UTC contract.

## Bounded verification

```sh
node --import tsx --import ./src/test/register-server-only.mjs --test --test-concurrency=1 src/components/settings/recovery-creation-time.test.ts experience/project-recovery/route-action.test.mjs
node --import tsx --import ./src/test/register-server-only.mjs experience/project-recovery/browser.mjs
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint src/components/settings/project-recovery.tsx src/components/settings/recovery-creation-time.ts src/components/settings/recovery-creation-time.test.ts experience/project-recovery/browser.mjs experience/project-recovery/fixture.mjs
git diff --check
```

The focused test command covers 4 date controls and 9 unchanged actual route/action/native-HTTP controls. The browser gate now has **14** cases (the parent's ten plus four record keyboard/pagination cases), using the actual component, styles/fonts and existing isolated SQLite/action fixture with explicit session/router adapters.

Record controls include:
- Same day with different seconds, and two rows with identical creation instants.
- Full 64-character Tasks fingerprints; 80-character publication IDs identical until the last characters.
- Unique action names containing the full associated reference and creation time.
- 390×844 and 1440×960 light/dark, long September dates, wrapping without horizontal overflow, and keyboard selection of the exact visible row.
- Two pages totaling 25 records, independent Tasks/publication cursors, reload and return to the first page with stable reference identities.
- Unchanged negative-action payloads and real persisted readback, with unrelated publication state retained.

For a retained **expected failure**, the same browser gate accepts `--baseline` to replace only the component with immutable parent source. It captures the old same-time UI and fails because the twenty record-specific accessible names are absent. It must not be registered as a passing gate. Both modes require a fresh output directory (`PROJECT_RECOVERY_OUTPUT`, or default timestamped ignored output).

Original principal screenshot SHA256:
`04EF25EA5C79DE12EBE0CA6FE6548F8ABCA5661942365DAE00AD135FF1D00DCA`.
The original parent archive/receipt is unchanged. Fresh evidence, including the failed first fixture setup, expected old-UI failure and successful new renders, is in the separate LFS archive:
`experience/reviews/january-recipient-2026-09-05/project-recovery-row-labels-2026-09-06.zip`.

Principal owns new test registration, final composition and receiving capture. Parent source's module-boundary allowance and API/role/projection review remain separate; this successor grants no full Event, public-link matching, provider, human or council acceptance.
