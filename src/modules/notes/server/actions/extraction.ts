"use server";

import { generateObject, jsonSchema } from "ai";

import { getModel, aiConfigured, AI_RATE_LIMITED_MESSAGE } from "@/server/ai";
import { allow } from "@/lib/ratelimit";
import { isDemoMode } from "@/lib/access-mode";
import { requireUser } from "@/modules/notes/server/notes-auth";
import {
  EXTRACTION_FAILED,
  EXTRACTION_SCHEMA,
  EXTRACTION_UNAVAILABLE_PHOTO,
  EXTRACTION_UNAVAILABLE_VOICE,
  MAX_EXTRACTED_NOTE_CHARS,
  PHOTO_EXTRACTION_PROMPT,
  VOICE_EXTRACTION_PROMPT,
  sanitizeExtractedNotes,
  tidyExtractedBody,
  type NoteExtraction,
} from "@/modules/notes/server/extraction/extraction-contract";
import { demoExtraction } from "@/modules/notes/server/demo/notes-extraction-demo";

/**
 * Turning a capture into notes.
 *
 * Two entry points, one contract. Both are owner-scoped, both are rate
 * limited on the same bucket, and both fail in a way that keeps the source:
 * the caller still holds the transcript or the image after any error here, so
 * nothing a person captured can be lost to a model outage.
 *
 * Nothing is stored by these actions. The spoken words arrive as text the
 * browser produced, the photograph arrives as bytes, and neither is written
 * to a database, a blob store, or a log. What persists is only the note the
 * person chooses to save afterwards.
 */

/** Spoken capture caps out well below the note limit; a long dictation is still one capture. */
const MAX_TRANSCRIPT_CHARS = 12_000;

/** Roughly 5 MB of base64. Larger than any phone photo needs to be for reading text. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export type ExtractFromSpeechInput = {
  transcript: string;
};

export type ExtractFromPhotoInput = {
  /** Raw bytes, base64 encoded. Never a URL: nothing is fetched on the caller's behalf. */
  base64: string;
  mediaType: string;
};

async function guard(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const userId = await requireUser();
  // Same bucket for both capture kinds. A person alternating voice and photo
  // is still one person, and the cost being bounded is the point.
  const permitted = await allow("notes-extract", userId, 20, "1 m");
  if (!permitted) return { ok: false, message: AI_RATE_LIMITED_MESSAGE };
  return { ok: true, userId };
}

/**
 * Spoken words in, notes out.
 *
 * Without a model this returns the transcript as one note and says plainly
 * that nothing was separated. That is the honest degradation: the person
 * still gets their words, and the interface never claims work it did not do.
 */
export async function extractNotesFromSpeech(
  input: ExtractFromSpeechInput,
): Promise<NoteExtraction> {
  const transcript = tidyExtractedBody(
    input.transcript.slice(0, MAX_TRANSCRIPT_CHARS),
  );
  if (!transcript) {
    return { status: "failed", message: "Nothing was heard, so there is nothing to save." };
  }

  if (isDemoMode()) return demoExtraction("voice", transcript);

  const gate = await guard();
  if (!gate.ok) return { status: "failed", message: gate.message };

  if (!aiConfigured()) {
    return {
      status: "ok",
      notes: [{ body: transcript }],
      separated: false,
    };
  }

  try {
    const notes = await runExtraction(VOICE_EXTRACTION_PROMPT, [
      { type: "text", text: transcript },
    ], transcript);
    return { status: "ok", notes, separated: true };
  } catch {
    // The transcript is still in the caller's hands, so this is recoverable,
    // not a loss. Say what happened and keep the words.
    return {
      status: "ok",
      notes: [{ body: transcript }],
      separated: false,
    };
  }
}

/**
 * A photograph in, notes out.
 *
 * Unlike speech there is no honest fallback: without a model that can read
 * the image there is nothing to give back, so this refuses clearly rather
 * than pretending. The caller keeps the image either way.
 */
export async function extractNotesFromPhoto(
  input: ExtractFromPhotoInput,
): Promise<NoteExtraction> {
  const mediaType = input.mediaType.trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(mediaType as AllowedImageType)) {
    return {
      status: "failed",
      message: "That file is not an image Signal can read. Try a PNG, JPEG or WebP photo.",
    };
  }
  // base64 carries 3 bytes per 4 characters; check before decoding so an
  // oversized upload never becomes an oversized buffer.
  const approximateBytes = Math.floor((input.base64.length * 3) / 4);
  if (approximateBytes > MAX_IMAGE_BYTES) {
    return {
      status: "failed",
      message: "That photo is larger than 5 MB. A smaller one reads just as well.",
    };
  }

  if (isDemoMode()) return demoExtraction("photo", "");

  const gate = await guard();
  if (!gate.ok) return { status: "failed", message: gate.message };

  if (!aiConfigured()) {
    return { status: "unavailable", message: EXTRACTION_UNAVAILABLE_PHOTO };
  }

  try {
    const notes = await runExtraction(
      PHOTO_EXTRACTION_PROMPT,
      [
        {
          type: "text",
          text: "Read this and return the thoughts written on it.",
        },
        {
          type: "file",
          mediaType,
          data: input.base64,
        },
      ],
      "",
    );
    if (!notes.length) {
      return {
        status: "failed",
        message: "Signal could not read any writing in that photo. Try a closer or brighter one.",
      };
    }
    return { status: "ok", notes, separated: true };
  } catch {
    return { status: "failed", message: EXTRACTION_FAILED };
  }
}

type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; data: string };

async function runExtraction(
  system: string,
  content: ModelContentPart[],
  fallbackSource: string,
) {
  const model = getModel();
  if (!model) throw new Error("no model");
  const { object } = await generateObject({
    model,
    system,
    // The contract is declared `as const` so a test can read its literals;
    // the SDK wants a plain JSON Schema object, and the shape is identical.
    schema: jsonSchema(EXTRACTION_SCHEMA as unknown as Parameters<typeof jsonSchema>[0]),
    // Six notes at the per-note ceiling, plus the JSON around them.
    maxOutputTokens: Math.ceil((6 * MAX_EXTRACTED_NOTE_CHARS) / 3) + 256,
    // A capture is a record, not a composition. Determinism is the feature.
    temperature: 0,
    messages: [{ role: "user", content }],
  });
  return sanitizeExtractedNotes(object, fallbackSource);
}

/** Whether the photo route can do anything at all, for the interface to gate on. */
export async function photoCaptureAvailable(): Promise<boolean> {
  if (isDemoMode()) return true;
  return aiConfigured();
}

/** Whether spoken capture will be separated into notes, or kept as one. */
export async function speechSeparationAvailable(): Promise<boolean> {
  if (isDemoMode()) return true;
  return aiConfigured();
}

export async function voiceUnavailableMessage(): Promise<string> {
  return EXTRACTION_UNAVAILABLE_VOICE;
}
