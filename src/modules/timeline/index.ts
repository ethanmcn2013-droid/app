/**
 * Timeline module public surface.
 *
 * Phase 5 port: the module now delivers the full authed Timeline product.
 * TimelineHome is the authenticated dashboard page (src/modules/timeline/app/page.tsx).
 * Import only from this barrel; do not reach into src/modules/timeline internals
 * from outside the module (check-module-boundaries.mjs enforces this).
 */
export { default as TimelineHome } from "./app/page";
