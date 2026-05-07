"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useToast } from "@/components/primitives/toast";
import { TEMPLATES } from "@/lib/templates";

/**
 * Reads `?templated={id}` from the URL on `/app/board` and surfaces a
 * single brand-toned toast: "{Template name} applied · N tasks." Then
 * strips the query so refreshing doesn't refire the toast.
 *
 * Mounted as a leaf inside the board's page chrome — pure side-effect
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
    const templateId = params.get("templated");
    if (!templateId) return;
    const template = TEMPLATES.find((t) => t.id === templateId);
    fired.current = true;

    if (template) {
      toast(`${template.name} applied`, {
        body: `${template.tasks.length} tasks landed in your board. Go give one a kick.`,
        tone: "success",
        duration: 5200,
      });
    } else {
      toast("Template applied", {
        body: "Your board just got a fresh batch of tasks.",
        tone: "success",
      });
    }

    // Strip the query so refresh doesn't refire and the URL stays
    // shareable without the templated stamp.
    const next = new URLSearchParams(params.toString());
    next.delete("templated");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, router, pathname, toast]);

  return null;
}
