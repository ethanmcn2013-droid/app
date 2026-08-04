/**
 * Image metadata inspection and removal, for photographs that will be
 * published on a couple's public artifact.
 *
 * WHY THIS EXISTS
 * ---------------
 * A phone photograph carries the coordinates of the place it was taken and
 * the second it was taken. E06.06 exists so a couple can conceal a location.
 * Publishing the same location inside the file's own metadata would undo that
 * silently, and nobody would ever see it happen. So the rule is: no byte
 * reaches a public surface until its description has been removed from it.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This does not re-encode pixels. It removes metadata segments and leaves the
 * compressed image data untouched, so it cannot change how a photograph looks,
 * cannot lose quality, and needs no native image library. Resizing and
 * re-compression are a separate concern: see `./policy.ts`.
 *
 * It also does not rotate anything. It READS the EXIF orientation before
 * discarding it and hands the value back, so the caller can persist it and
 * apply it at render. Discarding orientation without recording it is how a
 * portrait phone photograph ends up sideways on a public page.
 *
 * FORMAT SUPPORT IS AN ALLOWLIST, AND THE REFUSAL IS THE POINT
 * -----------------------------------------------------------
 * Only JPEG and PNG are supported, because those are the two formats whose
 * metadata this module can prove it has removed. Anything else is refused
 * rather than passed through unexamined. A format nobody thought of is
 * refused too. This mirrors the allowlist-by-absence rule in
 * `upload-validation` (E08.07).
 */

export type SupportedImageFormat = "jpeg" | "png";

export type ImageInspection =
  | { supported: false; reason: ImageRefusalReason }
  | {
      supported: true;
      format: SupportedImageFormat;
      /** Intrinsic pixel width, before any orientation is applied. */
      width: number;
      /** Intrinsic pixel height, before any orientation is applied. */
      height: number;
      /** EXIF orientation 1-8, or null when absent or unreadable. */
      orientation: number | null;
      hasExif: boolean;
      hasGps: boolean;
      hasCaptureTime: boolean;
      hasXmp: boolean;
      /** Named metadata segments/chunks present in the input. */
      metadataSegments: string[];
    };

export type ImageRefusalReason =
  | "empty"
  | "unrecognised-format"
  | "malformed-jpeg"
  | "malformed-png";

export type StripResult =
  | { supported: false; reason: ImageRefusalReason }
  | {
      supported: true;
      format: SupportedImageFormat;
      /** The image with every metadata segment removed. Pixels untouched. */
      bytes: Uint8Array;
      /** Orientation read out of the input before it was discarded. */
      orientation: number | null;
      width: number;
      height: number;
      /** Names of the segments/chunks actually removed. */
      removed: string[];
    };

// ── format detection ──────────────────────────────────────────────────

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function detect(bytes: Uint8Array): SupportedImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    return "png";
  }
  return null;
}

// ── TIFF / EXIF reader, shared by JPEG APP1 and PNG eXIf ──────────────

type ExifFacts = {
  orientation: number | null;
  hasGps: boolean;
  hasCaptureTime: boolean;
};

const TAG_ORIENTATION = 0x0112;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;

/**
 * Read the facts we care about out of a raw TIFF stream. Deliberately
 * tolerant: a stream we cannot parse yields "nothing known", never a throw,
 * because an unreadable header must not stop the strip from happening.
 */
function readTiff(tiff: Uint8Array): ExifFacts {
  const unknown: ExifFacts = { orientation: null, hasGps: false, hasCaptureTime: false };
  if (tiff.length < 8) return unknown;

  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return unknown;

  const u16 = (o: number): number => {
    if (o + 1 >= tiff.length) return 0;
    return little ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1];
  };
  const u32 = (o: number): number => {
    if (o + 3 >= tiff.length) return 0;
    return little
      ? (tiff[o] | (tiff[o + 1] << 8) | (tiff[o + 2] << 16) | (tiff[o + 3] << 24)) >>> 0
      : ((tiff[o] << 24) | (tiff[o + 1] << 16) | (tiff[o + 2] << 8) | tiff[o + 3]) >>> 0;
  };

  if (u16(2) !== 0x2a) return unknown;

  const facts: ExifFacts = { orientation: null, hasGps: false, hasCaptureTime: false };
  const seen = new Set<number>();

  const walk = (ifdOffset: number, depth: number): void => {
    if (depth > 4) return;
    if (ifdOffset <= 0 || ifdOffset + 2 > tiff.length) return;
    if (seen.has(ifdOffset)) return;
    seen.add(ifdOffset);

    const count = u16(ifdOffset);
    // A count that runs past the buffer means a truncated or hostile file.
    if (count <= 0 || ifdOffset + 2 + count * 12 > tiff.length) return;

    for (let n = 0; n < count; n += 1) {
      const entry = ifdOffset + 2 + n * 12;
      const tag = u16(entry);
      const value = entry + 8;

      if (tag === TAG_ORIENTATION) {
        const raw = u16(value);
        if (raw >= 1 && raw <= 8) facts.orientation = raw;
      } else if (tag === TAG_GPS_IFD) {
        facts.hasGps = true;
      } else if (
        tag === TAG_DATETIME
        || tag === TAG_DATETIME_ORIGINAL
        || tag === TAG_DATETIME_DIGITIZED
      ) {
        facts.hasCaptureTime = true;
      } else if (tag === TAG_EXIF_IFD) {
        walk(u32(value), depth + 1);
      }
    }
  };

  walk(u32(4), 0);
  return facts;
}

// ── JPEG ──────────────────────────────────────────────────────────────

type JpegSegment = {
  marker: number;
  /** Offset of the 0xFF that opens the segment. */
  start: number;
  /** Offset just past the segment, exclusive. */
  end: number;
  /** Offset of the payload, i.e. past marker and length. */
  payloadStart: number;
};

type JpegParse = {
  segments: JpegSegment[];
  /** Offset where the SOS marker begins; everything from here is copied raw. */
  scanStart: number;
};

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * Markers removed from a published photograph.
 *  APP1  - EXIF (GPS, capture time, camera serial) and XMP.
 *  APP3..APP15 - includes APP13, which is where IPTC/Photoshop
 *                captions, credits and locations live.
 *  COM   - free-text comment.
 * APP0 (JFIF density) and APP2 (ICC colour profile) are kept: they carry no
 * description of a person or a place, and dropping ICC visibly shifts colour.
 */
function isRemovableJpegMarker(marker: number): boolean {
  if (marker === 0xe1) return true;
  if (marker >= 0xe3 && marker <= 0xef) return true;
  if (marker === 0xfe) return true;
  return false;
}

function jpegSegmentName(marker: number, payload: Uint8Array): string {
  if (marker === 0xe1) {
    if (startsWithAscii(payload, "Exif\0\0")) return "APP1/Exif";
    if (startsWithAscii(payload, "http://ns.adobe.com/xap/")) return "APP1/XMP";
    return "APP1";
  }
  if (marker === 0xed) return "APP13/IPTC";
  if (marker === 0xfe) return "COM";
  return `APP${marker - 0xe0}`;
}

function startsWithAscii(bytes: Uint8Array, prefix: string): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (bytes[i] !== prefix.charCodeAt(i)) return false;
  }
  return true;
}

function parseJpeg(bytes: Uint8Array): JpegParse | null {
  let i = 2; // past SOI
  const segments: JpegSegment[] = [];

  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) return null;

    let marker = bytes[i + 1];
    let markerStart = i;
    // 0xFF is a legal fill byte before a marker.
    while (marker === 0xff && markerStart + 2 < bytes.length) {
      markerStart += 1;
      marker = bytes[markerStart + 1];
    }

    // Standalone markers carry no length word.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i = markerStart + 2;
      continue;
    }
    if (marker === 0xd9) return { segments, scanStart: markerStart };
    if (marker === 0xda) return { segments, scanStart: markerStart };

    const lengthAt = markerStart + 2;
    if (lengthAt + 1 >= bytes.length) return null;
    const length = (bytes[lengthAt] << 8) | bytes[lengthAt + 1];
    if (length < 2) return null;
    const end = lengthAt + length;
    if (end > bytes.length) return null;

    segments.push({ marker, start: markerStart, end, payloadStart: lengthAt + 2 });
    i = end;
  }

  return null;
}

function inspectJpeg(bytes: Uint8Array): ImageInspection {
  const parsed = parseJpeg(bytes);
  if (!parsed) return { supported: false, reason: "malformed-jpeg" };

  let width = 0;
  let height = 0;
  let orientation: number | null = null;
  let hasExif = false;
  let hasGps = false;
  let hasCaptureTime = false;
  let hasXmp = false;
  const metadataSegments: string[] = [];

  for (const segment of parsed.segments) {
    const payload = bytes.subarray(segment.payloadStart, segment.end);

    if (SOF_MARKERS.has(segment.marker) && payload.length >= 5) {
      height = (payload[1] << 8) | payload[2];
      width = (payload[3] << 8) | payload[4];
      continue;
    }

    if (!isRemovableJpegMarker(segment.marker)) continue;

    metadataSegments.push(jpegSegmentName(segment.marker, payload));

    if (startsWithAscii(payload, "Exif\0\0")) {
      hasExif = true;
      const facts = readTiff(payload.subarray(6));
      if (facts.orientation !== null) orientation = facts.orientation;
      hasGps ||= facts.hasGps;
      hasCaptureTime ||= facts.hasCaptureTime;
    } else if (startsWithAscii(payload, "http://ns.adobe.com/xap/")) {
      hasXmp = true;
    }
  }

  if (width <= 0 || height <= 0) return { supported: false, reason: "malformed-jpeg" };

  return {
    supported: true,
    format: "jpeg",
    width,
    height,
    orientation,
    hasExif,
    hasGps,
    hasCaptureTime,
    hasXmp,
    metadataSegments,
  };
}

function stripJpeg(bytes: Uint8Array, inspection: Extract<ImageInspection, { supported: true }>): StripResult {
  const parsed = parseJpeg(bytes);
  if (!parsed) return { supported: false, reason: "malformed-jpeg" };

  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  const removed: string[] = [];

  for (const segment of parsed.segments) {
    if (isRemovableJpegMarker(segment.marker)) {
      removed.push(jpegSegmentName(segment.marker, bytes.subarray(segment.payloadStart, segment.end)));
      continue;
    }
    chunks.push(bytes.subarray(segment.start, segment.end));
  }

  // Everything from SOS (or EOI) onward is entropy-coded image data. It is
  // copied verbatim: this module never touches a pixel.
  chunks.push(bytes.subarray(parsed.scanStart));

  return {
    supported: true,
    format: "jpeg",
    bytes: concat(chunks),
    orientation: inspection.orientation,
    width: inspection.width,
    height: inspection.height,
    removed,
  };
}

// ── PNG ───────────────────────────────────────────────────────────────

type PngChunk = { type: string; start: number; end: number; dataStart: number; dataEnd: number };

/**
 * PNG chunks removed from a published photograph. eXIf is the same TIFF
 * stream a JPEG carries in APP1, so it carries GPS. tEXt/zTXt/iTXt are
 * free-text and routinely carry camera software, captions and locations.
 * tIME is a modification timestamp.
 */
const REMOVABLE_PNG_CHUNKS = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function parsePng(bytes: Uint8Array): PngChunk[] | null {
  const chunks: PngChunk[] = [];
  let i = 8;

  while (i + 8 <= bytes.length) {
    const length = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    const dataStart = i + 8;
    const dataEnd = dataStart + length;
    const end = dataEnd + 4;
    if (end > bytes.length) return null;

    let type = "";
    for (let n = 0; n < 4; n += 1) type += String.fromCharCode(bytes[i + 4 + n]);

    chunks.push({ type, start: i, end, dataStart, dataEnd });
    i = end;
    if (type === "IEND") break;
  }

  if (!chunks.length || chunks[0].type !== "IHDR") return null;
  return chunks;
}

function inspectPng(bytes: Uint8Array): ImageInspection {
  const chunks = parsePng(bytes);
  if (!chunks) return { supported: false, reason: "malformed-png" };

  const ihdr = chunks[0];
  if (ihdr.dataEnd - ihdr.dataStart < 8) return { supported: false, reason: "malformed-png" };

  const read32 = (o: number): number =>
    ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;

  const width = read32(ihdr.dataStart);
  const height = read32(ihdr.dataStart + 4);
  if (width <= 0 || height <= 0) return { supported: false, reason: "malformed-png" };

  let orientation: number | null = null;
  let hasExif = false;
  let hasGps = false;
  let hasCaptureTime = false;
  let hasXmp = false;
  const metadataSegments: string[] = [];

  for (const chunk of chunks) {
    if (!REMOVABLE_PNG_CHUNKS.has(chunk.type)) continue;
    metadataSegments.push(chunk.type);

    if (chunk.type === "eXIf") {
      hasExif = true;
      const facts = readTiff(bytes.subarray(chunk.dataStart, chunk.dataEnd));
      if (facts.orientation !== null) orientation = facts.orientation;
      hasGps ||= facts.hasGps;
      hasCaptureTime ||= facts.hasCaptureTime;
    } else if (chunk.type === "iTXt" || chunk.type === "tEXt") {
      if (startsWithAscii(bytes.subarray(chunk.dataStart, chunk.dataEnd), "XML:com.adobe.xmp")) {
        hasXmp = true;
      }
    }
  }

  return {
    supported: true,
    format: "png",
    width,
    height,
    orientation,
    hasExif,
    hasGps,
    hasCaptureTime,
    hasXmp,
    metadataSegments,
  };
}

function stripPng(bytes: Uint8Array, inspection: Extract<ImageInspection, { supported: true }>): StripResult {
  const chunks = parsePng(bytes);
  if (!chunks) return { supported: false, reason: "malformed-png" };

  const out: Uint8Array[] = [bytes.subarray(0, 8)];
  const removed: string[] = [];

  for (const chunk of chunks) {
    if (REMOVABLE_PNG_CHUNKS.has(chunk.type)) {
      removed.push(chunk.type);
      continue;
    }
    // Whole chunks are dropped, so every surviving chunk keeps its own CRC.
    out.push(bytes.subarray(chunk.start, chunk.end));
  }

  return {
    supported: true,
    format: "png",
    bytes: concat(out),
    orientation: inspection.orientation,
    width: inspection.width,
    height: inspection.height,
    removed,
  };
}

// ── public seam ───────────────────────────────────────────────────────

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Read what a photograph says about itself, without changing it. */
export function inspectImage(bytes: Uint8Array): ImageInspection {
  if (!bytes.length) return { supported: false, reason: "empty" };
  const format = detect(bytes);
  if (format === "jpeg") return inspectJpeg(bytes);
  if (format === "png") return inspectPng(bytes);
  return { supported: false, reason: "unrecognised-format" };
}

/**
 * Remove every metadata segment from a photograph and hand back the
 * orientation that was removed, so the caller can persist it.
 *
 * Refuses anything it cannot prove it has cleaned. A refusal is a correct
 * outcome, not a failure to handle.
 */
export function stripImageMetadata(bytes: Uint8Array): StripResult {
  const inspection = inspectImage(bytes);
  if (!inspection.supported) return inspection;
  if (inspection.format === "jpeg") return stripJpeg(bytes, inspection);
  return stripPng(bytes, inspection);
}

/**
 * True when applying the orientation swaps the width and height, which is
 * what a portrait photograph from a phone held sideways does. Callers store
 * the display dimensions so the public page reserves the right box and does
 * not shift when the image loads.
 */
export function orientationSwapsAxes(orientation: number | null): boolean {
  return orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
}

/**
 * The CSS transform that puts an EXIF-oriented photograph the right way up.
 * Returned rather than baked into the pixels: this module re-encodes nothing.
 */
export function orientationTransform(orientation: number | null): string {
  switch (orientation) {
    case 2: return "scaleX(-1)";
    case 3: return "rotate(180deg)";
    case 4: return "scaleY(-1)";
    case 5: return "rotate(90deg) scaleX(-1)";
    case 6: return "rotate(90deg)";
    case 7: return "rotate(270deg) scaleX(-1)";
    case 8: return "rotate(270deg)";
    default: return "none";
  }
}
