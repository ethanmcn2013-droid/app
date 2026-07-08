import type { ReactNode } from "react";

/**
 * Lab-only layout. Suppresses dev-mode chrome (Clerk keyless prompt, Next dev
 * indicator) so the hero options can be reviewed on a clean white field.
 * Local review surface only; never ships to a public route.
 */
export default function LabLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        .cl-keylessPrompt, [class*="cl-keyless"], .cl-impersonationFab,
        [data-clerk-keyless], a[href*="clerk.com/apps/claim"],
        #clerk-components { display: none !important; }
        [data-nextjs-toast], [data-next-badge], nextjs-portal { display: none !important; }
      `}</style>
    </>
  );
}
