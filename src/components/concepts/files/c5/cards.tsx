"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useDemoLinks, useSurfaceHref } from "../../demo/links";
import {
  HEALTH_LABEL,
  countsFor,
  projectById,
  workspaceCounts,
  type DemoState,
} from "../../demo/store";
import {
  PEOPLE,
  PROJECTS,
  type FileItem,
  type PersonId,
  type ProjectId,
} from "./data";
import {
  isLatest,
  latestIn,
  pageOf,
  whenInline,
  type Hit,
  type Query,
  type Resolution,
} from "./engine";
import {
  Avatar,
  Glyph,
  Icon,
  Kbd,
  Marked,
  PageThumb,
  ProjectTag,
  Strong,
  personName,
  useMod,
} from "./parts";
import s from "./ask.module.css";

export type Actions = {
  open: (id: string) => void;
  copy: (id: string) => void;
  share: (id: string, to: PersonId) => void;
  /** Waiting on someone's approval: the answer ends in the nudge that moves it. */
  nudge: (id: string, to: PersonId) => void;
  ask: (id: string) => void;
  pick: (amb: string, i: number) => void;
  run: (query: string) => void;
};

type CardProps = {
  res: Exclude<Resolution, { kind: "none" | "status" }>;
  q: Query;
  files: FileItem[];
  /** Keyboard selection: 0 is the card (or the first reading), 1 the second reading, -1 none. */
  sel: number;
  shared: Set<string>;
  asked: Set<string>;
  act: Actions;
  total: number;
  /** Home: the question this card answers, shown in place of the tag. */
  question?: string;
  /** Home: the card opens the full search instead of being a keyboard target. */
  onAsk?: () => void;
};

/* ── Versions and approvals ─────────────────────────────────────── */

/** True when no newer version in the series has been approved. */
function latestApproved(files: FileItem[], file: FileItem) {
  return (
    file.state === "approved" &&
    !files.some(
      (x) =>
        x.series &&
        x.series === file.series &&
        (x.v ?? 0) > (file.v ?? 0) &&
        x.state === "approved",
    )
  );
}

/**
 * The approval that moves this file on: its own, or the newer version's when
 * this is the last approved one ("Ask Mara to approve v4"). Nobody is asked to
 * approve something waiting on you.
 */
export function pendingApproval(
  files: FileItem[],
  file: FileItem,
): { file: FileItem; to: PersonId; label: string } | null {
  if (file.state === "awaiting" && file.waitingOn && file.waitingOn !== "you")
    return { file, to: file.waitingOn, label: "" };
  if (file.series && !isLatest(files, file)) {
    const newer = latestIn(files, file);
    if (
      newer.state === "awaiting" &&
      newer.waitingOn &&
      newer.waitingOn !== "you"
    )
      return { file: newer, to: newer.waitingOn, label: ` v${newer.v}` };
  }
  return null;
}

/**
 * Two facts, never one: which version this is, and where it stands.
 * `said` is the answer sentence above: whatever it already says, the chip leaves out.
 */
export function TrustCheck({
  files,
  file,
  said,
}: {
  files: FileItem[];
  file: FileItem;
  said?: string;
}) {
  if (file.series && !isLatest(files, file)) {
    const newer = latestIn(files, file);
    // The last approved version is a fact to rely on, not a warning.
    if (latestApproved(files, file) && newer.state === "awaiting") {
      const who = newer.waitingOn ? personName(newer.waitingOn) : null;
      return (
        <span className={`${s.trust} ${s.trustOk}`}>
          <Icon name="check" size={13} />
          <span>
            Latest approved<span className={s.trustSep}> · </span>v{newer.v}{" "}
            {who ? `waiting for ${who}` : "waiting for approval"}
          </span>
        </span>
      );
    }
    return (
      <span className={`${s.trust} ${s.trustWarn}`}>
        <Icon name="clock" size={13} />
        <span>
          Older version<span className={s.trustSep}> · </span>v{newer.v} is
          newer
        </span>
      </span>
    );
  }
  const text = (said ?? "").toLowerCase();
  const saysLatest = /\blatest\b/.test(text);
  const approver = file.approvedBy
    ? PEOPLE.find((p) => p.id === file.approvedBy)
    : null;
  const waiter = file.waitingOn
    ? file.waitingOn === "you"
      ? "you"
      : personName(file.waitingOn)
    : null;
  const saysWho = (name: string | null | undefined) =>
    !!name && text.includes(name.toLowerCase()) && /approv/.test(text);
  let state: string | null;
  let tone: "ok" | "wait" | "plain";
  if (file.state === "approved" || file.state === "signed") {
    tone = "ok";
    state =
      file.state === "signed"
        ? "signed"
        : saysWho(approver?.first)
          ? null
          : approver
            ? `approved by ${approver.id === "you" ? "you" : approver.first}, ${file.approvedOn}`
            : "approved";
  } else if (file.state === "awaiting") {
    tone = "wait";
    state = saysWho(waiter)
      ? null
      : waiter === "you"
        ? "waiting for your approval"
        : waiter
          ? `waiting for ${waiter}’s approval`
          : "waiting for approval";
  } else {
    tone = "plain";
    state = file.state === "draft" ? "still a draft" : "no sign-off needed";
  }
  const version = saysLatest ? null : "Latest version";
  if (!version && !state) return null;
  const parts = [version, state].filter(Boolean) as string[];
  const label = parts
    .map((x, i) => (i === 0 ? x.charAt(0).toUpperCase() + x.slice(1) : x))
    .reduce<ReactNode[]>(
      (acc, x, i) =>
        i === 0
          ? [x]
          : [
              ...acc,
              <span key={i} className={s.trustSep}>
                {" · "}
              </span>,
              x,
            ],
      [],
    );
  return (
    <span
      className={`${s.trust} ${tone === "ok" ? s.trustOk : s.trustPlain}`}
    >
      {tone === "ok" ? <Icon name="check" size={13} /> : null}
      {tone === "wait" ? <Icon name="clock" size={13} /> : null}
      <span>{label}</span>
    </span>
  );
}

/** The task a file belongs to, as a link that opens it in Tasks. */
export function TaskLink({
  file,
  className,
}: {
  file: FileItem;
  className?: string;
}) {
  const to = useDemoLinks();
  if (!file.taskId || !file.task) return null;
  return (
    <Link
      href={to.task(file.taskId)}
      prefetch={false}
      className={`${s.taskLink} ${className ?? ""}`}
      title="Open the task"
    >
      <Icon name="task" size={13} />
      <span className={s.taskLinkText}>{file.task}</span>
    </Link>
  );
}

function Source({
  file,
  para,
  files,
  said,
}: {
  file: FileItem;
  para: number;
  files: FileItem[];
  said?: string;
}) {
  return (
    <div className={s.source}>
      <Glyph file={file} size={34} />
      <div className={s.sourceText}>
        <span className={s.sourceName}>{file.name}</span>
        <span className={s.sourceMeta}>
          {file.kind !== "image" && file.kind !== "link" ? (
            <span className={s.sourcePage}>
              Page {pageOf(file, para)} of {file.pages}
            </span>
          ) : null}
          <ProjectTag id={file.project} compact />
          <span>
            Added by {personName(file.by)}, {whenInline(file.date)}
          </span>
          <TaskLink file={file} />
        </span>
      </div>
      <TrustCheck files={files} file={file} said={said} />
    </div>
  );
}

export function shareTarget(file: FileItem): PersonId {
  const project = PROJECTS.find((p) => p.id === file.project);
  const options: PersonId[] = [
    project?.lead ?? "dev",
    project?.second ?? "dev",
    "dev",
  ];
  return options.find((p) => p !== "you" && p !== file.by) ?? "aoife";
}

/**
 * The file's actions, the same on the answer card and in the preview: copy a
 * link, and either the approval that moves it on or a share.
 */
export function FileButtons({
  file,
  files,
  shared,
  act,
  small,
  keys,
}: {
  file: FileItem;
  files: FileItem[];
  shared: Set<string>;
  act: Actions;
  /** The preview's compact bar. */
  small?: boolean;
  /** Show the keyboard hints (the card on the results page). */
  keys?: boolean;
}) {
  const mod = useMod();
  const btn = small ? s.btnSm : s.btn;
  const size = small ? 14 : 15;
  const approval = pendingApproval(files, file);
  const to = shareTarget(file);
  const done = shared.has(`${file.id}:${to}`);
  const nudged = approval ? shared.has(`${approval.file.id}:approve`) : false;
  return (
    <>
      <button type="button" className={btn} onClick={() => act.copy(file.id)}>
        <Icon name="link" size={size} />
        Copy link
        {keys ? <Kbd>{mod === "⌘" ? "⌘↵" : "Ctrl ↵"}</Kbd> : null}
      </button>
      {approval ? (
        <button
          type="button"
          className={`${btn} ${nudged ? s.btnDone : ""}`}
          onClick={() => act.nudge(approval.file.id, approval.to)}
          aria-pressed={nudged}
        >
          {nudged ? (
            <Icon name="check" size={size} />
          ) : (
            <Avatar id={approval.to} size={small ? 16 : 18} />
          )}
          {nudged
            ? `Asked ${personName(approval.to)} to approve${approval.label}`
            : `Ask ${personName(approval.to)} to approve${approval.label}`}
        </button>
      ) : (
        <button
          type="button"
          className={`${btn} ${done ? s.btnDone : ""}`}
          onClick={() => act.share(file.id, to)}
          aria-pressed={done}
        >
          {done ? (
            <Icon name="check" size={size} />
          ) : (
            <Avatar id={to} size={small ? 16 : 18} />
          )}
          {done
            ? `Shared with ${personName(to)}`
            : `Share with ${personName(to)}`}
        </button>
      )}
    </>
  );
}

function ActionsRow({
  file,
  files,
  shared,
  act,
  example,
}: {
  file: FileItem;
  files: FileItem[];
  shared: Set<string>;
  act: Actions;
  example?: boolean;
}) {
  return (
    <div className={s.ansActions}>
      <button
        type="button"
        className={s.btnPrimary}
        onClick={() => act.open(file.id)}
      >
        <Icon name="open" size={15} />
        Open at the passage
        {example ? null : <Kbd>↵</Kbd>}
      </button>
      <FileButtons
        file={file}
        files={files}
        shared={shared}
        act={act}
        keys={!example}
      />
    </div>
  );
}

export function AnswerCard({
  res,
  q,
  files,
  sel,
  shared,
  asked,
  act,
  total,
  question,
  onAsk,
}: CardProps) {
  if (res.kind === "ambiguous") {
    return (
      <section
        className={`${s.answer} ${s.answerSplit}`}
        aria-label="Two possible answers"
      >
        <div className={s.ansTop}>
          <span className={s.ansTag}>
            <Icon name="split" size={14} />
            Two readings
          </span>
          <span className={s.ansScope}>We won&rsquo;t guess which one</span>
        </div>
        <p className={s.ansSentenceSm}>{res.amb.prompt}</p>
        <div className={s.readings}>
          {res.amb.options.map((o, i) => {
            const file = files.find((f) => f.id === o.file)!;
            const on = sel === i;
            return (
              <button
                key={o.label}
                type="button"
                className={`${s.reading} ${on ? s.readingSel : ""}`}
                onClick={() => act.pick(res.amb.id, i)}
                data-selected={on || undefined}
              >
                <span className={s.readingHead}>
                  <ProjectTag id={o.project} />
                  {on ? (
                    <span className={s.readingKey}>
                      <Kbd>↵</Kbd>
                      this one
                    </span>
                  ) : (
                    <Icon name="arrow" size={14} className={s.readingGo} />
                  )}
                </span>
                <span className={s.readingLabel}>{o.label}</span>
                <span className={s.readingSentence}>
                  <Strong text={o.sentence} strong={o.strong} />
                </span>
                <span className={s.readingSource}>
                  <Glyph file={file} size={20} />
                  <span className={s.readingFile}>
                    {file.name} · page {pageOf(file, o.passage)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className={s.readingHint}>
          <Kbd>↓</Kbd>
          <span>
            to choose, or click the one you meant. The list below waits until
            you do.
          </span>
        </p>
      </section>
    );
  }

  if (res.kind === "locked") {
    const owner = res.file.lockedIn!;
    const didAsk = asked.has(res.file.id);
    return (
      <section
        className={`${s.answer} ${s.answerLocked}`}
        aria-label="Answer in a file you can't open"
      >
        <div className={s.ansTop}>
          <span className={s.ansTag}>
            <Icon name="lock" size={14} />
            Can&rsquo;t open yet
          </span>
          <span className={s.ansScope}>
            Searched the {total} files you can open
          </span>
        </div>
        <p className={s.ansSentenceSm}>{res.sentence}</p>
        <div className={s.lockedBox}>
          <Glyph file={res.file} size={34} />
          <div className={s.sourceText}>
            <span className={s.sourceName}>{res.file.name}</span>
            <span className={s.sourceMeta}>
              <span>In {personName(owner)}&rsquo;s Drive folder</span>
              <ProjectTag id={res.file.project} compact />
            </span>
          </div>
        </div>
        <div className={s.ansActions}>
          <button
            type="button"
            className={didAsk ? `${s.btn} ${s.btnDone}` : s.btnPrimary}
            onClick={() => act.ask(res.file.id)}
            aria-pressed={didAsk}
          >
            <Icon name={didAsk ? "check" : "lock"} size={15} />
            {didAsk
              ? `Asked ${personName(owner)}. We'll tell you when it opens`
              : `Ask ${personName(owner)} for access`}
          </button>
          <TaskLink file={res.file} />
        </div>
      </section>
    );
  }

  const isAnswer = res.kind === "answer";
  const file = isAnswer ? res.file : res.hit.file;
  const para = isAnswer ? res.answer.passage : res.hit.para;
  const also = isAnswer ? res.answer.also : undefined;
  const marks = isAnswer ? res.answer.marks : q.terms;
  const soft = isAnswer ? (res.answer.context ?? []) : [];
  const passage = file.body[para] ?? "";
  const key = isAnswer ? res.answer.id : `${file.id}-${q.terms.join("-")}`;
  const selected = sel === 0;

  return (
    <section
      key={key}
      className={`${s.answer} ${selected ? s.answerSel : ""} ${question ? s.answerHome : ""} ${isAnswer ? "" : s.answerPassage}`}
      aria-label={isAnswer ? "Answer" : "Closest passage"}
      data-selected={selected || undefined}
    >
      <div className={s.answerMain}>
        <div className={s.ansTop}>
          {question ? (
            <button type="button" className={s.ansAsked} onClick={onAsk}>
              <Icon name="search" size={14} />
              <span className={s.ansAskedText}>{question}</span>
            </button>
          ) : (
            <span className={s.ansTag}>
              <Icon name="quote" size={14} />
              {isAnswer
                ? q.question
                  ? "Answer"
                  : "Found it"
                : q.question
                  ? "Closest passage"
                  : "Mentions every word"}
            </span>
          )}
          {isAnswer && res.other ? (
            <button
              type="button"
              className={s.ansSwitch}
              onClick={() => act.pick(res.other!.amb, res.other!.i)}
            >
              <Icon name="split" size={13} />
              Meant {res.other.label.replace(/^The /, "the ")}?
            </button>
          ) : question ? null : (
            <span className={s.ansScope}>
              {isAnswer
                ? `From 1 of the ${total} files you can open`
                : q.question
                  ? "Not a direct answer: the passage that mentions all of it"
                  : `From 1 of the ${total} files you can open`}
            </span>
          )}
        </div>
        {isAnswer ? (
          <p className={s.ansSentence}>
            <Strong text={res.answer.sentence} strong={res.answer.strong} />
          </p>
        ) : (
          <p className={s.ansSentenceSm}>
            {file.name.replace(/\.[a-z]+$/, "")}
          </p>
        )}
        <blockquote className={s.quote}>
          <span className={s.quoteText}>
            <Marked
              text={passage.replace(/ \| /g, ": ")}
              marks={marks}
              soft={soft}
            />
          </span>
          {also !== undefined && file.body[also] ? (
            <span className={`${s.quoteText} ${s.quoteAlso}`}>
              <Marked
                text={file.body[also].replace(/ \| /g, ": ")}
                marks={marks}
                soft={soft}
              />
            </span>
          ) : null}
        </blockquote>
        <Source
          file={file}
          para={para}
          files={files}
          said={isAnswer ? res.answer.sentence : undefined}
        />
        <ActionsRow
          file={file}
          files={files}
          shared={shared}
          act={act}
          example={!!question}
        />
      </div>
      <button
        type="button"
        className={s.answerPage}
        onClick={() => act.open(file.id)}
        aria-label={`Open ${file.name} at the passage`}
      >
        <PageThumb file={file} para={para} also={also} />
        <span className={s.answerPageLabel}>
          {file.kind === "image"
            ? "Image"
            : `Page ${pageOf(file, para)} of ${file.pages}`}
        </span>
      </button>
    </section>
  );
}

/* ── How the work is going: a question for Analytics ────────────── */

export function StatusCard({
  question,
  project,
  state,
  href,
  selected,
  onWords,
}: {
  question: string;
  project: ProjectId | null;
  state: DemoState;
  href: string;
  selected: boolean;
  onWords: () => void;
}) {
  const p = project ? projectById(project) : undefined;
  let now: ReactNode;
  if (p) {
    const c = countsFor(state, p.id);
    const bits = [
      c.late ? `${c.late} late` : null,
      c.stuck ? `${c.stuck} stuck` : null,
      `${c.open} open`,
    ].filter(Boolean);
    now = (
      <>
        <strong>{p.name}</strong> is {HEALTH_LABEL[p.health].toLowerCase()}:{" "}
        {bits.join(", ")}.
      </>
    );
  } else {
    const w = workspaceCounts(state);
    now = (
      <>
        Across {w.activeProjects} projects: <strong>{w.late} tasks late</strong>
        , {w.stuck} stuck, {w.atRisk} projects at risk and {w.offTrack} off
        track.
      </>
    );
  }
  return (
    <section
      className={`${s.answer} ${s.answerStatus} ${selected ? s.answerSel : ""}`}
      aria-label="A question about how the work is going"
      data-selected={selected || undefined}
    >
      <div className={s.answerMain}>
        <div className={s.ansTop}>
          <span className={s.ansTag}>
            <Icon name="chart" size={14} />
            How the work is going
          </span>
          <span className={s.ansScope}>Analytics answers this one</span>
        </div>
        <p className={s.ansSentenceSm}>
          That&rsquo;s a question about how the work is going.
        </p>
        <p className={s.statusBody}>
          Files reads what&rsquo;s written inside your files. Analytics follows
          the work itself: what&rsquo;s done, late and stuck, and whether the
          date still holds.
        </p>
        <p className={s.statusNow}>{now}</p>
        <div className={s.ansActions}>
          <Link href={href} prefetch={false} className={s.btnPrimary}>
            <Icon name="chart" size={15} />
            Ask Analytics
            <Kbd>↵</Kbd>
          </Link>
          <button type="button" className={s.btnGhost} onClick={onWords}>
            Search the files for these words instead
          </button>
        </div>
        <p className={s.statusAsked}>
          <Icon name="search" size={13} />
          <span>{question}</span>
        </p>
      </div>
    </section>
  );
}

/* ── Nothing found ──────────────────────────────────────────────── */

/** "peonies or the arch": the words, as they were asked. */
function sayTerms(terms: string[], raw: string, join: "or" | "and") {
  const lower = raw.toLowerCase();
  const said = terms.map((t) =>
    new RegExp(`\\bthe ${t}`).test(lower) ? `the ${t}` : t,
  );
  if (said.length <= 1) return said.join("");
  return `${said.slice(0, -1).join(", ")} ${join} ${said[said.length - 1]}`;
}

export function NoResults({
  q,
  missing,
  partial,
  near,
  ocrCount,
  ocr,
  onOcr,
  unfiltered,
  onClearPills,
  act,
}: {
  q: Query;
  /** Words nothing in the files mentions. */
  missing: string[];
  /** Files that mention some of the words, and which. */
  partial: { file: FileItem; term: string; para: number }[];
  near: FileItem | null;
  ocrCount: number;
  ocr: boolean;
  onOcr: () => void;
  /** How many files match once the filters go. */
  unfiltered: number;
  onClearPills: () => void;
  act: Actions;
}) {
  const filters = q.pills.filter((p) => p.key !== "has");
  const title = missing.length
    ? `Nothing in your files mentions ${sayTerms(missing, q.text, "or")}`
    : filters.length && unfiltered > 0
      ? `Nothing with those filters mentions ${sayTerms(q.terms, q.text, "and")}`
      : `No file mentions ${sayTerms(q.terms, q.text, "and")} together`;
  const rows: ReactNode[] = [];
  for (const pt of partial)
    rows.push(
      <li key={`p-${pt.file.id}`}>
        <button
          type="button"
          className={s.recoverRow}
          onClick={() => act.open(pt.file.id)}
        >
          <Glyph file={pt.file} size={28} />
          <span className={s.recoverText}>
            <span className={s.recoverLabel}>
              {pt.file.name.replace(/\.[a-z]+$/, "")} mentions{" "}
              {sayTerms([pt.term], q.text, "or")}
            </span>
            <span className={s.recoverHintStack}>
              <span className={s.recoverSnippet}>
                <Marked
                  text={(pt.file.body[pt.para] ?? "").replace(/ \| /g, ": ")}
                  marks={[pt.term]}
                />
              </span>
            </span>
          </span>
          <Icon name="arrow" size={15} />
        </button>
      </li>,
    );
  if (near && !partial.some((pt) => pt.file.id === near.id))
    rows.push(
      <li key="near">
        <button
          type="button"
          className={s.recoverRow}
          onClick={() => act.open(near.id)}
        >
          <Glyph file={near} size={28} />
          <span className={s.recoverText}>
            <span className={s.recoverLabel}>
              Closest file:{" "}
              {near.name.replace(/\.[a-z]+$/, "").replace(/ v\d+$/, "")}
            </span>
            <span className={s.recoverHintStack}>
              <ProjectTag id={near.project} compact />
            </span>
          </span>
          <Icon name="arrow" size={15} />
        </button>
      </li>,
    );
  if (!ocr && ocrCount > 0)
    rows.push(
      <li key="ocr">
        <button type="button" className={s.recoverRow} onClick={onOcr}>
          <span className={s.recoverIcon}>
            <Icon name="image" size={16} />
          </span>
          <span className={s.recoverText}>
            <span className={s.recoverLabel}>Also read the words in images</span>
            <span className={s.recoverHint}>
              {ocrCount} {ocrCount === 1 ? "photo or sketch mentions" : "photos or sketches mention"} it
            </span>
          </span>
          <Icon name="arrow" size={15} />
        </button>
      </li>,
    );
  if (filters.length && unfiltered > 0)
    rows.push(
      <li key="filters">
        <button type="button" className={s.recoverRow} onClick={onClearPills}>
          <span className={s.recoverIcon}>
            <Icon name="x" size={16} />
          </span>
          <span className={s.recoverText}>
            <span className={s.recoverLabel}>Search without the filters</span>
            <span className={s.recoverHint}>
              {unfiltered} {unfiltered === 1 ? "file" : "files"} then
            </span>
          </span>
          <Icon name="arrow" size={15} />
        </button>
      </li>,
    );
  return (
    <section className={s.empty} aria-live="polite">
      <p className={s.emptyTitle}>{title}</p>
      <p className={s.emptyBody}>
        We read every file you can open, including the words inside them.
        {rows.length ? null : " Try other words, or the name of the file."}
      </p>
      {rows.length ? <ul className={s.recover}>{rows}</ul> : null}
    </section>
  );
}

export function FirstRun({ name: emptyName, onBack, onDrive }: { name: string; onBack: () => void; onDrive: () => void }) {
  const href = useSurfaceHref();
  return (
    <section className={s.first} aria-labelledby="c5-first">
      <div className={s.firstStory} aria-hidden="true">
        <div className={s.storyTask}>
          <span className={s.storyCheck} />
          <span className={s.storyTaskText}>
            Book the Harbour Coaches shuttle
          </span>
          <span className={s.storyChip}>
            <Glyph file={{ kind: "pdf" }} size={18} />
            Coach booking.pdf
          </span>
        </div>
        <span className={s.storyArrow}>
          <Icon name="down" size={16} />
        </span>
        <div className={s.storyAsk}>
          <Icon name="search" size={14} />
          <span className={s.storyTyped}>when does the coach leave?</span>
        </div>
        <div className={s.storyAnswer}>
          <span className={s.storyLine}>
            <strong>13:00</strong>, from Kinsale town pier
          </span>
          <span className={s.storyQuote}>
            &ldquo;The coaches leave Kinsale town pier at{" "}
            <mark className={s.markStatic}>13:00</mark>&rdquo; · Coach
            booking.pdf, page 1
          </span>
        </div>
      </div>
      <div className={s.firstCopy}>
        <h2 id="c5-first" className={s.firstTitle}>
          {emptyName} has no files yet
        </h2>
        <p className={s.firstBody}>
          Attach a file to any task and it becomes searchable here, including
          what&rsquo;s written inside it. Then ask it things, like when the coach
          leaves.
        </p>
        <div className={s.firstActions}>
          <Link
            href={href("tasks/board")}
            className={s.btnPrimary}
            prefetch={false}
          >
            <Icon name="task" size={15} />
            Open Tasks
          </Link>
          <button type="button" className={s.btn} onClick={onDrive}>
            <Icon name="drive" size={15} />
            Connect Google Drive
          </button>
          <button type="button" className={s.btnGhost} onClick={onBack}>
            See all files
          </button>
        </div>
      </div>
    </section>
  );
}

export function rowStyle(i: number): CSSProperties {
  return { "--i": Math.min(i, 10) } as CSSProperties;
}

export type { Hit };
