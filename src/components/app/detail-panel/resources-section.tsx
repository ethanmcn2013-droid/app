"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import type { Task } from "@/lib/data";
import { useCurrentUser } from "@/lib/auth-context";
import { Avatar } from "@/components/showcase/avatar";
import { useToast } from "@/components/primitives/toast";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  uploadAttachmentAction,
  type UploadAttachmentResult,
} from "@/server/actions/attachments";
import {
  addLinkResourceAction,
  listTaskResourcesAction,
  removeResourceAction,
  type ResourceRow,
} from "@/server/actions/resources";
import { Popover } from "./popover";

// Client-side hint only; the server is the authority on size limits.
// Updated to match SERVER_UPLOAD_LIMIT_BYTES (50 MB) so the hint stays
// aligned with the effective cap until client-direct multipart ships.
const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Resources section in the task detail panel. Replaces the old
 * AttachmentsSection with a unified view: file uploads + external links.
 *
 * Upload path is unchanged — bytes go to the same local-disk store via
 * uploadAttachmentAction. Links are added inline via addLinkResourceAction
 * (no external fetch; synchronous insert). Both kinds remove via
 * removeResourceAction which hand-rolls the backing-row delete.
 *
 * access_state='legacy' rows render normally; the bytes may still exist
 * on local disk for local-disk deployments.
 */
export function ResourcesSection({ task }: { task: Task }) {
  const reduceMotion = useReducedMotion();
  const me = useCurrentUser();
  const { toast } = useToast();
  const [items, setItems] = useState<DisplayRow[] | null>(null);
  const [, startTransition] = useTransition();
  const [dragDepth, setDragDepth] = useState(0);
  const [linkInput, setLinkInput] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const refreshKey = task.updatedAt?.getTime();

  useEffect(() => {
    let ignore = false;
    listTaskResourcesAction(task.id)
      .then((rows) => {
        if (!ignore) setItems(rows.map(toDisplayRow));
      })
      .catch((err) => {
        if (!ignore) {
          console.warn("resources: fetch failed", err);
          setItems([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, [task.id, refreshKey]);

  // ── Upload handler (unchanged path) ──────────────────────────────────

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      for (const file of list) {
        if (file.size > MAX_BYTES) {
          toast(`${file.name} is over 50 MB`, {
            tone: "warn",
            body: "Trim it down or share a link instead.",
          });
          continue;
        }

        const tempId = `temp-${Math.random().toString(36).slice(2, 8)}`;
        const placeholder: PendingUploadRow = {
          kind: "pending-upload",
          tempId,
          title: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          addedByUserId: me,
          addedAt: Math.floor(Date.now() / 1000),
        };
        const placeholderTimer = window.setTimeout(() => {
          setItems((cur) => (cur ? [...cur, placeholder] : [placeholder]));
        }, 300);

        const fd = new FormData();
        fd.append("file", file);

        startTransition(async () => {
          try {
            const result: UploadAttachmentResult = await uploadAttachmentAction(task.id, fd);
            window.clearTimeout(placeholderTimer);
            // Refresh from server to get the canonical resource row.
            const rows = await listTaskResourcesAction(task.id);
            setItems(rows.map(toDisplayRow));
            // Surface calm storage-usage warning if a threshold was crossed.
            if (result.warnThresholds.length > 0) {
              const highestThreshold = Math.max(
                ...result.warnThresholds.map(Number),
              );
              const displayPct = Math.round(highestThreshold * 100);
              toast(`Storage is at ${displayPct}% of your plan.`, {
                tone: "warn",
              });
            }
          } catch (err) {
            window.clearTimeout(placeholderTimer);
            console.warn("resources: upload failed; rolling back", err);
            setItems((cur) =>
              cur
                ? cur.filter(
                    (row) =>
                      !(row.kind === "pending-upload" && row.tempId === tempId),
                  )
                : cur,
            );
            toast(`Couldn't attach ${file.name}`, {
              tone: "error",
              body:
                err instanceof Error
                  ? err.message
                  : "The upload failed mid-flight.",
            });
          }
        });
      }
    },
    [me, task.id, toast],
  );

  // ── Link add handler ──────────────────────────────────────────────────

  const handleAddLink = useCallback(() => {
    const url = linkInput.trim();
    if (!url) return;

    setLinkPending(true);
    startTransition(async () => {
      try {
        const rows = await addLinkResourceAction(task.id, url);
        setItems(rows.map(toDisplayRow));
        setLinkInput("");
      } catch (err) {
        console.warn("resources: add link failed", err);
        toast("Couldn't add link", {
          tone: "error",
          body:
            err instanceof Error ? err.message : "The link could not be added.",
        });
      } finally {
        setLinkPending(false);
      }
    });
  }, [linkInput, task.id, toast]);

  // ── Remove handler ────────────────────────────────────────────────────

  const remove = useCallback(
    (row: RealRow) => {
      let priorIndex = -1;
      setItems((cur) => {
        if (!cur) return cur;
        priorIndex = cur.indexOf(row);
        return cur.filter((r) => r !== row);
      });
      startTransition(async () => {
        try {
          await removeResourceAction(row.id);
        } catch (err) {
          console.warn("resources: remove failed", err);
          setItems((cur) => {
            if (!cur || cur.some((item) => item.kind === "real" && item.id === row.id)) return cur;
            const next = [...cur];
            next.splice(Math.max(0, priorIndex), 0, row);
            return next;
          });
          toast(`Couldn't remove ${row.title}`, { tone: "error" });
        }
      });
    },
    [toast],
  );

  // ── Drag events ───────────────────────────────────────────────────────

  const onDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragDepth((d) => d + 1);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(e)) return;
    setDragDepth((d) => Math.max(0, d - 1));
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragDepth(0);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  if (items === null) return null;

  const dragging = dragDepth > 0;
  const realItems = items.filter((r): r is RealRow => r.kind === "real");
  const pendingItems = items.filter(
    (r): r is PendingUploadRow => r.kind === "pending-upload",
  );
  const total = items.length;

  return (
    <div
      className={cn(
        "relative border-t border-line-soft px-6 py-5 transition-colors",
        dragging && "bg-bg-sunken/50",
      )}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Section header */}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Resources
        </span>
        <div className="flex items-baseline gap-3">
          {total > 0 ? (
            <span className="text-[10.5px] tabular-nums text-ink-quiet">
              {total} {total === 1 ? "item" : "items"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md text-[11.5px] font-medium text-ink-quiet transition-colors hover:text-ink-soft"
            aria-label="Attach a file"
          >
            <PaperclipGlyph />
            Attach
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        aria-label="Files to attach"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Resource list */}
      {total > 0 ? (
        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {realItems.map((row) => (
              <RealResourceRow
                key={row.id}
                row={row}
                onRemove={() => remove(row)}
              />
            ))}
            {pendingItems.map((row) => (
              <PendingRow key={row.tempId} row={row} />
            ))}
          </AnimatePresence>
        </ul>
      ) : null}

      {/*
        One affordance for both intake paths. The empty state used to stack
        a dashed "drop files" message on top of a separate paste-link row —
        two ways of saying "put things here" taking two rows to say it. The
        link input IS the drop zone: dashed while empty, quiet once the
        section holds items.
      */}
      <div
        className={[
          "flex items-center gap-1.5",
          total === 0
            ? "rounded-md border border-dashed border-line px-2.5 py-2"
            : "mt-3",
        ].join(" ")}
      >
        <LinkGlyph />
        <input
          ref={linkInputRef}
          type="url"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddLink();
            }
          }}
          placeholder={total === 0 ? "Drop files here, or paste a link…" : "Paste a link…"}
          disabled={linkPending}
          className={[
            "min-w-0 flex-1 text-[12px] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50",
            total === 0
              ? "bg-transparent"
              : "rounded-md border border-line px-2 py-1 focus:border-ink-soft",
          ].join(" ")}
        />
        {linkInput.trim() ? (
          <button
            type="button"
            onClick={handleAddLink}
            disabled={linkPending}
            className="flex-shrink-0 rounded-md bg-ink px-2 py-1 text-[11.5px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {linkPending ? "Adding…" : "Add"}
          </button>
        ) : null}
      </div>

      {/* Drag-over overlay */}
      <AnimatePresence>
        {dragging ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.12 }}
            className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border border-dashed border-ink-soft/40 bg-white/80 text-[12px] font-medium text-ink-soft backdrop-blur-sm"
          >
            Drop to attach
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ── Row state types ───────────────────────────────────────────────────

type RealRow = {
  kind: "real";
  id: string;
  resourceKind: "upload" | "link";
  provider: string;
  title: string;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  addedByUserId: string | null;
  addedAt: number;
  accessState: string;
};

type PendingUploadRow = {
  kind: "pending-upload";
  tempId: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  addedByUserId: import("@/lib/data").UserId;
  addedAt: number;
};

type DisplayRow = RealRow | PendingUploadRow;

function toDisplayRow(r: ResourceRow): RealRow {
  return {
    kind: "real",
    id: r.id,
    resourceKind: r.kind,
    provider: r.provider,
    title: r.title,
    url: r.url,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    addedByUserId: r.addedByUserId,
    addedAt: r.addedAt,
    accessState: r.accessState,
  };
}

// ── Real resource row ─────────────────────────────────────────────────

function RealResourceRow({
  row,
  onRemove,
}: {
  row: RealRow;
  onRemove: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isUpload = row.resourceKind === "upload";
  // Upload rows link to the authenticated download route using the
  // attachment id derived from the resource id ('res-' prefix stripped).
  const downloadUrl = isUpload
    ? `/api/attachments/${row.id.startsWith("res-") ? row.id.slice(4) : row.id}`
    : null;
  const href = isUpload ? (downloadUrl ?? "#") : (row.url ?? "#");
  const isExternal = !isUpload;

  return (
    <motion.li
      layout="position"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px)" }}
      animate={{ opacity: 1, transform: "translateY(0)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="group/resource flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-bg-sunken/60"
    >
      <ResourceGlyph row={row} downloadUrl={downloadUrl} />
      <a
        href={href}
        {...(isExternal
          ? { target: "_blank", rel: "noreferrer" }
          : { download: row.title })}
        className="min-w-0 flex-1"
      >
        <div className="truncate text-[12.5px] font-medium leading-tight text-ink">
          {row.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums text-ink-quiet">
          <span className="rounded px-1 py-px text-[9.5px] font-medium uppercase tracking-wide text-ink-faint ring-1 ring-line">
            {providerLabel(row.provider)}
          </span>
          {row.sizeBytes != null ? (
            <>
              <span aria-hidden>·</span>
              <span>{formatBytes(row.sizeBytes)}</span>
            </>
          ) : null}
          {row.addedByUserId ? (
            <>
              <span aria-hidden>·</span>
              <Avatar user={row.addedByUserId} size={12} />
            </>
          ) : null}
          <span title={new Date(row.addedAt * 1000).toLocaleString()}>
            {formatRelativeTime(new Date(row.addedAt * 1000))}
          </span>
        </div>
      </a>
      <Popover
        align="end"
        width={200}
        aria-label="Confirm remove resource"
        trigger={({ onClick, "aria-expanded": expanded, ref }) => (
          <button
            type="button"
            ref={ref}
            onClick={onClick}
            aria-expanded={expanded}
            aria-label={`Remove ${row.title}`}
            className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-bg-sunken hover:text-ink-soft group-hover/resource:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
          >
            <TrashGlyph />
          </button>
        )}
      >
        {(close) => (
          <div className="flex flex-col gap-1.5 p-1.5">
            <p className="px-1.5 pt-1 text-[12px] leading-snug text-ink-soft">
              Remove this resource?
            </p>
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-quiet transition-colors hover:bg-bg-sunken hover:text-ink-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  close();
                  onRemove();
                }}
                className="rounded-md bg-ink px-2 py-1 text-[11.5px] font-medium text-white transition-opacity hover:opacity-85"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </Popover>
    </motion.li>
  );
}

function PendingRow({ row }: { row: PendingUploadRow }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.li
      layout="position"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(4px)" }}
      animate={{ opacity: 0.75, transform: "translateY(0)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
      className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5"
    >
      <FileGlyph mimeType={row.mimeType} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium leading-tight text-ink-soft">
          {row.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums text-ink-faint">
          <span>{formatBytes(row.sizeBytes)}</span>
          <span aria-hidden>·</span>
          <span>uploading…</span>
        </div>
      </div>
      <motion.span
        animate={reduceMotion ? { opacity: 0.65 } : { rotate: 360 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: "linear", repeat: Infinity }}
        className="inline-block h-[10px] w-[10px] flex-shrink-0 rounded-full border-2 border-brand/30 border-t-brand"
        aria-label="Uploading"
      />
    </motion.li>
  );
}

// ── Icon helpers ──────────────────────────────────────────────────────

function ResourceGlyph({
  row,
  downloadUrl,
}: {
  row: RealRow;
  downloadUrl: string | null;
}) {
  if (row.resourceKind === "upload") {
    return <FileGlyph mimeType={row.mimeType ?? ""} downloadUrl={downloadUrl ?? undefined} />;
  }
  return (
    <span
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line-soft bg-white text-ink-quiet"
      aria-hidden
    >
      <ExternalLinkGlyph />
    </span>
  );
}

function FileGlyph({
  mimeType,
  downloadUrl,
}: {
  mimeType: string;
  downloadUrl?: string;
}) {
  const category = mimeCategory(mimeType);
  if (category === "image" && downloadUrl) {
    return (
      <span
        className="block h-9 w-9 flex-shrink-0 rounded-md border border-line-soft bg-bg-sunken bg-cover bg-center"
        style={{ backgroundImage: `url(${downloadUrl})` }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line-soft bg-white text-ink-quiet"
      aria-hidden
    >
      <CategoryGlyph category={category} />
    </span>
  );
}

type MimeCategory = "image" | "pdf" | "doc" | "code" | "archive" | "other";

function mimeCategory(mimeType: string): MimeCategory {
  const m = mimeType.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  if (
    m.startsWith("application/zip") ||
    m.includes("compressed") ||
    m === "application/x-tar" ||
    m === "application/x-7z-compressed" ||
    m === "application/gzip"
  ) return "archive";
  if (
    m === "application/msword" ||
    m.includes("wordprocessingml") ||
    m.includes("opendocument.text") ||
    m === "text/plain" ||
    m === "text/markdown" ||
    m === "text/csv" ||
    m.includes("spreadsheet") ||
    m.includes("presentation")
  ) return "doc";
  if (
    m === "application/json" ||
    m === "application/javascript" ||
    m === "application/typescript" ||
    m.startsWith("text/") ||
    m.includes("xml") ||
    m.includes("html")
  ) return "code";
  return "other";
}

const svgBase = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CategoryGlyph({ category }: { category: MimeCategory }) {
  switch (category) {
    case "pdf":
      return (
        <svg {...svgBase}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <polyline points="14 3 14 8 19 8" />
          <text x="8" y="17" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">PDF</text>
        </svg>
      );
    case "doc":
      return (
        <svg {...svgBase}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <polyline points="14 3 14 8 19 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      );
    case "code":
      return (
        <svg {...svgBase}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "archive":
      return (
        <svg {...svgBase}>
          <rect x="3" y="3" width="18" height="4" rx="1" />
          <path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
          <line x1="12" y1="11" x2="12" y2="17" />
        </svg>
      );
    case "image":
      return (
        <svg {...svgBase}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      );
    default:
      return (
        <svg {...svgBase}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <polyline points="14 3 14 8 19 8" />
        </svg>
      );
  }
}

function ExternalLinkGlyph() {
  return (
    <svg {...svgBase}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function PaperclipGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-shrink-0 text-ink-faint"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

// ── Utility helpers ───────────────────────────────────────────────────

function providerLabel(provider: string): string {
  switch (provider) {
    case "google_doc": return "Doc";
    case "google_sheet": return "Sheet";
    case "google_slides": return "Slides";
    case "drive": return "Drive";
    case "figma": return "Figma";
    case "github": return "GitHub";
    case "file": return "File";
    case "url": return "Link";
    default: return provider;
  }
}

function hasFiles(e: DragEvent<HTMLDivElement>): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "Files") return true;
  }
  return false;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${roundOne(kb)} KB`;
  const mb = kb / 1024;
  return `${roundOne(mb)} MB`;
}

function roundOne(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
