import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { blockers, actionItems } from "@/server/db/schema";

/**
 * Launch-readiness seed — populates `blockers` and `action_items`
 * with the canonical launch-prep checklist. Idempotent: deterministic
 * IDs let re-running pick up additions without overwriting user-set
 * status, note, or completedAt. Drift on title/description is
 * applied silently. Resolution / status fields stay user-owned.
 *
 * Edit this file to add new action items. They appear in `/roadmap`
 * on next request after `seedLaunchReadinessIfMissing()` runs.
 */

interface SeedBlocker {
  id: string;
  title: string;
  kind: string;
  targetDate: string | null;
  description: string;
}

interface SeedActionItem {
  id: string;
  category: string;
  title: string;
  description: string;
  blockerId: string | null;
  priority: "P0" | "P1" | "P2";
}

const SEED_BLOCKERS: SeedBlocker[] = [
  {
    id: "B-domain",
    title: "Lock down domain",
    kind: "purchase",
    targetDate: "2026-05-08",
    description:
      "Use tasks.signalstudio.ie as the canonical Tasks domain; set DNS A/AAAA + CNAME + MX. Unblocks every URL swap across drafts and the email-from-domain story.",
  },
  {
    id: "B-elevenlabs",
    title: "ElevenLabs Creator + PVC voice clone",
    kind: "purchase",
    targetDate: "2026-05-15",
    description:
      "$22/mo subscription + record clone seed audio. Unblocks 90s walkthrough, 3-min founder explainer, two YouTube uploads.",
  },
  {
    id: "B-handle-x",
    title: "Claim X handle @taskshq",
    kind: "account",
    targetDate: "2026-05-11",
    description:
      "Sign up @taskshq, upload banner from /social/x-banner, set bio, pin the refusal-list post. Unblocks every X post row across W1–W8.",
  },
  {
    id: "B-handle-bluesky",
    title: "Claim Bluesky handle taskshq.bsky.social",
    kind: "account",
    targetDate: "2026-05-11",
    description:
      "Claim handle, upload banner from /social/bluesky-banner, set bio, pin the refusal-list post. Unblocks every Bluesky post row.",
  },
  {
    id: "B-handle-ph",
    title: "Confirm Product Hunt handle + product page",
    kind: "account",
    targetDate: "2026-05-11",
    description:
      "Claim producthunt.com/products/taskshq as Coming Soon, set maker @ethanmcn. Unblocks the PH launch beat 2026-06-23.",
  },
  {
    id: "B-screenstudio",
    title: "ScreenStudio recording session",
    kind: "recording",
    targetDate: "2026-05-22",
    description:
      "Single 30-min capture session covering hero loop variant, 90s walkthrough takes, 3-min founder explainer takes. Unblocks 4 YouTube uploads + the 90s/3min videos.",
  },
  {
    id: "B-sentry",
    title: "Sentry pager rule for launch",
    kind: "config",
    targetDate: "2026-06-15",
    description:
      "Configure Sentry alert rule + on-call destination (SMS or Telegram) for the Show HN + PH days. Unblocks launch-day error visibility.",
  },
  {
    id: "B-paid-reddit",
    title: "Authorize $300 Reddit Ads spend",
    kind: "ad-spend",
    targetDate: "2026-05-31",
    description:
      "Reddit Ads account setup, payment method, $300 budget locked for the W4 paid wedding-vertical experiment.",
  },
  {
    id: "B-paid-ig",
    title: "Authorize $200 IG boost via micro-influencer",
    kind: "ad-spend",
    targetDate: "2026-06-07",
    description:
      "Identify wedding micro-influencer (15–50k), $150 partner fee + $50 boost. Brief is in gtm-plan.md §8.",
  },
  {
    id: "B-launch-show-hn",
    title: "Show HN launch — Tue 2026-06-16 9:00am ET",
    kind: "launch-beat",
    targetDate: "2026-06-16",
    description:
      "The live launch. Playbook is docs/launch-day-show-hn.md. 90 min in comments first, 5–10 min reply gaps.",
  },
  {
    id: "B-launch-ph",
    title: "Product Hunt launch — Tue 2026-06-23 3:01am PT",
    kind: "launch-beat",
    targetDate: "2026-06-23",
    description:
      "The live launch. Playbook is docs/launch-day-product-hunt.md. Reply within 15 min for first 6 hrs.",
  },
  {
    id: "B-launch-ih",
    title: "Indie Hackers milestone post — Wed 2026-06-24 9am ET",
    kind: "launch-beat",
    targetDate: "2026-06-24",
    description:
      "Body in posts-week-7.md Wed 06-24. Pulls HN+PH numbers from kpi-log.md Tue/Wed rows.",
  },
];

const SEED_ACTION_ITEMS: SeedActionItem[] = [
  // ─── Domain & DNS ─────────────────────────────────────────────────
  { id: "AI-dns-records", category: "Domain & DNS", title: "Set DNS A/AAAA records pointing at Vercel", description: "Add the Vercel-recommended A and AAAA records on the registrar side; verify via `dig +short`.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-dns-cname-www", category: "Domain & DNS", title: "Set CNAME for www → apex", description: "Apex domain canonical; www redirects via Vercel domain settings.", blockerId: "B-domain", priority: "P1" },
  { id: "AI-dns-mx", category: "Domain & DNS", title: "Set MX records for email forwarding", description: "Forward hello@ and ethan@ to ethanmcn2013@gmail.com via Vercel Email Forwarding or registrar's forwarding.", blockerId: "B-domain", priority: "P1" },
  { id: "AI-dns-spf-dkim-dmarc", category: "Domain & DNS", title: "SPF + DKIM + DMARC for Resend sending", description: "Required so press emails / digest emails don't land in spam. Resend dashboard provides the exact records.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-dns-tls", category: "Domain & DNS", title: "TLS cert auto-issued + verified", description: "Vercel handles via Let's Encrypt; verify the cert resolves on apex + www + any preview branch.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-url-swap-cascade", category: "Domain & DNS", title: "Sed-swap old Vercel preview URLs → canonical domain across docs/", description: "Once domain is live, replace the legacy preview hostname across docs with tasks.signalstudio.ie.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-update-env-site-url", category: "Domain & DNS", title: "Update NEXT_PUBLIC_SITE_URL on Vercel", description: "Sitemaps, OG URLs, absolute share-link URLs all read from this var. Redeploy after change.", blockerId: "B-domain", priority: "P0" },

  // ─── Hosting & deployment ─────────────────────────────────────────
  { id: "AI-prod-deploy-latest", category: "Hosting", title: "Confirm prod is on the latest cycle 31 commit", description: "`vercel deploy --prod --yes` after the cycle-31 changelog lands. Watch the Functions logs for cold-start errors.", blockerId: null, priority: "P0" },
  { id: "AI-vercel-cron-digest", category: "Hosting", title: "Verify Vercel Cron runs /api/cron/digest daily 9am", description: "Trigger manually first via vercel.json's cron section; tail logs for 24 hrs to confirm it actually fires.", blockerId: null, priority: "P1" },
  { id: "AI-vercel-cron-weekly", category: "Hosting", title: "Verify Vercel Cron runs /api/cron/weekly-digest Sun 9am", description: "Same drill — manual trigger then 7-day observation.", blockerId: null, priority: "P1" },
  { id: "AI-vercel-observability", category: "Hosting", title: "Enable Vercel Observability + Speed Insights", description: "Free tier suffices pre-launch; promotes to paid if traffic spikes after Show HN.", blockerId: null, priority: "P1" },
  { id: "AI-tasks-db-bundled", category: "Hosting", title: "Confirm tasks.db is bundled into the Vercel build", description: "Per project_tasks_deploy.md memo: SQLite ephemeral on /tmp; bundled file copied at cold start. Verify via `vercel logs --prod` showing 'tasks.db copied'.", blockerId: null, priority: "P0" },
  { id: "AI-clerk-webhook-reachable", category: "Hosting", title: "Confirm /api/webhooks/clerk is reachable from Clerk dashboard", description: "Send a test event; verify svix signature passes; verify users row created.", blockerId: null, priority: "P0" },
  { id: "AI-stripe-webhook-reachable", category: "Hosting", title: "Confirm /api/webhooks/stripe is reachable from Stripe dashboard", description: "Send a test event; verify sig passes; verify entitlements row created; verify processed_webhooks idempotency.", blockerId: null, priority: "P0" },

  // ─── Auth & SSO ───────────────────────────────────────────────────
  { id: "AI-test-signup-email", category: "Auth", title: "Test sign-up via email + password", description: "Walk a fresh user through /sign-up; confirm Clerk webhook fires; confirm row in users table.", blockerId: null, priority: "P0" },
  { id: "AI-test-signup-magic-link", category: "Auth", title: "Test sign-up via magic link", description: "Confirm magic-link email arrives within 30s; click works; session opens.", blockerId: null, priority: "P0" },
  { id: "AI-test-signup-google", category: "Auth", title: "Test sign-up via Google OAuth", description: "Enable Google provider in Clerk; walk through; confirm email + name + avatar populated.", blockerId: null, priority: "P0" },
  { id: "AI-test-sso-friend", category: "Auth", title: "Have a friend test sign-up via Google SSO end-to-end", description: "Independent device, independent Google account. Confirm full flow + workspace creation works without your shoulder over them.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-test-signin", category: "Auth", title: "Test sign-in flow (existing user)", description: "Sign out, sign back in; confirm session restored, last workspace selected.", blockerId: null, priority: "P0" },
  { id: "AI-test-password-reset", category: "Auth", title: "Test password reset flow", description: "Trigger Clerk's reset email; click link; set new password; sign in.", blockerId: null, priority: "P1" },
  { id: "AI-test-app-redirect", category: "Auth", title: "Test /app/* → /sign-in redirect (signed-out)", description: "Incognito window, hit /app/board; expect 302 → /sign-in. The proxy.ts fix should do this in prod when Clerk env is set.", blockerId: null, priority: "P0" },
  { id: "AI-test-signout", category: "Auth", title: "Test sign-out behavior", description: "Click sign out; verify session destroyed; verify /app/* redirect kicks in immediately.", blockerId: null, priority: "P1" },
  { id: "AI-clerk-tier-check", category: "Auth", title: "Confirm Clerk pricing tier supports launch traffic", description: "Free tier caps at 10k MAU. Show HN + PH may push past on launch week. Watch the dashboard MAU counter daily.", blockerId: null, priority: "P1" },

  // ─── Payments & Stripe ────────────────────────────────────────────
  { id: "AI-stripe-test-wedding", category: "Stripe", title: "Test purchase: Wedding $79 one-time", description: "Use test card 4242 4242 4242 4242; confirm checkout.session.completed webhook; entitlement row inserts; tier resolves correctly.", blockerId: null, priority: "P0" },
  { id: "AI-stripe-test-pro", category: "Stripe", title: "Test purchase: Pro $4.99/mo", description: "Same drill; verify recurring sub created; entitlements has expiresAt set per cycle.", blockerId: null, priority: "P0" },
  { id: "AI-stripe-test-studio", category: "Stripe", title: "Test purchase: Studio $14.95/mo", description: "Verify Studio tier flag in entitlements; verify TIER_RANK rejects downgrades.", blockerId: null, priority: "P0" },
  { id: "AI-stripe-test-team", category: "Stripe", title: "Test purchase: Team $9.95/workspace/mo", description: "Verify per-workspace pricing math holds in `getEffectiveTier`.", blockerId: null, priority: "P0" },
  { id: "AI-stripe-test-update", category: "Stripe", title: "Test customer.subscription.updated webhook", description: "Trigger via Stripe CLI; verify entitlements row reflects new tier.", blockerId: null, priority: "P1" },
  { id: "AI-stripe-test-cancel", category: "Stripe", title: "Test customer.subscription.deleted webhook", description: "Cancel a test sub; verify entitlements expiresAt set; verify tier downgrades after expiresAt.", blockerId: null, priority: "P1" },
  { id: "AI-stripe-test-fail", category: "Stripe", title: "Test failed payment scenario", description: "Use test card 4000 0000 0000 0002 (decline). Verify graceful failure on /pricing.", blockerId: null, priority: "P1" },
  { id: "AI-stripe-test-idempotency", category: "Stripe", title: "Test webhook re-delivery (idempotency)", description: "Stripe re-delivers on transient failures. Trigger same event twice; verify processed_webhooks blocks duplicate entitlement insert.", blockerId: null, priority: "P0" },
  { id: "AI-stripe-tax", category: "Stripe", title: "Decide Stripe Tax on/off for launch", description: "Wedding $79 + per-workspace mo are simple but US states vary. Decision: leave off for launch; revisit at $1k MRR.", blockerId: null, priority: "P2" },
  { id: "AI-stripe-receipts", category: "Stripe", title: "Confirm Stripe receipt emails configured", description: "Default Stripe receipts on; brand customisation in Stripe dashboard. Match our voice (no exclamation points).", blockerId: null, priority: "P1" },
  { id: "AI-stripe-refund-flow", category: "Stripe", title: "Test refund flow", description: "Issue full refund on a test charge; verify webhook fires; verify entitlement row marked as refunded (or expired immediately).", blockerId: null, priority: "P1" },

  // ─── Promo codes & redemption ─────────────────────────────────────
  { id: "AI-promo-mint", category: "Promo codes", title: "Mint a test comp code", description: "Run the comp-mint server action; verify row in comp_codes; visit /redeem/<code>.", blockerId: null, priority: "P0" },
  { id: "AI-promo-redeem", category: "Promo codes", title: "Redeem a test comp code end-to-end", description: "Walk through /redeem/<code>; verify entitlements row inserted; verify quantity decrements; verify redeemed counter increments.", blockerId: null, priority: "P0" },
  { id: "AI-promo-expired", category: "Promo codes", title: "Test expired comp code path", description: "Set expiresAt in the past; visit /redeem/<code>; expect a clear refusal screen, not a crash.", blockerId: null, priority: "P1" },
  { id: "AI-promo-exhausted", category: "Promo codes", title: "Test exhausted comp code path", description: "Mint with quantity=1; redeem once; second user attempts; expect graceful 'all gone'.", blockerId: null, priority: "P1" },
  { id: "AI-promo-rereeem", category: "Promo codes", title: "Test re-redemption (same user)", description: "Redeem same code twice from same user; expect 'already redeemed' message, not duplicate entitlement.", blockerId: null, priority: "P1" },
  { id: "AI-promo-edu", category: "Promo codes", title: "Test .edu auto-Pro grant", description: "Sign up with a .edu email; verify Pro entitlement auto-granted (cycle 23 path).", blockerId: null, priority: "P1" },

  // ─── File attachments (just shipped) ──────────────────────────────
  { id: "AI-attach-drag-drop", category: "Attachments", title: "Test drag-drop upload", description: "Drag a PDF into the detail panel; verify optimistic placeholder; verify final row replaces it; verify activity feed line.", blockerId: null, priority: "P1" },
  { id: "AI-attach-picker", category: "Attachments", title: "Test file picker upload (multiple)", description: "Click Attach; select 3 files at once; verify all 3 land; verify size + filename display.", blockerId: null, priority: "P1" },
  { id: "AI-attach-25mb-cap", category: "Attachments", title: "Test 25 MB hard cap", description: "Attempt to upload a 30 MB file; expect graceful refusal, not a server error.", blockerId: null, priority: "P0" },
  { id: "AI-attach-mime-blocklist", category: "Attachments", title: "Test mime blocklist (executables)", description: "Attempt to upload an .exe; expect refusal with a clear message.", blockerId: null, priority: "P0" },
  { id: "AI-attach-download", category: "Attachments", title: "Test authenticated download", description: "Click download; verify Content-Disposition has the original filename; verify bytes intact.", blockerId: null, priority: "P0" },
  { id: "AI-attach-delete", category: "Attachments", title: "Test delete with popover confirm", description: "Click delete; confirm popover appears; confirm; verify row gone from UI; verify file unlinked from .data/uploads.", blockerId: null, priority: "P1" },
  { id: "AI-attach-cross-workspace-404", category: "Attachments", title: "Test cross-workspace 404 (security)", description: "Sign in as user A in workspace 1; try to fetch /api/attachments/<id> for an attachment in workspace 2; expect 404 (not 403 — opacity).", blockerId: null, priority: "P0" },
  { id: "AI-attach-image-thumb", category: "Attachments", title: "Test image thumbnail rendering", description: "Upload a JPG; verify the row shows a thumbnail, not just an icon.", blockerId: null, priority: "P2" },

  // ─── Share links ──────────────────────────────────────────────────
  { id: "AI-share-mint", category: "Share links", title: "Mint a share link from the share menu", description: "Click Share; pick a view; mint; copy URL.", blockerId: null, priority: "P1" },
  { id: "AI-share-guest-view", category: "Share links", title: "Open share link in incognito (view mode)", description: "No sign-in required; verify the workspace renders; verify edits are blocked.", blockerId: null, priority: "P1" },
  { id: "AI-share-guest-comment", category: "Share links", title: "Test comment-mode share link", description: "Mint with mode=comment; verify guest can post a comment; verify edits still blocked.", blockerId: null, priority: "P1" },
  { id: "AI-share-guest-edit", category: "Share links", title: "Test edit-mode share link", description: "Mint with mode=edit; verify guest can move a card and post a comment.", blockerId: null, priority: "P2" },
  { id: "AI-share-expiry", category: "Share links", title: "Test share-link expiry", description: "Mint with expiresAt 5 min from now; wait; verify link returns the expired-link page.", blockerId: null, priority: "P2" },
  { id: "AI-share-revoke", category: "Share links", title: "Test share-link revocation (2-step confirm)", description: "Click revoke; confirm twice; verify revokedAt set; verify link no longer resolves.", blockerId: null, priority: "P1" },
  { id: "AI-share-analytics", category: "Share links", title: "Test share-link visit analytics", description: "Open in incognito 5×; verify visits counter increments; verify 7-day sparkline updates.", blockerId: null, priority: "P2" },

  // ─── Mobile UX ────────────────────────────────────────────────────
  { id: "AI-mobile-overlap-audit", category: "Mobile", title: "Audit mobile breakpoints across all marketing pages", description: "/, /pricing, /principles, /about, /changelog, /templates, /for/*. Look for clipped headlines, overlapping CTAs, broken grids.", blockerId: null, priority: "P0" },
  { id: "AI-mobile-app-board", category: "Mobile", title: "Audit /app/board on mobile (≤768px)", description: "Mobile tabbar visible; drag-drop disabled; 'Move to' popover replaces it; cards readable.", blockerId: null, priority: "P0" },
  { id: "AI-mobile-app-list", category: "Mobile", title: "Audit /app/list on mobile", description: "Bulk-select shift-click works on touch (long-press alt?); rows tappable; sticky bottom action bar respects safe-area.", blockerId: null, priority: "P0" },
  { id: "AI-mobile-app-timeline", category: "Mobile", title: "Audit /app/timeline on mobile", description: "Horizontal scroll feels right; bars readable; pinch-zoom works.", blockerId: null, priority: "P1" },
  { id: "AI-mobile-app-calendar", category: "Mobile", title: "Audit /app/calendar on mobile", description: "Month view fits viewport; tap-day opens detail.", blockerId: null, priority: "P1" },
  { id: "AI-mobile-detail-panel", category: "Mobile", title: "Audit detail panel on mobile (slide-up sheet)", description: "Verify it doesn't overlay the tabbar; close gesture works; content scrolls inside the sheet.", blockerId: null, priority: "P0" },
  { id: "AI-mobile-settings", category: "Mobile", title: "Audit /app/settings on mobile", description: "All 5 tabs (workspace/members/billing/notifications/danger) usable on a 390px width.", blockerId: null, priority: "P1" },
  { id: "AI-mobile-forms", category: "Mobile", title: "Audit forms on mobile (sign-in, comment, settings)", description: "Inputs zoom-trigger correctly; keyboard doesn't overlap submit button; autocomplete attributes set.", blockerId: null, priority: "P1" },
  { id: "AI-mobile-safe-area", category: "Mobile", title: "Test safe-area insets on iPhone notch", description: "iPhone 14+ Safari; verify bottom tabbar sits above home indicator; top nav clears notch.", blockerId: null, priority: "P1" },
  { id: "AI-mobile-orientation", category: "Mobile", title: "Test orientation change on mobile", description: "Rotate device while on /app/board; verify layout reflows; verify no scroll position lost.", blockerId: null, priority: "P2" },

  // ─── Demo polish ──────────────────────────────────────────────────
  { id: "AI-demo-first-paint", category: "Demo polish", title: "Cinematic demo paints cleanly on first load", description: "No CLS jank; no flash of unstyled content; cursors render before the loop starts.", blockerId: null, priority: "P0" },
  { id: "AI-demo-reduced-motion", category: "Demo polish", title: "Demo respects prefers-reduced-motion", description: "Set the OS preference; verify the demo either freezes on a static frame or shows the hero-loop video instead.", blockerId: null, priority: "P1" },
  { id: "AI-demo-mobile-perf", category: "Demo polish", title: "Demo doesn't tank performance on mobile", description: "Test on a mid-tier Android (Pixel 5 emulator); aim for ≥30 fps during the loop; if not, gate on viewport width.", blockerId: null, priority: "P1" },
  { id: "AI-demo-loop-seamless", category: "Demo polish", title: "Demo loop is seamless (frame 900 ≈ frame 0)", description: "Watch 3 cycles; look for snap or fade artifacts at the loop boundary.", blockerId: null, priority: "P1" },
  { id: "AI-demo-cursor-feel", category: "Demo polish", title: "Cursor physics feel right (carry weight)", description: "When David picks up t-101, the cursor's spring lag (80ms) reads as weight; if too snappy or too laggy, tune in cinematic-demo.tsx.", blockerId: null, priority: "P2" },
  { id: "AI-demo-mute-toggle", category: "Demo polish", title: "Add a 'mute / pause' affordance to the demo", description: "Power users may find the auto-loop distracting; small icon bottom-right with a memory cookie.", blockerId: null, priority: "P2" },

  // ─── Performance ──────────────────────────────────────────────────
  { id: "AI-perf-lh-mobile-home", category: "Performance", title: "Lighthouse mobile ≥90 on /", description: "Run twice; record LCP, INP, CLS; flag any below 90 with the offending audit.", blockerId: null, priority: "P0" },
  { id: "AI-perf-lh-mobile-app", category: "Performance", title: "Lighthouse mobile ≥85 on /app/board (signed-in)", description: "Authenticated audits are flakier; aim 85 not 90.", blockerId: null, priority: "P1" },
  { id: "AI-perf-bundle-budget", category: "Performance", title: "Marketing bundle <300KB JS", description: "Use `next-bundle-analyzer` or Vercel's bundle inspection. Cap is generous; if breached, hunt the dep.", blockerId: null, priority: "P1" },
  { id: "AI-perf-image-opt", category: "Performance", title: "All marketing images use next/image", description: "Audit /, /pricing, /templates, /for/*. No raw <img> tags except OG card-emitted ones.", blockerId: null, priority: "P1" },
  { id: "AI-perf-fonts", category: "Performance", title: "Geist fonts load with display:swap", description: "next/font does this by default; verify no FOIT in real-device profiling.", blockerId: null, priority: "P1" },
  { id: "AI-perf-db-p95", category: "Performance", title: "Database query p95 <100ms", description: "Sample via Vercel logs or PostHog server-side timing on the busiest endpoints.", blockerId: null, priority: "P2" },

  // ─── SEO ──────────────────────────────────────────────────────────
  { id: "AI-seo-sitemap", category: "SEO", title: "Sitemap.xml includes every marketing route", description: "/, /pricing, /principles, /about, /changelog, /templates, /templates/<all-12-slugs>, /for/<all-vertical-slugs>. Verify on /sitemap.xml.", blockerId: null, priority: "P0" },
  { id: "AI-seo-robots", category: "SEO", title: "Robots.txt blocks /app/*, /share/*, /redeem/*, /api/*", description: "These should not be indexed. Verify on /robots.txt.", blockerId: null, priority: "P0" },
  { id: "AI-seo-canonical", category: "SEO", title: "Canonical URLs on every marketing page", description: "Use absolute https://<domain>/<route>. Helps with the trailing-slash + protocol disambiguation.", blockerId: null, priority: "P1" },
  { id: "AI-seo-og-cards", category: "SEO", title: "OG cards render for every shareable URL", description: "Curl each /opengraph-image route; verify 200 + image/png. Already shipped — re-confirm post domain swap.", blockerId: null, priority: "P0" },
  { id: "AI-seo-schema-org", category: "SEO", title: "Add Schema.org markup (Product + Organization)", description: "JSON-LD blocks in head. Helps Google rich-snippet eligibility.", blockerId: null, priority: "P2" },
  { id: "AI-seo-search-console", category: "SEO", title: "Verify domain in Google Search Console", description: "Submit sitemap; monitor coverage report; flag any 'Submitted but not indexed' rows.", blockerId: "B-domain", priority: "P1" },

  // ─── Security ─────────────────────────────────────────────────────
  { id: "AI-sec-https-only", category: "Security", title: "HTTPS-only enforced (HSTS preload)", description: "Vercel handles redirect; add Strict-Transport-Security header with includeSubDomains + preload; submit to hstspreload.org.", blockerId: null, priority: "P0" },
  { id: "AI-sec-csp", category: "Security", title: "Content-Security-Policy header set", description: "Restrict script-src, img-src, frame-ancestors. Allow Stripe.js + Clerk + Sentry + PostHog origins.", blockerId: null, priority: "P0" },
  { id: "AI-sec-frame-ancestors", category: "Security", title: "frame-ancestors 'none' (anti-clickjacking)", description: "Either via CSP frame-ancestors or X-Frame-Options DENY. /share routes may need an allowlist for the embed widget.", blockerId: null, priority: "P0" },
  { id: "AI-sec-content-type-options", category: "Security", title: "X-Content-Type-Options: nosniff", description: "One-line header; prevents mime-type confusion attacks on uploaded files.", blockerId: null, priority: "P0" },
  { id: "AI-sec-referrer-policy", category: "Security", title: "Referrer-Policy: strict-origin-when-cross-origin", description: "Default for Vercel; verify it actually applies in response headers.", blockerId: null, priority: "P1" },
  { id: "AI-sec-rate-limit", category: "Security", title: "Rate limit /api/auth/* and /api/webhooks/*", description: "Use Vercel's edge rate limit or a small in-memory token bucket. Abuse is real on launch day.", blockerId: null, priority: "P1" },
  { id: "AI-sec-secrets-audit", category: "Security", title: "Audit no secrets in client bundle", description: "`grep -r 'sk_live\\|whsec_\\|sk_test' .next/static`; expect nothing. Server-only env vars stay server-side.", blockerId: null, priority: "P0" },
  { id: "AI-sec-webhook-sigs", category: "Security", title: "Webhook signature verification (Clerk + Stripe)", description: "Already wired; re-confirm by tampering a body and watching the route reject.", blockerId: null, priority: "P0" },
  { id: "AI-sec-cors", category: "Security", title: "CORS locked to same-origin on /api/*", description: "Default Next 16 behavior; verify no Access-Control-Allow-Origin: *.", blockerId: null, priority: "P1" },
  { id: "AI-sec-xss-comments", category: "Security", title: "XSS audit on user-generated content (comments, share-link labels)", description: "React escapes by default; check any `dangerouslyInnerHTML` (markdown rendering in comments?). Sanitize via rehype-sanitize.", blockerId: null, priority: "P0" },
  { id: "AI-sec-pii-logging", category: "Security", title: "Audit Sentry + Vercel logs for PII leakage", description: "Strip email/name from error reports; redact request headers containing auth tokens.", blockerId: null, priority: "P1" },

  // ─── Data storage & analytics ─────────────────────────────────────
  { id: "AI-data-postgres-decision", category: "Data", title: "Decide Postgres vs SQLite-on-Vercel for prod", description: "Per project_tasks_deploy.md memo: SQLite-on-/tmp is ephemeral per instance — multi-replica = data loss. Phase D's Postgres adapter is in backlog. Decision needed before any user-facing prod push.", blockerId: null, priority: "P0" },
  { id: "AI-data-bigquery-decision", category: "Data", title: "Decide BigQuery for analytics warehouse", description: "BQ is overkill at launch traffic; PostHog + Stripe dashboards cover Q3. Revisit at $5k MRR or 10k MAU. For now, decision = no.", blockerId: null, priority: "P2" },
  { id: "AI-data-backups", category: "Data", title: "Set up DB backup strategy", description: "Once Postgres is in: daily logical dump to Vercel Blob or S3; retention 30 days; restore drill quarterly.", blockerId: null, priority: "P0" },
  { id: "AI-data-gdpr-deletion", category: "Data", title: "Implement GDPR right-to-deletion", description: "Cascade delete on users → workspaces (if owner) → tasks → comments → attachments → activities → entitlements. Test on a fixture user.", blockerId: null, priority: "P1" },
  { id: "AI-data-gdpr-export", category: "Data", title: "Implement GDPR data export endpoint", description: "/api/me/export returns a tarball of the user's tasks/comments/attachments. JSON + the actual files.", blockerId: null, priority: "P1" },
  { id: "AI-data-posthog", category: "Data", title: "PostHog wired + sending signup_completed event", description: "Verify event arrives within 5s of sign-up; confirm Funnel: visit / → /sign-up → completed.", blockerId: null, priority: "P0" },
  { id: "AI-data-stripe-events", category: "Data", title: "Stripe events surfacing in PostHog or Vercel Analytics", description: "Either via Stripe → PostHog connector or by emitting events from the webhook handler.", blockerId: null, priority: "P1" },
  { id: "AI-data-storage-doc", category: "Data", title: "Document where each kind of data lives", description: "User accounts (Clerk), tasks/workspaces (SQLite/Postgres), files (.data/uploads → eventually S3 or Vercel Blob), payments (Stripe), telemetry (PostHog), errors (Sentry). One-page README under docs/data-model.md.", blockerId: null, priority: "P1" },

  // ─── Email & notifications ────────────────────────────────────────
  { id: "AI-email-resend-domain", category: "Email", title: "Add domain to Resend + verify SPF/DKIM/DMARC", description: "After domain lockdown. Otherwise launch-day press emails go to spam.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-email-test-digest", category: "Email", title: "Test daily digest email (manually trigger)", description: "Hit /api/cron/digest?send=1; verify email arrives at ethanmcn2013@gmail.com; verify it renders correctly in Gmail + Apple Mail.", blockerId: null, priority: "P1" },
  { id: "AI-email-test-share-link", category: "Email", title: "Test share-link invite email", description: "Mint share link with email-on; verify invitee receives + the URL works.", blockerId: null, priority: "P2" },
  { id: "AI-email-test-student-code", category: "Email", title: "Test student-code redemption email", description: "Mint comp code with email-on; redeem; verify email confirms entitlement.", blockerId: null, priority: "P2" },
  { id: "AI-email-bounce-handling", category: "Email", title: "Resend bounce handling + suppression list", description: "Configure bounce webhook; suppress hard bounces; soft-retry. Avoids being blacklisted.", blockerId: null, priority: "P2" },

  // ─── Compliance ───────────────────────────────────────────────────
  { id: "AI-legal-privacy", category: "Legal", title: "Publish /privacy", description: "Cover: data collected, purpose, third parties (Clerk, Stripe, PostHog, Sentry, Resend), retention, deletion request flow, contact.", blockerId: null, priority: "P0" },
  { id: "AI-legal-terms", category: "Legal", title: "Publish /terms", description: "Cover: acceptable use, refusal list (manifesto-as-policy), refund policy, IP ownership of user content, termination clauses.", blockerId: null, priority: "P0" },
  { id: "AI-legal-cookies", category: "Legal", title: "Cookie consent banner if EU traffic >5%", description: "PostHog can be configured cookie-less. If we keep cookies, need an opt-in banner. Defer until traffic data.", blockerId: null, priority: "P2" },
  { id: "AI-legal-trademark-search", category: "Legal", title: "Trademark search on 'Tasks' / @taskshq", description: "USPTO TESS quick search; international register check. 'Tasks' alone is generic; the wordmark is what's protectable.", blockerId: null, priority: "P2" },

  // ─── Branding & assets ────────────────────────────────────────────
  { id: "AI-brand-favicon", category: "Branding", title: "Favicon (16/32/180/192/512px) + ICO", description: "Multi-size favicon set + Apple touch icon + maskable PWA icon. Generate from src/components/brand/wordmark.tsx via Playwright.", blockerId: null, priority: "P1" },
  { id: "AI-brand-pwa-manifest", category: "Branding", title: "PWA manifest tuned for installability", description: "name, short_name, theme_color, background_color, icons. Already partly there — verify on /manifest.webmanifest.", blockerId: null, priority: "P1" },
  { id: "AI-brand-kit-doc", category: "Branding", title: "Document the brand kit", description: "docs/brand.md: logo SVG, color tokens, type system, voice rules. So future contributors don't drift.", blockerId: null, priority: "P2" },

  // ─── Testing infrastructure ───────────────────────────────────────
  { id: "AI-test-e2e-playwright", category: "Testing infra", title: "Playwright e2e tests for the golden path", description: "sign-up → create task → move to Doing → comment → publish workspace → guest views. One script, ~5 steps.", blockerId: null, priority: "P1" },
  { id: "AI-test-unit-parser", category: "Testing infra", title: "Unit tests on roadmap parser", description: "Vitest or Node's built-in. Cover: week-heading parse, table-row parse, bold-detection, date normalization.", blockerId: null, priority: "P2" },
  { id: "AI-test-ci-pipeline", category: "Testing infra", title: "CI on every push (typecheck + lint + tests)", description: "GitHub Actions or Vercel Build Step. Block PRs that don't typecheck.", blockerId: null, priority: "P1" },
  { id: "AI-test-visual-regression", category: "Testing infra", title: "Visual regression on key marketing pages", description: "Playwright screenshot diffs on /, /pricing, /principles. Catches accidental layout breaks.", blockerId: null, priority: "P2" },

  // ─── Accessibility ────────────────────────────────────────────────
  { id: "AI-a11y-contrast", category: "A11y", title: "WCAG AA color contrast audit", description: "Use Lighthouse + axe DevTools. Fix anything below 4.5:1 on body text.", blockerId: null, priority: "P0" },
  { id: "AI-a11y-keyboard-nav", category: "A11y", title: "Keyboard nav across the app", description: "Tab through /, /pricing, /app/board. Verify focus rings; verify all interactive elements reachable.", blockerId: null, priority: "P1" },
  { id: "AI-a11y-screen-reader", category: "A11y", title: "Screen reader test on board / list / timeline", description: "VoiceOver on macOS. Aria labels on all icon-only buttons; table semantics on list view.", blockerId: null, priority: "P1" },
  { id: "AI-a11y-skip-link", category: "A11y", title: "Skip-to-content link on every page", description: "Hidden until focused; jumps over the nav.", blockerId: null, priority: "P2" },

  // ─── Pre-launch QA (D-1) ──────────────────────────────────────────
  { id: "AI-qa-marketing-200", category: "Pre-launch QA", title: "All marketing routes return 200", description: "Curl /, /about, /principles, /pricing, /changelog, /templates, /templates/*, /for/*. Run on prod, the morning of 06-15.", blockerId: null, priority: "P0" },
  { id: "AI-qa-app-routes", category: "Pre-launch QA", title: "All /app/* routes work signed-in", description: "Manual walk-through, signed in. /app/board, /list, /timeline, /calendar, /inbox, /settings. Look for broken state, console errors.", blockerId: null, priority: "P0" },
  { id: "AI-qa-real-purchase-79", category: "Pre-launch QA", title: "One real $79 Wedding purchase tested in prod", description: "Use a real card; refund yourself after. Want to feel the actual flow, not the test-mode flow.", blockerId: null, priority: "P0" },
  { id: "AI-qa-real-purchase-995", category: "Pre-launch QA", title: "One real $9.95 Team purchase tested in prod", description: "Same drill. Refund after.", blockerId: null, priority: "P0" },
  { id: "AI-qa-status-page", category: "Pre-launch QA", title: "/status page shows green", description: "Verify it actually checks the right downstreams (DB, Clerk, Stripe webhook receipt).", blockerId: null, priority: "P1" },
  { id: "AI-qa-support-email", category: "Pre-launch QA", title: "Support email set up + tested", description: "hello@<domain> forwards to ethanmcn2013@gmail.com; reply-from-personal works for press replies.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-qa-rate-limits", category: "Pre-launch QA", title: "Confirm rate limits don't trip on launch traffic", description: "Show HN front-page = 100k+ visits in an hour. Validate Vercel function concurrency limit + Clerk request rate.", blockerId: null, priority: "P0" },
  { id: "AI-qa-rollback-plan", category: "Pre-launch QA", title: "Document a rollback plan", description: "If launch day reveals a regression: `vercel rollback` to the prior production commit. Practice once before 06-16.", blockerId: null, priority: "P0" },
  { id: "AI-qa-press-followup-template", category: "Pre-launch QA", title: "Confirm press follow-up reply templates exist", description: "Already in posts-week-6.md / posts-week-7.md. Re-read the morning of 06-16.", blockerId: null, priority: "P1" },
  { id: "AI-qa-launch-day-coffee", category: "Pre-launch QA", title: "Coffee + breakfast + no inbox before 9am ET 06-16", description: "Per launch-day-show-hn.md. The playbook is the playbook for a reason.", blockerId: null, priority: "P1" },

  // ─── Analytics & tracking ─────────────────────────────────────────
  { id: "AI-ga4-setup", category: "Analytics & tracking", title: "GA4 property + measurement ID wired", description: "GA4 over Universal Analytics — UA is gone. Pair with GTM for tag governance; route through the existing /api/posthog proxy if you keep PostHog as primary.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-gtm-container", category: "Analytics & tracking", title: "Google Tag Manager container", description: "One container for GA4 + any future Meta/LinkedIn pixels; keeps tags out of source. Trigger only on consent if cookie banner ships.", blockerId: "B-domain", priority: "P1" },
  { id: "AI-search-console", category: "Analytics & tracking", title: "Google Search Console verified + sitemap submitted", description: "Verify via DNS TXT (cleanest); submit /sitemap.xml; monitor coverage weekly for the first month post-launch.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-bing-webmaster", category: "Analytics & tracking", title: "Bing Webmaster Tools verified", description: "Bing powers DuckDuckGo + ChatGPT search. Import settings from Search Console with one click; don't sleep on the 10% non-Google share.", blockerId: "B-domain", priority: "P1" },
  { id: "AI-posthog-dashboards", category: "Analytics & tracking", title: "PostHog launch dashboard pinned", description: "One dashboard: signups, paid conversions, key funnels (visit → /pricing → checkout), retention cohorts. Pin to PostHog home for one-click status checks.", blockerId: null, priority: "P0" },
  { id: "AI-vercel-web-analytics", category: "Analytics & tracking", title: "Decide Vercel Web Analytics on/off", description: "Free, zero-config, cookieless, doesn't pad bundle. Decision: on — it's complementary to PostHog (Vercel = aggregate, PostHog = behavioral).", blockerId: null, priority: "P1" },
  { id: "AI-clarity-heatmap", category: "Analytics & tracking", title: "Microsoft Clarity for heatmaps + session replay", description: "Free, no MAU caps, no PII by default. Cleaner privacy story than Hotjar. Drop the script behind consent if EU traffic shows up.", blockerId: null, priority: "P1" },
  { id: "AI-plausible-eval", category: "Analytics & tracking", title: "Evaluate Plausible/Fathom as PostHog alternative", description: "If PostHog feels heavy or pricing scales weird post-launch, Plausible ($9/mo) or Fathom ($14/mo) are cleaner. Decision: stay PostHog through Q3.", blockerId: null, priority: "P2" },

  // ─── Business operations ──────────────────────────────────────────
  { id: "AI-form-entity", category: "Business operations", title: "Form business entity (LLC via Stripe Atlas)", description: "Stripe Atlas LLC for $500: forms entity, EIN, bank intro, post-incorporation docs. Clerky is the alt if you want C-Corp for future fundraising.", blockerId: null, priority: "P0" },
  { id: "AI-state-of-incorp", category: "Business operations", title: "Decide state of incorporation (Delaware vs home state)", description: "Delaware is the default for any future fundraising path; home-state LLC is cheaper and simpler if you stay bootstrapped. Decision: Delaware via Stripe Atlas.", blockerId: null, priority: "P0" },
  { id: "AI-ein-application", category: "Business operations", title: "EIN application via IRS or Stripe Atlas", description: "Atlas handles it; takes 1–2 weeks. Required for bank account, payroll, 1099s. Don't try to launch revenue without it.", blockerId: null, priority: "P0" },
  { id: "AI-registered-agent", category: "Business operations", title: "Registered agent + business address", description: "Atlas includes a registered agent year one. Use a virtual mailbox (Earth Class Mail or iPostal1) so home address stays off public filings.", blockerId: null, priority: "P0" },
  { id: "AI-operating-agreement", category: "Business operations", title: "Operating agreement signed", description: "Atlas generates a single-member template; sign it and store with the corporate records. Required by most banks at account opening.", blockerId: null, priority: "P1" },
  { id: "AI-capital-structure", category: "Business operations", title: "Initial capital structure documented", description: "Single-member LLC: simple. If anyone joins later, document the cap table from day zero — retrofitting equity is painful.", blockerId: null, priority: "P1" },
  { id: "AI-dba-decision", category: "Business operations", title: "DBA filing decision (Tasks vs legal entity name)", description: "If the LLC name differs from the brand 'Tasks', file a DBA in the home state so receipts and contracts can use the brand. Decision pending entity name.", blockerId: null, priority: "P2" },

  // ─── Banking & accounting ─────────────────────────────────────────
  { id: "AI-mercury-account", category: "Banking & accounting", title: "Open Mercury business account", description: "Mercury: SOC 2, free, integrates with Stripe payouts in two clicks. Brex is the alt if you want corporate cards day-one with rewards.", blockerId: null, priority: "P0" },
  { id: "AI-stripe-payouts", category: "Banking & accounting", title: "Connect Stripe payouts to Mercury", description: "Stripe → Mercury via ACH; daily rolling payouts. Verify the first payout actually lands before launch traffic ramps.", blockerId: null, priority: "P0" },
  { id: "AI-bookkeeping-software", category: "Banking & accounting", title: "Bookkeeping: Xero or QuickBooks", description: "Xero is cleaner UI and friendlier for solo founders; QuickBooks is what your future accountant will already know. Decision: Xero through year one.", blockerId: null, priority: "P1" },
  { id: "AI-monthly-close", category: "Banking & accounting", title: "Monthly close cadence (last day of month)", description: "Reconcile Mercury + Stripe + expenses; tag everything; export P&L. 30 minutes if you stay current, 4 hours if you let it pile up.", blockerId: null, priority: "P1" },
  { id: "AI-accountant-referral", category: "Banking & accounting", title: "Find an accountant for year-end taxes", description: "Atlas refers; alternatively Pilot or Bench for monthly bookkeeping bundled with tax prep. Decision: solo until $50k revenue, then outsource.", blockerId: null, priority: "P2" },
  { id: "AI-tax-filing-prep", category: "Banking & accounting", title: "Year-end tax filing prep", description: "Single-member LLC = pass-through to Schedule C. Delaware franchise tax due March 1 ($300/yr min). Calendar reminders set.", blockerId: null, priority: "P1" },
  { id: "AI-sales-tax", category: "Banking & accounting", title: "Sales tax: Stripe Tax on for SaaS subs", description: "Stripe Tax handles US state nexus + EU VAT automatically for $0.50/transaction. Anrok is the alt if you outgrow it. Decision: Stripe Tax at launch.", blockerId: null, priority: "P0" },

  // ─── Insurance ────────────────────────────────────────────────────
  { id: "AI-general-liability", category: "Insurance", title: "General liability insurance decision", description: "Software-only, no physical premises, no employees: skip GL until first contract demands it. Vouch or Embroker quote when triggered.", blockerId: null, priority: "P2" },
  { id: "AI-eo-insurance", category: "Insurance", title: "E&O / professional indemnity quote", description: "Once a Studio or Team customer asks for proof of insurance (it'll happen by month 6), get a $1M/$2M policy via Vouch — typically $80–150/mo for solo SaaS.", blockerId: null, priority: "P1" },
  { id: "AI-cyber-liability", category: "Insurance", title: "Cyber liability quote", description: "Bundle with E&O via Vouch. Covers breach response, notification costs, ransomware. Required by most enterprise procurement past 50 seats.", blockerId: null, priority: "P2" },
  { id: "AI-jurisdiction-review", category: "Insurance", title: "Jurisdiction review before binding any policy", description: "Delaware LLC + NY operating address + customers globally — make sure the policy actually covers the surface area. Don't sign blind.", blockerId: null, priority: "P2" },

  // ─── Customer support ────────────────────────────────────────────
  { id: "AI-support-tool", category: "Customer support", title: "Support tool: Plain or Help Scout", description: "Plain is the modern pick (Linear-aesthetic, free for solo); Help Scout is the workhorse. Crisp/Intercom are overkill at this stage. Decision: Plain.", blockerId: null, priority: "P1" },
  { id: "AI-help-faq", category: "Customer support", title: "Publish /help FAQ page", description: "Cover the top 12 questions extracted from beta-tester DMs and the launch-day playbook. Markdown in-repo, no CMS needed.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-support-email-forward", category: "Customer support", title: "support@ email forwarding configured", description: "support@<domain> → ethanmcn2013@gmail.com via Resend or registrar forwarding; Gmail filter labels them 'support' for triage.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-support-sla", category: "Customer support", title: "Self-imposed SLA: 24hr free, 8hr paid", description: "Publish on /help. Honesty about response time builds more trust than fake 'instant chat' promises that go unanswered overnight.", blockerId: null, priority: "P1" },
  { id: "AI-community-decision", category: "Customer support", title: "Community: Slack, Discord, or neither", description: "Both create dead-channel risk pre-1k users. Decision: neither at launch — funnel everything to support@ until volume justifies a community.", blockerId: null, priority: "P2" },
  { id: "AI-loom-async", category: "Customer support", title: "Loom for async support replies", description: "60-second screen recordings beat 4-paragraph emails for any 'how do I X' question. Free tier covers it.", blockerId: null, priority: "P2" },

  // ─── Newsletter & content marketing ──────────────────────────────
  { id: "AI-newsletter-platform", category: "Newsletter", title: "Newsletter platform: Beehiiv", description: "Beehiiv has the best free tier (2,500 subs), clean RSS, native referral program. Substack pulls audience away; ConvertKit is overkill solo.", blockerId: null, priority: "P1" },
  { id: "AI-newsletter-first-issue", category: "Newsletter", title: "Draft issue #1 (the refusal list, expanded)", description: "Lead with the manifesto angle that's already on /principles; ship same week as Show HN so launch traffic captures emails.", blockerId: null, priority: "P1" },
  { id: "AI-newsletter-signup-form", category: "Newsletter", title: "Sign-up form on landing + footer", description: "Embed Beehiiv form in the homepage hero secondary slot and global footer. No popups — they erode trust.", blockerId: null, priority: "P1" },
  { id: "AI-newsletter-welcome-seq", category: "Newsletter", title: "Welcome sequence (3 emails over 2 weeks)", description: "Email 1: confirm + the manifesto. Email 2: how Tasks differs from Linear/Asana. Email 3: invite to try free tier with a code.", blockerId: null, priority: "P2" },
  { id: "AI-newsletter-double-optin", category: "Newsletter", title: "Double opt-in for GDPR compliance", description: "Beehiiv supports it natively; turn it on for any subscriber whose IP geolocates to EU. Saves you from CASL/GDPR fines later.", blockerId: null, priority: "P1" },
  { id: "AI-newsletter-segmentation", category: "Newsletter", title: "Audience segmentation strategy", description: "Tag by source (Show HN, PH, organic, vertical-wedding, vertical-restaurant). Lets you send vertical-specific issues without spamming the rest.", blockerId: null, priority: "P2" },
  { id: "AI-changelog-rss", category: "Newsletter", title: "RSS feed for /changelog", description: "Static XML emit at build time; lets indie hacker types subscribe via Feedly. Already on the trust list — many devs check RSS before signing up.", blockerId: null, priority: "P2" },

  // ─── CRM & contacts ──────────────────────────────────────────────
  { id: "AI-press-crm", category: "CRM & contacts", title: "Press contacts CRM: Attio", description: "Attio's free tier handles a press list cleanly; Folk is the alt if you want lighter UI. Spreadsheet works at <50 contacts but breaks fast.", blockerId: null, priority: "P1" },
  { id: "AI-leads-crm", category: "CRM & contacts", title: "Customer leads CRM (same Attio workspace)", description: "Separate list inside Attio for inbound demos and sales conversations. Tag by tier interest (Wedding/Pro/Studio/Team) and source.", blockerId: null, priority: "P2" },
  { id: "AI-influencer-rolodex", category: "CRM & contacts", title: "Influencer rolodex synced from venue-outreach.md", description: "Migrate the markdown contact list into Attio so DMs/replies/follow-ups don't fall through the cracks.", blockerId: null, priority: "P2" },
  { id: "AI-resend-attio-integration", category: "CRM & contacts", title: "Resend ↔ Attio integration for sends", description: "Sync Attio contacts into Resend audiences; track opens/clicks back into Attio timeline. Avoids the manual copy-paste loop.", blockerId: null, priority: "P2" },

  // ─── DNS & CDN ───────────────────────────────────────────────────
  { id: "AI-cloudflare-decision", category: "DNS & CDN", title: "Cloudflare in front of Vercel: DNS-only initially", description: "DNS-only mode through launch; flip to proxy mode only if launch-day traffic warrants WAF + DDoS rules. Proxy adds a hop you don't need at zero abuse.", blockerId: "B-domain", priority: "P1" },
  { id: "AI-cloudflare-waf", category: "DNS & CDN", title: "Cloudflare WAF rules (when proxy enabled)", description: "Stock OWASP ruleset + custom rules blocking obvious abuse patterns on /api/auth/* and /api/webhooks/*. Only after flipping to proxy.", blockerId: null, priority: "P2" },
  { id: "AI-ddos-launch-day", category: "DNS & CDN", title: "DDoS protection plan for launch day", description: "Vercel includes baseline DDoS; Cloudflare proxy adds another layer if Show HN traffic gets weird. Plan: monitor, flip if needed.", blockerId: null, priority: "P1" },
  { id: "AI-bot-management", category: "DNS & CDN", title: "Bot management strategy", description: "Cloudflare's bot fight mode is free; turns away the obvious scrapers without breaking GoogleBot. Enable post-launch.", blockerId: null, priority: "P2" },
  { id: "AI-edge-cache-templates", category: "DNS & CDN", title: "Edge caching for /templates/*", description: "Templates are static + read-heavy; cache aggressively at the edge with stale-while-revalidate. Vercel handles via cacheLife in next.config.", blockerId: null, priority: "P1" },
  { id: "AI-image-edge-opt", category: "DNS & CDN", title: "Image optimization at the edge", description: "next/image already routes through Vercel's image optimizer. Verify Cloudflare proxy (if enabled) doesn't double-optimize and break cache.", blockerId: null, priority: "P2" },

  // ─── Database & infrastructure ───────────────────────────────────
  { id: "AI-postgres-pick", category: "Database & infrastructure", title: "Pick Postgres provider: Neon", description: "Neon: serverless, branching, generous free tier, native Vercel integration. Supabase if you also want auth/storage; Vercel Postgres is Neon under the hood.", blockerId: null, priority: "P0" },
  { id: "AI-pg-pooling", category: "Database & infrastructure", title: "Connection pooling via Neon's PgBouncer", description: "Vercel Functions = many short-lived connections; pgbouncer or Neon's pooled endpoint is required, not optional. Use the pooled connection string.", blockerId: null, priority: "P0" },
  { id: "AI-pg-read-replica", category: "Database & infrastructure", title: "Read replica decision (defer to month 3)", description: "At launch traffic, single primary handles everything. Revisit when /app/* p95 query times exceed 100ms or MAU passes 5k.", blockerId: null, priority: "P2" },
  { id: "AI-pg-pitr", category: "Database & infrastructure", title: "Point-in-time recovery enabled", description: "Neon's free tier includes 7 days PITR; paid extends to 30. Required before any production user data lands. Test a restore once before launch.", blockerId: null, priority: "P0" },
  { id: "AI-sqlite-pg-migration", category: "Database & infrastructure", title: "SQLite → Postgres migration plan", description: "Drizzle abstracts most of it; rewrite the connection layer + run drizzle-kit push against the new DB; export/import any user data via JSON intermediate.", blockerId: null, priority: "P0" },

  // ─── Background jobs & queues ────────────────────────────────────
  { id: "AI-jobs-platform", category: "Background jobs", title: "Pick: Vercel Cron only at launch", description: "Inngest and Trigger.dev are great, but Vercel Cron handles the digest cron with zero added complexity. Move to Inngest when you need fan-out or retries.", blockerId: null, priority: "P1" },
  { id: "AI-jobs-digest-cron", category: "Background jobs", title: "Digest cron implemented as Vercel Cron", description: "Already wired via vercel.json. Verified daily at 9am ET (AI-vercel-cron-digest). Migrate to Inngest only if cron contention or fan-out emerges.", blockerId: null, priority: "P1" },
  { id: "AI-jobs-ai-nudges", category: "Background jobs", title: "Nudge generation: Inngest when shipping", description: "Stuck-work nudges need retries and idempotency that Vercel Cron doesn't gracefully provide. When the feature ships, route through Inngest.", blockerId: null, priority: "P2" },
  { id: "AI-jobs-retry-logic", category: "Background jobs", title: "Retry logic for webhook handlers", description: "Stripe and Clerk both retry on 5xx, but our handlers should be idempotent regardless. Document retry semantics per route in a comment header.", blockerId: null, priority: "P1" },
  { id: "AI-jobs-dlq", category: "Background jobs", title: "Dead-letter queue for failed jobs", description: "Once Inngest is in: failed-after-retries jobs land in DLQ + Slack alert. Pre-Inngest, Sentry catches the throw and that's the DLQ proxy.", blockerId: null, priority: "P2" },
  { id: "AI-jobs-observability", category: "Background jobs", title: "Cron observability via Vercel Logs + Sentry", description: "Verify every cron run emits a log line with duration + result; Sentry catches throws. Without this, silent failures rot for weeks.", blockerId: null, priority: "P1" },

  // ─── Feature flags & experimentation ─────────────────────────────
  { id: "AI-flags-platform", category: "Feature flags", title: "Pick: PostHog feature flags", description: "PostHog is already in the stack and flags are free. Statsig/LaunchDarkly add cost without value at this scale. GrowthBook only if you want self-host.", blockerId: null, priority: "P1" },
  { id: "AI-flags-needed-prelaunch", category: "Feature flags", title: "Decide if any flags are needed before launch", description: "Decision: no. Ship straight to 100%; the launch beats are too short to A/B. Flags become useful at $1k MRR when you have traffic to slice.", blockerId: null, priority: "P2" },
  { id: "AI-flags-naming", category: "Feature flags", title: "Flag naming convention documented", description: "Convention: <area>-<feature>-<variant> (e.g. pricing-annual-discount-v1). Document in docs/flags.md so flags don't sprawl into chaos.", blockerId: null, priority: "P2" },

  // ─── Image & video infrastructure ────────────────────────────────
  { id: "AI-image-storage-longterm", category: "Image & video", title: "Long-term file storage: Vercel Blob", description: "Vercel Blob is the lowest-friction step up from local disk; Cloudflare Images and Cloudinary add transformation features we don't need yet. Migrate when SQLite migrates.", blockerId: null, priority: "P1" },
  { id: "AI-video-hosting", category: "Image & video", title: "Future video hosting: Mux", description: "If we ever ship in-app video (loom-style replies, demo embeds), Mux is the cleanest API + best player. Cloudflare Stream is the cheap alt. Decision deferred.", blockerId: null, priority: "P2" },
  { id: "AI-transcoding-pipeline", category: "Image & video", title: "Transcoding pipeline (defer until video ships)", description: "Mux handles transcoding end-to-end; no separate pipeline needed. Note as 'no-op until video feature exists' so future-you doesn't over-engineer.", blockerId: null, priority: "P2" },

  // ─── Compliance scanning ─────────────────────────────────────────
  { id: "AI-dependabot", category: "Compliance scanning", title: "Dependabot enabled on the repo", description: "GitHub-native, free, opens PRs for security updates. Enable security-only at first to avoid PR noise from minor bumps.", blockerId: null, priority: "P0" },
  { id: "AI-snyk-vs-audit", category: "Compliance scanning", title: "npm audit weekly; Snyk only if needed", description: "`npm audit --production` in CI fails the build on high/critical. Snyk's UI is nicer but $52/mo solo doesn't pencil pre-revenue.", blockerId: null, priority: "P1" },
  { id: "AI-semgrep-sast", category: "Compliance scanning", title: "Semgrep SAST in CI", description: "Free tier covers OWASP top-10 rules; runs in GitHub Actions in <1 min. Catches things eslint won't (SQL injection patterns, hardcoded creds).", blockerId: null, priority: "P1" },
  { id: "AI-trufflehog-secrets", category: "Compliance scanning", title: "TruffleHog secrets scanning pre-commit", description: "Pre-commit hook + GitHub Action; catches AWS keys, Stripe keys, Clerk keys before they hit history. Free tier is plenty.", blockerId: null, priority: "P0" },
  { id: "AI-vuln-disclosure", category: "Compliance scanning", title: "Vulnerability disclosure policy on /security", description: "Publish security@<domain> + scope + safe-harbor language. Standard template at securitytxt.org. Required for any future SOC 2 path.", blockerId: "B-domain", priority: "P1" },

  // ─── Trademark & IP ──────────────────────────────────────────────
  { id: "AI-tm-wordmark", category: "Trademark & IP", title: "Wordmark trademark filing (USPTO class 9 + 42)", description: "~$350/class via USPTO TEAS Plus. File 'Tasks' wordmark for software (class 9) + SaaS services (class 42). Direct filing is cheaper than LegalZoom.", blockerId: null, priority: "P1" },
  { id: "AI-tm-international", category: "Trademark & IP", title: "International filing via Madrid Protocol (defer)", description: "Madrid Protocol lets you extend to 130+ countries from one US application; ~$3k+ for the basic set. Defer until you have international revenue.", blockerId: null, priority: "P2" },
  { id: "AI-tm-design-mark", category: "Trademark & IP", title: "Design mark decision (logo)", description: "Wordmark is the priority — covers any visual treatment. File the design mark separately only if the wordmark application gets refused on genericness.", blockerId: null, priority: "P2" },
  { id: "AI-tm-monitoring", category: "Trademark & IP", title: "Monitor for infringement (Markify or manual)", description: "Markify watches USPTO for confusingly similar filings; $30/mo. Manual quarterly USPTO TESS check is free and probably sufficient at this stage.", blockerId: null, priority: "P2" },

  // ─── Marketing & growth tools ────────────────────────────────────
  { id: "AI-affiliate-program", category: "Marketing & growth", title: "Affiliate program decision: defer to month 3", description: "Rewardful integrates with Stripe in 10 min ($49/mo); Tapfiliate is the alt. Decision: no affiliate at launch — wait for product-market signal first.", blockerId: null, priority: "P2" },
  { id: "AI-referral-program", category: "Marketing & growth", title: "Referral program decision: in-house at month 2", description: "GrowSurf and Viral Loops are both ~$200/mo; we can build referral codes on top of the existing comp_codes table for $0. Defer until launch dust settles.", blockerId: null, priority: "P2" },
  { id: "AI-pricing-experiments", category: "Marketing & growth", title: "Pricing-page A/B experiments via PostHog", description: "Once flags ship: test annual discount %, default tier, social proof placement. Don't run anything during the launch beats — too much noise.", blockerId: null, priority: "P2" },
  { id: "AI-landing-variants", category: "Marketing & growth", title: "Landing-page variants by audience", description: "/for/<vertical> already exists for venues/restaurants. Add /for/agencies and /for/freelancers post-launch based on which verticals signal.", blockerId: null, priority: "P2" },

  // ─── Internal tooling ────────────────────────────────────────────
  { id: "AI-dogfood-tasks", category: "Internal tooling", title: "Dogfood Tasks for internal todos", description: "Move launch-readiness checklist + cycle planning into Tasks itself. Eat the dog food; the friction you find is the friction users find.", blockerId: null, priority: "P1" },
  { id: "AI-notion-vs-tasks-docs", category: "Internal tooling", title: "Long-form docs: keep in-repo MDX", description: "Notion sprawls; in-repo MDX (docs/) keeps docs versioned with code. Decision: stay in-repo until a non-engineer joins and needs Notion's WYSIWYG.", blockerId: null, priority: "P2" },
  { id: "AI-bug-tracker", category: "Internal tooling", title: "Bug tracking: GitHub Issues", description: "Linear is great but $8/seat compounds; GitHub Issues is free and lives next to the code. Migrate to Linear when team grows past 2.", blockerId: null, priority: "P1" },
  { id: "AI-loom-walkthroughs", category: "Internal tooling", title: "Loom for product walkthroughs (internal + press)", description: "Free tier (25 videos, 5min cap) covers internal use. Useful for press follow-ups: 'here's a 3-min walkthrough of the feature you asked about'.", blockerId: null, priority: "P2" },
  { id: "AI-calendly-press", category: "Internal tooling", title: "Calendly for press meetings", description: "Free tier handles 1 event type — make it a 20-min 'Tasks demo / press chat' link. Drop in every cold press email signature.", blockerId: null, priority: "P1" },

  // ─── Status & uptime ─────────────────────────────────────────────
  { id: "AI-status-page", category: "Status & uptime", title: "Public status page: BetterStack", description: "BetterStack: free tier covers status page + uptime monitoring + on-call paging in one tool. Statuspage is enterprise-priced; Instatus is the cheap alt.", blockerId: "B-domain", priority: "P0" },
  { id: "AI-uptime-multi-region", category: "Status & uptime", title: "Uptime probes from 3+ regions", description: "BetterStack probes from US-East, EU, APAC by default. Catches regional Vercel issues that single-region monitors miss.", blockerId: null, priority: "P1" },
  { id: "AI-on-call-rotation", category: "Status & uptime", title: "On-call rotation (just Ethan, for now)", description: "Single-person rotation = 24/7 on-call. BetterStack pages via SMS + push. Document handoff plan for when team grows past 1.", blockerId: null, priority: "P1" },
  { id: "AI-incident-comms-template", category: "Status & uptime", title: "Incident communication template", description: "Pre-written status update templates for: investigating, identified, monitoring, resolved. Stops you from writing prose at 3am during an outage.", blockerId: null, priority: "P1" },
  { id: "AI-postmortem-template", category: "Status & uptime", title: "Post-mortem template in docs/", description: "Blameless format: timeline, impact, root cause, contributing factors, action items. Publish to /changelog for any user-visible incident.", blockerId: null, priority: "P2" },

  // ─── Documentation ───────────────────────────────────────────────
  { id: "AI-docs-strategy", category: "Documentation", title: "Docs strategy: stay at /changelog + /principles", description: "Adding /docs invites scope creep; /changelog covers what shipped and /principles covers why. Add /docs only when the API exists and needs reference.", blockerId: null, priority: "P2" },
  { id: "AI-mintlify-vs-mdx", category: "Documentation", title: "Mintlify vs in-repo MDX (when /docs ships)", description: "Mintlify is gorgeous but $150/mo and an external dep. In-repo MDX with our existing /changelog styling stays cohesive. Decision: MDX.", blockerId: null, priority: "P2" },
  { id: "AI-api-docs", category: "Documentation", title: "API docs (when an API exists)", description: "No public API at launch. When one ships: OpenAPI spec generated from Zod schemas + rendered via Scalar (free, no SaaS). No-op until then.", blockerId: null, priority: "P2" },

  // ─── Press & PR tooling ──────────────────────────────────────────
  { id: "AI-muckrack-decision", category: "Press & PR", title: "Muck Rack / Cision: skip at launch", description: "Both are $5k+/yr enterprise tools. The press list at this stage is small enough that Gmail labels + a spreadsheet beat any CRM.", blockerId: null, priority: "P2" },
  { id: "AI-gmail-press-labels", category: "Press & PR", title: "Gmail labels for press tracking", description: "Labels: press/sent, press/replied, press/published, press/no-response. Filter rules auto-label by domain (techcrunch.com, theverge.com, etc).", blockerId: null, priority: "P1" },
  { id: "AI-press-reply-tracking", category: "Press & PR", title: "Reply tracking via Attio (not spreadsheet)", description: "Once Attio is set up, log every press send + reply there with the journalist's beat + last touch. Spreadsheets break at 30+ contacts.", blockerId: null, priority: "P2" },
  { id: "AI-press-page", category: "Press & PR", title: "Media kit page on /press", description: "Logo (SVG + PNG), screenshots, founder photo, 100/250/500-word boilerplates, contact email. One-page; press will copy-paste.", blockerId: null, priority: "P1" },

  // ─── Legal additions ─────────────────────────────────────────────
  { id: "AI-legal-cookie-policy", category: "Legal additions", title: "Cookie policy if any cookies are set", description: "PostHog can run cookieless; Clerk sets session cookies; Vercel Analytics is cookieless. Document what's set + why on /privacy or /cookies.", blockerId: null, priority: "P1" },
  { id: "AI-legal-aup", category: "Legal additions", title: "Acceptable Use Policy", description: "Short version of the refusal-list manifesto in legal-policy form. Covers: no spam, no abuse, no illegal content, no scraping. Link from /terms.", blockerId: null, priority: "P1" },
  { id: "AI-legal-dpa", category: "Legal additions", title: "DPA template for enterprise customers", description: "GDPR Article 28 requirement when an EU business buys. Generate template via Iubenda or copy from a friendly OSS SaaS (Plain has theirs public).", blockerId: null, priority: "P2" },
  { id: "AI-legal-oss-notices", category: "Legal additions", title: "Open-source notices page if deps require it", description: "Most MIT/Apache deps don't require attribution beyond NOTICE files. Run `license-checker` once; if any GPL/LGPL show up, address before launch.", blockerId: null, priority: "P2" },
  { id: "AI-legal-privacy-handwritten", category: "Legal additions", title: "Privacy policy: hand-written, not generated", description: "Iubenda/Termly templates read like legal mush and undercut the brand voice. Hand-written keeps it readable and matches /principles tone.", blockerId: null, priority: "P0" },
];

export async function seedLaunchReadinessIfMissing(): Promise<void> {
  // Blockers — upsert by id, preserve resolvedAt + note.
  const blockerIds = SEED_BLOCKERS.map((b) => b.id);
  const existingBlockers = await db
    .select()
    .from(blockers)
    .where(inArray(blockers.id, blockerIds));
  const existingBlockerById = new Map(existingBlockers.map((b) => [b.id, b]));
  const now = new Date();

  for (let i = 0; i < SEED_BLOCKERS.length; i++) {
    const b = SEED_BLOCKERS[i];
    const prior = existingBlockerById.get(b.id);
    if (!prior) {
      await db.insert(blockers).values({
        id: b.id,
        title: b.title,
        kind: b.kind,
        targetDate: b.targetDate,
        description: b.description,
        ord: i,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }
    if (
      prior.title !== b.title ||
      prior.kind !== b.kind ||
      prior.targetDate !== b.targetDate ||
      prior.description !== b.description ||
      prior.ord !== i
    ) {
      await db
        .update(blockers)
        .set({
          title: b.title,
          kind: b.kind,
          targetDate: b.targetDate,
          description: b.description,
          ord: i,
          updatedAt: now,
        })
        .where(eq(blockers.id, b.id));
    }
  }

  // Action items — same upsert pattern, preserve status / note / completedAt.
  const actionIds = SEED_ACTION_ITEMS.map((a) => a.id);
  const existingActions = await db
    .select()
    .from(actionItems)
    .where(inArray(actionItems.id, actionIds));
  const existingActionById = new Map(existingActions.map((a) => [a.id, a]));

  for (let i = 0; i < SEED_ACTION_ITEMS.length; i++) {
    const a = SEED_ACTION_ITEMS[i];
    const prior = existingActionById.get(a.id);
    if (!prior) {
      await db.insert(actionItems).values({
        id: a.id,
        category: a.category,
        title: a.title,
        description: a.description,
        blockerId: a.blockerId,
        priority: a.priority,
        ord: i,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }
    if (
      prior.category !== a.category ||
      prior.title !== a.title ||
      prior.description !== a.description ||
      prior.blockerId !== a.blockerId ||
      prior.priority !== a.priority ||
      prior.ord !== i
    ) {
      await db
        .update(actionItems)
        .set({
          category: a.category,
          title: a.title,
          description: a.description,
          blockerId: a.blockerId,
          priority: a.priority,
          ord: i,
          updatedAt: now,
        })
        .where(eq(actionItems.id, a.id));
    }
  }
}

export interface BlockerRow {
  id: string;
  title: string;
  kind: string;
  targetDate: string | null;
  description: string;
  note: string | null;
  resolvedAt: Date | null;
  ord: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionItemRow {
  id: string;
  category: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  blockerId: string | null;
  note: string | null;
  priority: "P0" | "P1" | "P2";
  ord: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export async function readBlockers(): Promise<BlockerRow[]> {
  const rows = await db.select().from(blockers).orderBy(blockers.ord);
  return rows.map((r) => ({
    ...r,
    targetDate: r.targetDate ?? null,
    note: r.note ?? null,
    resolvedAt: r.resolvedAt ?? null,
  })) as BlockerRow[];
}

export async function readActionItems(): Promise<ActionItemRow[]> {
  const rows = await db.select().from(actionItems).orderBy(actionItems.ord);
  return rows.map((r) => ({
    ...r,
    description: r.description ?? null,
    blockerId: r.blockerId ?? null,
    note: r.note ?? null,
    completedAt: r.completedAt ?? null,
  })) as ActionItemRow[];
}
