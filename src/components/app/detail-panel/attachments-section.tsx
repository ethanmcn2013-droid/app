"use client";

import { motion, AnimatePresence } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import type { Attachment, Task } from "@/lib/data";
import { useCurrentUser } from "@/lib/auth-context";
import { Avatar } from "@/components/showcase/avatar";
import { useToast } from "@/components/primitives/toast";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  deleteAttachmentAction,
  listAttachmentsForTaskAction,
  uploadAttachmentAction,
} from "@/server/actions/attachments";
import { Popover } from "./popover";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Attachments section in the task detail panel. Drag-and-drop over
 * the section uploads the dropped files; the explicit "Attach" button
 * triggers a hidden multi-file picker so keyboard users hit the same
 * path. Each pending file inserts an optimistic row immediately and
 * is reconciled (or removed + toasted) when the server resolves.
 *
 * Bytes never round-trip through this component on the read path —
 * the rendered rows link out to `/api/attachments/[id]` and the
 * route streams from disk after re-checking the workspace.
 */
export function AttachmentsSection({ task }: { task: Task }) {
  const me = useCurrentUser();
  const { toast } = useToast();
  const [items, setItems] = useState<AttachmentRow[] | null>(null);
  const [, startTransition] = useTransition();
  const [dragDepth, setDragDepth] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const refreshKey = task.updatedAt?.getTime();

  // Load on mount + whenever the parent task's updatedAt flips
  // (server-side reconciliation after upload / delete).
  useEffect(() => {
    let ignore = false;
    listAttachmentsForTaskAction(task.id)
      .then((rows) => {
        if (!ignore) setItems(rows.map(toRealRow));
      })
      .catch((err) => {
        if (!ignore) {
          console.warn("attachments: fetch failed", err);
          setItems([]);
        }
      });
    return () => {
      ignore = true;
    };
  }, [task.id, refreshKey]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      for (const file of list) {
        if (file.size > MAX_BYTES) {
          toast(`${file.name} is over 25 MB`, {
            tone: "warn",
            body: "Trim it down or share a link instead.",
          });
          continue;
        }

        const tempId = `temp-${Math.random().toString(36).slice(2, 8)}`;
        const placeholder: AttachmentRow = {
          kind: "pending",
          tempId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          uploaderUserId: me,
          createdAt: new Date(),
        };
        setItems((cur) => (cur ? [...cur, placeholder] : [placeholder]));

        const fd = new FormData();
        fd.append("file", file);

        startTransition(async () => {
          try {
            const real = await uploadAttachmentAction(task.id, fd);
            setItems((cur) => {
              if (!cur) return [toRealRow(real)];
              return cur.map((row) =>
                row.kind === "pending" && row.tempId === tempId
                  ? toRealRow(real)
                  : row,
              );
            });
          } catch (err) {
            console.warn("attachments: upload failed; rolling back", err);
            setItems((cur) =>
              cur
                ? cur.filter(
                    (row) => !(row.kind === "pending" && row.tempId === tempId),
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

  const remove = useCallback(
    (att: RealRow) => {
      setItems((cur) => (cur ? cur.filter((r) => r !== att) : cur));
      startTransition(async () => {
        try {
          await deleteAttachmentAction(att.id);
        } catch (err) {
          console.warn("attachments: delete failed", err);
          toast(`Couldn't remove ${att.filename}`, { tone: "error" });
          // Reinsert at original position is more trouble than it's
          // worth; refetch will catch the row on next refresh.
        }
      });
    },
    [toast],
  );

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

  // Defer rendering until the first read resolves, flashing an
  // empty state would lie about the row count.
  if (items === null) return null;

  const dragging = dragDepth > 0;
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
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-quiet">
          Attachments
        </span>
        <div className="flex items-baseline gap-3">
          {total > 0 ? (
            <span className="text-[10.5px] tabular-nums text-ink-quiet">
              {total} {total === 1 ? "file" : "files"}
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

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        aria-label="Files to attach"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          // Reset so picking the same file twice still fires `change`.
          e.target.value = "";
        }}
      />

      {total === 0 ? (
        <EmptyState dragging={dragging} />
      ) : (
        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {items.map((row) =>
              row.kind === "real" ? (
                <RealAttachmentRow
                  key={row.id}
                  row={row}
                  onRemove={() => remove(row)}
                />
              ) : (
                <PendingAttachmentRow key={row.tempId} row={row} />
              ),
            )}
          </AnimatePresence>
        </ul>
      )}

      <AnimatePresence>
        {dragging ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border border-dashed border-ink-soft/40 bg-white/80 text-[12px] font-medium text-ink-soft backdrop-blur-sm"
          >
            Drop to attach
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Row state types, local to this component
// ────────────────────────────────────────────────────────────────────

type RealRow = {
  kind: "real";
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploaderUserId: import("@/lib/data").UserId;
  createdAt: Date;
};

type PendingRow = {
  kind: "pending";
  tempId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploaderUserId: import("@/lib/data").UserId;
  createdAt: Date;
};

type AttachmentRow = RealRow | PendingRow;

function toRealRow(
  att: Pick<
    Attachment,
    "id" | "uploaderUserId" | "filename" | "mimeType" | "sizeBytes" | "createdAt"
  >,
): RealRow {
  return {
    kind: "real",
    id: att.id,
    filename: att.filename,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
    uploaderUserId: att.uploaderUserId,
    createdAt: att.createdAt,
  };
}

function hasFiles(e: DragEvent<HTMLDivElement>): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "Files") return true;
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────
// Rows
// ────────────────────────────────────────────────────────────────────

function RealAttachmentRow({
  row,
  onRemove,
}: {
  row: RealRow;
  onRemove: () => void;
}) {
  const downloadUrl = `/api/attachments/${row.id}`;
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="group/attachment flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-bg-sunken/60"
    >
      <FileGlyph mimeType={row.mimeType} downloadUrl={downloadUrl} />
      <a
        href={downloadUrl}
        download={row.filename}
        className="min-w-0 flex-1"
      >
        <div className="truncate text-[12.5px] font-medium leading-tight text-ink">
          {row.filename}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums text-ink-quiet">
          <span>{formatBytes(row.sizeBytes)}</span>
          <span aria-hidden>·</span>
          <Avatar user={row.uploaderUserId} size={12} />
          <span title={row.createdAt.toLocaleString()}>
            {formatRelativeTime(row.createdAt)}
          </span>
        </div>
      </a>
      <a
        href={downloadUrl}
        download={row.filename}
        aria-label={`Download ${row.filename}`}
        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-bg-sunken hover:text-ink-soft group-hover/attachment:opacity-100 focus-visible:opacity-100"
      >
        <DownloadGlyph />
      </a>
      <Popover
        align="end"
        width={200}
        aria-label="Confirm delete attachment"
        trigger={({ onClick, "aria-expanded": expanded, ref }) => (
          <button
            type="button"
            ref={ref}
            onClick={onClick}
            aria-expanded={expanded}
            aria-label={`Remove ${row.filename}`}
            className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-bg-sunken hover:text-ink-soft group-hover/attachment:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
          >
            <TrashGlyph />
          </button>
        )}
      >
        {(close) => (
          <div className="flex flex-col gap-1.5 p-1.5">
            <p className="px-1.5 pt-1 text-[12px] leading-snug text-ink-soft">
              Remove this attachment?
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

function PendingAttachmentRow({ row }: { row: PendingRow }) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 0.75, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5"
    >
      <FileGlyph mimeType={row.mimeType} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium leading-tight text-ink-soft">
          {row.filename}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums text-ink-faint">
          <span>{formatBytes(row.sizeBytes)}</span>
          <span aria-hidden>·</span>
          <span>uploading…</span>
        </div>
      </div>
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
        className="inline-block h-[10px] w-[10px] flex-shrink-0 rounded-full border-2 border-brand/30 border-t-brand"
        aria-label="Uploading"
      />
    </motion.li>
  );
}

function EmptyState({ dragging }: { dragging: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-line px-3 py-3 text-[12px] leading-snug transition-colors",
        dragging
          ? "border-ink-soft/40 text-ink-soft"
          : "text-ink-quiet",
      )}
    >
      Drop files to attach. Up to 25 MB each.
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// File icon, branches on mime category. Image rows render the
// thumbnail fetched through the authenticated route.
// ────────────────────────────────────────────────────────────────────

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
      className={cn(
        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line-soft bg-white text-ink-quiet",
      )}
      aria-hidden
    >
      <CategoryGlyph category={category} />
    </span>
  );
}

type MimeCategory =
  | "image"
  | "pdf"
  | "doc"
  | "code"
  | "archive"
  | "other";

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
  ) {
    return "archive";
  }
  if (
    m === "application/msword" ||
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    m === "application/vnd.oasis.opendocument.text" ||
    m === "text/plain" ||
    m === "text/markdown" ||
    m === "text/csv" ||
    m.includes("spreadsheet") ||
    m.includes("presentation")
  ) {
    return "doc";
  }
  if (
    m === "application/json" ||
    m === "application/javascript" ||
    m === "application/typescript" ||
    m.startsWith("text/") ||
    m.includes("xml") ||
    m.includes("html")
  ) {
    return "code";
  }
  return "other";
}

function CategoryGlyph({ category }: { category: MimeCategory }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (category) {
    case "pdf":
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <polyline points="14 3 14 8 19 8" />
          <text x="8" y="17" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">
            PDF
          </text>
        </svg>
      );
    case "doc":
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <polyline points="14 3 14 8 19 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "archive":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="4" rx="1" />
          <path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
          <line x1="12" y1="11" x2="12" y2="17" />
        </svg>
      );
    case "image":
      // Only used as a fallback when downloadUrl is missing.
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      );
    case "other":
    default:
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <polyline points="14 3 14 8 19 8" />
        </svg>
      );
  }
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

function DownloadGlyph() {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

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
