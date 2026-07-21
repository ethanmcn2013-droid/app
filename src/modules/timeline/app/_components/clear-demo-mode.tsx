"use client";

/**
 * Clears the §14-canonical signal_preview_public cookie on mount.
 *
 * The "View public site" escape hatch sets this cookie (max-age 86400,
 * SameSite=Strict) to suppress the M→app redirect. When the owner
 * navigates back to /app, the cookie is cleared so the next marketing
 * page visit redirects normally, no manual "Exit preview" required.
 *
 * This is a zero-render effect component, returns null.
 */

import { useEffect } from "react";

export function ClearDemoMode() {
  useEffect(() => {
    // Clear by setting an expired date.
    document.cookie =
      "signal_preview_public=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
  }, []);
  return null;
}
