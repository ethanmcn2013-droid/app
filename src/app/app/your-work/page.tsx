import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Your Work was the planning-period (program) view. There are no program
 * views in v3 (founder, 24 Sep 2026): old links land on My tasks.
 */
export default function YourWorkPage(): never {
  redirect("/app/my-tasks");
}
