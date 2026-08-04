/**
 * What an attachment is allowed to be.
 *
 * E08.07. The upload path had three problems and this module fixes the one
 * that can be fixed in code without spending money.
 *
 * 1. **Validation trusted the browser.** `uploadAttachmentAction` read
 *    `file.type` — a string the client supplies — and checked it against a
 *    DENYLIST of eight MIME types. A denylist on a client-supplied label is
 *    two failures compounded: anything not on the list passes, and the label
 *    can simply be changed. Renaming `payload.html` to `photo.png` and letting
 *    the browser declare `image/png` walked straight through.
 *
 * 2. **Nothing looked at the bytes.** No magic-number check existed anywhere,
 *    so the stored `mime_type` — which the download route later serves as
 *    `Content-Type` — was whatever the uploader said it was.
 *
 * 3. **There is no malware scanning, and this module does not add any.** See
 *    the E08.07 evidence for what a scanner costs and why it is deferred. This
 *    module is content-type validation, not anti-virus, and it does not
 *    pretend otherwise.
 *
 * The rule here is an ALLOWLIST checked against the file's own leading bytes.
 * A file is accepted only when its declared type is on the list AND its bytes
 * agree with that type. Types whose format has no reliable signature (plain
 * text, CSV) are accepted on the declared type alone and are marked as such,
 * because inventing a signature for them would be theatre.
 */

export type UploadVerdict =
  | { ok: true; mimeType: string; sniffed: "matched" | "no-signature" }
  | { ok: false; reason: UploadRejection; detail: string };

export type UploadRejection =
  /** The declared type is not on the allowlist. */
  | "type-not-allowed"
  /** The bytes do not match the declared type. */
  | "content-mismatch"
  /** Nothing to inspect. */
  | "empty";

/**
 * Byte signatures, longest-first within a type. `null` means the format has no
 * dependable magic number and is accepted on its declared type alone.
 *
 * SVG is deliberately ABSENT from this list, not present-and-rejected: an SVG
 * is a script-bearing document that browsers render, and there is no version
 * of "safe SVG" worth maintaining for a wedding attachment. HTML, XML and
 * executables are absent for the same reason. Absence is the refusal, which
 * is the point of an allowlist.
 */
const ALLOWED: ReadonlyArray<{
  mimeType: string;
  signatures: ReadonlyArray<ReadonlyArray<number | null>> | null;
}> = [
  { mimeType: "image/png", signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  { mimeType: "image/jpeg", signatures: [[0xff, 0xd8, 0xff]] },
  { mimeType: "image/gif", signatures: [[0x47, 0x49, 0x46, 0x38]] },
  {
    mimeType: "image/webp",
    // RIFF????WEBP — four length bytes in the middle are wildcards.
    signatures: [
      [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
    ],
  },
  { mimeType: "image/heic", signatures: [[null, null, null, null, 0x66, 0x74, 0x79, 0x70]] },
  { mimeType: "application/pdf", signatures: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
  {
    // The Office and OpenDocument family are ZIP containers.
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signatures: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  },
  {
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    signatures: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  },
  {
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    signatures: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  },
  { mimeType: "application/zip", signatures: [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]] },
  // No dependable signature. Accepted on the declared type, and the download
  // route serves them with `nosniff` and a sandbox CSP.
  { mimeType: "text/plain", signatures: null },
  { mimeType: "text/csv", signatures: null },
  { mimeType: "text/markdown", signatures: null },
];

/** Bytes the caller must read off the file and hand to `validateUpload`. */
export const SNIFF_BYTES = 16;

/** Every MIME type an attachment may declare. */
export function allowedMimeTypes(): string[] {
  return ALLOWED.map((entry) => entry.mimeType);
}

function signatureMatches(
  signature: ReadonlyArray<number | null>,
  head: Uint8Array,
): boolean {
  if (head.length < signature.length) return false;
  return signature.every((byte, at) => byte === null || head[at] === byte);
}

/**
 * Decide whether an upload may be stored.
 *
 * @param declaredMimeType what the client said the file is
 * @param head             the first `SNIFF_BYTES` bytes of the file
 * @param sizeBytes        the file's length
 *
 * Size limits are NOT enforced here. They are tier-dependent and live in
 * `src/lib/storage-config.ts`; duplicating them would give two answers to one
 * question. This function refuses an empty file and nothing else about size.
 */
export function validateUpload(
  declaredMimeType: string,
  head: Uint8Array,
  sizeBytes: number,
): UploadVerdict {
  if (sizeBytes <= 0 || head.length === 0) {
    return { ok: false, reason: "empty", detail: "the file has no bytes" };
  }

  // Strip any `; charset=…` parameter and normalise case before matching.
  const mimeType = declaredMimeType.split(";")[0].trim().toLowerCase();
  const entry = ALLOWED.find((candidate) => candidate.mimeType === mimeType);
  if (!entry) {
    return {
      ok: false,
      reason: "type-not-allowed",
      detail: `${mimeType || "(no type)"} is not an accepted attachment type`,
    };
  }

  if (entry.signatures === null) {
    return { ok: true, mimeType, sniffed: "no-signature" };
  }

  const matched = entry.signatures.some((signature) =>
    signatureMatches(signature, head),
  );
  if (!matched) {
    return {
      ok: false,
      reason: "content-mismatch",
      detail: `the file's contents are not ${mimeType}`,
    };
  }
  return { ok: true, mimeType, sniffed: "matched" };
}

/**
 * The message an uploader sees. Plain, specific, and it never repeats the
 * uploader's filename or MIME string back into the page.
 */
export function uploadRejectionMessage(reason: UploadRejection): string {
  switch (reason) {
    case "empty":
      return "That file is empty. Pick another one.";
    case "type-not-allowed":
      return "We accept images, PDFs, Office documents and plain text. That file is none of those.";
    case "content-mismatch":
      return "That file's contents do not match its type. Re-export it and try again.";
  }
}
