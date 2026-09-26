"use client";

/* Split-flap text. Each character rolls through three others before it
   settles, left to right, like a departure board changing its row. Pure
   CSS: a change of text remounts the row and the roll plays once. Reduced
   motion shows the final text straight away. */

import s from "./c6.module.css";

const POOL = "ABCDEFGHIJKLMNOPRSTUVWYabcdeghiklmnoprstuvwy0123456789";

function hash(str: string, i: number) {
  let h = 2166136261 ^ i;
  for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619);
  return Math.abs(h);
}

/** Words keep their trailing space so lines only break between words. */
function words(text: string) {
  const out: { chars: { ch: string; i: number }[] }[] = [];
  let cur: { ch: string; i: number }[] = [];
  Array.from(text).forEach((ch, i) => {
    cur.push({ ch, i });
    if (ch === " ") {
      out.push({ chars: cur });
      cur = [];
    }
  });
  if (cur.length) out.push({ chars: cur });
  return out;
}

export function FlapText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`${s.flap} ${className ?? ""}`} aria-label={text} role="text">
      <span key={text} className={s.flapRow} aria-hidden="true">
        {words(text).map((w, wi) => (
          <span key={wi} className={s.flapWord}>
            {w.chars.map(({ ch, i }) => {
              if (ch === " ") return <span key={i} className={s.flapSpace}> </span>;
              const h = hash(text, i);
              const r = [POOL[h % POOL.length], POOL[(h >> 5) % POOL.length], POOL[(h >> 10) % POOL.length]];
              const delay = `${Math.min(i, 26) * 16}ms`;
              return (
                <span key={i} className={s.flapCell}>
                  <span className={s.flapSizer}>{ch}</span>
                  <span className={s.flapStrip} style={{ animationDelay: delay }}>
                    <span>{r[0]}</span>
                    <span>{r[1]}</span>
                    <span>{r[2]}</span>
                    <span>{ch}</span>
                  </span>
                </span>
              );
            })}
          </span>
        ))}
      </span>
    </span>
  );
}
