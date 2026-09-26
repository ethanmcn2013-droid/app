"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Seg, Sentence, Tok } from "./summary";
import { Pie, hueVar } from "./bits";
import pg from "./page.module.css";

/**
 * Renders the written sentences with live tokens. A token re-mounts when its
 * words change (its key includes the label), so edits visibly re-write the
 * fact in place while the rest of the paragraph holds still. Punctuation that
 * follows a token is kept on the same line as it.
 */
export function LivingText({
  sentences,
  onToken,
  size = "page",
  interactive = true,
}: {
  sentences: Sentence[];
  onToken?: (tok: Tok, el: HTMLElement) => void;
  size?: "page" | "compact";
  interactive?: boolean;
}) {
  const inner = (seg: Tok) => (
    <>
      {seg.progress !== undefined ? (
        <span className={pg.tokPie}>
          <Pie value={seg.progress} />
        </span>
      ) : null}
      {seg.kind === "project" ? <span className={pg.tokSwatch} aria-hidden="true" /> : null}
      {seg.label}
    </>
  );

  const renderTok = (seg: Tok) =>
    interactive ? (
      <button
        key={`${seg.key}:${seg.label}`}
        type="button"
        className={pg.tok}
        data-tone={seg.tone}
        data-kind={seg.kind}
        style={seg.hue ? ({ "--hue": hueVar(seg.hue) } as CSSProperties) : undefined}
        onClick={(e) => onToken?.(seg, e.currentTarget)}
      >
        {inner(seg)}
      </button>
    ) : (
      <span
        key={`${seg.key}:${seg.label}`}
        className={pg.tok}
        data-tone={seg.tone}
        data-kind={seg.kind}
        style={seg.hue ? ({ "--hue": hueVar(seg.hue) } as CSSProperties) : undefined}
      >
        {inner(seg)}
      </span>
    );

  const renderSegs = (segs: Seg[]) => {
    const out: ReactNode[] = [];
    for (let j = 0; j < segs.length; j++) {
      const seg = segs[j];
      if (typeof seg === "string") {
        out.push(<span key={j}>{seg}</span>);
        continue;
      }
      const after = segs[j + 1];
      const punct = typeof after === "string" ? /^[.,;:?]+/.exec(after)?.[0] : undefined;
      if (punct && typeof after === "string") {
        out.push(
          <span key={`g${j}`} className={pg.tokGroup}>
            {renderTok(seg)}
            {punct}
          </span>,
        );
        const rest = after.slice(punct.length);
        if (rest) out.push(<span key={`r${j}`}>{rest}</span>);
        j++;
      } else {
        out.push(renderTok(seg));
      }
    }
    return out;
  };

  return (
    <p className={pg.living} data-size={size}>
      {sentences.map((sentence, i) => (
        <span key={sentence.key} className={pg.sentence} style={{ "--d": `${i * 70}ms` } as CSSProperties}>
          {renderSegs(sentence.segs)}
          {i < sentences.length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}
