"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemoLinks } from "../../demo/links";
import { noteTask, nudgeTask, undo as undoStore, useDemoStore } from "../../demo/store/client";
import { PageHeader, ProjectPill } from "../../tasks/header";
import { useModKeys } from "../../tasks/keys";
import {
  FEATURED,
  FILES,
  PROJECTS,
  SUGGESTIONS,
  approvalAsks,
  askNote,
  liveFiles,
  type FileItem,
  type PersonId,
} from "./data";
import {
  completions,
  correct,
  groupHits,
  isStatusQuestion,
  makeQuery,
  missingTerms,
  nearMiss,
  parse,
  PILL_NAMES,
  pillLabel,
  resolve,
  samePill,
  search,
  tokenFor,
  type Pill,
  type PillKey,
} from "./engine";
import {
  AnswerCard,
  FirstRun,
  NoResults,
  StatusCard,
  type Actions,
} from "./cards";
import { buildFacets, Groups, Narrow } from "./results";
import { Home, Suggestions } from "./home";
import { Preview } from "./preview";
import { Avatar, Icon, Kbd, personName, useMod } from "./parts";
import s from "./ask.module.css";

type ToastIcon = "check" | "link" | "pin" | "spark";

type Collection = {
  id: string;
  name: string;
  text: string;
  pills: Pill[];
  mine?: boolean;
};

const START: Collection[] = [
  {
    id: "c-mara",
    name: "Everything Mara approved",
    text: "",
    pills: [
      { key: "person", value: "mara" },
      { key: "state", value: "approved" },
    ],
  },
  {
    id: "c-wait",
    name: "Waiting for approval",
    text: "",
    pills: [{ key: "state", value: "awaiting" }],
  },
];

const RECENT = [
  "w-seat-4",
  "w-marquee-3",
  "l-plan",
  "r-heating",
  "w-coach",
  "w-bar",
];
const OCR: Pill = { key: "has", value: "ocr" };
function sameQuery(c: Collection, text: string, pills: Pill[]) {
  return (
    c.text.trim().toLowerCase() === text.trim().toLowerCase() &&
    c.pills.length === pills.length &&
    c.pills.every((p) => pills.some((x) => samePill(p, x)))
  );
}

function suggestName(text: string, pills: Pill[]) {
  const person = pills.find((p) => p.key === "person");
  const approved = pills.some(
    (p) => p.key === "state" && p.value === "approved",
  );
  const words = text.trim().replace(/\?$/, "");
  if (person && approved && !words)
    return `Everything ${pillLabel(person)} approved`;
  const head = words ? words.charAt(0).toUpperCase() + words.slice(1) : "Files";
  const rest = pills
    .filter((p) => p !== person && p.key !== "has")
    .map((p) => pillLabel(p).toLowerCase())
    .join(", ");
  return [
    head,
    person ? `from ${pillLabel(person)}` : "",
    rest ? `(${rest})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function AskTheFiles() {
  const [text, setText] = useState("");
  const [pills, setPills] = useState<Pill[]>([]);
  const [selIdx, setSelIdx] = useState(0);
  /** False until the person moves the selection themselves. Two readings start with nothing chosen. */
  const [moved, setMoved] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [collections, setCollections] = useState<Collection[]>(START);
  const [saving, setSaving] = useState<string | null>(null);
  const [shared, setShared] = useState<Set<string>>(() => new Set());
  const [asked, setAsked] = useState<Set<string>>(() => new Set());
  const [bumped, setBumped] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [compIdx, setCompIdx] = useState(0);
  /** What happened, with the way back when there is one: "Pinned. Undo". */
  const [toast, setToast] = useState<{
    id: number;
    text: string;
    icon: ToastIcon;
    undo?: () => void;
  } | null>(null);
  /** Search exactly what was typed, even when it looks like a typo. */
  const [exact, setExact] = useState(false);
  /** Search the words of a progress question anyway. */
  const [wordsOnly, setWordsOnly] = useState(false);

  const reduce = useReducedMotion();
  const mod = useMod();
  const keys = useModKeys();
  const router = useRouter();
  const params = useSearchParams();
  const to = useDemoLinks();
  const state = useDemoStore((x) => x);
  const inputRef = useRef<HTMLInputElement>(null);
  const narrowRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // The files as the live store has them: a task renamed or an approval
  // finished on Tasks shows here too.
  const live = useMemo(() => liveFiles(FILES, state), [state]);
  // Narrowed to a project that has no files yet (in:ada-theo): the page is that project's first run.
  const emptyProject =
    pills.length === 1 && pills[0].key === "project" && !text.trim() && !live.some((f) => f.project === pills[0].value)
      ? (PROJECTS.find((p) => p.id === pills[0].value) ?? null)
      : null;
  const scenario: "live" | "first" = emptyProject ? "first" : "live";
  const files: FileItem[] = useMemo(() => (scenario === "first" ? [] : live), [scenario, live]);
  /** Shares made here, plus approval asks the store has recorded today (they survive a reload and undo). */
  const sharedAll = useMemo(() => {
    const out = new Set(shared);
    for (const k of approvalAsks(live, state)) out.add(k);
    return out;
  }, [shared, live, state]);
  const ocr = pills.some((p) => p.key === "has");
  const typed = useMemo(() => makeQuery(text, pills), [text, pills]);
  // A word that matches nothing and sits one letter from a word in the files is
  // a typo: search the fix straight away, and offer the original back.
  const fixed = useMemo(() => {
    if (exact || typed.terms.length === 0 || isStatusQuestion(typed.text))
      return null;
    if (search(files, typed, { ocr }).length > 0) return null;
    const next = correct(files, typed);
    if (!next) return null;
    const fq = makeQuery(next, pills);
    return search(files, fq, { ocr }).length > 0 ? fq : null;
  }, [exact, typed, files, pills, ocr]);
  const q = fixed ?? typed;
  const active = q.terms.length > 0 || pills.length > 0;
  const hits = useMemo(() => search(files, q, { ocr }), [files, q, ocr]);
  const resolved = useMemo(
    () => resolve(files, q, hits, picked, state),
    [files, q, hits, picked, state],
  );
  const res =
    wordsOnly && resolved.kind === "status"
      ? resolve(
          files,
          { ...q, text: q.terms.join(" "), question: false },
          hits,
          picked,
          state,
        )
      : resolved;
  const status = res.kind === "status" ? res : null;
  const cardFile =
    res.kind === "answer"
      ? res.file
      : res.kind === "passage"
        ? res.hit.file
        : res.kind === "locked"
          ? res.file
          : null;
  // The answer's own file is already on screen: the list shows everything else.
  const groups = useMemo(() => {
    // A progress question gets no keyword list: it would answer a different question.
    if (status) return [];
    const rest = cardFile
      ? hits.filter((h) => h.file.id !== cardFile.id)
      : hits;
    const out = groupHits(files, rest, q);
    // A question nothing answers: say plainly what the list is, never "Best match".
    if (!cardFile && q.question && q.terms.length)
      return out.map((g) =>
        g.id === "best" || g.id === "also"
          ? {
              ...g,
              title:
                g.id === "best"
                  ? `Files that mention “${q.terms.join(" ")}”`
                  : "Mention some of it",
            }
          : g,
      );
    if (!cardFile) return out;
    // With an answer above, "best" and "also" are one list: everything else that mentions it.
    const current = out.filter((g) => g.id !== "older");
    const older = out.filter((g) => g.id === "older");
    const merged = current.flatMap((g) => g.hits);
    return [
      ...(merged.length
        ? [
            {
              id: "best",
              title: `Also mentions “${q.terms.join(" ")}”`,
              hits: merged,
            },
          ]
        : []),
      ...older,
    ];
  }, [files, hits, q, cardFile, status]);
  const lead = res.kind === "ambiguous" ? 2 : cardFile || status ? 1 : 0;
  const flat = useMemo(() => {
    const ids: string[] = [];
    if (res.kind === "ambiguous") ids.push("amb:0", "amb:1");
    else if (res.kind === "status") ids.push("status");
    else if (cardFile) ids.push(cardFile.id);
    for (const g of groups) for (const h of g.hits) ids.push(h.file.id);
    return ids;
  }, [res.kind, cardFile, groups]);
  const selected =
    res.kind === "ambiguous" && !moved
      ? -1
      : Math.max(0, Math.min(selIdx, flat.length - 1));

  const facets = useMemo(
    () =>
      buildFacets((key: PillKey) =>
        search(
          files,
          makeQuery(
            text,
            pills.filter((p) => p.key !== key),
          ),
          { ocr },
        ),
      ),
    [files, text, pills, ocr],
  );
  const ocrExtra = useMemo(
    () =>
      active && !ocr ? search(files, q, { ocr: true }).length - hits.length : 0,
    [active, ocr, files, q, hits.length],
  );

  const countOf = useCallback(
    (t: string, ps: Pill[]) =>
      search(files, makeQuery(t, ps), { ocr: false }).length,
    [files],
  );
  const suggestionCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of SUGGESTIONS)
      out[c.id] = countOf("", parse(c.token, true).pills);
    return out;
  }, [countOf]);

  // Home leads with one question, already answered from the files.
  const featureQ = useMemo(() => makeQuery(FEATURED, []), []);
  const featureRes = useMemo(() => {
    const r = resolve(
      files,
      featureQ,
      search(files, featureQ, { ocr: false }),
      {},
      state,
    );
    return r.kind === "none" || r.kind === "status" ? null : r;
  }, [files, featureQ, state]);

  const lastWord = /\s$/.test(text) ? "" : (text.split(/\s+/).pop() ?? "");
  const comps = focused ? completions(lastWord) : [];
  const compSel = Math.min(compIdx, Math.max(0, comps.length - 1));
  const activeCollection =
    collections.find((c) => sameQuery(c, text, pills)) ?? null;
  const total = files.filter((f) => !f.lockedIn).length;
  // The projects that have at least one file, which is what the header's count says.
  const projectCount = new Set(files.map((f) => f.project)).size;

  /* ── toasts ─────────────────────────────────────────────────── */

  const say = useCallback(
    (t: string, icon: ToastIcon = "check", undo?: () => void) => {
      window.clearTimeout(toastTimer.current);
      setToast({ id: Date.now(), text: t, icon, undo });
      toastTimer.current = window.setTimeout(() => setToast(null), undo ? 6000 : 3600);
    },
    [],
  );
  /** Take back the last thing a toast offered to undo. Returns false when there is nothing to take back. */
  const undoToast = useCallback(() => {
    if (!toast?.undo) return false;
    toast.undo();
    say("Undone.");
    return true;
  }, [toast, say]);

  /* Ctrl K hands a question here as /demo/files?q=…: answer it on arrival. */
  const asked0 = params.get("q");
  const lastAsked = useRef<string | null>(null);
  useEffect(() => {
    if (!asked0 || asked0 === lastAsked.current) return;
    lastAsked.current = asked0;
    const parsed = parse(asked0, true);
    setText(parsed.text);
    setPills(parsed.pills);
    setSelIdx(0);
    setMoved(false);
    setExact(false);
    setWordsOnly(false);
  }, [asked0]);

  /* ── query editing ──────────────────────────────────────────── */

  const setQuery = useCallback((nextText: string, nextPills: Pill[]) => {
    setText(nextText);
    setPills(nextPills);
    setSelIdx(0);
    setMoved(false);
    setCompIdx(0);
    setSaving(null);
    setExact(false);
    setWordsOnly(false);
  }, []);

  const addPills = (base: Pill[], add: Pill[]) => {
    const out = [...base];
    for (const p of add) if (!out.some((x) => samePill(x, p))) out.push(p);
    return out;
  };

  const onChange = (value: string) => {
    const parsed = parse(value);
    setQuery(parsed.text, addPills(pills, parsed.pills));
  };

  const run = useCallback(
    (query: string) => {
      const parsed = parse(query, true);
      setQuery(parsed.text, parsed.pills);
      rootRef.current?.scrollTo({ top: 0 });
      inputRef.current?.focus({ preventScroll: true });
    },
    [setQuery],
  );

  const addToken = (token: string) => {
    const parsed = parse(token, true);
    setQuery(text, addPills(pills, parsed.pills));
    rootRef.current?.scrollTo({ top: 0 });
    inputRef.current?.focus({ preventScroll: true });
  };

  const addPill = (p: Pill) => {
    setQuery(text, addPills(pills, [p]));
    inputRef.current?.focus({ preventScroll: true });
  };

  const toggleOcr = () => {
    setQuery(
      text,
      ocr ? pills.filter((p) => p.key !== "has") : [...pills, OCR],
    );
    inputRef.current?.focus({ preventScroll: true });
  };

  const removePill = (p: Pill) => {
    setQuery(
      text,
      pills.filter((x) => !samePill(x, p)),
    );
    inputRef.current?.focus();
  };

  const applyCompletion = (i: number) => {
    const c = comps[i];
    if (!c) return;
    const kept = text.split(/\s+/).slice(0, -1).join(" ");
    setQuery(kept ? `${kept} ` : "", addPills(pills, [c.pill]));
  };

  /* ── actions ────────────────────────────────────────────────── */

  const fileById = useCallback(
    (id: string) => files.find((f) => f.id === id) ?? null,
    [files],
  );

  const open = useCallback((id: string) => setOpenId(id), []);

  const copy = useCallback(
    (id: string) => {
      const f = fileById(id);
      if (!f) return;
      try {
        void navigator.clipboard
          ?.writeText(`https://app.signalstudio.ie/app/files/${id}`)
          .catch(() => undefined);
      } catch {
        /* clipboard unavailable: the toast still confirms the intent */
      }
      say(`Link copied to ${f.name}.`, "link");
    },
    [fileById, say],
  );

  const share = useCallback(
    (id: string, to: PersonId) => {
      const key = `${id}:${to}`;
      setShared((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      if (!shared.has(key))
        say(`Shared with ${personName(to)}. It's in their Inbox with the passage lit.`, "check", () =>
          setShared((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          }),
        );
    },
    [say, shared],
  );

  /*
   * Asking for an approval is a store event on the file's task, so Tasks and
   * Projects see it too: a nudge when the task is waiting on that person (the
   * seating plan waits on Mara), otherwise a note in the task's history.
   */
  const nudge = useCallback(
    (id: string, to: PersonId) => {
      const f = fileById(id);
      const key = `${id}:approve`;
      if (!f || sharedAll.has(key)) return;
      const task = f.taskId ? state.tasks.find((t) => t.id === f.taskId) : undefined;
      const note = askNote(personName(to), f);
      if (task && task.status === "waiting" && task.waitingOn?.who === to) nudgeTask(task.id, note);
      else if (task) noteTask(task.id, note);
      else setShared((prev) => new Set(prev).add(key));
      // With a task, the ask is one step on the shared undo stack; without one it only lives here.
      say(`Asked ${personName(to)} to approve ${f.name}. It's in their Inbox.`, "check", () => {
        if (task) undoStore();
        else
          setShared((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
      });
    },
    [fileById, say, sharedAll, state],
  );

  const ask = useCallback(
    (id: string) => {
      const f = fileById(id);
      if (!f?.lockedIn || asked.has(id)) return;
      setAsked((prev) => new Set(prev).add(id));
      say(`Asked ${personName(f.lockedIn)} for access to ${f.name}.`, "check", () =>
        setAsked((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
      );
    },
    [asked, fileById, say],
  );

  const pick = (amb: string, i: number) => {
    setPicked((prev) => ({ ...prev, [amb]: i }));
    setSelIdx(0);
    setMoved(true);
  };

  const act: Actions = { open, copy, share, nudge, ask, pick, run };

  const startSave = () => setSaving(suggestName(text, pills));
  const confirmSave = () => {
    const name = (saving ?? "").trim() || suggestName(text, pills);
    const id = `c-${Date.now()}`;
    setCollections((prev) => [
      ...prev,
      { id, name, text: text.trim(), pills, mine: true },
    ]);
    setSaving(null);
    setBumped(id);
    window.setTimeout(() => setBumped(null), 2400);
    say(`Pinned “${name}”. It keeps counting as files arrive.`, "pin", () =>
      setCollections((prev) => prev.filter((c) => c.id !== id)),
    );
  };
  const unpin = (id: string) => {
    const at = collections.findIndex((c) => c.id === id);
    const was = collections[at];
    if (!was) return;
    setCollections((prev) => prev.filter((c) => c.id !== id));
    say(`Unpinned “${was.name}”.`, "pin", () =>
      setCollections((prev) => (prev.some((c) => c.id === id) ? prev : [...prev.slice(0, at), was, ...prev.slice(at)])),
    );
  };
  const openPin = (id: string) => {
    const c = collections.find((x) => x.id === id);
    if (!c) return;
    run([c.text, ...c.pills.map(tokenFor)].filter(Boolean).join(" "));
  };

  /* ── keyboard ───────────────────────────────────────────────── */

  const analyticsHref = to.surface("analytics", undefined, {
    q: typed.text,
    project: status?.project ?? undefined,
  });

  const scrollSel = () =>
    window.requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector('[aria-selected="true"], [data-selected]')
        ?.scrollIntoView({
          block: "nearest",
          behavior: reduce ? "auto" : "smooth",
        }),
    );

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const modKey = e.metaKey || e.ctrlKey;
    if (comps.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setCompIdx(
          (compSel + (e.key === "ArrowDown" ? 1 : comps.length - 1)) %
            comps.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyCompletion(compSel);
        return;
      }
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!active || flat.length === 0) return;
      e.preventDefault();
      const from = selected < 0 ? (e.key === "ArrowDown" ? -1 : 1) : selected;
      setSelIdx(
        Math.max(
          0,
          Math.min(flat.length - 1, from + (e.key === "ArrowDown" ? 1 : -1)),
        ),
      );
      setMoved(true);
      scrollSel();
      return;
    }
    if (e.key === "Enter") {
      if (!active) {
        if (text.trim()) run(text);
        return;
      }
      e.preventDefault();
      const id = selected >= 0 ? flat[selected] : undefined;
      if (!id) return;
      if (id.startsWith("amb:") && res.kind === "ambiguous") {
        pick(res.amb.id, Number(id.slice(4)));
        return;
      }
      if (id === "status") {
        router.push(analyticsHref);
        return;
      }
      if (modKey) copy(id);
      else open(id);
      return;
    }
    if (e.key.toLowerCase() === "s" && modKey && active) {
      e.preventDefault();
      startSave();
      return;
    }
    if (e.key === "Tab" && !e.shiftKey && active && narrowRef.current) {
      e.preventDefault();
      narrowRef.current.focus();
      return;
    }
    if (
      e.key === "Backspace" &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0 &&
      pills.length
    ) {
      e.preventDefault();
      const last = pills[pills.length - 1];
      setQuery(tokenFor(last) + (text ? ` ${text}` : ""), pills.slice(0, -1));
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (active || text) setQuery("", []);
      else e.currentTarget.blur();
    }
  };

  useEffect(() => {
    const onGlobal = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      // "/" always means "search this page".
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      // Ctrl or ⌘ Z takes back what the toast offers. In a field with words in it, it stays the field's own undo.
      const field = typing ? (target as HTMLInputElement).value : "";
      if (e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey && !field) {
        if (undoToast()) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onGlobal);
    return () => window.removeEventListener("keydown", onGlobal);
  }, [undoToast]);

  /* ── render ─────────────────────────────────────────────────── */

  const openFile = openId ? fileById(openId) : null;
  const cardAnswer =
    res.kind === "answer" && cardFile?.id === openId ? res.answer : null;
  const featureAnswer =
    !active && featureRes?.kind === "answer" && featureRes.file.id === openId
      ? featureRes.answer
      : null;
  const openAnswer = cardAnswer ?? featureAnswer;
  const openPara = openFile
    ? openAnswer
      ? openAnswer.passage
      : (hits.find((h) => h.file.id === openFile.id)?.para ?? -1)
    : -1;
  // Opened from an answer: only the answering value glows, as on the card.
  const openMarks = openAnswer ? openAnswer.marks : q.terms;
  const noResults = active && hits.length === 0 && res.kind === "none";
  const recent = RECENT.map((id) => fileById(id)).filter(Boolean) as FileItem[];
  const sweepKey = `${q.terms.join(" ")}|${pills.map(tokenFor).join(" ")}`;
  const others = status ? 0 : hits.length - (cardFile ? 1 : 0);

  // Nothing found: say which words nothing mentions, and only offer what would change the result.
  const empty = useMemo(() => {
    if (!noResults) return null;
    const missing = missingTerms(files, q);
    const partial = q.terms
      .filter((t) => !missing.includes(t))
      .flatMap((t) => {
        const top = search(files, makeQuery(t, pills), { ocr })[0];
        return top ? [{ file: top.file, term: t, para: Math.max(0, top.para) }] : [];
      })
      .filter((x, i, all) => all.findIndex((y) => y.file.id === x.file.id) === i)
      .slice(0, 2);
    const unfiltered = pills.some((p) => p.key !== "has")
      ? search(files, makeQuery(q.text, pills.filter((p) => p.key === "has")), { ocr }).length
      : 0;
    return { missing, partial, unfiltered };
  }, [noResults, files, q, pills, ocr]);

  const pinRows = collections.map((c) => ({
    id: c.id,
    name: c.name,
    count: countOf(c.text, c.pills),
    fresh: 0,
    on: activeCollection?.id === c.id,
  }));

  return (
    <div className={`${s.root} ${active ? s.rootActive : ""}`} ref={rootRef}>
      <div className={s.headBand}>
        <PageHeader
          title="Files"
          project={
            scenario === "first" ? (
              <ProjectPill
                name={emptyProject?.name ?? ""}
                kind="New project"
                tone={emptyProject?.tone ?? "var(--v3-text-3)"}
              />
            ) : (
              <ProjectPill
                name="All projects"
                kind="The Orchard"
                tone="var(--v3-text-3)"
              />
            )
          }
          summary={
            <p className={s.summary}>
              {scenario === "first" ? (
                <span>No files yet</span>
              ) : (
                <span>
                  <strong>{total}</strong> {total === 1 ? "file" : "files"} across{" "}
                  <strong>{projectCount}</strong> {projectCount === 1 ? "project" : "projects"} with files
                </span>
              )}
            </p>
          }
        />
      </div>

      <div className={s.top}>
        <div className={s.dock}>
          <div
            className={`${s.field} ${focused ? s.fieldFocus : ""}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                inputRef.current?.focus();
              }
            }}
          >
            <Icon
              name="search"
              size={active ? 18 : 20}
              className={s.fieldIcon}
            />
            <div className={s.fieldTokens}>
              {pills.map((p) => (
                <span
                  key={`${p.key}:${p.value}`}
                  className={s.pill}
                  data-key={p.key}
                >
                  {p.key === "person" ? (
                    <Avatar id={p.value as PersonId} size={16} />
                  ) : null}
                  {p.key === "has" ? <Icon name="image" size={13} /> : null}
                  <span className={s.pillKey}>{PILL_NAMES[p.key]}</span>
                  <span className={s.pillVal}>{pillLabel(p)}</span>
                  <button
                    type="button"
                    className={s.pillX}
                    onClick={() => removePill(p)}
                    aria-label={`Remove ${PILL_NAMES[p.key]}: ${pillLabel(p)}`}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                className={s.input}
                value={text}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKey}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={
                  pills.length
                    ? "Add words, or keep narrowing"
                    : "Find a file, or ask about one"
                }
                aria-label="Find a file, or ask about one"
                role="combobox"
                aria-expanded={comps.length > 0}
                aria-controls="c5-completions"
                aria-autocomplete="list"
                aria-activedescendant={
                  comps.length ? `c5-comp-${compSel}` : undefined
                }
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {active || text ? (
              <button
                type="button"
                className={s.clear}
                onClick={() => setQuery("", [])}
                aria-label="Clear search"
              >
                <span className={s.hoverOnly}>
                  <Kbd>Esc</Kbd>
                </span>
                <span className={s.touchOnly}>
                  <Icon name="x" size={16} />
                </span>
              </button>
            ) : (
              <span className={`${s.slash} ${s.hoverOnly}`}>
                <Kbd>/</Kbd>
              </span>
            )}
            <span key={sweepKey} className={s.sweep} aria-hidden="true" />
            {comps.length > 0 ? (
              <ul
                id="c5-completions"
                className={s.comps}
                role="listbox"
                aria-label="Filters"
              >
                {comps.map((c, i) => (
                  <li
                    key={c.token}
                    id={`c5-comp-${i}`}
                    role="option"
                    aria-selected={i === compSel}
                    className={`${s.comp} ${i === compSel ? s.compSel : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyCompletion(i);
                    }}
                    onMouseMove={() => setCompIdx(i)}
                  >
                    {c.pill.key === "person" ? (
                      <Avatar id={c.pill.value as PersonId} size={18} />
                    ) : (
                      <span className={s.compDot} />
                    )}
                    <code className={s.compToken}>{c.token}</code>
                    <span className={s.compHint}>{c.hint}</span>
                    {i === compSel ? <Kbd>Tab</Kbd> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {scenario === "live" && !active ? (
            <Suggestions counts={suggestionCounts} onPick={addToken} />
          ) : null}
        </div>
      </div>

      {/* The frame already provides the page's one <main>. */}
      <div className={s.body}>
        {scenario === "first" ? (
          <FirstRun
            name={emptyProject?.name ?? "This project"}
            onBack={() => {
              setQuery("", []);
              inputRef.current?.focus({ preventScroll: true });
            }}
            onDrive={() => say("Google Drive connects from Settings. This sample keeps its files here.", "link")}
          />
        ) : !active ? (
          <Home
              feature={
                featureRes ? (
                  <AnswerCard
                    res={featureRes}
                    q={featureQ}
                    files={files}
                    sel={-1}
                    shared={sharedAll}
                    asked={asked}
                    act={act}
                    total={total}
                    question={FEATURED}
                    onAsk={() => run(FEATURED)}
                  />
                ) : null
              }
              featureQuestion={FEATURED}
              pins={pinRows}
              bumped={bumped}
              onPin={openPin}
              recent={recent}
              onOpen={open}
              onRun={run}
            />
        ) : (
          <div className={s.results}>
            <div className={s.main} aria-live="polite">
              {fixed ? (
                <p className={s.fixLine}>
                  <span>
                    Searched for <strong>{fixed.text}</strong> instead
                  </span>
                  <span className={s.fixSep} aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    className={s.linkBtn}
                    onClick={() => setExact(true)}
                  >
                    Search for {typed.text}
                  </button>
                </p>
              ) : null}
              {status ? (
                <StatusCard
                  question={typed.text}
                  project={status.project}
                  state={state}
                  href={analyticsHref}
                  selected={selected === 0}
                  onWords={() => setWordsOnly(true)}
                />
              ) : res.kind !== "none" && res.kind !== "status" ? (
                <AnswerCard
                  res={res}
                  q={q}
                  files={files}
                  sel={selected}
                  shared={sharedAll}
                  asked={asked}
                  act={act}
                  total={total}
                />
              ) : null}
              {status || noResults || others === 0 ? null : (
                <Narrow
                  facets={facets}
                  pills={pills}
                  total={hits.length}
                  onAdd={addPill}
                  ocr={ocr}
                  ocrExtra={ocrExtra}
                  onOcr={toggleOcr}
                  firstRef={narrowRef}
                  onEscape={() => inputRef.current?.focus()}
                />
              )}
              {status || (others === 0 && cardFile) ? null : noResults ? (
                <NoResults
                  q={q}
                  missing={empty?.missing ?? []}
                  partial={empty?.partial ?? []}
                  unfiltered={empty?.unfiltered ?? 0}
                  near={nearMiss(files, q)}
                  ocrCount={ocrExtra}
                  ocr={ocr}
                  onOcr={toggleOcr}
                  onClearPills={() =>
                    setQuery(
                      text,
                      pills.filter((p) => p.key === "has"),
                    )
                  }
                  act={act}
                />
              ) : (
                <>
                  <div
                    className={`${s.resHead} ${res.kind === "ambiguous" && !moved ? s.resHeadWaiting : ""}`}
                  >
                    <p className={s.resCount}>
                      <strong>{others}</strong>{" "}
                      {cardFile
                        ? others === 1
                          ? "more file"
                          : "more files"
                        : others === 1
                          ? "file"
                          : "files"}
                      {ocr ? (
                        <span className={s.resNote}>
                          {" "}
                          · reading text in images
                        </span>
                      ) : null}
                    </p>
                    {saving !== null ? (
                      <form
                        className={s.saveForm}
                        onSubmit={(e) => {
                          e.preventDefault();
                          confirmSave();
                        }}
                      >
                        <Icon name="pin" size={14} />
                        <input
                          className={s.saveInput}
                          value={saving}
                          onChange={(e) => setSaving(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setSaving(null);
                              inputRef.current?.focus();
                            }
                          }}
                          aria-label="Name this search"
                          autoFocus
                        />
                        <button type="submit" className={s.btnSmPrimary}>
                          Pin
                        </button>
                      </form>
                    ) : activeCollection ? (
                      <span className={s.pinnedNote}>
                        <Icon name="pin" size={13} />
                        Pinned as {activeCollection.name}
                        <button
                          type="button"
                          className={s.linkBtn}
                          onClick={() => unpin(activeCollection.id)}
                        >
                          Unpin
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={s.btnSm}
                        onClick={startSave}
                      >
                        <Icon name="pin" size={14} />
                        Pin this search
                        <span className={s.hoverOnly}>
                          <Kbd>{mod === "⌘" ? "⌘S" : "Ctrl S"}</Kbd>
                        </span>
                      </button>
                    )}
                  </div>
                  <Groups
                    groups={groups}
                    files={files}
                    q={q}
                    selected={selected}
                    offset={lead}
                    onSelect={(pos) => {
                      setSelIdx(pos);
                      setMoved(true);
                    }}
                    onOpen={open}
                    onCopy={copy}
                    ocr={ocr}
                    waiting={res.kind === "ambiguous" && !moved}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {openFile ? (
        <Preview
          file={openFile}
          files={files}
          para={openPara}
          also={openAnswer?.also}
          marks={openMarks}
          soft={openAnswer?.context ?? []}
          onClose={() => {
            setOpenId(null);
            inputRef.current?.focus({ preventScroll: true });
          }}
          act={act}
          asked={asked.has(openFile.id)}
          shared={sharedAll}
          onOpenOther={(id) => setOpenId(id)}
        />
      ) : null}

      {toast ? (
        <div
          key={toast.id}
          className={`${s.toast} ${active ? s.toastAside : ""}`}
          role="status"
        >
          <Icon name={toast.icon} size={15} />
          <span className={s.toastText}>{toast.text}</span>
          {toast.undo ? (
            <button type="button" className={s.toastUndo} onClick={undoToast}>
              Undo
              <kbd className={s.toastKbd} aria-hidden="true">
                {keys.mod === "⌘" ? "⌘Z" : `${keys.mod} Z`}
              </kbd>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
