import { ImageResponse } from "next/og";
import { getPublishedWorkspaceBySlug } from "@/server/db/queries";
import { DOMAINS, type DomainId } from "@/lib/domains";
import { TASKS_DOMAIN } from "@/lib/product-urls";

// nodejs runtime (not edge) — this OG image reads the workspace via
// `getPublishedWorkspaceBySlug`, which transitively imports the libSQL
// client. The existing per-template OG at `/templates/[slug]/opengraph-image`
// stays edge because it reads only the in-memory TEMPLATES array.
export const runtime = "nodejs";
export const alt = "Tasks workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OG card for a published workspace at `/p/{slug}`. Shows the
 * workspace title, domain pack, task count, and the brand wordmark.
 *
 * The visual treatment is the same across all four domain packs at
 * the OG level — themes are for the page itself, not the social
 * preview. Keeping a single OG style keeps the unfurl recognizable
 * as Tasks regardless of which workspace someone shared.
 */
export default async function PublishedWorkspaceOG({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getPublishedWorkspaceBySlug(slug);
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

  const domainLabel = ws.activeDomain
    ? DOMAINS[ws.activeDomain as DomainId]?.label ?? ""
    : "";

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

        {/* Top row: wordmark + domain chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
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
          {domainLabel ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 16px",
                borderRadius: 999,
                background: "rgba(79,70,229,0.10)",
                color: "#4f46e5",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {domainLabel}
            </div>
          ) : null}
        </div>

        <div style={{ flex: 1, display: "flex" }} />

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
            Published workspace
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 76,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1.04,
              maxWidth: 980,
            }}
          >
            {ws.name}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 24,
              color: "#475569",
              maxWidth: 880,
              lineHeight: 1.4,
            }}
          >
            {ws.tasks.length} task{ws.tasks.length === 1 ? "" : "s"} · A
            read-only Tasks workspace · Pick the layout free
          </div>
        </div>

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
