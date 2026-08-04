/**
 * The publication policy for a milestone photograph: the numbers, in one
 * place, as values rather than as comments in a resize call.
 *
 * These are deliberately here and not inline. E06.03's acceptance criteria
 * require the maximum long edge and the target byte size to be stated as
 * checkable numbers, so a reviewer can read the policy without reading the
 * pipeline.
 */

import {
  inspectImage,
  orientationSwapsAxes,
  type ImageRefusalReason,
} from "./metadata";

/**
 * Longest edge, in pixels, of a photograph on a published artifact.
 * 2000 covers a full-bleed image on a 2x display at the artifact's widest
 * layout without paying for pixels nobody sees.
 */
export const PUBLISHED_MAX_LONG_EDGE_PX = 2000;

/**
 * Below this the photograph looks soft on a phone, which is where most
 * viewers open a link from a message.
 */
export const PUBLISHED_MIN_LONG_EDGE_PX = 800;

/**
 * What a compressed photograph should weigh. The compression step aims here.
 */
export const PUBLISHED_TARGET_BYTES = 500 * 1024;

/**
 * The refusal ceiling. A file above this is not published, whatever it
 * weighed before compression. Six of these still load in under a second on a
 * normal mobile connection.
 */
export const PUBLISHED_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The two formats whose metadata `stripImageMetadata` can prove it has
 * removed. Refusal by absence is the control, not a convenience.
 */
export const PUBLISHED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;

/** Longest alt text a photograph may carry. */
export const ALT_TEXT_MAX_LENGTH = 200;

export type PhotographDecision =
  | { publishable: true; width: number; height: number; displayWidth: number; displayHeight: number }
  | { publishable: false; reason: PhotographRefusal };

export type PhotographRefusal =
  | ImageRefusalReason
  | "too-large"
  | "too-small"
  | "metadata-present";

/**
 * Decide whether a set of bytes may be published, after stripping.
 *
 * `metadata-present` is the interesting refusal: it fires when a caller
 * hands over bytes that still carry EXIF, which means the strip was skipped.
 * The check is here rather than trusted to the caller because a photograph
 * reaching a public page with its GPS intact is the failure this whole module
 * exists to prevent.
 *
 * `orientation` is passed IN rather than read out. By the time bytes are
 * publishable the orientation segment has been removed, so the value has to
 * come from wherever the caller persisted it at strip time. Reading it from
 * the cleaned bytes would always return null and every portrait photograph
 * would reserve a landscape box.
 */
export function decidePhotograph(
  bytes: Uint8Array,
  { orientation = null }: { orientation?: number | null } = {},
): PhotographDecision {
  const inspection = inspectImage(bytes);
  if (!inspection.supported) return { publishable: false, reason: inspection.reason };

  if (inspection.hasExif || inspection.hasXmp || inspection.metadataSegments.length > 0) {
    return { publishable: false, reason: "metadata-present" };
  }
  if (bytes.length > PUBLISHED_MAX_BYTES) {
    return { publishable: false, reason: "too-large" };
  }

  const longEdge = Math.max(inspection.width, inspection.height);
  if (longEdge > PUBLISHED_MAX_LONG_EDGE_PX) return { publishable: false, reason: "too-large" };
  if (longEdge < PUBLISHED_MIN_LONG_EDGE_PX) return { publishable: false, reason: "too-small" };

  const swap = orientationSwapsAxes(orientation);
  return {
    publishable: true,
    width: inspection.width,
    height: inspection.height,
    displayWidth: swap ? inspection.height : inspection.width,
    displayHeight: swap ? inspection.width : inspection.height,
  };
}

export type AltTextDecision =
  | { kind: "described"; text: string }
  | { kind: "decorative" }
  | { kind: "rejected"; reason: "too-long" | "filename" };

/**
 * Resolve what a photograph's alt attribute becomes.
 *
 * Three outcomes and no fourth. A photograph is either described by the
 * couple, or marked decorative and given `alt=""` so a screen reader skips
 * it, or refused. There is deliberately no filename fallback: "IMG_4183.JPG"
 * read aloud is worse than silence, and it leaks the couple's camera roll
 * numbering onto a public page.
 */
export function resolveAltText(
  input: string | null | undefined,
  { decorative = false }: { decorative?: boolean } = {},
): AltTextDecision {
  if (decorative) return { kind: "decorative" };

  const text = (input ?? "").trim();
  if (!text) return { kind: "decorative" };
  if (text.length > ALT_TEXT_MAX_LENGTH) return { kind: "rejected", reason: "too-long" };
  if (looksLikeFilename(text)) return { kind: "rejected", reason: "filename" };
  return { kind: "described", text };
}

const FILENAME_PATTERN = /^[\w \-.]+\.(jpe?g|png|gif|webp|heic|heif|tiff?)$/i;

function looksLikeFilename(text: string): boolean {
  return FILENAME_PATTERN.test(text);
}

/**
 * The alt attribute value to render. Never undefined: an image with no alt
 * attribute at all is announced by its src, which is the outcome
 * `resolveAltText` exists to prevent.
 */
export function altAttribute(decision: AltTextDecision): string {
  return decision.kind === "described" ? decision.text : "";
}
