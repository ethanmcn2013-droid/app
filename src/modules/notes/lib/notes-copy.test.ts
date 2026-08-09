import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALL_REGISTERS,
  BANNED_IN_COPY,
  notesCopy,
  notesCopyForDomain,
  registerForDomain,
  type NotesCopy,
} from "./notes-copy";

/**
 * Guards for E05.04 and E05.05.
 *
 * These are the checks a reviewer who did not write the copy can run to see
 * whether the wording is still what was agreed. They are deliberately about
 * words, not layout: the flow's behaviour is covered elsewhere, and this file
 * exists so engineer vocabulary cannot creep back onto a couple's screen.
 */

/** Walk every leaf string in a copy object, with its dotted path. */
function leaves(copy: NotesCopy): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") {
      out.push([path, node]);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        walk(value, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(copy, "");
  return out;
}

/** Every dotted key present in a register, sorted. */
function keysOf(copy: NotesCopy): string[] {
  return leaves(copy)
    .map(([path]) => path)
    .sort();
}

test("both registers define exactly the same keys", () => {
  const generic = keysOf(notesCopy("generic"));
  const wedding = keysOf(notesCopy("wedding"));
  assert.deepEqual(
    wedding,
    generic,
    "a wedding account must never fall through to a missing string",
  );
  assert.ok(generic.length > 40, "the copy set should cover the whole flow");
});

test("no user-visible string carries engineer vocabulary", () => {
  const offences: string[] = [];
  for (const register of ALL_REGISTERS) {
    for (const [path, value] of leaves(notesCopy(register))) {
      const haystack = value.toLowerCase();
      for (const banned of BANNED_IN_COPY) {
        if (haystack.includes(banned)) {
          offences.push(`${register}.${path} contains "${banned}": ${value}`);
        }
      }
    }
  }
  assert.deepEqual(offences, [], offences.join("\n"));
});

test("no em dashes and no exclamation marks", () => {
  // studio/BRAND.md §3, two of the four absolutes. An en dash between words
  // is the same crutch, so it is caught here too.
  const offences: string[] = [];
  for (const register of ALL_REGISTERS) {
    for (const [path, value] of leaves(notesCopy(register))) {
      if (value.includes("—")) offences.push(`${register}.${path} em dash: ${value}`);
      if (/\s–\s/.test(value)) offences.push(`${register}.${path} en dash: ${value}`);
      if (value.includes("!")) offences.push(`${register}.${path} exclamation: ${value}`);
    }
  }
  assert.deepEqual(offences, [], offences.join("\n"));
});

test("the privacy boundary is stated in both registers", () => {
  for (const register of ALL_REGISTERS) {
    const copy = notesCopy(register);
    // What crosses, and what does not. Both halves, or the sentence is not
    // doing its job.
    assert.match(
      copy.handoff.boundary,
      /stays here/i,
      `${register}: the boundary sentence must say the note stays`,
    );
    assert.match(
      copy.handoff.boundary,
      /only ever/i,
      `${register}: the boundary sentence must bound what crosses`,
    );
    assert.match(
      copy.handoff.payload,
      /nothing else/i,
      `${register}: the payload sentence must say what does not cross`,
    );
    assert.match(
      copy.handoff.payload,
      /stays private/i,
      `${register}: the payload sentence must say the rest stays private`,
    );
  }
});

test("the wedding register promises the venue sees nothing", () => {
  // The central promise of the Venue Edition offer. A couple is told it once,
  // plainly, at the only point in Notes where anything leaves the notebook.
  assert.match(notesCopy("wedding").handoff.boundary, /venue never sees/i);
});

test("dictation discloses the complete browser audio boundary", () => {
  // E05.04. The browser speech engine sends audio to the browser maker's
  // speech service. Nothing in the product said so before this task. If this
  // assertion is ever deleted, the disclosure has been dropped with it.
  for (const register of ALL_REGISTERS) {
    const { disclosure } = notesCopy(register).voice;
    assert.match(
      disclosure,
      /microphone audio/i,
      `${register}: dictation must name the microphone audio`,
    );
    assert.match(
      disclosure,
      /speech service/i,
      `${register}: dictation must name what receives the audio`,
    );
    assert.match(
      disclosure,
      /typing stays on your device/i,
      `${register}: the honest contrast with typing must be stated`,
    );
    assert.match(
      disclosure,
      /does not receive or retain/i,
      `${register}: Signal Studio's audio boundary must be explicit`,
    );
    assert.match(
      disclosure,
      /provider controls its service retention/i,
      `${register}: provider retention must not be invented`,
    );
  }
});

test("every dictation failure has its own plain-English message", () => {
  for (const register of ALL_REGISTERS) {
    const { denied, noSpeech, failed, unavailable } = notesCopy(register).voice;
    const all = [denied, noSpeech, failed, unavailable];
    assert.equal(
      new Set(all).size,
      all.length,
      `${register}: each failure must read differently, so the user can tell them apart`,
    );
    for (const message of all) {
      assert.ok(message.length > 20, `${register}: "${message}" is too terse to act on`);
    }
    // An unsupported browser is explained rather than silently hidden.
    assert.match(unavailable, /typing works everywhere/i);
  }
});

test("registerForDomain only treats the wedding domain as a wedding", () => {
  assert.equal(registerForDomain("wedding"), "wedding");
  assert.equal(registerForDomain("marketing"), "generic");
  assert.equal(registerForDomain(null), "generic");
  assert.equal(registerForDomain(undefined), "generic");
  assert.equal(registerForDomain(""), "generic");
  // Guard against a loose match on a domain that merely contains the word.
  assert.equal(registerForDomain("wedding_season"), "generic");
  assert.equal(notesCopyForDomain("wedding"), notesCopy("wedding"));
  assert.equal(notesCopyForDomain(null), notesCopy("generic"));
});

test("the two registers actually differ where a couple would notice", () => {
  // A wedding register that is a copy of the generic one is not a wedding
  // register. These are the surfaces a couple meets first and most often.
  const g = notesCopy("generic");
  const w = notesCopy("wedding");
  const mustDiffer: Array<[string, string, string]> = [
    ["capture.placeholder", g.capture.placeholder, w.capture.placeholder],
    ["capture.emptyTitle", g.capture.emptyTitle, w.capture.emptyTitle],
    ["handoff.heading", g.handoff.heading, w.handoff.heading],
    ["handoff.send", g.handoff.send, w.handoff.send],
    ["handoff.boundary", g.handoff.boundary, w.handoff.boundary],
    ["receipts.sent", g.receipts.sent, w.receipts.sent],
  ];
  for (const [path, generic, wedding] of mustDiffer) {
    assert.notEqual(generic, wedding, `${path} should read differently for a couple`);
  }
});

test("no string names a price, a plan or an upgrade", () => {
  // The couple never sees a price. D-001, PROJECT.md §5. Notes is one of the
  // three surfaces where a price leaked before, so it is asserted here.
  const offences: string[] = [];
  for (const register of ALL_REGISTERS) {
    for (const [path, value] of leaves(notesCopy(register))) {
      if (/upgrade|pricing|\bplan\b.*\b(from|per|month)\b|€|\$\d/i.test(value)) {
        offences.push(`${register}.${path}: ${value}`);
      }
    }
  }
  assert.deepEqual(offences, [], offences.join("\n"));
});

test("no string promises access forever", () => {
  // D-009 point 3, D-021, R-008. Never "for life", never "forever".
  const offences: string[] = [];
  for (const register of ALL_REGISTERS) {
    for (const [path, value] of leaves(notesCopy(register))) {
      if (/\bforever\b|\bfor life\b|\bin perpetuity\b|\balways yours\b/i.test(value)) {
        offences.push(`${register}.${path}: ${value}`);
      }
    }
  }
  assert.deepEqual(offences, [], offences.join("\n"));
});
