import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  size = "md",
  href = "/",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
}) {
  const sizeClass =
    size === "lg"
      ? "text-2xl"
      : size === "sm"
        ? "text-base"
        : "text-lg";
  return (
    <Link
      href={href}
      aria-label="Tasks"
      className={cn(
        // Tracking matches the design system spec: -0.05em (-5%).
        // Geist 600 baseline-aligned with the dot at the baseline.
        "wordmark-hover relative inline-flex select-none items-baseline font-semibold",
        sizeClass,
        className,
      )}
      style={{ letterSpacing: "-0.05em" }}
    >
      <span className="wordmark" style={{ fontWeight: 600 }}>
        tasks
      </span>
      <span className="tasks-dot" aria-hidden />
    </Link>
  );
}
