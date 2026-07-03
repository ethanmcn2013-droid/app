export const SIGNAL_INDIGO = "#4f46e5";
export const SIGNAL_PAPER = "#ffffff";

type SuiteMarkProps = {
  canvas: number;
  background?: string;
  borderRadius?: number;
};

/** Proportions locked to option 6, dot + broadcast ring. */
export function suiteMarkMetrics(canvas: number) {
  const dot = Math.round(canvas * 0.36);
  const ring = Math.round(canvas * 0.72);
  const stroke = Math.max(1.5, Math.round(canvas * 0.047));
  return { dot, ring, stroke };
}

/**
 * Suite favicon mark, indigo dot with broadcast ring on paper.
 * Frozen frame of the umbrella pulse-slow / signal-emit gesture.
 */
export function SuiteMark({
  canvas,
  background = SIGNAL_PAPER,
  borderRadius = 0,
}: SuiteMarkProps) {
  const { dot, ring, stroke } = suiteMarkMetrics(canvas);

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
          width: ring,
          height: ring,
          borderRadius: "50%",
          border: `${stroke}px solid ${SIGNAL_INDIGO}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
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
    </div>
  );
}
