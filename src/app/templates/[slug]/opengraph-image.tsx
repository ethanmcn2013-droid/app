import { ImageResponse } from "next/og";
import { TEMPLATES } from "@/lib/templates";
import { getTemplateEssay } from "@/lib/template-essays";
import { DOMAINS, type DomainId } from "@/lib/domains";
import { templateGlyphForOg } from "@/components/marketing/template-glyph";
import { TASKS_PUBLIC_DOMAIN } from "@/lib/product-urls";

// nodejs runtime, keeps this OG aligned with the others
// (`/p/[slug]/opengraph-image`, `/share-card/[workspaceId]/opengraph-image`).
// Edge runtime + Turbopack dev mode + ImageResponse intermittently
// hits "failed to pipe response" in our dev environment; nodejs
// avoids that path. Cycle-26 review caught it.
export const runtime = "nodejs";
export const alt = "Tasks template";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Note: do NOT define `generateImageMetadata` here. This route lives
// under `[slug]`, so Next.js already generates one OG image per slug
// via `generateStaticParams` on the parent page. A `generateImageMetadata`
// that returns N entries here would multiply that, producing
// `/templates/{slug}/opengraph-image/{otherId}` URLs per slug per id —
// which is what cycle-26 review caught: the rendered `og:image` URL
// for every template was pointing at `.../opengraph-image/job-application-sprint`
// (the last entry in TEMPLATES). Removing the function lets Next.js
// route a single OG image per slug correctly.

export default async function TemplateOG({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template =
    TEMPLATES.find((t) => t.id === slug) ?? TEMPLATES[0];
  const essay = getTemplateEssay(template.id);
  const domain = DOMAINS[template.domain as DomainId];
  const headline = essay?.heroline ?? `${template.name}, pre-written.`;

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
        {/* Soft brand glow */}
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

        {/* Top row: wordmark + template chip */}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
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
            <span style={{ display: "flex", color: "#4f46e5" }}>
              {templateGlyphForOg(template.icon)}
            </span>
            <span style={{ display: "flex" }}>
              Template · {domain?.label ?? template.domain}
            </span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: "flex" }} />

        {/* Headline + meta */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            color: "#14151a",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1.04,
              maxWidth: 980,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 24,
              color: "#475569",
              maxWidth: 880,
              lineHeight: 1.4,
            }}
          >
            {template.tasks.length} task
            {template.tasks.length === 1 ? "" : "s"}, free, applies in 30
            seconds. No signup required.
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
          <div style={{ display: "flex" }}>
            {TASKS_PUBLIC_DOMAIN}/templates/{template.id}
          </div>
          <div style={{ display: "flex" }}>Free on every tier</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
