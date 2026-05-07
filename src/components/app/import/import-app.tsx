"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/primitives/toast";
import {
  CANONICAL_FIELDS,
  MAX_BYTES,
  MAX_ROWS,
  type CanonicalField,
  type ImportRow,
  type ParseResult,
  type SourceId,
  parseCsv,
  rebuildRows,
} from "@/components/app/import/csv-parsers";
import { importCsvAction } from "@/server/actions/import";
import type { LaneId, Priority } from "@/lib/data";

type Step = "upload" | "preview" | "confirm";

const SOURCES: { id: SourceId; label: string; hint: string }[] = [
  { id: "auto", label: "Auto-detect", hint: "Let us guess." },
  { id: "trello", label: "Trello", hint: "Card name, list, labels." },
  { id: "asana", label: "Asana", hint: "Name, section, assignee." },
  { id: "notion", label: "Notion", hint: "Database export." },
];

const FIELD_LABEL: Record<CanonicalField, string> = {
  title: "Title",
  lane: "Lane",
  priority: "Priority",
  due: "Due",
  dueAt: "Due (parsed)",
  assignees: "Assignees",
  tags: "Tags",
};

const LANE_LABEL: Record<LaneId, string> = {
  todo: "To do",
  doing: "Doing",
  review: "Review",
  done: "Done",
};

const STEPS: { id: Step; label: string; n: number }[] = [
  { id: "upload", label: "Upload", n: 1 },
  { id: "preview", label: "Preview", n: 2 },
  { id: "confirm", label: "Confirm", n: 3 },
];

const FADE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export function ImportApp({ workspaceName }: { workspaceName: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [source, setSource] = useState<SourceId>("auto");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<
    Record<CanonicalField, string | null>
  >({
    title: null,
    lane: null,
    priority: null,
    due: null,
    dueAt: null,
    assignees: null,
    tags: null,
  });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  // -- File handling -------------------------------------------------------

  const handleFile = useCallback(
    async (next: File) => {
      setParseError(null);
      if (!next.name.toLowerCase().endsWith(".csv")) {
        setParseError("That's not a CSV. We're picky about extensions.");
        return;
      }
      if (next.size > MAX_BYTES) {
        setParseError(
          `That file is ${(next.size / 1024 / 1024).toFixed(1)} MB. We cap at 5 MB — split it.`,
        );
        return;
      }
      setFile(next);
      setParsing(true);
      try {
        const text = await next.text();
        const result = await parseCsv(text, source);
        setParsed(result);
        setMapping(result.mapping);
        setRows(result.rows);
        // Auto-skip rows that came in totally empty so they don't pollute
        // the "missing title" count later.
        const autoSkip = new Set<number>();
        result.rows.forEach((r, i) => {
          const empty =
            !r.title &&
            r.assignees.length === 0 &&
            r.tags.length === 0 &&
            !r.due;
          if (empty) autoSkip.add(i);
        });
        setSkipped(autoSkip);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Couldn't read that CSV.";
        setParseError(msg);
        setFile(null);
      } finally {
        setParsing(false);
      }
    },
    [source],
  );

  // Re-detect when the user changes the source AFTER an initial parse.
  useEffect(() => {
    if (!file || !parsed) return;
    let cancelled = false;
    (async () => {
      const text = await file.text();
      const result = await parseCsv(text, source);
      if (cancelled) return;
      setParsed(result);
      setMapping(result.mapping);
      setRows(result.rows);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
    // file is stable until reset; source is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // Re-derive rows when the user remaps a column manually.
  function remap(field: CanonicalField, header: string | null) {
    if (!parsed) return;
    const next = { ...mapping, [field]: header };
    setMapping(next);
    setRows(rebuildRows(parsed.raw, next));
  }

  // Counters for the preview eyebrow.
  const counts = useMemo(() => {
    let ready = 0;
    let missing = 0;
    rows.forEach((r, i) => {
      if (skipped.has(i)) return;
      if (!r.title.trim()) missing++;
      else ready++;
    });
    return { ready, missing, skipped: skipped.size, total: rows.length };
  }, [rows, skipped]);

  const tooMany = rows.length > MAX_ROWS;

  function reset() {
    setFile(null);
    setParsed(null);
    setRows([]);
    setSkipped(new Set());
    setParseError(null);
    setStep("upload");
  }

  function toggleSkip(i: number) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function importNow() {
    const payload = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => !skipped.has(i) && r.title.trim().length > 0)
      .map(({ r }) => ({
        title: r.title.trim(),
        lane: r.lane,
        priority: r.priority,
        due: r.due,
        // Date instances cross the action boundary as ISO strings.
        dueAt: r.dueAt ? r.dueAt.toISOString() : undefined,
        assignees: r.assignees,
        tags: r.tags,
      }));
    if (payload.length === 0) {
      toast("Nothing to import", {
        body: "Every row was skipped or missing a title.",
        tone: "warn",
      });
      return;
    }
    startTransition(async () => {
      try {
        const result = await importCsvAction(payload);
        toast(`Imported ${result.inserted} tasks. Go give one a kick.`, {
          tone: "success",
        });
        router.push("/app/board");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Import hit a snag.";
        toast("Import failed", { body: msg, tone: "error" });
      }
    });
  }

  // -- Render --------------------------------------------------------------

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[920px] px-6 py-8">
          <Stepper current={step} />

          <AnimatePresence mode="wait" initial={false}>
            {step === "upload" ? (
              <motion.section key="upload" {...FADE}>
                <UploadStep
                  source={source}
                  onSourceChange={setSource}
                  file={file}
                  parsing={parsing}
                  parsed={parsed}
                  parseError={parseError}
                  onFile={handleFile}
                  onReset={reset}
                  onContinue={() => setStep("preview")}
                  tooMany={tooMany}
                />
              </motion.section>
            ) : null}

            {step === "preview" && parsed ? (
              <motion.section key="preview" {...FADE}>
                <PreviewStep
                  parsed={parsed}
                  mapping={mapping}
                  onRemap={remap}
                  rows={rows}
                  skipped={skipped}
                  onToggleSkip={toggleSkip}
                  counts={counts}
                  onBack={() => setStep("upload")}
                  onContinue={() => setStep("confirm")}
                  tooMany={tooMany}
                />
              </motion.section>
            ) : null}

            {step === "confirm" && parsed ? (
              <motion.section key="confirm" {...FADE}>
                <ConfirmStep
                  workspaceName={workspaceName}
                  counts={counts}
                  source={parsed.source}
                  pending={pending}
                  onBack={() => setStep("preview")}
                  onConfirm={importNow}
                />
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header — anchored to the import flow only; does not touch the shared
// page-header. Mirrors its visual rhythm so the route doesn't feel orphaned.
// ---------------------------------------------------------------------------

function Header() {
  return (
    <div className="border-b border-line-soft bg-bg-elevated/60 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[920px] items-baseline justify-between">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
            Import
          </div>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">
            Bring your tasks in from somewhere else
          </h1>
        </div>
        <div className="hidden text-right text-[12px] text-ink-quiet md:block">
          Trello · Asana · Notion
          <br />
          <span className="text-ink-faint">CSV only · 5 MB cap</span>
        </div>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="mb-8 flex items-center gap-2 text-[12px]">
      {STEPS.map((s, i) => {
        const state =
          i < idx ? "done" : i === idx ? "current" : "future";
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors " +
                (state === "done"
                  ? "bg-brand text-white"
                  : state === "current"
                    ? "bg-ink text-white"
                    : "bg-line-soft text-ink-quiet")
              }
            >
              {state === "done" ? (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                s.n
              )}
            </span>
            <span
              className={
                "font-medium " +
                (state === "future" ? "text-ink-quiet" : "text-ink")
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span
                className={
                  "ml-1 h-px w-10 transition-colors " +
                  (i < idx ? "bg-brand" : "bg-line-soft")
                }
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Upload
// ---------------------------------------------------------------------------

function UploadStep({
  source,
  onSourceChange,
  file,
  parsing,
  parsed,
  parseError,
  onFile,
  onReset,
  onContinue,
  tooMany,
}: {
  source: SourceId;
  onSourceChange: (s: SourceId) => void;
  file: File | null;
  parsing: boolean;
  parsed: ParseResult | null;
  parseError: string | null;
  onFile: (f: File) => void;
  onReset: () => void;
  onContinue: () => void;
  tooMany: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setHovering(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    // Reset so picking the same file twice still fires the change event.
    e.target.value = "";
  }

  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
        Source
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SOURCES.map((s) => {
          const active = source === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSourceChange(s.id)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-all " +
                (active
                  ? "border-brand bg-brand text-white shadow-[0_8px_20px_-10px_rgba(79,70,229,0.45)]"
                  : "border-line bg-bg-elevated text-ink-soft hover:border-ink-soft/30 hover:text-ink")
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <label
        htmlFor="csv-input"
        onDragEnter={(e) => {
          e.preventDefault();
          setHovering(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setHovering(true);
        }}
        onDragLeave={() => setHovering(false)}
        onDrop={onDrop}
        className={
          "mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-bg-elevated/60 px-6 py-12 text-center transition-all " +
          (hovering
            ? "border-brand bg-brand-soft/40"
            : "border-line hover:border-ink-soft/40 hover:bg-bg-elevated")
        }
      >
        <input
          ref={inputRef}
          id="csv-input"
          type="file"
          accept=".csv,text/csv"
          onChange={onPick}
          className="sr-only"
          aria-label="Choose a CSV file"
        />
        <div className="rounded-full border border-line-soft bg-white p-3 shadow-[0_8px_24px_-12px_rgba(20,21,26,0.18)]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-soft"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="mt-3 text-[15px] font-semibold tracking-[-0.005em] text-ink">
          Drop a CSV here, or click to choose
        </div>
        <div className="mt-1 text-[12.5px] text-ink-quiet">
          Up to 5 MB · 500 rows max · we&rsquo;ll figure out the columns
        </div>
      </label>

      <AnimatePresence>
        {parseError ? (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50/70 px-4 py-3 text-[12.5px] text-rose-800"
          >
            {parseError}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {parsing ? (
        <div className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-ink-quiet">
          <span
            className="block h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ background: "var(--brand)" }}
          />
          Reading the file…
        </div>
      ) : null}

      {file && parsed && !parsing ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 rounded-xl border border-line-soft bg-bg-elevated p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold text-ink">
                {file.name}
              </div>
              <div className="mt-0.5 text-[12px] text-ink-quiet">
                {(file.size / 1024).toFixed(1)} KB · {parsed.rows.length} rows ·
                detected as{" "}
                <span className="font-medium text-ink-soft">
                  {parsed.source}
                </span>{" "}
                ({parsed.matchScore}/{CANONICAL_FIELDS.length} fields matched)
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReset}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
              >
                Pick a different file
              </button>
              <button
                type="button"
                disabled={tooMany || parsed.rows.length === 0}
                onClick={onContinue}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Preview
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          {tooMany ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-800">
              {parsed.rows.length} rows is over our {MAX_ROWS} cap. Split into
              batches and run the import twice.
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Preview
// ---------------------------------------------------------------------------

function PreviewStep({
  parsed,
  mapping,
  onRemap,
  rows,
  skipped,
  onToggleSkip,
  counts,
  onBack,
  onContinue,
  tooMany,
}: {
  parsed: ParseResult;
  mapping: Record<CanonicalField, string | null>;
  onRemap: (f: CanonicalField, header: string | null) => void;
  rows: ImportRow[];
  skipped: Set<number>;
  onToggleSkip: (i: number) => void;
  counts: { ready: number; missing: number; skipped: number; total: number };
  onBack: () => void;
  onContinue: () => void;
  tooMany: boolean;
}) {
  const visible = rows.slice(0, 20);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
            Preview
          </div>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-ink">
            First {visible.length} of {rows.length} rows
          </h2>
        </div>
        <div className="text-[12.5px] text-ink-soft">
          <span className="font-semibold text-ink">{counts.ready}</span> ready ·{" "}
          <span className="font-semibold text-ink">{counts.skipped}</span>{" "}
          skipped ·{" "}
          <span className={counts.missing > 0 ? "font-semibold text-rose-700" : ""}>
            {counts.missing}
          </span>{" "}
          missing title
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line-soft bg-bg-elevated">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line-soft bg-bg-sunken/40">
                <th className="px-2 py-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
                  &nbsp;
                </th>
                {CANONICAL_FIELDS.map((f) => (
                  <th
                    key={f}
                    className="px-3 py-2 align-bottom text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet"
                  >
                    <div className="flex flex-col gap-1">
                      <span>{FIELD_LABEL[f]}</span>
                      <ColumnSelect
                        field={f}
                        value={mapping[f]}
                        headers={parsed.headers}
                        onChange={(h) => onRemap(f, h)}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const isSkipped = skipped.has(i);
                const missing = !r.title.trim();
                return (
                  <tr
                    key={i}
                    className={
                      "border-b border-line-soft/70 last:border-0 transition-colors " +
                      (isSkipped
                        ? "bg-bg-sunken/30 text-ink-quiet"
                        : missing
                          ? "bg-rose-50/40"
                          : "hover:bg-bg-sunken/40")
                    }
                  >
                    <td className="px-2 py-2 align-top">
                      <button
                        type="button"
                        aria-label={isSkipped ? "Include this row" : "Skip this row"}
                        onClick={() => onToggleSkip(i)}
                        className={
                          "inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors " +
                          (isSkipped
                            ? "border-line bg-white text-ink-quiet hover:border-ink-soft/30"
                            : "border-line-soft bg-white text-ink-soft hover:border-ink-soft/40")
                        }
                      >
                        {isSkipped ? (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          >
                            <line x1="6" y1="6" x2="18" y2="18" />
                            <line x1="6" y1="18" x2="18" y2="6" />
                          </svg>
                        ) : (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div
                        className={
                          "max-w-[260px] truncate " +
                          (missing ? "text-rose-700" : "text-ink")
                        }
                      >
                        {r.title || (
                          <span className="italic">missing title</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <LaneChip lane={r.lane} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <PriorityChip priority={r.priority} />
                    </td>
                    <td className="px-3 py-2 align-top text-ink-soft">
                      {r.due ?? <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="px-3 py-2 align-top text-ink-soft">
                      {r.dueAt ? (
                        <time
                          dateTime={r.dueAt.toISOString()}
                          className="tabular-nums"
                        >
                          {r.dueAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <PillList items={r.assignees} tone="user" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <PillList items={r.tags} tone="tag" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rows.length > visible.length ? (
        <div className="mt-2 text-[11.5px] text-ink-quiet">
          {rows.length - visible.length} more rows queued — they&rsquo;ll come
          along on import.
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-line bg-white px-4 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
        >
          Back
        </button>
        <button
          type="button"
          disabled={counts.ready === 0 || tooMany}
          onClick={onContinue}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[12.5px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          Looks right
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ColumnSelect({
  field,
  value,
  headers,
  onChange,
}: {
  field: CanonicalField;
  value: string | null;
  headers: string[];
  onChange: (h: string | null) => void;
}) {
  return (
    <select
      aria-label={`Map column for ${FIELD_LABEL[field]}`}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      className="rounded border border-line bg-white px-1.5 py-0.5 text-[10.5px] font-medium normal-case tracking-normal text-ink-soft hover:border-ink-soft/30 focus:border-brand focus:outline-none"
    >
      <option value="">— none —</option>
      {headers.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}

function LaneChip({ lane }: { lane: LaneId }) {
  const palette: Record<LaneId, { bg: string; ink: string }> = {
    todo: { bg: "bg-bg-sunken", ink: "text-ink-soft" },
    doing: { bg: "bg-blue-50", ink: "text-blue-800" },
    review: { bg: "bg-amber-50", ink: "text-amber-800" },
    done: { bg: "bg-emerald-50", ink: "text-emerald-800" },
  };
  const c = palette[lane];
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
        c.bg +
        " " +
        c.ink
      }
    >
      {LANE_LABEL[lane]}
    </span>
  );
}

function PriorityChip({ priority }: { priority: Priority }) {
  const palette: Record<Priority, { ink: string; dot: string }> = {
    p0: { ink: "text-rose-800", dot: "bg-rose-500" },
    p1: { ink: "text-amber-800", dot: "bg-amber-500" },
    p2: { ink: "text-ink-soft", dot: "bg-ink-quiet" },
    p3: { ink: "text-ink-quiet", dot: "bg-line" },
  };
  const c = palette[priority];
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-[11px] font-medium tabular-nums " +
        c.ink
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + c.dot} />
      {priority.toUpperCase()}
    </span>
  );
}

function PillList({
  items,
  tone,
}: {
  items: string[];
  tone: "user" | "tag";
}) {
  if (items.length === 0)
    return <span className="text-ink-faint">—</span>;
  const styles =
    tone === "user"
      ? "border-line-soft bg-white text-ink-soft"
      : "border-brand-soft bg-brand-soft/60 text-brand-deep";
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 3).map((it, i) => (
        <span
          key={`${it}-${i}`}
          className={
            "inline-flex max-w-[120px] items-center truncate rounded-full border px-1.5 py-0.5 text-[10.5px] font-medium " +
            styles
          }
        >
          {tone === "user" ? "@" : ""}
          {it}
        </span>
      ))}
      {items.length > 3 ? (
        <span className="text-[10.5px] text-ink-quiet">
          +{items.length - 3}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Confirm
// ---------------------------------------------------------------------------

function ConfirmStep({
  workspaceName,
  counts,
  source,
  pending,
  onBack,
  onConfirm,
}: {
  workspaceName: string;
  counts: { ready: number; skipped: number; missing: number; total: number };
  source: string;
  pending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-bg-elevated p-7">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
        Final check
      </div>
      <h2 className="mt-2 text-balance text-[22px] font-semibold tracking-[-0.02em] text-ink">
        Importing {counts.ready} tasks into {workspaceName}.
      </h2>
      <p className="mt-2 max-w-[52ch] text-[13.5px] leading-[1.55] text-ink-soft">
        Detected as <span className="font-medium text-ink">{source}</span>.{" "}
        {counts.skipped > 0
          ? `${counts.skipped} skipped on purpose. `
          : ""}
        {counts.missing > 0
          ? `${counts.missing} dropped because they had no title. `
          : ""}
        Comments and activity history don&rsquo;t come along — just the
        tasks themselves.
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-4 text-center">
        <Stat label="Ready" value={counts.ready} tone="ink" />
        <Stat label="Skipped" value={counts.skipped} tone="quiet" />
        <Stat label="No title" value={counts.missing} tone="warn" />
      </dl>

      <div className="mt-7 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="rounded-full border border-line bg-white px-4 py-1.5 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending || counts.ready === 0}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-[13px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(79,70,229,0.55)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? (
            <>
              <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Importing…
            </>
          ) : (
            <>
              Import {counts.ready} tasks
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ink" | "quiet" | "warn";
}) {
  const inkColor =
    tone === "warn"
      ? "text-rose-800"
      : tone === "quiet"
        ? "text-ink-quiet"
        : "text-ink";
  return (
    <div className="rounded-xl border border-line-soft bg-white px-3 py-4">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </dt>
      <dd
        className={
          "mt-1 text-[26px] font-semibold tabular-nums tracking-tight " +
          inkColor
        }
      >
        {value}
      </dd>
    </div>
  );
}
