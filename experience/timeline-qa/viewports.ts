/**
 * Viewport manifest for the Timeline visual-QA harness.
 *
 * The brief specifies seven concrete sizes plus 200% zoom, emulated by
 * halving the three primary desktop sizes. Two entries required a judgment
 * call the brief left open, both documented below rather than made silently:
 *
 *  - "1024 wide" gave no height. This harness uses 1024x768, the
 *    conventional small-laptop/landscape-tablet pairing used elsewhere in
 *    this design system's own breakpoint language.
 *  - "768 tablet" is treated as a PORTRAIT tablet (768x1024), which is the
 *    orientation that actually stresses a horizontal timeline rail.
 */

export type TimelineQaViewport = {
  name: string;
  width: number;
  height: number;
  note: string;
};

export const TIMELINE_QA_VIEWPORTS: TimelineQaViewport[] = [
  { name: "desktop-1920", width: 1920, height: 1080, note: "Primary desktop." },
  { name: "desktop-1600", width: 1600, height: 900, note: "Common laptop." },
  { name: "desktop-1440", width: 1440, height: 900, note: "Common laptop, the redesign brief measured baseline numbers at this size." },
  { name: "desktop-1280", width: 1280, height: 800, note: "Small laptop." },
  { name: "wide-1024", width: 1024, height: 768, note: "1024 wide -- height 768 is this harness documented choice; the brief specified width only." },
  { name: "tablet-768", width: 768, height: 1024, note: "Tablet, portrait -- the brief specified width only; portrait is the stress case." },
  { name: "mobile-390", width: 390, height: 844, note: "Mobile, iPhone 12/13/14-class." },
  { name: "zoom-960", width: 960, height: 540, note: "200% zoom emulation of 1920x1080 (half-size, per the brief)." },
  { name: "zoom-800", width: 800, height: 450, note: "200% zoom emulation of 1600x900 (half-size, per the brief)." },
  { name: "zoom-720", width: 720, height: 450, note: "200% zoom emulation of 1440x900 (half-size, per the brief)." },
];
