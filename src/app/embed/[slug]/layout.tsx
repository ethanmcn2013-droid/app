/**
 * Bare layout for the iframe-only `/embed/{slug}` route. Skips the
 * marketing chrome (no SiteNav, no SiteFooter) and the global app
 * stylesheet so the embed renders as a self-contained surface that
 * inherits typography from whatever blog or page it's framed inside.
 *
 * The root layout already owns `<html>` and `<body>` for the whole
 * tree, so this file just tightens the wrapper styles for embed pages
 * via a scoped <style> tag, no Tailwind dependency, no global CSS.
 *
 * No `X-Frame-Options` header is set anywhere on this route, so it's
 * implicitly framable. That's the contract.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Scope all styles to the server-rendered `.tasks-embed-root` div
  // instead of the body, keeps SSR/CSR markup byte-identical so
  // hydration doesn't complain. Earlier draft used a client-side
  // class-toggle script on `document.body`; that produced a
  // hydration warning because the server-rendered body className
  // differed from the post-hydration one.
  return (
    <>
      <style>{`
        html, body { background: transparent; }
        .tasks-embed-root {
          margin: 0;
          padding: 16px;
          font-family: Geist, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #14151a;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>
      <div className="tasks-embed-root">{children}</div>
    </>
  );
}
