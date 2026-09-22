/**
 * Suite mark — a single indigo dot on ink.
 *
 * THE DOT IS THE MARK. docs/brand.md is explicit that the wordmark's
 * trailing dot is load-bearing ("don't replace it with a swoosh, a
 * checkmark, or a square"), so the icon is that dot and nothing else.
 * The broadcast ring it used to carry (option 6, cycle 37) was a second
 * idea competing with the first at 16px, where a 1.5px stroke is a grey
 * smudge around the thing you actually wanted to see.
 *
 * THE INK. #17171a is --x-studio-chrome, the charcoal L-frame of the
 * Studio Bar — and the one surface colour that is IDENTICAL in both
 * themes (globals.css, T·94). It is also already the manifest's
 * theme_color, so an installed PWA's title bar and its icon are now the
 * same charcoal rather than white-on-charcoal. A literal, not a var():
 * ImageResponse rasterises outside the document, so there is no
 * cascade here to read tokens from.
 *
 * THE INDIGO. indigo-500, NOT the brand's indigo-600. A favicon dot is
 * a non-text graphic, so its floor is WCAG 1.4.11's 3:1 against the
 * field it sits on, and the ratios on this exact charcoal are the ones
 * globals.css already measured for the dark accent roles:
 *
 *     indigo-600  #4f46e5   2.84:1   ← the brand indigo, fails
 *     indigo-500  #6366f1   4.00:1   ← chosen
 *     indigo-400  #818cf8   6.00:1   ← clears, but reads lilac
 *
 * indigo-500 is not a new value invented for the icon: it is what
 * --x-studio-accent already resolves to, i.e. the repo's existing
 * answer to "which indigo rides ON the charcoal chrome". indigo-400
 * clears by more but drifts off-brand at the one size that matters,
 * where a 6px dot is read as a colour and nothing else.
 */

/** indigo-500 · --x-studio-accent — the indigo that rides on charcoal. */
export const SIGNAL_INDIGO = "#6366f1";
/** --x-studio-chrome — the Studio Bar charcoal, same in both themes. */
export const SIGNAL_INK = "#17171a";

type SuiteMarkProps = {
  canvas: number;
  background?: string;
  borderRadius?: number;
};

/**
 * The dot holds 40% of the canvas — up from the 36% it spent inside the
 * old ring. With the ring gone the mark loses its outer edge, so the dot
 * grows to keep the same presence in a tab strip; the remaining 30% of
 * ink on each side reads as deliberate framing rather than a shrunken
 * mark. 40% also sits far inside the 80% safe zone Android's adaptive
 * masks clip the 512px icon to, so no mask can touch it.
 */
export function suiteMarkMetrics(canvas: number) {
  const dot = Math.round(canvas * 0.4);
  return { dot };
}

/** Suite icon mark, a single indigo dot centred on ink. */
export function SuiteMark({
  canvas,
  background = SIGNAL_INK,
  borderRadius = 0,
}: SuiteMarkProps) {
  const { dot } = suiteMarkMetrics(canvas);

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
      <div
        style={{
          width: dot,
          height: dot,
          borderRadius: "50%",
          background: SIGNAL_INDIGO,
          flexShrink: 0,
        }}
      />
    </div>
  );
}
