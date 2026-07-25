export const metadata = {
  title: "Invite only · Signal Studio",
  robots: { index: false, follow: false },
};

/**
 * The closed-beta holding page. A signed-in account that is not on the
 * allowlist is redirected here by requireAppAccess(). Public route, no product
 * data. Shared across all four product modules in this app.
 */
export default function WaitlistPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
        background: "var(--bg)",
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          Invite only
        </p>
        <h1
          style={{
            marginTop: 16,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            color: "var(--ink)",
          }}
        >
          Signal Studio is in private preview.
        </h1>
        <p
          style={{
            marginTop: 14,
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--ink-soft)",
          }}
        >
          You&rsquo;re signed in, but your account isn&rsquo;t open yet. We let
          people in a few at a time. Write to us and we&rsquo;ll add you.
        </p>
        <a
          href="mailto:hello@signalstudio.ie?subject=Access%20request"
          style={{
            display: "inline-block",
            marginTop: 22,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          hello@signalstudio.ie
        </a>
      </div>
    </div>
  );
}
