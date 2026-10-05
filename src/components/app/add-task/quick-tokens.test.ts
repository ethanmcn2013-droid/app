import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickTokens, type QuickMember } from "./quick-tokens";

const members: QuickMember[] = [
  { id: "m-orla", name: "Orla Byrne", initials: "OB" },
  { id: "m-dan", name: "Dan Okafor", initials: "DO" },
  { id: "m-dana", name: "Dana Kelly", initials: "DK" },
];

test("priority and people come out of the title and onto the task", () => {
  const out = parseQuickTokens("Book the florist friday !high #venue @orla", members);
  assert.equal(out.title, "Book the florist friday #venue");
  assert.deepEqual(out.priority, { value: "high", token: "!high" });
  assert.deepEqual(out.people, [{ id: "m-orla", token: "@orla" }]);
});

test("p0 to p3 follow the product scale, and only the first priority counts", () => {
  assert.equal(parseQuickTokens("Call venue p0", members).priority?.value, "urgent");
  assert.equal(parseQuickTokens("Call venue !p3", members).priority?.value, "low");
  const two = parseQuickTokens("Call venue !low !urgent", members);
  assert.equal(two.priority?.value, "low");
  assert.equal(two.title, "Call venue !urgent");
});

test("people match by first-name prefix or initials, ignoring case", () => {
  assert.deepEqual(parseQuickTokens("Menu @OR", members).people.map((p) => p.id), ["m-orla"]);
  assert.deepEqual(parseQuickTokens("Menu @dk", members).people.map((p) => p.id), ["m-dana"]);
  // "dan" is exactly Dan's first name, so it is not ambiguous with Dana.
  assert.deepEqual(parseQuickTokens("Menu @dan", members).people.map((p) => p.id), ["m-dan"]);
});

test("unmatched and ambiguous tokens stay in the title as written", () => {
  const out = parseQuickTokens("Ask @da about @zoe !soon", members);
  assert.equal(out.title, "Ask @da about @zoe !soon");
  assert.equal(out.priority, null);
  assert.deepEqual(out.people, []);
});

test("a removed chip gives its words back to the title", () => {
  const out = parseQuickTokens("Order tonic !high @orla", members, { priority: true, people: ["m-orla"] });
  assert.equal(out.title, "Order tonic !high @orla");
  assert.equal(out.priority, null);
  assert.deepEqual(out.people, []);
});
