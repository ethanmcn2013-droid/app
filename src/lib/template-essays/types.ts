/**
 * Per-template SEO essay. The route at `/templates/[slug]` reads
 * these to render the long-form, manifesto-voiced sales copy that
 * targets a specific search query.
 *
 * One essay per template id. Templates without an essay still render
 * at the slug, but with a lighter card-style layout.
 */
export type TemplateEssay = {
  /** Must match a `Template.id` in `@/lib/templates`. */
  templateId: string;
  /** SEO `<title>`, punchier than the template name; long-tail aware. */
  seoTitle: string;
  /** Meta description for the page + OG card subhead. */
  seoDescription: string;
  /** H1 on the page. Manifesto-voiced. Different from template.name
   *  (which is utilitarian). */
  heroline: string;
  /** Opening paragraph, the hook. Names the problem before pitching
   *  the list. */
  intro: string;
  /** Body sections in order. Each gets an `<h2>`. Aim for 3–4
   *  sections totalling ~200 words. */
  sections: Array<{ heading: string; body: string }>;
  /** Optional closing kicker, one sentence that lands the CTA. */
  closer?: string;
};
