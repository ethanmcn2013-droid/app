import { auth } from "@clerk/nextjs/server";
import { proxySponsorReport, readInvitationBody, sameOriginJsonPost } from "@/server/sponsor-report/proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request, context: { params: Promise<{ programmeId: string }> }) {
  const { userId } = await auth();
  const { programmeId } = await context.params;
  if (new URL(request.url).search) return Response.json({ state: "conflict" },
    { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const method = request.method === "POST" ? "POST" : "GET";
  if (method === "POST" && !sameOriginJsonPost(request)) return Response.json({ state: "forbidden" },
    { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const body = method === "POST" ? await readInvitationBody(request) : undefined;
  if (method === "POST" && body === null) return Response.json({ state: "conflict" },
    { status: 400, headers: { "Cache-Control": "private, no-store" } });
  return proxySponsorReport({ actor: userId ?? "", programmeId, kind: "invitations", method, body: body ?? undefined });
}
export { handle as GET, handle as POST };
