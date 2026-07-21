import Link from "next/link";
import type { TrendPoint } from "../../lib/analytics/contracts";

interface TrendChartProps {
  title: string;
  summary: string;
  points: TrendPoint[];
  unitLabel?: string;
  evidenceHref?: (evidenceId: string) => string;
}

const WIDTH = 720;
const HEIGHT = 260;
const PADDING_X = 44;
const PADDING_Y = 38;

export function TrendChart({
  title,
  summary,
  points,
  unitLabel = "items",
  evidenceHref,
}: TrendChartProps) {
  if (points.length < 2) {
    return (
      <div className="signal-notice" role="status">
        <h2>Not enough history yet</h2>
        <p>
          Signal will show this change after at least two complete periods have
          trustworthy source coverage.
        </p>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const plotWidth = WIDTH - PADDING_X * 2;
  const plotHeight = HEIGHT - PADDING_Y * 2;
  const coordinates = points.map((point, index) => ({
    point,
    x: PADDING_X + (index / (points.length - 1)) * plotWidth,
    y: PADDING_Y + ((max - point.value) / range) * plotHeight,
  }));
  const path = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");

  return (
    <figure className="signal-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        aria-labelledby="signal-trend-title signal-trend-description"
      >
        <title id="signal-trend-title">{title}</title>
        <desc id="signal-trend-description">{summary}</desc>
        {[0, 0.5, 1].map((position) => {
          const y = PADDING_Y + position * plotHeight;
          const value = Math.round(max - position * range);
          return (
            <g key={position}>
              <line
                className="signal-chart-grid"
                x1={PADDING_X}
                x2={WIDTH - PADDING_X}
                y1={y}
                y2={y}
              />
              <text className="signal-chart-label" x={0} y={y + 4}>
                {value}
              </text>
            </g>
          );
        })}
        <path className="signal-chart-line" d={path} />
        {coordinates.map(({ point, x, y }, index) => {
          const content = (
            <>
              <circle
                className="signal-chart-hit"
                cx={x}
                cy={y}
                r={14}
              />
              <circle className="signal-chart-point" cx={x} cy={y} r={5} />
              <text
                className="signal-chart-value"
                x={x}
                y={y - 12}
                textAnchor="middle"
              >
                {point.value}
              </text>
              {(index === 0 || index === coordinates.length - 1) && (
                <text
                  className="signal-chart-label"
                  x={x}
                  y={HEIGHT - 8}
                  textAnchor={index === 0 ? "start" : "end"}
                >
                  {point.label}
                </text>
              )}
            </>
          );
          const label = `${point.label}: ${point.value} ${unitLabel}${point.annotation ? `. ${point.annotation}` : ""}`;
          return point.evidenceId && evidenceHref ? (
            <Link
              key={`${point.start}-${point.end}`}
              href={evidenceHref(point.evidenceId)}
              aria-label={`${label}. Open evidence.`}
              scroll={false}
            >
              {content}
            </Link>
          ) : (
            <g key={`${point.start}-${point.end}`} aria-label={label}>
              {content}
            </g>
          );
        })}
      </svg>
      <figcaption className="signal-chart-summary">{summary}</figcaption>
      <details>
        <summary className="signal-button-quiet">Read chart values</summary>
        <dl className="signal-coverage-grid" style={{ marginTop: "var(--space-3)" }}>
          {points.map((point) => (
            <div className="signal-coverage-row" key={`${point.start}-value`}>
              <dt>{point.label}</dt>
              <dd>
                {point.value} {unitLabel}
                {point.annotation ? ` · ${point.annotation}` : ""}
                {point.evidenceId && evidenceHref ? (
                  <>
                    {" · "}
                    <Link href={evidenceHref(point.evidenceId)} scroll={false}>
                      See evidence
                    </Link>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </figure>
  );
}
