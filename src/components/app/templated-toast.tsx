"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useToast } from "@/components/primitives/toast";
import { TEMPLATES } from "@/lib/templates";
import { SYNCED_TEMPLATE_IDS } from "@/lib/templates.generated";
import { PRODUCT_APP_URLS } from "@/lib/product-urls";

/**
 * Reads `?templated={id}` or `?remixed={id}` from the URL on `/app/board`
 * and surfaces a single brand-toned toast. Strips the query so
 * refreshing doesn't refire.
 *
 * `?templated` (apply path): "{Template name} applied · N tasks."
 * `?remixed` (remix path): same headline, but for canonical workspace
 *   templates the toast carries an "Open Timeline" action. Specialty
 *   Tasks-only templates skip the action.
 *
 * Mounted as a leaf inside the board's page chrome, pure side-effect
 * component, renders nothing.
 */
export function TemplatedToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const appliedId = params.get("templated");
    const remixedId = params.get("remixed");
    const templateId = appliedId ?? remixedId;
    if (!templateId) return;
    const template = TEMPLATES.find((t) => t.id === templateId);
    fired.current = true;

    const isRemix = Boolean(remixedId);
    const isCanonical = SYNCED_TEMPLATE_IDS.has(templateId);

    if (template) {
      toast(`${template.name} applied`, {
        body: isRemix
          ? `Fresh workspace seeded with ${template.tasks.length} tasks. Yours to edit.`
          : `${template.tasks.length} tasks landed in your board. Go give one a kick.`,
        tone: "success",
        duration: isRemix && isCanonical ? 9000 : 5200,
        action:
          isRemix && isCanonical
            ? {
                href: PRODUCT_APP_URLS.timeline,
                label: "Open Timeline",
              }
            : undefined,
      });
    } else {
      toast(isRemix ? "Workspace seeded" : "Template applied", {
        body: isRemix
          ? "Your fresh workspace is ready."
          : "Your board just got a fresh batch of tasks.",
        tone: "success",
      });
    }

    // Strip the query so refresh doesn't refire and the URL stays
    // shareable without the templated stamp.
    const next = new URLSearchParams(params.toString());
    next.delete("templated");
    next.delete("remixed");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, router, pathname, toast]);

  return null;
}
