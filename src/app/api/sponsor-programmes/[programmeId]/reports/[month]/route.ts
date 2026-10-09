import { auth } from "@clerk/nextjs/server";
import { proxySponsorReport } from "@/server/sponsor-report/proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ programmeId: string; month: string }> }) {
  const { userId } = await auth();
  const { programmeId, month } = await context.params;
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => key !== "format") || query.getAll("format").length > 1)
    return Response.json({ state: "conflict" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  return proxySponsorReport({ actor: userId ?? "", programmeId, month, kind: "report",
    format: query.get("format"), method: "GET" });
}
