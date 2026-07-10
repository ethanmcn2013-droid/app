import Link from "next/link";
import {
  ACTIVE_OPTIONS,
  ARCHIVED_OPTIONS,
  type LabOption,
} from "@/components/lab/registry";

/**
 * Lab index — the showroom door. Review-only. Lists every hero direction
 * as a card. Not linked from any shipped surface.
 */
export const metadata = {
  title: "Tasks hero lab",
  robots: { index: false, follow: false },
};

export default function LabIndexPage() {
  return (
    <main className="lab-index">
      <style>{CSS}</style>
      <header className="lab-index-head">
        <p className="lab-index-kicker">Signal Tasks · hero showroom</p>
        <h1 className="lab-index-title">
          The work, made clear<span className="lab-index-dot" aria-hidden />
        </h1>
        <p className="lab-index-lede">
          Two active hero directions for the Signal Tasks homepage. Both begin
          with a real artifact, prove accountable movement, and settle on the
          product pulse. Nothing here ships. Open one, then press 1&ndash;
          {ACTIVE_OPTIONS.length} to jump or R to replay.
        </p>
      </header>

      <ul className="lab-index-grid">
        {ACTIVE_OPTIONS.map((option, index) => (
          <OptionCard key={option.slug} option={option} index={index + 1} />
        ))}
      </ul>

      <section className="lab-archive" aria-labelledby="lab-archive-title">
        <div className="lab-archive-head">
          <p className="lab-index-kicker">Research archive</p>
          <h2 className="lab-archive-title" id="lab-archive-title">
            Kept to show the road not taken.
          </h2>
        </div>
        <ul className="lab-archive-grid">
          {ARCHIVED_OPTIONS.map((option, index) => (
            <OptionCard
              archived
              key={option.slug}
              option={option}
              index={ACTIVE_OPTIONS.length + index + 1}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}

function OptionCard({
  option,
  index,
  archived = false,
}: {
  option: LabOption;
  index: number;
  archived?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/lab/${option.slug}`}
        className={`lab-card${archived ? " lab-card-archived" : ""}`}
      >
        <div className="lab-card-top">
          <span className="lab-card-num">{String(index).padStart(2, "0")}</span>
          <span className={`lab-card-badge${option.role === "counterpoint" ? " is-wild" : ""}`}>
            {option.role}
          </span>
        </div>
        <p className="lab-card-lens">{option.lens}</p>
        <h2 className="lab-card-headline">{option.name}</h2>
        <p className="lab-card-say">{option.headline}</p>
        <p className="lab-card-blurb">{option.blurb}</p>
        <span className="lab-card-open">
          {archived ? "Review research" : "Open"} <span aria-hidden>&rarr;</span>
        </span>
      </Link>
    </li>
  );
}

const CSS = `
.lab-index {
  max-width: 1080px; margin: 0 auto;
  padding: clamp(56px, 10vh, 104px) 24px 96px;
  background: var(--paper);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  color: var(--ink);
}
.lab-index-head { max-width: 720px; }
.lab-index-kicker {
  margin: 0 0 20px; font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ink-faint);
}
.lab-index-title {
  margin: 0; font-size: clamp(2.2rem, 1.6rem + 2.6vw, 3.6rem);
  font-weight: 600; letter-spacing: -0.04em; line-height: 1.02;
}
.lab-index-dot {
  display: inline-block; width: 0.14em; height: 0.14em; min-width: 8px; min-height: 8px;
  max-width: 12px; max-height: 12px; margin-left: 0.06em;
  border-radius: 50%; background: var(--accent); vertical-align: baseline;
}
.lab-index-lede {
  margin: 24px 0 0; max-width: 60ch;
  font-size: 17px; line-height: 1.6; color: var(--ink-soft);
}
.lab-index-grid {
  list-style: none; margin: 56px 0 0; padding: 0;
  display: grid; gap: 1px; background: var(--hairline);
  border: 1px solid var(--hairline);
  grid-template-columns: repeat(2, 1fr);
}
@media (max-width: 720px) { .lab-index-grid { grid-template-columns: 1fr; } }
.lab-card {
  display: flex; flex-direction: column; height: 100%;
  padding: 28px; background: var(--paper);
  text-decoration: none; color: inherit;
  transition: background 160ms var(--ease-out);
}
.lab-card:hover { background: var(--paper-soft); }
.lab-card:focus-visible { outline: 3px solid rgba(79,70,229,.24); outline-offset: 3px; }
.lab-card-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 22px;
}
.lab-card-num {
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 12px; color: var(--ink-faint); letter-spacing: 0.04em;
}
.lab-card-badge {
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-faint); padding: 3px 8px; border-radius: 999px;
  border: 1px solid var(--hairline);
}
.lab-card-badge.is-wild { color: var(--accent); border-color: rgba(79,70,229,.35); }
.lab-card-lens {
  margin: 0 0 8px; font-size: 12px; letter-spacing: 0.02em;
  color: var(--ink-faint);
}
.lab-card-headline {
  margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em;
}
.lab-card-say {
  margin: 10px 0 0; font-size: 16px; color: var(--ink-soft);
  letter-spacing: -0.01em;
}
.lab-card-blurb {
  margin: 14px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--ink-faint);
}
.lab-card-open {
  margin-top: 22px; font-size: 13px; font-weight: 500; color: var(--accent);
  display: inline-flex; gap: 6px; align-items: center;
}
.lab-archive { margin-top: 72px; padding-top: 32px; border-top: 1px solid var(--hairline); }
.lab-archive-head { max-width: 680px; }
.lab-archive-title { margin: -6px 0 0; font-size: 22px; font-weight: 600; letter-spacing: -0.025em; }
.lab-archive-grid { list-style: none; margin: 28px 0 0; padding: 0; max-width: 720px; }
.lab-card-archived { border: 1px solid var(--hairline); color: var(--ink-soft); }
.lab-card-archived .lab-card-open { color: var(--ink-faint); }
`;
