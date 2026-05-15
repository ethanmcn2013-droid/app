import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { tasks, workspaces } from "@/server/db/schema";
import { TASKS_DOMAIN } from "@/lib/product-urls";

// nodejs runtime — reads from the libSQL/Turso-backed Drizzle client.
//
// Why this lives at `share-card/[workspaceId]/opengraph-image.tsx`
// and not as a Route Handler: Turbopack + Next.js 16's nodejs route
// handler runtime doesn't pipe `next/og`'s streaming Response cleanly
// (errors with "failed to pipe response"). The OG-image file
// convention handles the wrapping for free, and the URL still
// unfurls cleanly in Slack / Twitter / iMessage.
//
// Visual modeled closely on `src/app/p/[slug]/opengraph-image.tsx`
// — single glow, conservative font sizing — because Satori (the
// HTML-to-PNG renderer behind ImageResponse) is touchy about layout
// edge cases. Stay on the proven shape.
export const runtime = "nodejs";
export const alt = "Tasks · share card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function ShareCardOG({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const [ws] = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  let closedCount = 0;
  if (ws) {
    const rows = await db
      .select({
        lane: tasks.lane,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(eq(tasks.workspaceId, ws.id));
    const cutoff = Date.now() - WEEK_MS;
    closedCount = rows.filter(
      (r) => r.lane === "done" && r.updatedAt.getTime() >= cutoff,
    ).length;
  }

  if (!ws) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fafafa",
            fontSize: 48,
            color: "#94a3b8",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          Not found
        </div>
      ),
      { ...size },
    );
  }

  const subhead =
    closedCount === 1 ? "task closed this week" : "tasks closed this week";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #fafafa 0%, #f3f4f6 60%, #e5e7eb 100%)",
          padding: "80px 96px",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -200,
            width: 800,
            height: 800,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(79,70,229,0.32), rgba(79,70,229,0.12), transparent 70%)",
            filter: "blur(60px)",
            display: "flex",
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: "#14151a",
          }}
        >
          tasks
          <span
            style={{
              display: "flex",
              marginLeft: 6,
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#4f46e5",
              boxShadow: "0 0 24px rgba(79,70,229,0.6)",
            }}
          />
        </div>

        <div style={{ flex: 1, display: "flex" }} />

        {/* The number + subhead */}
        <div style={{ display: "flex", flexDirection: "column", color: "#14151a" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Closed this week
          </div>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "baseline",
              gap: 24,
            }}
          >
            <div
              style={{
                fontSize: 168,
                fontWeight: 600,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                color: "#14151a",
              }}
            >
              {closedCount}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "#14151a",
                paddingBottom: 12,
              }}
            >
              {subhead}
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              fontSize: 22,
              color: "#475569",
              letterSpacing: "-0.005em",
            }}
          >
            {ws.name}
          </div>
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 36,
            color: "#94a3b8",
            fontSize: 18,
            letterSpacing: "0.04em",
          }}
        >
          <div style={{ display: "flex" }}>{TASKS_DOMAIN}/p/{ws.slug}</div>
          <div style={{ display: "flex" }}>Made with Signal Tasks</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
