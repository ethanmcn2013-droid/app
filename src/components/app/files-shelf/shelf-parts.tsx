import type { ProjectFile } from "@/lib/projects/project-files";
import { markRuns } from "@/lib/projects/project-files";
import { shelfTypeOf, splitName, type ShelfSource } from "./shelf-model";
import styles from "./files-shelf.module.css";

/**
 * Small drawn pieces of the shelf: the folder, the source marks and the one
 * greyscale placeholder per file type. Server-safe; no state.
 */

const FOLDER_BACK =
  "M0 20a12 12 0 0 1 12-12h44c5 0 8 1.5 11 4.5l5 5c3 3 6 4.5 11 4.5h105a12 12 0 0 1 12 12v102a14 14 0 0 1-14 14H14a14 14 0 0 1-14-14Z";
const FOLDER_FRONT = "M0 68a10 10 0 0 1 10-10h180a10 10 0 0 1 10 10v68a14 14 0 0 1-14 14H14a14 14 0 0 1-14-14Z";

function paperLines(x: number, y: number) {
  return <path d={`M${x} ${y}h54M${x} ${y + 11}h96M${x} ${y + 22}h78`} />;
}

/**
 * One folder silhouette with one neutral finish. Papers show inside when it
 * holds files; `ghost` is the dashed Add files folder.
 */
export function Folder({
  count,
  mark,
  ghost = false,
  ghostIcon,
  showCount = true,
  size = "large",
}: {
  count: number;
  mark?: React.ReactNode;
  ghost?: boolean;
  ghostIcon?: React.ReactNode;
  showCount?: boolean;
  size?: "large" | "small";
}) {
  return (
    <span className={styles.folder} data-ghost={ghost ? "" : undefined} data-size={size} aria-hidden="true">
      <svg viewBox="0 0 200 150" focusable="false">
        <path className={styles.folderBack} d={FOLDER_BACK} />
        {!ghost && count > 1 ? (
          <g className={`${styles.paper} ${styles.paper2}`}>
            <rect x="30" y="22" width="140" height="100" rx="5" />
            {paperLines(44, 34)}
          </g>
        ) : null}
        {!ghost && count > 0 ? (
          <g className={`${styles.paper} ${styles.paper1}`}>
            <rect x="22" y="29" width="156" height="100" rx="5" />
            {paperLines(36, 41)}
          </g>
        ) : null}
        {ghost ? null : <path className={styles.folderLip} d="M10 57h180" />}
        <path className={styles.folderFront} d={FOLDER_FRONT} />
      </svg>
      {ghost ? (
        <span className={styles.folderLabel} data-ghost="">{ghostIcon}</span>
      ) : (
        <span className={styles.folderLabel}>
          <span className={styles.folderMark}>{mark}</span>
          {showCount ? <span className={styles.folderCount}>{count}</span> : null}
        </span>
      )}
    </span>
  );
}

/** The Signal Studio mark: ring and dot, in the brand colour. */
export function SignalMark({ size = 20 }: { size?: number }) {
  return (
    <svg className={styles.markSignal} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="10" r="3.25" fill="currentColor" />
    </svg>
  );
}

/** The Google Drive logo, as Google draws it: identity, not decoration. */
export function DriveMark({ size = 20 }: { size?: number }) {
  return (
    <svg className={styles.markDrive} width={size} height={Math.round(size * 0.9)} viewBox="0 0 87.3 78" aria-hidden="true" focusable="false">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  );
}

/** A link: the one teal the shelf allows. */
export function LinkMark({ size = 20 }: { size?: number }) {
  return (
    <svg className={styles.markLink} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6.75 9.25a2.75 2.75 0 0 0 3.9 0l1.9-1.9a2.75 2.75 0 0 0-3.9-3.9l-.6.6" />
      <path d="M9.25 6.75a2.75 2.75 0 0 0-3.9 0l-1.9 1.9a2.75 2.75 0 0 0 3.9 3.9l.6-.6" />
    </svg>
  );
}

export function SourceMark({ source, size = 20 }: { source: ShelfSource; size?: number }) {
  if (source === "drive") return <DriveMark size={size} />;
  if (source === "links") return <LinkMark size={size} />;
  return <SignalMark size={size} />;
}

const LINE_WIDTHS = [92, 84, 96, 62, 88, 79, 94, 58, 86, 70, 92, 84, 96, 62, 88, 79, 94, 58, 86, 70];

/**
 * One fixed greyscale placeholder per type (founder decision, 21 Oct): a page
 * of lines for documents, a grid for sheets, a photo glyph for images and a
 * web page for links. No type badges; the name carries the extension.
 */
export function Placeholder({ file }: { file: Pick<ProjectFile, "kind" | "storage"> }) {
  const type = shelfTypeOf(file);
  if (type === "image") {
    return (
      <span className={styles.thumb} data-type="image" aria-hidden="true">
        <svg viewBox="0 0 48 36" focusable="false">
          <circle cx="35" cy="10" r="4.5" />
          <path d="M0 36 15 16l10 11 7-7 16 16Z" />
        </svg>
      </span>
    );
  }
  if (type === "sheet") {
    return (
      <span className={styles.thumb} data-type="sheet" aria-hidden="true">
        <span className={styles.sheetHead}><i /><i /><i /></span>
        {Array.from({ length: 16 }, (_, index) => (
          <span key={index} className={styles.sheetRow}><i /><i /><i /></span>
        ))}
      </span>
    );
  }
  if (type === "link") {
    return (
      <span className={styles.thumb} data-type="link" aria-hidden="true">
        <span className={styles.thumbPage}>
          <span className={styles.webBar}><b /><i className={styles.line} style={{ width: "44%" }} /></span>
          <i className={`${styles.line} ${styles.lineHead}`} style={{ width: "80%" }} />
          <i className={`${styles.line} ${styles.lineHead}`} style={{ width: "56%" }} />
          <span className={styles.webBlock} />
        </span>
      </span>
    );
  }
  return (
    <span className={styles.thumb} data-type="document" aria-hidden="true">
      <span className={styles.thumbPage}>
        <i className={`${styles.line} ${styles.lineHead}`} style={{ width: "52%" }} />
        {LINE_WIDTHS.map((width, index) => (
          <i key={index} className={styles.line} style={{ width: `${width}%` }} />
        ))}
      </span>
    </span>
  );
}

/** Text with the query's words set in the medium weight. */
export function Lit({ text, words }: { text: string; words: readonly string[] }) {
  const useful = words.filter((word) => word.length > 1);
  if (useful.length === 0) return <>{text}</>;
  return (
    <>
      {markRuns(text, useful).map((run, index) =>
        run.hit ? <mark key={index} className={styles.lit}>{run.text}</mark> : <span key={index}>{run.text}</span>,
      )}
    </>
  );
}

/** A file name whose extension never truncates. */
export function FileName({ title, words }: { title: string; words: readonly string[] }) {
  const { base, ext } = splitName(title);
  return (
    <span className={styles.name}>
      <span className={styles.nameBase}><Lit text={base} words={words} /></span>
      {ext ? <span className={styles.nameExt}>{ext}</span> : null}
    </span>
  );
}

const ICON = {
  search: <><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></>,
  x: <path d="m4 4 8 8M12 4l-8 8" />,
  grid: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></>,
  list: <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />,
  chevron: <path d="m6 3.5 4.5 4.5L6 12.5" />,
  task: <><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" /><path d="m5.5 8.2 1.8 1.8 3.4-3.7" /></>,
  plus: <path d="M8 3v10M3 8h10" />,
  back: <path d="M10 3.5 5.5 8l4.5 4.5" />,
} as const;

export function ShelfIcon({ name, size = 14 }: { name: keyof typeof ICON; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICON[name]}
    </svg>
  );
}
