# Floor canon — the board's appearance

The Tasks board has one locked look: **A · Air** from the Tasks Design
Console, with three overrides chosen by the founder on 2026-08-22.

| Axis | Value |
|---|---|
| Card style | **Flat** |
| Corner radius | **Soft** |
| Density | **Compact** |
| Indigo | Subtle accents |
| Type scale | Calm |

The single source of that configuration in code is `FLOOR_PRESET` in
`src/components/floor/floor-preset.ts`, applied to the workspace root as
five data-attributes and realised entirely by the option blocks already in
`floor.module.css`.

References:

- Console (interactive): `docs/design/labs/tasks-2026-08/customizer.html`
  — load `?preset=a&radius=soft&density=compact&indigo=subtle&type=calm`.
- Design master: `docs/design/labs/tasks-2026-08/floor.html` (the React
  port in `src/components/floor/` mirrors it 1:1).

## History

On 2026-08-22 the founder retired the standing design-gate machinery to
clear the way for redesigns: `.ds-grandfather.json` + `scripts/ds/ds-check.mjs`
(the hex/easing drift ratchet), `scripts/check-chrome-contract.mjs`,
`scripts/check-loading-contract.mjs`,
`docs/design/TASKS_DELIGHT_MOTION_CONTRACT.md`, `docs/DELIGHT_CATALOG.md`,
and `src/components/hybrid/board-pass3-contract.test.mjs`. Their history is
in git. What survives is taste: the north star, the quality council, and
this page.
