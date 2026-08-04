import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectImage,
  orientationSwapsAxes,
  orientationTransform,
  stripImageMetadata,
} from "./metadata";
import {
  ALT_TEXT_MAX_LENGTH,
  PUBLISHED_MAX_LONG_EDGE_PX,
  PUBLISHED_MIN_LONG_EDGE_PX,
  altAttribute,
  decidePhotograph,
  resolveAltText,
} from "./policy";

// ── fixtures, built byte by byte ──────────────────────────────────────
//
// Built here rather than committed as binaries so the test states exactly
// what it claims to be testing. A checked-in .jpg proves nothing a reader
// can see.

function u16be(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function ascii(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

/**
 * A little-endian TIFF stream carrying orientation 6 (rotate 90), a
 * DateTime, and a GPS IFD pointer. This is what a phone writes.
 */
function tiffWithGps(): number[] {
  const dateTime = "2026:08:03 12:00:00\0"; // 20 bytes
  const dateTimeOffset = 50;
  const gpsIfdOffset = 70;

  const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
  const le32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];

  return [
    ...ascii("II"), ...le16(0x2a), ...le32(8),          // 0..7   header
    ...le16(3),                                          // 8..9   IFD0 entry count
    ...le16(0x0112), ...le16(3), ...le32(1), ...le32(6), // 10..21 Orientation = 6
    ...le16(0x0132), ...le16(2), ...le32(20), ...le32(dateTimeOffset), // 22..33 DateTime
    ...le16(0x8825), ...le16(4), ...le32(1), ...le32(gpsIfdOffset),    // 34..45 GPS IFD
    ...le32(0),                                          // 46..49 no next IFD
    ...ascii(dateTime),                                  // 50..69
    ...le16(1),                                          // 70..71 GPS IFD entry count
    ...le16(0x0001), ...le16(2), ...le32(2), ...ascii("N\0\0\0"), // 72..83 GPSLatitudeRef
    ...le32(0),                                          // 84..87 no next IFD
  ];
}

function jpegWithExif({ width = 1600, height = 1200 } = {}): Uint8Array {
  const tiff = tiffWithGps();
  const app1Payload = [...ascii("Exif\0\0"), ...tiff];
  const comment = ascii("Taken at home");

  return new Uint8Array([
    0xff, 0xd8,                                              // SOI
    0xff, 0xe0, ...u16be(16), ...ascii("JFIF\0"),            // APP0, kept
    1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xe1, ...u16be(app1Payload.length + 2), ...app1Payload, // APP1/Exif
    0xff, 0xfe, ...u16be(comment.length + 2), ...comment,    // COM
    0xff, 0xc0, ...u16be(11), 8, ...u16be(height), ...u16be(width), 1, 1, 0x11, 0, // SOF0
    0xff, 0xda, ...u16be(8), 1, 1, 0, 0, 63, 0,              // SOS
    0x12, 0x34, 0x56, 0x78, 0x9a,                            // "pixels"
    0xff, 0xd9,                                              // EOI
  ]);
}

function jpegWithoutMetadata({ width = 1600, height = 1200 } = {}): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, ...u16be(16), ...ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc0, ...u16be(11), 8, ...u16be(height), ...u16be(width), 1, 1, 0x11, 0,
    0xff, 0xda, ...u16be(8), 1, 1, 0, 0, 63, 0,
    0x12, 0x34, 0x56, 0x78, 0x9a,
    0xff, 0xd9,
  ]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: number[]): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: number[]): number[] {
  const be32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  const body = [...ascii(type), ...data];
  return [...be32(data.length), ...body, ...be32(crc32(body))];
}

function pngWithExif({ width = 1600, height = 1200 } = {}): Uint8Array {
  const be32 = (v: number) => [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...pngChunk("IHDR", [...be32(width), ...be32(height), 8, 2, 0, 0, 0]),
    ...pngChunk("eXIf", tiffWithGps()),
    ...pngChunk("tEXt", ascii("Comment\0Ballintubber, Co. Limerick")),
    ...pngChunk("sRGB", [0]),
    ...pngChunk("IDAT", [0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]),
    ...pngChunk("IEND", []),
  ]);
}

// ── what the photograph says about itself ─────────────────────────────

test("a phone photograph's GPS, capture time and orientation are all read before anything is removed", () => {
  const inspection = inspectImage(jpegWithExif());
  assert.equal(inspection.supported, true);
  if (!inspection.supported) return;

  assert.equal(inspection.format, "jpeg");
  assert.equal(inspection.width, 1600);
  assert.equal(inspection.height, 1200);
  assert.equal(inspection.orientation, 6);
  assert.equal(inspection.hasExif, true);
  assert.equal(inspection.hasGps, true);
  assert.equal(inspection.hasCaptureTime, true);
  assert.deepEqual(inspection.metadataSegments, ["APP1/Exif", "COM"]);
});

test("a GPS-bearing JPEG comes out clean: no EXIF, no GPS, no capture time, no comment", () => {
  const original = jpegWithExif();
  const result = stripImageMetadata(original);
  assert.equal(result.supported, true);
  if (!result.supported) return;

  assert.deepEqual(result.removed, ["APP1/Exif", "COM"]);

  const after = inspectImage(result.bytes);
  assert.equal(after.supported, true);
  if (!after.supported) return;

  assert.equal(after.hasExif, false);
  assert.equal(after.hasGps, false);
  assert.equal(after.hasCaptureTime, false);
  assert.equal(after.hasXmp, false);
  assert.deepEqual(after.metadataSegments, []);

  // The literal ASCII of the EXIF marker is gone from the byte stream, not
  // merely unparsed.
  const text = Buffer.from(result.bytes).toString("latin1");
  assert.equal(text.includes("Exif"), false);
  assert.equal(text.includes("Taken at home"), false);
  assert.equal(text.includes("2026:08:03"), false);
});

test("stripping removes description and never a pixel", () => {
  const original = jpegWithExif();
  const result = stripImageMetadata(original);
  assert.equal(result.supported, true);
  if (!result.supported) return;

  const after = inspectImage(result.bytes);
  assert.equal(after.supported, true);
  if (!after.supported) return;

  // Same picture: same intrinsic dimensions, same trailing scan bytes.
  assert.equal(after.width, 1600);
  assert.equal(after.height, 1200);
  assert.deepEqual(
    Array.from(result.bytes.subarray(result.bytes.length - 7)),
    Array.from(original.subarray(original.length - 7)),
  );
  assert.ok(result.bytes.length < original.length);
});

test("orientation survives as a value after the segment that carried it is gone", () => {
  const result = stripImageMetadata(jpegWithExif());
  assert.equal(result.supported, true);
  if (!result.supported) return;

  // The whole point: the caller can still put the photograph the right way up.
  assert.equal(result.orientation, 6);
  assert.equal(orientationSwapsAxes(result.orientation), true);
  assert.equal(orientationTransform(result.orientation), "rotate(90deg)");

  // And the stripped file no longer claims an orientation of its own.
  const after = inspectImage(result.bytes);
  assert.equal(after.supported, true);
  if (!after.supported) return;
  assert.equal(after.orientation, null);
});

test("a portrait photograph reports swapped display dimensions so the page reserves the right box", () => {
  const original = jpegWithExif({ width: 1600, height: 1200 });
  const strip = stripImageMetadata(original);
  assert.equal(strip.supported, true);
  if (!strip.supported) return;

  // Orientation is carried forward from the strip, not re-read from the
  // cleaned bytes, because the cleaned bytes no longer contain it.
  const decision = decidePhotograph(strip.bytes, { orientation: strip.orientation });
  assert.equal(decision.publishable, true);
  if (!decision.publishable) return;

  assert.equal(decision.width, 1600);
  assert.equal(decision.height, 1200);
  assert.equal(decision.displayWidth, 1200);
  assert.equal(decision.displayHeight, 1600);

  // And the regression this API shape exists to prevent: forget to pass the
  // orientation on and a portrait photograph silently reserves a landscape box.
  const forgotten = decidePhotograph(strip.bytes);
  assert.equal(forgotten.publishable, true);
  if (!forgotten.publishable) return;
  assert.equal(forgotten.displayWidth, 1600);
});

test("a PNG's eXIf and tEXt chunks are removed and the image chunks are left alone", () => {
  const original = pngWithExif();
  const before = inspectImage(original);
  assert.equal(before.supported, true);
  if (!before.supported) return;
  assert.equal(before.hasGps, true);
  assert.deepEqual(before.metadataSegments, ["eXIf", "tEXt"]);

  const result = stripImageMetadata(original);
  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.deepEqual(result.removed, ["eXIf", "tEXt"]);
  assert.equal(result.orientation, 6);

  const text = Buffer.from(result.bytes).toString("latin1");
  assert.equal(text.includes("Ballintubber"), false);
  assert.equal(text.includes("eXIf"), false);
  // sRGB, IDAT and IEND survive untouched, so the file still renders.
  assert.equal(text.includes("sRGB"), true);
  assert.equal(text.includes("IDAT"), true);
  assert.equal(text.includes("IEND"), true);

  const after = inspectImage(result.bytes);
  assert.equal(after.supported, true);
  if (!after.supported) return;
  assert.equal(after.width, 1600);
  assert.equal(after.height, 1200);
  assert.equal(after.hasGps, false);
});

// ── refusal by absence ────────────────────────────────────────────────

test("a format whose metadata cannot be proven removed is refused, not passed through", () => {
  // A real WebP header. WebP carries EXIF and XMP chunks of its own; this
  // module does not handle them, so it must refuse rather than let a file
  // through unexamined.
  const webp = new Uint8Array([
    ...ascii("RIFF"), 0x1a, 0, 0, 0, ...ascii("WEBPVP8 "),
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const result = stripImageMetadata(webp);
  assert.equal(result.supported, false);
  if (result.supported) return;
  assert.equal(result.reason, "unrecognised-format");

  assert.equal(inspectImage(new Uint8Array()).supported, false);
  const heic = new Uint8Array([0, 0, 0, 0x18, ...ascii("ftypheic")]);
  assert.equal(stripImageMetadata(heic).supported, false);
});

test("a truncated JPEG is refused rather than half-parsed", () => {
  const truncated = jpegWithExif().subarray(0, 20);
  const result = stripImageMetadata(truncated);
  assert.equal(result.supported, false);
  if (result.supported) return;
  assert.equal(result.reason, "malformed-jpeg");
});

// ── publication policy ────────────────────────────────────────────────

test("bytes that still carry metadata are refused publication outright", () => {
  const decision = decidePhotograph(jpegWithExif());
  assert.equal(decision.publishable, false);
  if (decision.publishable) return;
  // This is the guard against a caller forgetting to strip.
  assert.equal(decision.reason, "metadata-present");
});

test("the stated dimension bounds are the ones enforced", () => {
  const tooBig = decidePhotograph(
    jpegWithoutMetadata({ width: PUBLISHED_MAX_LONG_EDGE_PX + 1, height: 1000 }),
  );
  assert.equal(tooBig.publishable, false);
  if (!tooBig.publishable) assert.equal(tooBig.reason, "too-large");

  const tooSmall = decidePhotograph(
    jpegWithoutMetadata({ width: PUBLISHED_MIN_LONG_EDGE_PX - 1, height: 400 }),
  );
  assert.equal(tooSmall.publishable, false);
  if (!tooSmall.publishable) assert.equal(tooSmall.reason, "too-small");

  const exactlyAtTheCeiling = decidePhotograph(
    jpegWithoutMetadata({ width: PUBLISHED_MAX_LONG_EDGE_PX, height: 1000 }),
  );
  assert.equal(exactlyAtTheCeiling.publishable, true);
});

// ── alt text ──────────────────────────────────────────────────────────

test("alt text never falls back to a filename", () => {
  assert.deepEqual(resolveAltText("IMG_4183.JPG"), { kind: "rejected", reason: "filename" });
  assert.deepEqual(resolveAltText("DSC00214.jpeg"), { kind: "rejected", reason: "filename" });
  assert.deepEqual(resolveAltText("photo 3.png"), { kind: "rejected", reason: "filename" });
});

test("a photograph with no description is decorative, and decorative means an empty alt attribute", () => {
  assert.deepEqual(resolveAltText(""), { kind: "decorative" });
  assert.deepEqual(resolveAltText(null), { kind: "decorative" });
  assert.deepEqual(resolveAltText("   "), { kind: "decorative" });
  assert.deepEqual(resolveAltText("Anything", { decorative: true }), { kind: "decorative" });

  // Empty string, not undefined. An <img> with no alt attribute is announced
  // by its src, which is the outcome this exists to prevent.
  assert.equal(altAttribute(resolveAltText(null)), "");
  assert.equal(altAttribute({ kind: "described", text: "The first dance" }), "The first dance");
});

test("a description the couple wrote is kept, and an overlong one is refused", () => {
  assert.deepEqual(resolveAltText("  Cutting the cake at Ballintubber  "), {
    kind: "described",
    text: "Cutting the cake at Ballintubber",
  });
  assert.deepEqual(resolveAltText("x".repeat(ALT_TEXT_MAX_LENGTH + 1)), {
    kind: "rejected",
    reason: "too-long",
  });
  assert.equal(resolveAltText("x".repeat(ALT_TEXT_MAX_LENGTH)).kind, "described");
});
