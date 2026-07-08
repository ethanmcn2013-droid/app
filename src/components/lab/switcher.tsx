"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { OPTIONS } from "./registry";

/**
 * Lab switcher, a quiet top bar to move between the Tasks hero options and
 * replay the current one. Keys 1..N jump between options, R replays the intro
 * (router.refresh re-mounts the option so its pure-CSS intro runs again).
 * Lab-only chrome; never ships. Scoped `lab-` classes.
 */
export function LabSwitcher({ activeSlug }: { activeSlug: string }) {
  const router = useRouter();

  // Keyboard: 1..N jump between options, R replays (remount via refresh).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key.toLowerCase() === "r") {
        router.refresh();
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= OPTIONS.length) {
        router.push(`/lab/${OPTIONS[n - 1].slug}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <nav className="lab-bar" aria-label="Tasks hero options">
      <Link href="/lab" className="lab-home">
        Tasks · hero lab
      </Link>
      <div className="lab-tabs">
        {OPTIONS.map((o, i) => {
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
      </div>
      <button className="lab-replay" onClick={() => router.refresh()} title="Replay (R)">
        Replay &#9656;
      </button>
      <style>{LAB_CSS}</style>
    </nav>
  );
}

const LAB_CSS = `
.lab-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:16px;
  padding:10px 18px;background:rgba(255,255,255,.82);backdrop-filter:blur(8px);
  border-bottom:1px solid rgba(17,17,17,.08);font-family:var(--font-geist-sans,system-ui,sans-serif)}
.lab-home{font-size:13px;font-weight:600;color:#111;text-decoration:none;letter-spacing:-.01em;white-space:nowrap}
.lab-tabs{display:flex;gap:6px;flex:1;overflow-x:auto}
.lab-tab{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;
  border:1px solid rgba(17,17,17,.1);color:#3f3f46;text-decoration:none;font-size:13px;white-space:nowrap;transition:.15s}
.lab-tab:hover{border-color:#4f46e5;color:#111}
.lab-tab-on{background:#4f46e5;border-color:#4f46e5;color:#fff}
.lab-tab-on .lab-idx{color:#fff;border-color:rgba(255,255,255,.5)}
.lab-idx{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;
  border:1px solid rgba(17,17,17,.2);font-family:var(--font-geist-mono,monospace);font-size:10px;color:#71717a}
.lab-wild{font-family:var(--font-geist-mono,monospace);font-size:10px;letter-spacing:.06em;
  color:#4f46e5;text-transform:uppercase}
.lab-tab-on .lab-wild{color:#fff}
.lab-replay{appearance:none;border:1px solid rgba(17,17,17,.12);background:#fff;color:#111;
  font:inherit;font-size:12.5px;padding:6px 13px;border-radius:8px;cursor:pointer;white-space:nowrap}
.lab-replay:hover{border-color:#4f46e5}
@media (max-width:520px){.lab-home{display:none}}
`;
