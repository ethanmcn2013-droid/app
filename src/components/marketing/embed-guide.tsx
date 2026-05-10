/**
 * `/embed/guide` — how-to page for embedding a published Tasks
 * workspace into Google Sites, Notion, indie blogs, Substack, or
 * anywhere that takes an iframe or a script tag.
 *
 * Sprint-9 thesis: distribution at the boundary, not OAuth-deep.
 * The cycle-23 embed widget already handles the rendering — this
 * page just teaches the patterns.
 */
import Link from "next/link";
import { TASKS_DOMAIN, TASKS_URL } from "@/lib/product-urls";

export function EmbedGuide() {
  return (
    <section className="relative isolate pb-32 pt-12 md:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,92,255,0.16), rgba(79,70,229,0.04), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[820px] px-6">
        <Eyebrow />

        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink">
          Embed a workspace{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(124,92,255,0.30), rgba(79,70,229,0.16))",
              }}
            />
            anywhere.
          </span>
        </h1>

        <p className="mt-6 text-[17px] leading-[1.55] text-ink-soft">
          Once you publish a workspace at{" "}
          <code className="rounded bg-bg-sunken/70 px-1.5 py-0.5 font-mono text-[15px]">
            {TASKS_DOMAIN}/p/{"{slug}"}
          </code>
          , you can drop it into a blog post, a Notion page, a Google
          Site, a Substack, a Webflow project — anywhere that accepts
          an iframe or a script tag. No OAuth, no plugin, no
          permissions to negotiate.
        </p>

        <p className="mt-5 text-[15.5px] leading-[1.6] text-ink-quiet">
          You publish; the workspace becomes a URL; the URL drops
          into other tools. The pattern is the same as YouTube videos
          or Tweets — paste the link, the destination unfurls it.
        </p>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The simplest version — paste an iframe.
        </h2>
        <p className="mt-3 text-[15.5px] leading-[1.6] text-ink-soft">
          Most blog editors take raw HTML in a code block or
          &ldquo;embed&rdquo; element. Drop this in:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line-soft bg-bg-sunken/40 px-5 py-4 font-mono text-[12.5px] leading-[1.55] text-ink">
{`<iframe
  src="${TASKS_URL}/embed/your-slug"
  width="100%"
  height="480"
  style="border: 0; border-radius: 12px"
  loading="lazy"
  title="Tasks workspace"
></iframe>`}
        </pre>
        <p className="mt-3 text-[13px] leading-[1.55] text-ink-quiet">
          Replace <code className="font-mono">your-slug</code> with
          the slug shown in your workspace settings (Settings &rarr;
          Workspace &rarr; Identity &rarr; URL slug). The published-workspace
          URL must already be live —{" "}
          <code className="font-mono">{TASKS_DOMAIN}/p/{"{slug}"}</code>{" "}
          should return your workspace.
        </p>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The script-tag version — for repeating embeds.
        </h2>
        <p className="mt-3 text-[15.5px] leading-[1.6] text-ink-soft">
          If you want multiple workspaces on the same page (or want
          one line of script to handle every embed across a whole
          site), use the script tag. It auto-discovers any element
          with{" "}
          <code className="rounded bg-bg-sunken/70 px-1.5 py-0.5 font-mono text-[14px]">
            data-tasks-workspace
          </code>{" "}
          and injects an iframe at that location.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-line-soft bg-bg-sunken/40 px-5 py-4 font-mono text-[12.5px] leading-[1.55] text-ink">
{`<div data-tasks-workspace="your-slug"></div>
<div data-tasks-workspace="other-slug"
     data-tasks-height="320"></div>

<script src="${TASKS_URL}/embed.js" async></script>`}
        </pre>
        <p className="mt-3 text-[13px] leading-[1.55] text-ink-quiet">
          Per-element overrides:{" "}
          <code className="font-mono">data-tasks-width</code> and{" "}
          <code className="font-mono">data-tasks-height</code>. The
          script is idempotent — if it loads twice or you re-render,
          existing iframes are skipped.
        </p>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Per-tool notes.
        </h2>
        <ToolBlock
          name="Google Sites"
          notes="Insert → Embed → Embed code → paste the iframe. Google Sites strips most attributes; the basic iframe with src + width + height works. The loading attribute is dropped, that's fine."
        />
        <ToolBlock
          name="Notion"
          notes={`Type /embed → paste the published URL directly (${TASKS_DOMAIN}/p/your-slug). Notion's embed block handles iframe wrapping automatically. The script-tag version doesn't apply here.`}
        />
        <ToolBlock
          name="Substack / Ghost / blogs"
          notes="Use the iframe block in the editor. Most blog editors expose this as 'HTML embed' or 'raw HTML.' If your editor doesn't take iframes, the script-tag version on a custom theme template works too."
        />
        <ToolBlock
          name="Webflow / Framer / Squarespace"
          notes="All three have native HTML / Embed blocks. Paste the iframe. Set the height generously — the embed view is fixed-height, doesn't grow with content."
        />
        <ToolBlock
          name="Google Docs"
          notes="Docs doesn't render iframes. Paste the published URL as a plain link — Docs auto-creates a smart chip with the page's OG card. You can also export your workspace tasks as Markdown from the in-app Export menu and paste that into Docs directly."
        />

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          What the embed looks like.
        </h2>
        <p className="mt-3 text-[15.5px] leading-[1.6] text-ink-soft">
          A compact lane-grouped task list with a small chip header
          (workspace name &middot; published date), up to 6 tasks
          per lane with a{" "}
          <code className="rounded bg-bg-sunken/70 px-1.5 py-0.5 font-mono text-[14px]">
            + N more
          </code>{" "}
          overflow row, and a tiny &ldquo;Made with Tasks&rdquo;
          footer linking to the full{" "}
          <code className="rounded bg-bg-sunken/70 px-1.5 py-0.5 font-mono text-[14px]">
            /p/{"{slug}"}
          </code>{" "}
          page in a new tab. The styling stays restrained — white
          background, system fonts, no app chrome — so the embed
          inherits the host page&rsquo;s look.
        </p>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            Plain English
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            Publish your workspace. Paste the URL. The destination
            renders it. Done.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app/settings"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              Open settings
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:border-ink-soft/30"
            >
              Or pick a template first
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolBlock({ name, notes }: { name: string; notes: string }) {
  return (
    <div className="mt-5 rounded-xl border border-line-soft bg-bg-elevated px-5 py-4">
      <div className="text-[13px] font-semibold tracking-[-0.005em] text-ink">
        {name}
      </div>
      <p className="mt-1.5 text-[13.5px] leading-[1.55] text-ink-soft">
        {notes}
      </p>
    </div>
  );
}

function Eyebrow() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/60 py-1 pl-1 pr-3 text-[11.5px] font-medium text-ink-soft backdrop-blur">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white"
        style={{
          background: "linear-gradient(135deg, var(--brand) 0%, #7c5cff 100%)",
          boxShadow: "0 4px 10px rgba(79, 70, 229, 0.32)",
        }}
      >
        Embed guide
      </span>
      Drop a workspace into anywhere that takes HTML
    </div>
  );
}
