import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import {
  CODE_ALPHABET,
  CODE_BODY_LENGTH,
  MINIMUM_CODE_ENTROPY_BITS,
  codeEntropyBits,
  generateCompCode,
  isCurrentCompCodeShape,
} from "@/lib/comp-code";

/**
 * E08.06 — the redeemable code is the credential a stranger would guess.
 *
 * A comp code buys a paid tier. A venue-edition comp code additionally binds
 * the redeeming account to a named venue's sponsorship and consumes a code a
 * real couple was given. These tests exist so that weakening the code fails
 * the build instead of passing review, which is how it got to 2^28.
 */

describe("comp code entropy", () => {
  it("clears the stated entropy floor, computed rather than asserted", () => {
    assert.equal(CODE_ALPHABET.length, 31);
    assert.equal(CODE_BODY_LENGTH, 10);
    const bits = codeEntropyBits();
    assert.ok(
      bits >= MINIMUM_CODE_ENTROPY_BITS,
      `entropy is ${bits.toFixed(2)} bits, floor is ${MINIMUM_CODE_ENTROPY_BITS}`,
    );
    // The keyspace spelled out, so the number in the module doc is checkable.
    assert.equal(CODE_ALPHABET.length ** CODE_BODY_LENGTH, 819628286980801);
  });

  it("is three million times the keyspace of the UUID-hex generation it replaces", () => {
    // What shipped: seven hex characters off a UUID. 16^7 = 268,435,456.
    const previous = 16 ** 7;
    assert.equal(previous, 268435456);
    const current = CODE_ALPHABET.length ** CODE_BODY_LENGTH;
    assert.ok(current / previous > 3_000_000);
  });

  it("holds the cross-repository parity numbers", () => {
    // studio/src/lib/invitation-code.ts restates these three literals and
    // asserts them in its own suite. The two repositories cannot import from
    // each other, so this pair of assertions is the lock. If you change one,
    // change the other in the same cycle.
    assert.equal(CODE_ALPHABET, "ABCDEFGHJKMNPQRSTUVWXYZ23456789");
    assert.equal(CODE_BODY_LENGTH, 10);
    assert.equal(MINIMUM_CODE_ENTROPY_BITS, 48);
  });

  it("uses no ambiguous glyphs, because the code is typed off a card", () => {
    for (const banned of ["0", "O", "1", "I", "L"]) {
      assert.ok(!CODE_ALPHABET.includes(banned), `${banned} is ambiguous`);
    }
  });
});

describe("comp code generation", () => {
  it("mints the documented shape", () => {
    const code = generateCompCode("student26");
    assert.ok(isCurrentCompCodeShape(code), code);
    assert.match(code, /^STUDENT26-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  });

  it("falls back to a safe prefix rather than an empty one", () => {
    assert.match(generateCompCode("!!!"), /^GIFT-/);
  });

  it("emits nothing outside the alphabet", () => {
    for (let i = 0; i < 500; i++) {
      for (const character of generateCompCode("g").split("-").slice(1).join("")) {
        assert.ok(CODE_ALPHABET.includes(character), `stray glyph ${character}`);
      }
    }
  });

  it("does not repeat across a large run", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateCompCode("g"));
    assert.equal(seen.size, 5000);
  });

  it("draws uniformly: rejection sampling, not a biased modulo", () => {
    // 256 = 8*31 + 8, so `byte % 31` returns A-H 9/256 of the time against
    // 8/256 for the rest. Bound and sample size chosen to be decisive in both
    // directions: 620,000 draws puts 20,000 on each symbol with sd ~140; the
    // biased mean for A-H is ~21,797. A 4.5% bound (20,900) sits ~6.4 sd from
    // both. The control below runs the biased draw and must trip it.
    const draws = 620_000;
    const expected = draws / CODE_ALPHABET.length;
    const bound = expected * 1.045;

    const fair = new Map<string, number>();
    for (let i = 0; i < draws / CODE_BODY_LENGTH; i++) {
      for (const c of generateCompCode("g").split("-").slice(1).join("")) {
        fair.set(c, (fair.get(c) ?? 0) + 1);
      }
    }
    for (const c of CODE_ALPHABET.slice(0, 8)) {
      assert.ok(
        (fair.get(c) ?? 0) < bound,
        `${c} drawn ${fair.get(c)} times against ${expected} expected — modulo bias is back`,
      );
    }

    // Control: the generation this replaces must FAIL the bound above. Without
    // this, a bound that is simply too loose would look like a passing test.
    const biased = new Map<string, number>();
    for (let i = 0; i < draws; i++) {
      const c = CODE_ALPHABET[randomBytes(1)[0] % CODE_ALPHABET.length];
      biased.set(c, (biased.get(c) ?? 0) + 1);
    }
    const worstBiased = Math.max(
      ...CODE_ALPHABET.slice(0, 8).split("").map((c) => biased.get(c) ?? 0),
    );
    assert.ok(
      worstBiased > bound,
      `the biased control scored ${worstBiased} against a bound of ${bound.toFixed(0)}: this test cannot detect the defect it claims to`,
    );
  });

  it("accepts a legacy code as valid input while calling it not-current", () => {
    // Codes already in a couple's or a student's hands keep working. The
    // predicate reports generation; it never gates redemption.
    assert.ok(!isCurrentCompCodeShape("LAMBSHIL-MP93X"));
    assert.ok(!isCurrentCompCodeShape("STUDENT26-A4B2X9"));
    assert.ok(isCurrentCompCodeShape(generateCompCode("lambshill")));
  });
});

describe("source contract: the redeem path", () => {
  const comp = readFileSync(
    new URL("./actions/comp.ts", import.meta.url),
    "utf8",
  );

  it("mints through the tested module, with no local generator left behind", () => {
    assert.match(comp, /generateCompCode/);
    // The UUID-hex minter and its non-cryptographic fallback are gone, not
    // merely unused.
    assert.doesNotMatch(comp, /randomUUID\?\.\(\) \?\?[\s\S]{0,60}Math\.random\(\)[\s\S]{0,80}slice\(0, 7\)/);
    assert.doesNotMatch(comp, /slice\(0, 7\)\.toUpperCase\(\)/);
  });

  it("checks the attempt budget BEFORE it looks the code up", () => {
    const impl = comp.slice(
      comp.indexOf("async function redeemCompCodeImpl"),
      comp.indexOf("export type StudentVerifyResult"),
    );
    const limiter = impl.indexOf("redeemWithinAttemptLimits");
    const lookup = impl.indexOf("await claimCompEntitlement(db");
    assert.ok(limiter > 0, "the redeem path must consult the attempt limiter");
    assert.ok(lookup > 0);
    assert.ok(
      limiter < lookup,
      "looking the code up before spending the budget leaves an unmetered does-this-code-exist oracle",
    );
    assert.match(impl, /reason: "rate-limited"/);
    const claim = readFileSync(new URL("./db/comp-redemption.ts", import.meta.url), "utf8");
    assert.match(claim, /\.from\(compCodes\)/);
    assert.doesNotMatch(impl, /\.from\(compCodes\)/);
  });

  it("states the limiter's failure mode in the source, not only in a document", () => {
    // The limiter fails OPEN and Upstash is unprovisioned, so this control
    // enforces nothing today. A reader of this file must not be able to miss
    // that.
    assert.match(comp, /failure mode is OPEN/i);
    assert.match(comp, /UPSTASH_REDIS_REST_URL/);
  });
});
