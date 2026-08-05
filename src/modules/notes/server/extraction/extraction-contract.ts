/**
 * The contract for turning spoken words or a photograph into notes.
 *
 * Pure: no model client, no server imports, no React. The prompt, the shape
 * of the answer, and the rules the answer has to survive all live here so a
 * test can hold the model to them without a network call.
 *
 * The product rule this file exists to enforce: what comes back is one or
 * more **notes a person would recognise as their own thought**, not a
 * transcript, not a summary, and not an invention. When the model has nothing
 * useful to add, the honest answer is the original words unchanged.
 */

export const MAX_EXTRACTED_NOTES = 6;
export const MAX_EXTRACTED_NOTE_CHARS = 600;

/** What a capture produced, before anyone has edited it. */
export type ExtractedNote = {
  /** The note's wording. Editable everywhere it is shown. */
  body: string;
};

export type NoteExtraction =
  | {
      status: "ok";
      notes: ExtractedNote[];
      /**
       * False means Signal did not separate anything and these are the words
       * as they arrived. The interface says so rather than implying work that
       * did not happen.
       */
      separated: boolean;
    }
  | { status: "unavailable"; message: string }
  | { status: "failed"; message: string };

/** The JSON Schema the model is held to. `ai@6`'s jsonSchema() takes this directly. */
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["notes"],
  properties: {
    notes: {
      type: "array",
      minItems: 1,
      maxItems: MAX_EXTRACTED_NOTES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["body"],
        properties: {
          body: {
            type: "string",
            minLength: 1,
            maxLength: MAX_EXTRACTED_NOTE_CHARS,
            description:
              "One captured thought, in the speaker's own words, ready to be saved as a note.",
          },
        },
      },
    },
  },
} as const;

const SHARED_RULES = `You are the quiet part of Signal Notes that turns raw capture into notes a person can use.

What you are doing: someone captured a thought in a hurry. Give it back to them as notes they will recognise as their own.

Rules, in order:
- Keep their words. Fix only what the capture broke: false starts, stray filler, a mangled word that is obviously one thing. Never rewrite their phrasing into yours.
- One thought per note. If they said two unrelated things, that is two notes. If they said one thing at length, that is one note. Never split for the sake of splitting.
- Never invent. No detail that was not in the source. No inferred dates, names, numbers, or actions. If something is unclear, keep it unclear in their words.
- No commentary, no headings, no labels, no bullet characters, no summaries of what they said. The note is the thought itself.
- Drop nothing that carries meaning. Greetings, thinking-aloud and dead air can go.
- Plain sentences. No emoji, no exclamation marks, no em dashes.
- If there is no usable thought at all, return the source text as a single note rather than an empty answer.`;

export const VOICE_EXTRACTION_PROMPT = `${SHARED_RULES}

This capture was spoken and turned into text by a speech engine, so expect run-on sentences, missing punctuation and the odd misheard word. Punctuate it the way the speaker meant it.`;

export const PHOTO_EXTRACTION_PROMPT = `${SHARED_RULES}

This capture is a photograph: a notebook page, a whiteboard, handwriting, or something printed. Read what is written and return the thoughts on it.

Extra rules for a photograph:
- Read the writing, do not describe the picture. Never write "a whiteboard showing" or "handwritten notes about".
- Keep the writer's own lines. A list of five items written on a page is one note holding that list, not five notes, unless the items are plainly separate thoughts.
- Ignore page furniture: dates printed on stationery, page numbers, letterheads, ruled-line artefacts.
- If the writing is not legible enough to be sure, say so as the note: "Some of this photo was not legible." followed by whatever you could read.`;

/**
 * Everything the model returns has to survive this before a person sees it.
 * A model that ignores the schema, echoes the prompt, or pads its answer
 * loses those notes rather than putting them on screen.
 */
export function sanitizeExtractedNotes(
  raw: unknown,
  fallbackSource: string,
): ExtractedNote[] {
  const candidates: unknown[] =
    raw && typeof raw === "object" && Array.isArray((raw as { notes?: unknown[] }).notes)
      ? ((raw as { notes: unknown[] }).notes ?? [])
      : [];

  const seen = new Set<string>();
  const notes: ExtractedNote[] = [];
  for (const candidate of candidates) {
    const value =
      candidate && typeof candidate === "object"
        ? (candidate as { body?: unknown }).body
        : candidate;
    if (typeof value !== "string") continue;
    const body = tidyExtractedBody(value);
    if (!body) continue;
    const key = body.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push({ body });
    if (notes.length >= MAX_EXTRACTED_NOTES) break;
  }

  if (notes.length) return notes;
  const fallback = tidyExtractedBody(fallbackSource);
  return fallback ? [{ body: fallback }] : [];
}

/**
 * Strip the things models add when they forget they are not writing prose:
 * list markers, a leading "Note:" label, wrapping quotes, and the trailing
 * offer of further help.
 */
export function tidyExtractedBody(value: string): string {
  let body = value.replace(/\r\n/g, "\n").trim();
  body = body.replace(/^(?:[-*•]|\d+[.)])\s+/, "");
  body = body.replace(/^(?:note|thought|item)\s*\d*\s*[:\-–]\s*/i, "");
  if (
    (body.startsWith('"') && body.endsWith('"') && body.length > 2) ||
    (body.startsWith("“") && body.endsWith("”") && body.length > 2)
  ) {
    body = body.slice(1, -1).trim();
  }
  body = body.replace(/\n{3,}/g, "\n\n");
  if (body.length > MAX_EXTRACTED_NOTE_CHARS) {
    body = `${body.slice(0, MAX_EXTRACTED_NOTE_CHARS - 1).trimEnd()}…`;
  }
  return body.trim();
}

/** Shown when the key is absent. Says what is off, not how it is wired. */
export const EXTRACTION_UNAVAILABLE_VOICE =
  "Signal cannot separate spoken notes on this account yet, so your words are kept exactly as you said them.";

export const EXTRACTION_UNAVAILABLE_PHOTO =
  "Reading photos is not switched on for this account yet. Typing and voice both work.";

export const EXTRACTION_FAILED =
  "Signal could not turn this into notes. Nothing was lost, so you can try again or keep the words as they are.";
