/**
 * Suite mark: the broadcast ring around the dot (founder, 26 Sep 2026).
 *
 * THE MARK. An indigo ring with the dot at its centre, the same mark the
 * app sidebar carries. It is drawn as vector geometry (an inline SVG that
 * ImageResponse rasterises at each exact size), so every favicon frame is
 * rendered natively rather than scaled from another size.
 *
 * NO BACKGROUND IN THE TAB. The browser icon and the ICO frames are
 * transparent: the mark sits on whatever the tab strip is. The Apple touch
 * icon and the Android maskable icon keep the ink tile, because both
 * platforms fill a transparent icon with a colour of their own.
 *
 * SMALL SIZES. A tab icon is 16px to 32px. The reference ring is a hairline
 * (4% of its diameter), which at 16px is a grey smudge rather than a ring,
 * so tab sizes fill the canvas and carry a heavier ring. From 64px up the
 * ring returns to the reference proportion.
 *
 * THE INDIGO. #6860ff is the reference's saturated blue-violet, lifted just
 * enough to hold WCAG 1.4.11's 3:1 as a non-text graphic on a dark tab strip
 * (#202124, 3.5:1) as well as on the ink tile and on light tabs.
 */

/** The mark's indigo: saturated blue-violet, 3:1 or better on dark tabs. */
export const SIGNAL_INDIGO = "#6860ff";
/** --x-studio-chrome: the Studio Bar charcoal, same in both themes. */
export const SIGNAL_INK = "#17171a";

type SuiteMarkProps = {
  canvas: number;
  /** Transparent by default; the app-install icons pass the ink tile. */
  background?: string;
  borderRadius?: number;
};

/**
 * Geometry for a canvas. On a transparent tab icon the ring fills the
 * canvas; on a tile it sits well inside the 80% safe zone Android's masks
 * clip to. The dot is 41% of the ring's outer diameter, as in the reference.
 */
export function suiteMarkMetrics(canvas: number, onTile = false) {
  const small = canvas <= 48;
  const outer = onTile ? canvas * 0.56 : canvas - (small ? 1 : canvas * 0.04);
  const stroke = Math.max(outer * (small ? 0.085 : 0.045), 1.25);
  const ring = (outer - stroke) / 2;
  const dot = (outer * 0.41) / 2;
  return { outer, stroke, ring, dot };
}

/** Suite icon mark: the indigo ring and dot, on a tile or on nothing. */
export function SuiteMark({ canvas, background = "transparent", borderRadius = 0 }: SuiteMarkProps) {
  const onTile = background !== "transparent";
  const { stroke, ring, dot } = suiteMarkMetrics(canvas, onTile);
  const c = canvas / 2;

  return (
    <div
      style={{
        width: canvas,
        height: canvas,
        background,
        borderRadius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={canvas} height={canvas} viewBox={`0 0 ${canvas} ${canvas}`} xmlns="http://www.w3.org/2000/svg">
        <circle cx={c} cy={c} r={ring} fill="none" stroke={SIGNAL_INDIGO} strokeWidth={stroke} />
        <circle cx={c} cy={c} r={dot} fill={SIGNAL_INDIGO} />
      </svg>
    </div>
  );
}
