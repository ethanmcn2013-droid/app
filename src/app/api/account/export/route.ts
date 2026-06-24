import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { exportAccountData } from "@/server/account-export";

/**
 * GET /api/account/export — Signal Tasks.
 *
 * GDPR Art. 20 data portability: the signed-in user downloads a complete
 * machine-readable (JSON) copy of everything Tasks holds for them — their
 * profile, every owned workspace and its content, and their footprint in
 * other workspaces. Authed; resolved from the Clerk session, never a
 * client-supplied id. Attachment bytes are not inlined (metadata only).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const data = await exportAccountData(db, userId);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="signal-tasks-export-${userId}.json"`,
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
