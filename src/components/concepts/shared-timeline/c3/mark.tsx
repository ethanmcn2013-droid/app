/* The stationer's mark: a quiet "Made with Signal Studio", printed small. */

import s from "./c3.module.css";

export function StudioMark() {
  return (
    <span className={s.studioMark}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className={s.studioGlyph}>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M4.5 9.5 C 6 6, 7.5 6, 8 8 S 10 10, 11.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
      Made with Signal Studio
    </span>
  );
}
