import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EXTRACTION_SCHEMA,
  MAX_EXTRACTED_NOTE_CHARS,
  MAX_EXTRACTED_NOTES,
  PHOTO_EXTRACTION_PROMPT,
  sanitizeExtractedNotes,
  tidyExtractedBody,
  VOICE_EXTRACTION_PROMPT,
} from "./extraction-contract";

/**
 * Guards for the capture-to-notes contract: what a model is asked for, the
 * shape it is held to, and what has to survive before its answer becomes a
 * note a person sees. No model client here — the rules alone.
 */

test("tidyExtractedBody strips a leading list marker", () => {
  assert.equal(tidyExtractedBody("- Item text"), "Item text");
  assert.equal(tidyExtractedBody("* Item text"), "Item text");
  assert.equal(tidyExtractedBody("• Item text"), "Item text");
  assert.equal(tidyExtractedBody("1. Item text"), "Item text");
  assert.equal(tidyExtractedBody("2) Item text"), "Item text");
});

test("tidyExtractedBody strips a leading Note:/Thought N - label", () => {
  assert.equal(tidyExtractedBody("Note: Call the florist"), "Call the florist");
  assert.equal(tidyExtractedBody("Thought 2 - Something"), "Something");
});

test("tidyExtractedBody unwraps matching quotes but leaves an unmatched quote alone", () => {
  assert.equal(tidyExtractedBody('"Hello world"'), "Hello world");
  assert.equal(tidyExtractedBody("“Hello world”"), "Hello world");
  assert.equal(tidyExtractedBody('"Hello world'), '"Hello world');
});

test("tidyExtractedBody collapses 3 or more newlines to 2", () => {
  assert.equal(tidyExtractedBody("a\n\n\n\nb"), "a\n\nb");
});

test("tidyExtractedBody truncates past MAX_EXTRACTED_NOTE_CHARS with a trailing ellipsis and never exceeds it", () => {
  const out = tidyExtractedBody("x".repeat(MAX_EXTRACTED_NOTE_CHARS + 50));
  assert.equal(out.length, MAX_EXTRACTED_NOTE_CHARS);
  assert.ok(out.endsWith("…"));
});

test("tidyExtractedBody trims", () => {
  assert.equal(tidyExtractedBody("  padded text  \n"), "padded text");
});

test("sanitizeExtractedNotes: a well-formed notes array passes through in order", () => {
  const raw = { notes: [{ body: "First" }, { body: "Second" }, { body: "Third" }] };
  assert.deepEqual(sanitizeExtractedNotes(raw, "fallback text"), [
    { body: "First" },
    { body: "Second" },
    { body: "Third" },
  ]);
});

test("sanitizeExtractedNotes: malformed shapes all fall back to the source as one note", () => {
  assert.deepEqual(sanitizeExtractedNotes("just a string", "fallback text"), [
    { body: "fallback text" },
  ]);
  assert.deepEqual(sanitizeExtractedNotes(null, "fallback text"), [{ body: "fallback text" }]);
  assert.deepEqual(sanitizeExtractedNotes([{ body: "x" }], "fallback text"), [
    { body: "fallback text" },
  ]);
  assert.deepEqual(sanitizeExtractedNotes({ notes: "x" }, "fallback text"), [
    { body: "fallback text" },
  ]);
});

test("sanitizeExtractedNotes: entries whose body is not a string are dropped", () => {
  const raw = { notes: [{ body: 123 }, { body: "Good one" }] };
  assert.deepEqual(sanitizeExtractedNotes(raw, "fallback text"), [{ body: "Good one" }]);
});

test("sanitizeExtractedNotes: empty and whitespace bodies are dropped", () => {
  const raw = { notes: [{ body: "   " }, { body: "Real one" }] };
  assert.deepEqual(sanitizeExtractedNotes(raw, "fallback text"), [{ body: "Real one" }]);
});

test("sanitizeExtractedNotes: case-insensitive duplicates are removed, keeping the first", () => {
  const raw = {
    notes: [{ body: "Call the Florist" }, { body: "call the florist" }, { body: "Something else" }],
  };
  assert.deepEqual(sanitizeExtractedNotes(raw, "fallback text"), [
    { body: "Call the Florist" },
    { body: "Something else" },
  ]);
});

test("sanitizeExtractedNotes: more than MAX_EXTRACTED_NOTES are truncated to the cap", () => {
  const raw = {
    notes: [
      { body: "One" },
      { body: "Two" },
      { body: "Three" },
      { body: "Four" },
      { body: "Five" },
      { body: "Six" },
      { body: "Seven" },
    ],
  };
  const result = sanitizeExtractedNotes(raw, "fallback text");
  assert.equal(result.length, MAX_EXTRACTED_NOTES);
  assert.deepEqual(
    result.map((n) => n.body),
    ["One", "Two", "Three", "Four", "Five", "Six"],
  );
});

test("sanitizeExtractedNotes: every candidate dropped and an empty fallback gives an empty array, not a note with an empty body", () => {
  const raw = { notes: [{ body: "   " }, { body: 123 }] };
  assert.deepEqual(sanitizeExtractedNotes(raw, "   "), []);
  assert.deepEqual(sanitizeExtractedNotes(raw, ""), []);
});

test("EXTRACTION_SCHEMA is a valid-looking JSON Schema for the notes array", () => {
  assert.equal(EXTRACTION_SCHEMA.type, "object");
  assert.deepEqual(EXTRACTION_SCHEMA.required, ["notes"]);
  assert.equal(EXTRACTION_SCHEMA.properties.notes.minItems, 1);
  assert.equal(EXTRACTION_SCHEMA.properties.notes.maxItems, MAX_EXTRACTED_NOTES);
  const itemSchema = EXTRACTION_SCHEMA.properties.notes.items;
  assert.deepEqual(itemSchema.required, ["body"]);
  assert.equal(itemSchema.properties.body.type, "string");
  assert.equal(itemSchema.properties.body.maxLength, MAX_EXTRACTED_NOTE_CHARS);
});

test("both extraction prompts carry the Never invent rule", () => {
  assert.match(VOICE_EXTRACTION_PROMPT, /Never invent/);
  assert.match(PHOTO_EXTRACTION_PROMPT, /Never invent/);
});

test("both extraction prompts carry the no-em-dash and no-exclamation-mark voice rules", () => {
  assert.match(VOICE_EXTRACTION_PROMPT, /no em dashes/i);
  assert.match(PHOTO_EXTRACTION_PROMPT, /no em dashes/i);
  assert.match(VOICE_EXTRACTION_PROMPT, /no exclamation marks/i);
  assert.match(PHOTO_EXTRACTION_PROMPT, /no exclamation marks/i);
});

test("the photo prompt forbids describing the picture", () => {
  assert.match(PHOTO_EXTRACTION_PROMPT, /do not describe the picture/i);
});

test("neither prompt contains an em dash or an exclamation mark itself — the brand voice rules bind the prompt too", () => {
  assert.equal(VOICE_EXTRACTION_PROMPT.includes("—"), false);
  assert.equal(PHOTO_EXTRACTION_PROMPT.includes("—"), false);
  assert.equal(VOICE_EXTRACTION_PROMPT.includes("!"), false);
  assert.equal(PHOTO_EXTRACTION_PROMPT.includes("!"), false);
});
