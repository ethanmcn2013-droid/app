/**
 * The login directions under review.
 *
 * Adding one here adds it to the index and to the switcher. The route reads
 * from the same list, so a slug that is not here does not render.
 */

export type DirectionSlug = "spine-v2" | "spine" | "desk" | "line" | "rail";

export interface LoginDirection {
  slug: DirectionSlug;
  /** Review letter, so the set is easy to talk about out loud. */
  letter: "A" | "B" | "C" | "D" | "E";
  name: string;
  /** The one-line argument the direction is making. */
  claim: string;
  /** What is different here, in plain terms. */
  note: string;
  /** The move worth keeping even if the direction loses. */
  move: string;
}

export const LOGIN_DIRECTIONS: readonly LoginDirection[] = [
  {
    slug: "spine-v2",
    letter: "E",
    name: "Spine v2",
    claim: "The line carries the suite. The card is unmistakably a sign-in.",
    note: "D rebuilt after the panel review. Stations ride the stage grid, the travelled line stays lit, you are the primary action, and email folds away. Light and dark first-class.",
    move: "The dot starts at notes and lands on signal, directly above the iPhone card.",
  },
  {
    slug: "spine",
    letter: "D",
    name: "Spine",
    claim: "The line is the suite, and the card is unmistakably a sign-in.",
    note: "C's chrome and containment with B's line, except the line now carries the four products as stations and the dot travels it on arrival. Light and dark are both first-class, switched from the review bar.",
    move: "One horizontal line that means something, with a full sign-in card sitting on it.",
  },
  {
    slug: "desk",
    letter: "A",
    name: "Desk",
    claim: "Show the work before you ask for the password.",
    note: "Split canvas. Sign-in on the left, a live Signal briefing assembling on the right, the four-product spine underneath it.",
    move: "The briefing writes itself while you sign in.",
  },
  {
    slug: "line",
    letter: "B",
    name: "Line",
    claim: "The page already knows who you are.",
    note: "One centred column on a single hairline. Opens with the account this device last used, one button. Providers and the email field fold away until you ask for them.",
    move: "The indigo dot rides the line and moves when the flow moves.",
  },
  {
    slug: "rail",
    letter: "C",
    name: "Rail",
    claim: "You are already standing inside the workspace.",
    note: "The charcoal Studio Bar L-frame is on screen from the first frame. The product tiles wake down the rail, and the auth card floats on paper in the middle.",
    move: "Signing in lights the rail you are already looking at.",
  },
] as const;

export function findDirection(slug: string): LoginDirection | undefined {
  return LOGIN_DIRECTIONS.find((direction) => direction.slug === slug);
}
