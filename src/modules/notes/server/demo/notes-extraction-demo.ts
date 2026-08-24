import "server-only";

import {
  sanitizeExtractedNotes,
  tidyExtractedBody,
  type NoteExtraction,
} from "@/modules/notes/server/extraction/extraction-contract";

/**
 * Capture extraction inside demo / review mode.
 *
 * Demo mode is a closed fixture world: no database, no session, no outbound
 * request, one scripted venue manager's day. Extraction has to behave the
 * same way, or the two capture routes that matter most would be the only
 * dead controls on a reviewable build.
 *
 * This is deterministic and local. It is not a model, and it does not
 * pretend to be one: it splits spoken text on the boundaries a person
 * actually pauses at, and for a photograph it returns one fixed page from
 * the same fixture story every other demo surface tells. `isDemoMode()` is
 * the only caller, and production never reaches this file.
 */

/** The whiteboard the demo notebook's owner photographed with the Saturday team. */
const DEMO_PHOTO_NOTES = [
  "Saturday team, three things they kept asking for: one place to see who is on which room, a way to hand a job over without chasing it, and something that works on a phone out at the marquee.",
  "Sinead offered to run the second session if we give her the slides a week ahead.",
  "Room 4 has no plug near the board. Bring the long lead or move to Room 2.",
];

/**
 * Sentence-ish boundaries. Spoken capture arrives with almost no
 * punctuation, so this also treats the places people genuinely change
 * subject as boundaries: "and then", "also", "oh and".
 */
const SPOKEN_BOUNDARY = /(?<=[.!?])\s+|\s+(?:and then|also,?|oh and|next thing)\s+/gi;

function splitSpoken(transcript: string): string[] {
  const parts = transcript
    .split(SPOKEN_BOUNDARY)
    .map((part) => tidyExtractedBody(part))
    .filter((part) => part.length > 0);
  if (parts.length < 2) return [];

  // Rejoin fragments that are too short to be a thought on their own, so a
  // trailing "thanks" never becomes its own note.
  const merged: string[] = [];
  for (const part of parts) {
    if (part.length < 24 && merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${part}`;
      continue;
    }
    merged.push(part);
  }
  return merged.map((part) =>
    /[.!?]$/.test(part) ? part : `${part}.`,
  );
}

export function demoExtraction(
  kind: "voice" | "photo",
  transcript: string,
): NoteExtraction {
  if (kind === "photo") {
    return {
      status: "ok",
      notes: sanitizeExtractedNotes({ notes: DEMO_PHOTO_NOTES.map((body) => ({ body })) }, ""),
      separated: true,
    };
  }
  const cleaned = tidyExtractedBody(transcript);
  if (!cleaned) {
    return { status: "failed", message: "Nothing was heard, so there is nothing to save." };
  }
  const split = splitSpoken(cleaned);
  if (!split.length) {
    return { status: "ok", notes: [{ body: cleaned }], separated: false };
  }
  return {
    status: "ok",
    notes: sanitizeExtractedNotes({ notes: split.map((body) => ({ body })) }, cleaned),
    separated: true,
  };
}
