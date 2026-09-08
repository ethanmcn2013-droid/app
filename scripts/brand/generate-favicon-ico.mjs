#!/usr/bin/env node
/**
 * Regenerates src/app/favicon.ico from the suite mark.
 *
 * WHY THIS EXISTS. The mark itself lives in src/lib/brand/suite-mark.tsx
 * and is rasterised by Next's ImageResponse for /icon, /icon1 and
 * /apple-icon. favicon.ico is the one icon Next CANNOT generate: a
 * static file in src/app/ that is served verbatim at /favicon.ico for
 * the browsers (and crawlers, and link unfurlers) that request that
 * path directly instead of reading the <link rel="icon"> tag. Before
 * this script it was an opaque binary nobody could re-derive, so a
 * brand change silently left it behind. Now the .ico is a build
 * artifact of the same two colours and the same 40% geometry.
 *
 *   node scripts/brand/generate-favicon-ico.mjs
 *
 * FRAMES: 16, 32, 48, 256 — the set the previous .ico shipped. 16/32/48
 * are written as BMP (DIB) because 16px PNG-in-ICO is the one combination
 * old Windows shells still mishandle; 256 is written as PNG, which is
 * what makes the file ~25KB instead of ~275KB.
 *
 * The circle is supersampled 8×8 per pixel and composited over the ink,
 * so the 16px frame gets the same soft edge the browser gives the
 * ImageResponse dot rather than a hard-aliased staircase.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* Kept in sync with src/lib/brand/suite-mark.tsx — indigo-500 on the
   Studio Bar charcoal, dot at 40% of the canvas. */
const INDIGO = [0x63, 0x66, 0xf1];
const INK = [0x17, 0x17, 0x1a];
const DOT_RATIO = 0.4;
const SIZES = [16, 32, 48, 256];
const SUBSAMPLES = 8;

/** RGBA pixels, top-down, for one square frame of the mark. */
function renderMark(size) {
  const px = Buffer.alloc(size * size * 4);
  /* Centre and radius in continuous space — the same place flexbox puts
     the dot, including the half-pixel offsets at odd diameters. */
  const centre = size / 2;
  const radius = Math.round(size * DOT_RATIO) / 2;
  const step = 1 / SUBSAMPLES;
  const offset = step / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SUBSAMPLES; sy++) {
        for (let sx = 0; sx < SUBSAMPLES; sx++) {
          const dx = x + sx * step + offset - centre;
          const dy = y + sy * step + offset - centre;
          if (dx * dx + dy * dy <= radius * radius) hits++;
        }
      }
      const coverage = hits / (SUBSAMPLES * SUBSAMPLES);
      const i = (y * size + x) * 4;
      /* Opaque throughout: the ink is a field, not a transparency. */
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round(INK[c] + (INDIGO[c] - INK[c]) * coverage);
      }
      px[i + 3] = 0xff;
    }
  }
  return px;
}

/* ── PNG ──────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  /* 10,11,12 stay 0: deflate, adaptive filtering, no interlace. */

  /* One filter byte per scanline; filter 0 (None) — a flat field of two
     colours deflates fine without per-row prediction. */
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const dst = y * (size * 4 + 1);
    raw[dst] = 0;
    rgba.copy(raw, dst + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── BMP (DIB) ────────────────────────────────────────────────── */

function encodeDib(size, rgba) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR bitmap + AND mask, per the ICO spec
  header.writeUInt16LE(1, 12); // planes
  header.writeUInt16LE(32, 14); // bpp
  header.writeUInt32LE(0, 16); // BI_RGB
  header.writeUInt32LE(size * size * 4, 20);

  /* BGRA, bottom-up. */
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = ((size - 1 - y) * size + x) * 4;
      xor[dst] = rgba[src + 2];
      xor[dst + 1] = rgba[src + 1];
      xor[dst + 2] = rgba[src];
      xor[dst + 3] = rgba[src + 3];
    }
  }

  /* AND mask: 1bpp, rows padded to 4 bytes, all zero = fully opaque.
     Ignored by anything that reads the alpha channel, required by
     everything that doesn't. */
  const maskStride = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, xor, Buffer.alloc(maskStride * size)]);
}

/* ── ICO container ────────────────────────────────────────────── */

const frames = SIZES.map((size) => {
  const rgba = renderMark(size);
  return { size, data: size >= 256 ? encodePng(size, rgba) : encodeDib(size, rgba) };
});

const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2); // 1 = icon
dir.writeUInt16LE(frames.length, 4);

let offset = 6 + frames.length * 16;
const entries = frames.map(({ size, data }) => {
  const e = Buffer.alloc(16);
  e[0] = size >= 256 ? 0 : size; // 0 means 256
  e[1] = size >= 256 ? 0 : size;
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});

const out = Buffer.concat([dir, ...entries, ...frames.map((f) => f.data)]);
const target = join(dirname(fileURLToPath(import.meta.url)), "../../src/app/favicon.ico");
writeFileSync(target, out);
console.log(
  `favicon.ico · ${frames.map((f) => f.size).join("/")} · ${(out.length / 1024).toFixed(1)}KB`,
);
