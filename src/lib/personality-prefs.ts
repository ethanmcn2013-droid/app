/**
 * Personality preference shape + defaults.
 *
 * Lives in a plain module (NOT a "use server" file) because Next only
 * permits async-function exports from "use server" files — a value export
 * like PERSONALITY_DEFAULTS there fails the production build. The server
 * actions in src/server/actions/personality.ts import from here.
 */

export type PersonalityPrefs = {
  /** Show a contextual greeting at the top of the inbox. */
  greeting: boolean;
  /** Show contextual tips while working in the board or task panel. */
  tips: boolean;
  /** Show a milestone notification at 100 / 250 / 500 / 1000 completions. */
  celebrations: boolean;
};

export const PERSONALITY_DEFAULTS: PersonalityPrefs = {
  greeting: true,
  tips: true,
  celebrations: true,
};

export const PERSONALITY_KEYS: Array<keyof PersonalityPrefs> = [
  "greeting",
  "tips",
  "celebrations",
];
