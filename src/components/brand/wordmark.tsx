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
        "wordmark-hover relative inline-flex select-none items-baseline font-semibold tracking-tight",
        sizeClass,
        className,
      )}
    >
      <span className="wordmark" style={{ fontWeight: 600 }}>
        tasks
      </span>
      <span className="tasks-dot" aria-hidden />
    </Link>
  );
}
