import type { ComponentType } from "react";
import type { ConceptMeta } from "./types";

/**
 * Production stand-in for ./registry.ts. Concepts render only in review and
 * demo mode, so a production build aliases the registry to this empty one
 * (see `turbopack.resolveAlias` in next.config.ts) and emits no concept
 * chunks at all. Without it, every concept's lazy chunk is still built and
 * counted against the total_client_js performance budget.
 */
export const CONCEPTS: readonly ConceptMeta[] = [];

export const CONCEPT_LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {};
