/**
 * Template card glyph. Replaces the emoji icons that earlier
 * versions of `Template.icon` carried — brand.md is absolute on
 * "no emoji anywhere," and the templates surface is the most
 * visible offender. Each slug maps to a stroke-SVG glyph in the
 * brand-soft tile shape used across the marketing surface.
 *
 * Add a new glyph by extending `GLYPHS` and pointing the relevant
 * Template's `icon` field at the slug.
 */

import type { ReactNode } from "react";

type GlyphProps = {
  width: number;
  height: number;
  strokeWidth?: number;
};

const GLYPHS: Record<string, (p: GlyphProps) => ReactNode> = {
  ring: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="14" r="6" />
      <path d="M9 5l3-3 3 3" />
    </svg>
  ),
  clock: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  cap: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9l10-5 10 5-10 5L2 9z" />
      <path d="M6 11v5a6 4 0 0 0 12 0v-5" />
    </svg>
  ),
  document: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  ),
  book: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5H6.5A2.5 2.5 0 0 0 4 19.5z" />
    </svg>
  ),
  briefcase: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  ),
  receipt: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  ),
  plane: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16v-2L13 9V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1L15 22v-1.5L13 19v-5.5z" />
    </svg>
  ),
  target: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  ),
  box: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4V11" />
      <path d="M21 7v10l-9 4" />
    </svg>
  ),
  wrench: ({ width, height, strokeWidth = 1.6 }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2.6-2.6 2.7-2.7a4 4 0 0 0-.4-.4z" />
    </svg>
  ),
};

export type GlyphSlug = keyof typeof GLYPHS;

export function TemplateGlyph({
  slug,
  size = 22,
  strokeWidth,
}: {
  slug: string;
  size?: number;
  strokeWidth?: number;
}) {
  const render = GLYPHS[slug] ?? GLYPHS.target;
  return <>{render({ width: size, height: size, strokeWidth })}</>;
}

/**
 * Same set of glyphs, returned as a serializable object for the
 * Next ImageResponse (OG card) generator. ImageResponse can render
 * inline SVG via JSX, but it doesn't tolerate function components —
 * we hand it the JSX directly.
 */
export function templateGlyphForOg(slug: string): ReactNode {
  const render = GLYPHS[slug] ?? GLYPHS.target;
  return render({ width: 36, height: 36, strokeWidth: 1.4 });
}
