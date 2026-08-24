/**
 * The board's appearance, locked.
 *
 * This is the A · Air configuration of the Tasks Design Console with the
 * founder's three overrides (radius soft, density compact, type calm) —
 * the whole decision recorded in `docs/design/FLOOR_CANON.md`. The five
 * axes are realised by the option blocks at the foot of `floor.module.css`
 * (`[data-cards]`, `[data-radius]`, `[data-density]`, `[data-indigo]`,
 * `[data-type]`); changing a value here re-skins every surface that hangs
 * off the workspace root. There is no runtime switching and no user
 * setting: this is what the board looks like.
 */
export const FLOOR_PRESET = {
  cards: "flat",
  radius: "soft",
  density: "compact",
  indigo: "subtle",
  type: "calm",
} as const;

export type FloorPreset = typeof FLOOR_PRESET;
