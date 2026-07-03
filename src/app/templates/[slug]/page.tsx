import { notFound } from "next/navigation";
import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TemplateDetail } from "@/components/marketing/template-detail";
import { TEMPLATES } from "@/lib/templates";
import { getTemplateEssay } from "@/lib/template-essays";

/**
 * `/templates/[slug]`, one route per template id, every slug a real
 * destination page. Two render modes inside `<TemplateDetail>`:
 *
 *   - Rich (template has an entry in `TEMPLATE_ESSAYS`): manifesto-
 *     voiced long-form copy targeting a long-tail SERP query.
 *   - Light (no essay yet): same skeleton, falls back to the
 *     template's `description` and a generic heroline. Still a
 *     working URL with the apply CTA so every template slug works.
 *
 * `generateStaticParams` enumerates every template at build time so
 * the routes prerender, important for indexing.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = TEMPLATES.find((t) => t.id === slug);
  if (!template) return {};
  const essay = getTemplateEssay(slug);

  const title = essay?.seoTitle ?? `${template.name}, Tasks template`;
  const description = essay?.seoDescription ?? template.description;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function TemplateSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const template = TEMPLATES.find((t) => t.id === slug);
  if (!template) notFound();

  const essay = getTemplateEssay(slug) ?? null;

  // Related: up to 3 other templates from the same domain pack,
  // falling back to other templates if the same-domain pool is small.
  const sameDomain = TEMPLATES.filter(
    (t) => t.id !== template.id && t.domain === template.domain,
  );
  const otherDomain = TEMPLATES.filter(
    (t) => t.id !== template.id && t.domain !== template.domain,
  );
  const related = [...sameDomain, ...otherDomain].slice(0, 3);

  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <TemplateDetail
          template={template}
          essay={essay}
          related={related}
        />
      </main>
      <SiteFooter />
    </>
  );
}
