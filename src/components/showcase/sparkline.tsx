"use client";

import { motion } from "motion/react";

export function Sparkline({
  values,
  width = 88,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return [x, y] as const;
    });

  const path = points
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(" ");

  const fillPath =
    path + ` L ${width} ${height} L 0 ${height} Z`;

  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible"
      role="img"
      aria-label="Open work winding down over the week"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={fillPath}
        fill="url(#sparkFill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r="2.6"
        fill="var(--brand)"
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
    </svg>
  );
}
