import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/** Relative time formatter for comments / activity. Returns "just now",
 *  "3m", "2h", "yesterday", "May 2", "May 2, 2024" — tabular-nums
 *  friendly. */
export function formatRelativeTime(date: Date | number | string): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}
