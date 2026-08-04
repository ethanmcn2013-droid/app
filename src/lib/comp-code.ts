/**
 * Comp-code generation, in a module a test can actually load.
 *
 * E08.06. This used to be a private `newCode` inside `src/server/actions/comp.ts`,
 * which is `"use server"` and pulls in the database, so nothing could exercise
 * it directly and its entropy was whatever the last edit left behind. It is
 * the credential a stranger would guess for a free paid tier, so it gets a
 * module and a test of its own.
 *
 * PARITY OBLIGATION. `studio/src/lib/invitation-code.ts` mints the venue
 * invitation codes with the same alphabet, the same length and the same
 * entropy floor. The two repositories cannot import from each other, so the
 * numbers are restated in both and asserted in both. If one is changed, change
 * the other in the same cycle.
 */

/**
 * Thirty-one symbols. No 0/O, no 1/I/L — a comp code is read off a card or an
 * email and typed by hand. Widening the alphabet to buy entropy makes a code
 * harder to dictate; lengthen the body instead.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Characters of randomness. Ten, in two blocks of five. */
export const CODE_BODY_LENGTH = 10;

const BLOCK_LENGTH = 5;

/**
 * Entropy floor, in bits, that any newly minted code must clear. Asserted by
 * `src/server/invitation-code-security.test.ts`, so lowering the length or
 * narrowing the alphabet fails the build rather than passing review.
 */
export const MINIMUM_CODE_ENTROPY_BITS = 48;

/** Entropy of a code body in bits. The prefix is public and counts for none. */
export function codeEntropyBits(
  bodyLength: number = CODE_BODY_LENGTH,
): number {
  return bodyLength * Math.log2(CODE_ALPHABET.length);
}

/**
 * Mint a comp code: `<PREFIX>-XXXXX-XXXXX`.
 *
 * The draw is rejection sampling, not `byte % 31`. 256 = 8x31 + 8, so a bare
 * modulo would return the first eight symbols 9/256 of the time against 8/256
 * for the other twenty-three: about 12.5% more often. Bytes landing in the
 * ragged tail (248..255) are discarded and redrawn.
 *
 * Throws when no cryptographic source is available. The version this replaces
 * fell back to `Math.random()`, which would have minted predictable codes with
 * nothing failing and nothing logged.
 */
export function generateCompCode(prefix: string): string {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) {
    throw new Error(
      "generateCompCode: no cryptographic random source. Refusing to mint a guessable code.",
    );
  }
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let body = "";
  while (body.length < CODE_BODY_LENGTH) {
    const bytes = new Uint8Array(CODE_BODY_LENGTH);
    source.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      body += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (body.length === CODE_BODY_LENGTH) break;
    }
  }
  const cleanPrefix =
    prefix.replace(/[^a-z0-9]/gi, "").slice(0, 10).toUpperCase() || "GIFT";
  return `${cleanPrefix}-${body.slice(0, BLOCK_LENGTH)}-${body.slice(BLOCK_LENGTH)}`;
}

/**
 * True when `value` has the shape this module mints today.
 *
 * Deliberately NOT used to gate redemption. Codes issued before this change
 * are shorter and are already in couples' and students' hands; refusing them
 * would punish the holder for the system's own past. Redemption accepts any
 * string and looks it up.
 */
export function isCurrentCompCodeShape(value: string): boolean {
  return new RegExp(
    `^[A-Z0-9]{1,10}(-[${CODE_ALPHABET}]{${BLOCK_LENGTH}}){${
      CODE_BODY_LENGTH / BLOCK_LENGTH
    }}$`,
  ).test(value);
}
