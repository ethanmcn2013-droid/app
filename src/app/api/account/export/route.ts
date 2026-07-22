import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { exportAccountForUser } from "@/server/account";

/**
 * GET /api/account/export · Signal Studio unified export.
 *
 * GDPR Art. 20 data portability: the signed-in user downloads a complete
 * machine-readable (JSON) copy of everything the Signal Studio suite holds
 * for them across Tasks, Notes, Timeline, and Signal. Authed; the user id
 * is always resolved from the Clerk session, never from the client.
 *
 * Module sections that are unavailable (missing env or transient DB error)
 * degrade to `{ available: false }` rather than failing the whole export.
 *
 * The filename is scoped to the user id and the current date so repeated
 * exports are distinguishable without leaking server-side metadata.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = await exportAccountForUser(userId);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="signal-export-${userId}-${date}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "export_failed", message },
      { status: 500 },
    );
  }
}
