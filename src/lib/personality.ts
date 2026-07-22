/**
 * Personality — pure greeting builder, no IO.
 *
 * buildGreeting produces a personalised opening line for the inbox.
 * Rules:
 *   - Salutation by hour band (server clock, passed in).
 *   - Append name when present ("Morning, Niamh.").
 *   - One substance sentence stating only facts from the input.
 *   - Numbers one-nine are spelled as words; 10+ are digits.
 *   - No em dashes, no exclamation marks, no motivational fluff.
 *   - Returns null only for an out-of-range hour (defensive guard).
 */

export type GreetingInput = {
  name: string | null;
  /** 0-23 local hour. Values outside this range → null. */
  hour: number;
  dueToday: number;
  overdue: number;
  doneToday: number;
};

export type GreetingResult = {
  line: string;
};

const SMALL_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

/** Spell numbers one-nine as words; 10+ as digits. */
export function numWord(n: number): string {
  if (n >= 0 && n <= 9) return SMALL_WORDS[n]!;
  return String(n);
}

function salutation(hour: number): string {
  if (hour >= 5 && hour <= 11) return "Morning";
  if (hour >= 12 && hour <= 16) return "Afternoon";
  if (hour >= 17 && hour <= 22) return "Evening";
  return "Hello";
}

function substanceLine(input: GreetingInput): string {
  const { overdue, dueToday, doneToday } = input;

  if (overdue > 0) {
    const n = numWord(overdue);
    return overdue === 1 ? "One task is overdue." : `${n} tasks are overdue.`;
  }

  if (dueToday > 0) {
    const n = numWord(dueToday);
    return dueToday === 1
      ? "One task is due today."
      : `${n} tasks are due today.`;
  }

  if (doneToday > 0) {
    const n = numWord(doneToday);
    return doneToday === 1
      ? "You have completed one today."
      : `You have completed ${n} today.`;
  }

  return "Nothing is due today.";
}

export function buildGreeting(input: GreetingInput): GreetingResult | null {
  const { hour, name } = input;
  if (hour < 0 || hour > 23) return null;

  const sal = salutation(hour);
  const opening = name ? `${sal}, ${name}.` : `${sal}.`;
  // The substance sentence follows the salutation's period, so it always
  // opens a new sentence — capitalise its first letter (number-word plurals
  // like "two" would otherwise read lowercase mid-line).
  const substance = capitalizeFirst(substanceLine(input));

  return { line: `${opening} ${substance}` };
}

/** Uppercase the first character; leaves digits and the rest untouched. */
function capitalizeFirst(sentence: string): string {
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
