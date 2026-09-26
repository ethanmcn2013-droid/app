import type { SVGProps } from "react";
import type { TaskStatus } from "./data";

type P = SVGProps<SVGSVGElement>;

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  "aria-hidden": true,
} as const;

export function Chevron(props: P) {
  return (
    <svg {...base} {...props}>
      <path
        d="M4.5 6.5 8 10l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Check(props: P) {
  return (
    <svg {...base} {...props}>
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Arrow(props: P) {
  return (
    <svg {...base} {...props}>
      <path
        d="M3.5 8h9m-3.5-3.5L12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Speaker(props: P) {
  return (
    <svg {...base} {...props}>
      <path
        d="M2.5 6.2h2.2L8 3.5v9L4.7 9.8H2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 5.8a3 3 0 0 1 0 4.4M12.3 4a5.5 5.5 0 0 1 0 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Stop(props: P) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function Close(props: P) {
  return (
    <svg {...base} {...props}>
      <path
        d="m4.5 4.5 7 7m0-7-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Calendar(props: P) {
  return (
    <svg {...base} {...props}>
      <rect
        x="2.5"
        y="3.5"
        width="11"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Task status glyph, drawn to sit on the text baseline at 0.8em. */
export function StatusGlyph({
  status,
  late,
  ...props
}: P & { status: TaskStatus; late?: boolean }) {
  if (status === "done") {
    return (
      <svg {...base} {...props}>
        <circle cx="8" cy="8" r="6.25" fill="var(--v3-success)" />
        <path
          d="m5.3 8.2 1.9 1.9 3.6-4"
          stroke="var(--v3-surface)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  const ring = late
    ? "var(--v3-danger)"
    : status === "review"
      ? "var(--v3-review)"
      : status === "stalled"
        ? "var(--v3-warning-stroke)"
        : "var(--v3-control-border)";
  return (
    <svg {...base} {...props}>
      <circle
        cx="8"
        cy="8"
        r="5.75"
        stroke={ring}
        strokeWidth="1.5"
        strokeDasharray={status === "review" ? "2.2 1.6" : undefined}
      />
      {status === "doing" && (
        <path
          d="M8 4.5a3.5 3.5 0 0 1 0 7z"
          fill={late ? "var(--v3-danger)" : "var(--v3-warning-stroke)"}
        />
      )}
      {status === "stalled" && (
        <path
          d="M6.6 5.8v4.4M9.4 5.8v4.4"
          stroke="var(--v3-warning-stroke)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      )}
      {status === "review" && (
        <circle cx="8" cy="8" r="2" fill="var(--v3-review)" />
      )}
      {late && status === "todo" && (
        <circle cx="8" cy="8" r="2" fill="var(--v3-danger)" />
      )}
    </svg>
  );
}
