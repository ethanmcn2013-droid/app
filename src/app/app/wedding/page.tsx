import { redirect } from "next/navigation";

/**
 * /app/wedding opens the guest list, the first of the Wedding tools. The
 * chosen Project travels with it.
 */
export default async function WeddingPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams ?? {};
  const requested = typeof params.workspaceId === "string" ? params.workspaceId : null;
  redirect(requested ? `/app/wedding/guests?workspaceId=${encodeURIComponent(requested)}` : "/app/wedding/guests");
}
