"use client";

import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShellIcon } from "../shell-icons";
import {
  COMING_SOON_LABEL,
  TOOL_ENTRIES,
  feedbackHref,
  toolIdeasHref,
  untilThenApps,
  type ToolEntry,
} from "./launcher-catalog";
import { LauncherGlyph } from "./launcher-icons";
import styles from "./launcher.module.css";

/**
 * The eighth card on /app/tools: the honest answer to a tool that is not on
 * the list. A mail to a person, nothing about the viewer in it.
 */
export function ToolRequestCard() {
  return (
    <a href={feedbackHref()} className={styles.requestCard}>
      <span className={styles.requestPlate} aria-hidden="true">
        <ShellIcon.plus size={18} />
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardLabel}>Missing something?</span>
        <span className={styles.cardDescription}>Tell us what you need</span>
      </span>
    </a>
  );
}

function neighbours(tool: ToolEntry): { previous: ToolEntry; next: ToolEntry } {
  const index = TOOL_ENTRIES.findIndex((entry) => entry.slug === tool.slug);
  const count = TOOL_ENTRIES.length;
  return {
    previous: TOOL_ENTRIES[(index - 1 + count) % count]!,
    next: TOOL_ENTRIES[(index + 1) % count]!,
  };
}

const hue = (tool: ToolEntry) => ({ "--tool-hue": `var(--v3-project-${tool.identity})` }) as CSSProperties;

/**
 * The one template for every tool on the way (/app/tools/[slug]).
 *
 * Honest by construction: a promise in plain words, and real links to what
 * already works. No mock screens, no waitlist form, no switch that stores
 * nothing. The only way to ask for more is a mail to a person. `[` and `]`
 * page through the tools, the way the pager above the title does.
 */
export function ToolPlaceholder({
  tool,
  messagesEnabled,
}: {
  tool: ToolEntry;
  messagesEnabled: boolean;
}) {
  const router = useRouter();
  const apps = untilThenApps(tool, messagesEnabled);
  const { previous, next } = neighbours(tool);
  const others = TOOL_ENTRIES.filter((entry) => entry.slug !== tool.slug);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "[" && event.key !== "]") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], [data-suite-command-layer]')) return;
      event.preventDefault();
      router.push(`/app/tools/${event.key === "[" ? previous.slug : next.slug}`);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next.slug, previous.slug, router]);

  return (
    <div className={styles.page}>
      <article className={styles.tool} style={hue(tool)}>
        <nav className={styles.toolNav} aria-label="Tools on the way">
          <Link href="/app/tools" className={styles.backLink}>
            <ShellIcon.chevronLeft size={14} />
            All apps and tools
          </Link>
          <span className={styles.pager}>
            <Link
              href={`/app/tools/${previous.slug}`}
              className={styles.pagerLink}
              aria-keyshortcuts="["
              aria-label={`Previous: ${previous.name}`}
            >
              <ShellIcon.chevronLeft size={14} />
              <span className={styles.pagerName}>{previous.name}</span>
            </Link>
            <Link
              href={`/app/tools/${next.slug}`}
              className={styles.pagerLink}
              aria-keyshortcuts="]"
              aria-label={`Next: ${next.name}`}
            >
              <span className={styles.pagerName}>{next.name}</span>
              <ShellIcon.chevronRight size={14} />
            </Link>
          </span>
        </nav>

        <header className={styles.toolHero} key={tool.slug}>
          <span className={styles.toolMark}>
            <LauncherGlyph name={tool.icon} size={30} />
          </span>
          <div className={styles.toolHeadText}>
            <div className={styles.toolHeading}>
              <h1 className={styles.toolName}>{tool.name}</h1>
              <span className={styles.pill} data-tone="soon">
                {COMING_SOON_LABEL}
              </span>
            </div>
            <p className={styles.toolLede}>{tool.oneLiner}</p>
          </div>
        </header>

        <section className={styles.toolSection} aria-labelledby="tool-will-do">
          <h2 className={styles.toolSectionTitle} id="tool-will-do">
            What it will do
          </h2>
          <ul className={styles.bullets}>
            {tool.bullets.map((bullet) => (
              <li key={bullet} className={styles.bullet}>
                <span className={styles.bulletMark} aria-hidden="true" />
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.toolSection} aria-labelledby="tool-until-then">
          <h2 className={styles.toolSectionTitle} id="tool-until-then">
            Until then
          </h2>
          <div className={styles.untilThen}>
            {apps.map((app) => (
              <Link key={app.id} href={app.href} className={styles.untilLink}>
                <span
                  className={styles.plate}
                  data-identity=""
                  style={{ "--app-hue": `var(--v3-project-${app.identity})` } as CSSProperties}
                >
                  <LauncherGlyph name={app.icon} size={18} />
                </span>
                <span className={styles.cardText}>
                  <span className={styles.cardLabel}>Open {app.label}</span>
                  <span className={styles.cardDescription}>{app.description}</span>
                </span>
                <ShellIcon.chevronRight size={14} className={styles.chevron} />
              </Link>
            ))}
          </div>
          <a className={styles.askButton} href={toolIdeasHref(tool)}>
            <ShellIcon.messages size={16} />
            Tell us what you need
          </a>
        </section>

        <section className={styles.toolSection} aria-labelledby="tool-others">
          <h2 className={styles.toolSectionTitle} id="tool-others">
            Other tools on the way
          </h2>
          <ul className={styles.otherTools}>
            {others.map((other) => (
              <li key={other.slug}>
                <Link href={`/app/tools/${other.slug}`} className={styles.otherTool} style={hue(other)}>
                  <span className={styles.otherPlate}>
                    <LauncherGlyph name={other.icon} size={16} />
                  </span>
                  {other.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Link href={`/app/tools/${next.slug}`} className={styles.nextLink}>
          Next: {next.name}
          <ShellIcon.chevronRight size={14} />
        </Link>
      </article>
    </div>
  );
}
