"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ACTIVE_OPTIONS, ARCHIVED_OPTIONS } from "./registry";

/**
 * Lab stage and switcher. The replay counter keys the rendered hero subtree,
 * which guarantees pure-CSS intros remount instead of relying on
 * router.refresh preserving or replacing the same DOM.
 */
export function LabStage({
  activeSlug,
  children,
}: {
  activeSlug: string;
  children: ReactNode;
}) {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <>
      <LabSwitcher
        activeSlug={activeSlug}
        onReplay={() => setReplayKey((current) => current + 1)}
      />
      <div className="lab-stage" key={`${activeSlug}-${replayKey}`}>
        {children}
      </div>
    </>
  );
}

function LabSwitcher({
  activeSlug,
  onReplay,
}: {
  activeSlug: string;
  onReplay: () => void;
}) {
  const router = useRouter();
  const archived = ARCHIVED_OPTIONS.find((option) => option.slug === activeSlug);

  // Keyboard: 1..N jump between active options. R remounts the current hero.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        onReplay();
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= ACTIVE_OPTIONS.length) {
        e.preventDefault();
        router.push(`/lab/${ACTIVE_OPTIONS[n - 1].slug}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReplay, router]);

  return (
    <nav className="lab-bar" aria-label="Tasks hero options">
      <Link href="/lab" className="lab-home">
        Tasks · hero lab
      </Link>
      <div className="lab-tabs">
        {ACTIVE_OPTIONS.map((o, i) => {
          const active = o.slug === activeSlug;
          return (
            <Link
              key={o.slug}
              href={`/lab/${o.slug}`}
              className={`lab-tab${active ? " lab-tab-on" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="lab-idx">{i + 1}</span>
              <span className="lab-name">{o.name}</span>
              {o.role === "counterpoint" && <span className="lab-wild">counterpoint</span>}
            </Link>
          );
        })}
        {archived ? (
          <Link
            href={`/lab/${archived.slug}`}
            className="lab-tab lab-tab-archive lab-tab-on"
            aria-current="page"
          >
            <span className="lab-name">{archived.name}</span>
            <span className="lab-wild">archive</span>
          </Link>
        ) : null}
      </div>
      <button
        className="lab-replay"
        onClick={onReplay}
        title="Replay (R)"
        aria-keyshortcuts="R"
      >
        Replay ▸
      </button>
      <style>{LAB_CSS}</style>
    </nav>
  );
}

const LAB_CSS = `
.lab-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:16px;
  padding:10px 18px;background:rgba(255,255,255,.82);backdrop-filter:blur(8px);
  border-bottom:1px solid rgba(17,17,17,.08);font-family:var(--font-geist-sans,system-ui,sans-serif)}
.lab-home{font-size:13px;font-weight:600;color:var(--ink);text-decoration:none;letter-spacing:-.01em;white-space:nowrap}
.lab-tabs{display:flex;gap:6px;flex:1;overflow-x:auto}
.lab-tab{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;
  border:1px solid rgba(17,17,17,.1);color:var(--ink-soft);text-decoration:none;font-size:13px;white-space:nowrap;transition:.15s}
.lab-tab:hover{border-color:var(--accent);color:var(--ink)}
.lab-tab-on{background:var(--accent);border-color:var(--accent);color:var(--paper)}
.lab-tab-archive.lab-tab-on{background:var(--paper-deep);border-color:rgba(17,17,17,.16);color:var(--ink-soft)}
.lab-tab-on .lab-idx{color:var(--paper);border-color:rgba(255,255,255,.5)}
.lab-idx{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;
  border:1px solid rgba(17,17,17,.2);font-family:var(--font-geist-mono,monospace);font-size:10px;color:var(--ink-faint)}
.lab-wild{font-family:var(--font-geist-mono,monospace);font-size:10px;letter-spacing:.06em;
  color:var(--accent);text-transform:uppercase}
.lab-tab-on .lab-wild{color:var(--paper)}
.lab-tab-archive.lab-tab-on .lab-wild{color:var(--ink-faint)}
.lab-replay{appearance:none;border:1px solid rgba(17,17,17,.12);background:var(--paper);color:var(--ink);
  font:inherit;font-size:12.5px;padding:6px 13px;border-radius:8px;cursor:pointer;white-space:nowrap}
.lab-replay:hover{border-color:var(--accent)}
.lab-home:focus-visible,.lab-tab:focus-visible,.lab-replay:focus-visible{outline:3px solid rgba(79,70,229,.24);outline-offset:2px}
.lab-stage{display:block}
@media (max-width:520px){
  .lab-bar{gap:8px;padding:8px 10px}
  .lab-home{display:none}
  .lab-tabs{min-width:0;gap:4px}
  .lab-tab{gap:6px;padding:6px 9px}
  .lab-wild{display:none}
  .lab-replay{padding-inline:10px}
}
`;
