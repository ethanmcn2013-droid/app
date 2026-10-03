type P = { className?: string };

const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function Chevron({ className, open }: P & { open?: boolean }) {
  return (
    <svg
      {...base}
      className={className}
      style={{ transform: open ? "rotate(90deg)" : undefined }}
    >
      <path d="M6 3.8L10.2 8 6 12.2" />
    </svg>
  );
}

export function Close({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function Flag({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 14V2.6M3.5 3h8.2l-1.8 3 1.8 3H3.5" />
    </svg>
  );
}

export function WallIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="2.5" width="5" height="5" rx="1.2" />
      <rect x="9" y="2.5" width="5" height="5" rx="1.2" />
      <rect x="2" y="9.5" width="5" height="5" rx="1.2" />
      <rect x="9" y="9.5" width="5" height="5" rx="1.2" />
    </svg>
  );
}

export function TableIcon({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.6" />
      <path d="M2 6.2h12M2 9.9h12M6 6.2v7.3" />
    </svg>
  );
}

export function Keyboard({ className }: P) {
  return (
    <svg {...base} className={className}>
      <rect x="1.6" y="4" width="12.8" height="8.4" rx="1.6" />
      <path d="M4.2 6.6h.01M6.8 6.6h.01M9.4 6.6h.01M12 6.6h.01M5 9.8h6" />
    </svg>
  );
}

export function Search({ className }: P) {
  return (
    <svg {...base} className={className}>
      <circle cx="7" cy="7" r="4.4" />
      <path d="M10.4 10.4l3.2 3.2" />
    </svg>
  );
}

export function Pin({ className }: P) {
  return (
    <svg {...base} className={className}>
      <path d="M8 14v-3.4M4.6 10.6h6.8L10.2 7V2.6H5.8V7z" />
    </svg>
  );
}
