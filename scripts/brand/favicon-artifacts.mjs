import { createElement } from "react";
import { ImageResponse } from "next/og";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { SuiteMark } = require("../../src/lib/brand/suite-mark.tsx");

export const FAVICON_SIZES = [16, 32, 48, 256];

/** Render the same component as /icon; the ICO owns no brand constants. */
export async function renderFaviconFrame(canvas) {
  const response = new ImageResponse(createElement(SuiteMark, { canvas }), {
    width: canvas,
    height: canvas,
  });
  return Buffer.from(await response.arrayBuffer());
}

/** A standard ICO directory containing a lossless PNG at each tab size. */
export async function buildFavicon() {
  const frames = await Promise.all(FAVICON_SIZES.map(renderFaviconFrame));
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;

  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    const size = FAVICON_SIZES[index];
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  });

  return Buffer.concat([header, ...frames]);
}
