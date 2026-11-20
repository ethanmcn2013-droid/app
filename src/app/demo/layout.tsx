import { notFound } from "next/navigation";
import { ThemeRuntime } from "@/app/app/theme-runtime";
import { isDemoMode } from "@/lib/access-mode";

export const dynamic = "force-dynamic";

/**
 * The integrated design demo: every design chosen in the concept review, in
 * one product frame on sample data. Review mode only, never in production.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) notFound();
  return (
    <>
      <ThemeRuntime />
      {children}
    </>
  );
}
