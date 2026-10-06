import type { ProjectFileKind } from "@/lib/projects/project-files";
import { markRuns } from "@/lib/projects/project-files";
import styles from "./files.module.css";

/** Small shared pieces of the Files page: the kind glyph, icons and marked text. */

const KIND_PATH: Record<ProjectFileKind, React.ReactNode> = {
  document: <><path d="M4 1.75h5.5L12.5 4.75v9.5H4z" /><path d="M9.5 1.75v3h3M6 8h4.5M6 10.5h4.5" /></>,
  image: <><rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.5" /><circle cx="6" cy="6.5" r="1.25" /><path d="m3 12 3.5-3.5 2.5 2.5 1.5-1.5 2.5 2.5" /></>,
  sheet: <><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.5" /><path d="M2.25 6.25h11.5M2.25 10h11.5M6.25 2.25v11.5" /></>,
  slides: <><rect x="2" y="3" width="12" height="8" rx="1.25" /><path d="M8 11v2.5M5.5 13.5h5" /></>,
  design: <><circle cx="8" cy="8" r="5.75" /><path d="M8 2.25v11.5M2.25 8h11.5" /></>,
  code: <path d="m5.5 5-3 3 3 3M10.5 5l3 3-3 3" />,
  link: <><path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l1.9-1.9a2.75 2.75 0 0 0-3.9-3.9l-.6.6" /><path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-1.9 1.9a2.75 2.75 0 0 0 3.9 3.9l.6-.6" /></>,
  file: <><path d="M4 1.75h5.5L12.5 4.75v9.5H4z" /><path d="M9.5 1.75v3h3" /></>,
};

/** A file's kind as a tinted tile. `size` is the tile; the drawing scales with it. */
export function FileGlyph({ kind, size = 34 }: { kind: ProjectFileKind; size?: number }) {
  const icon = Math.round(size * 0.5);
  return (
    <span className={styles.glyph} data-kind={kind} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {KIND_PATH[kind]}
      </svg>
    </span>
  );
}

const ICON_PATH = {
  search: <><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></>,
  x: <path d="m4 4 8 8M12 4l-8 8" />,
  clock: <><circle cx="8" cy="8" r="5.75" /><path d="M8 4.75V8l2.25 1.5" /></>,
  person: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.25a5 5 0 0 1 10 0" /></>,
  open: <><path d="M9 2.75h4.25V7M13.25 2.75 7.5 8.5" /><path d="M11.5 9.5v2.75a1 1 0 0 1-1 1h-6.75a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1H6.5" /></>,
  download: <><path d="M8 2.5v7.75M4.75 7.25 8 10.5l3.25-3.25" /><path d="M3 13.25h10" /></>,
  link: KIND_PATH.link,
  check: <path d="m3.5 8.5 3 3 6-6.5" />,
  task: <><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" /><path d="m5.5 8.2 1.8 1.8 3.4-3.7" /></>,
  list: <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />,
  grid: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></>,
  document: KIND_PATH.document,
  image: KIND_PATH.image,
  sheet: KIND_PATH.sheet,
} as const;

export type FilesIconName = keyof typeof ICON_PATH;

export function FilesIcon({ name, size = 14, className }: { name: FilesIconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICON_PATH[name]}
    </svg>
  );
}

/** Text with the query's words lit. */
export function Marked({ text, terms }: { text: string; terms: readonly string[] }) {
  if (terms.length === 0) return <>{text}</>;
  return (
    <>
      {markRuns(text, terms).map((run, index) =>
        run.hit ? (
          <mark key={index} className={styles.mark}>{run.text}</mark>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}
