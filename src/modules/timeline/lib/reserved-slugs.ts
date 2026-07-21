/**
 * Slugs that cannot be used as workspace or project slugs, they
 * collide with app routes, public pages, or reserved infrastructure.
 */
export const RESERVED_SLUGS = new Set([
  "sign-in",
  "sign-up",
  "app",
  "api",
  "onboarding",
  "r",
  "opengraph-image",
  "sitemap",
  "robots",
  "manifest",
  "_next",
  "static",
  "public",
  "about",
  "pricing",
  "demo",
  "update",
  "refusals",
  "admin",
  "settings",
  "help",
  "blog",
  "changelog",
  "lab",
  "waitlist",
  "the-wedding",
  "docs",
  "support",
  "terms",
  "privacy",
  "security",
  "tasks",
  "roadmap",
  "ethan",
  "studio",
]);

/** Returns true if the slug passes format rules and is not reserved. */
export function isValidSlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.length < 3 || slug.length > 32) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

/** Convert a display name to a URL-safe slug (best-effort). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
