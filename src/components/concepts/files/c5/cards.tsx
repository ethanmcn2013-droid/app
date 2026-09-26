"use client";

import type { CSSProperties } from "react";
import { PEOPLE, PROJECTS, type FileItem, type PersonId } from "./data";
import {
  clip,
  isLatest,
  latestIn,
  pageOf,
  when,
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
  ask: (id: string) => void;
  pick: (amb: string, i: number) => void;
  run: (query: string) => void;
};

type CardProps = {
  res: Exclude<Resolution, { kind: "none" }>;
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

/**
 * Two facts, never one: which version this is, and where it stands.
 * Green only when the figure is both current and approved or signed.
 */
export function TrustCheck({
  files,
  file,
}: {
  files: FileItem[];
  file: FileItem;
}) {
  if (file.series && !isLatest(files, file)) {
    const newer = latestIn(files, file);
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
  const approver = file.approvedBy
    ? PEOPLE.find((p) => p.id === file.approvedBy)
    : null;
  if (file.state === "approved" || file.state === "signed") {
    return (
      <span className={`${s.trust} ${s.trustOk}`}>
        <Icon name="check" size={13} />
        <span>
          Latest version<span className={s.trustSep}> · </span>
          {file.state === "signed"
            ? "signed"
            : approver
              ? `approved by ${approver.first}, ${file.approvedOn}`
              : "approved"}
        </span>
      </span>
    );
  }
  if (file.state === "awaiting") {
    return (
      <span className={`${s.trust} ${s.trustWarn}`}>
        <Icon name="clock" size={13} />
        <span>
          Latest version<span className={s.trustSep}> · </span>
          {file.waitingOn
            ? `waiting for ${personName(file.waitingOn)}’s approval`
            : "waiting for approval"}
        </span>
      </span>
    );
  }
  return (
    <span className={`${s.trust} ${s.trustPlain}`}>
      <span>
        Latest version<span className={s.trustSep}> · </span>
        {file.state === "draft" ? "still a draft" : "no sign-off needed"}
      </span>
    </span>
  );
}

function Source({
  file,
  para,
  files,
}: {
  file: FileItem;
  para: number;
  files: FileItem[];
}) {
  return (
    <div className={s.source}>
      <Glyph file={file} size={34} />
      <div className={s.sourceText}>
        <span className={s.sourceName}>{file.name}</span>
        <span className={s.sourceMeta}>
          {file.kind !== "image" && file.kind !== "link" ? (
            <span>
              Page {pageOf(file, para)} of {file.pages}
            </span>
          ) : null}
          <ProjectTag id={file.project} compact />
          <span>
            Added by {personName(file.by)}, {when(file.date)}
          </span>
        </span>
      </div>
      <TrustCheck files={files} file={file} />
    </div>
  );
}

export function shareTarget(file: FileItem): PersonId {
  const project = PROJECTS.find((p) => p.id === file.project);
  const lead = project?.lead ?? "dev";
  return lead === file.by ? (project?.second ?? "dev") : lead;
}

function ActionsRow({
  file,
  shared,
  act,
  example,
}: {
  file: FileItem;
  shared: Set<string>;
  act: Actions;
  example?: boolean;
}) {
  const mod = useMod();
  const to = shareTarget(file);
  const done = shared.has(`${file.id}:${to}`);
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
      <button type="button" className={s.btn} onClick={() => act.copy(file.id)}>
        <Icon name="link" size={15} />
        Copy link
        {example ? null : <Kbd>{mod === "⌘" ? "⌘↵" : "Ctrl ↵"}</Kbd>}
      </button>
      {example ? null : (
        <button
          type="button"
          className={`${s.btn} ${done ? s.btnDone : ""}`}
          onClick={() => act.share(file.id, to)}
          aria-pressed={done}
        >
          {done ? (
            <Icon name="check" size={15} />
          ) : (
            <Avatar id={to} size={18} />
          )}
          {done
            ? `Shared with ${personName(to)}`
            : `Share with ${personName(to)}`}
        </button>
      )}
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
          {res.file.task ? (
            <span className={s.lockedTask}>
              <Icon name="task" size={14} />
              On the task: {res.file.task}
            </span>
          ) : null}
        </div>
      </section>
    );
  }

  const isAnswer = res.kind === "answer";
  const file = isAnswer ? res.file : res.hit.file;
  const para = isAnswer ? res.answer.passage : res.hit.para;
  const marks = isAnswer ? res.answer.marks : q.terms;
  const soft = isAnswer ? (res.answer.context ?? []) : [];
  const passage = file.body[para] ?? "";
  const key = isAnswer ? res.answer.id : `${file.id}-${q.terms.join("-")}`;
  const selected = sel === 0;

  return (
    <section
      key={key}
      className={`${s.answer} ${selected ? s.answerSel : ""} ${question ? s.answerHome : ""}`}
      aria-label={isAnswer ? "Answer" : "Top match"}
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
                : "Top match, quoted"}
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
          ) : (
            <span className={s.ansScope}>
              From 1 of the {total} files you can open
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
        </blockquote>
        <Source file={file} para={para} files={files} />
        <ActionsRow
          file={file}
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
        <PageThumb file={file} para={para} />
        <span className={s.answerPageLabel}>
          {file.kind === "image"
            ? "Image"
            : `Page ${pageOf(file, para)} of ${file.pages}`}
        </span>
      </button>
    </section>
  );
}

export function NoResults({
  q,
  near,
  ocrCount,
  ocr,
  onOcr,
  onClearPills,
  act,
}: {
  q: Query;
  near: FileItem | null;
  ocrCount: number;
  ocr: boolean;
  onOcr: () => void;
  onClearPills: () => void;
  act: Actions;
}) {
  const said = q.text || "that";
  const filters = q.pills.filter((p) => p.key !== "has");
  return (
    <section className={s.empty} aria-live="polite">
      <p className={s.emptyTitle}>
        Nothing called <span className={s.emptyWord}>{said}</span>
        {filters.length ? " with those filters" : ""}.
      </p>
      <p className={s.emptyBody}>
        We read every file you can open, including the text inside them.
        Here&rsquo;s where it might be instead.
      </p>
      <ul className={s.recover}>
        {near ? (
          <li>
            <button
              type="button"
              className={s.recoverRow}
              onClick={() => act.open(near.id)}
            >
              <Glyph file={near} size={28} />
              <span className={s.recoverText}>
                <span className={s.recoverLabel}>
                  Did you mean{" "}
                  {near.name.replace(/\.[a-z]+$/, "").replace(/ v\d+$/, "")}?
                </span>
                <span className={s.recoverHintStack}>
                  <ProjectTag id={near.project} compact />
                  <span className={s.recoverSnippet}>
                    {clip(near.body[1] ?? near.body[0] ?? "", [], 90)}
                  </span>
                </span>
              </span>
              <Icon name="arrow" size={15} />
            </button>
          </li>
        ) : null}
        {!ocr ? (
          <li>
            <button type="button" className={s.recoverRow} onClick={onOcr}>
              <span className={s.recoverIcon}>
                <Icon name="image" size={16} />
              </span>
              <span className={s.recoverText}>
                <span className={s.recoverLabel}>Or search inside images</span>
                <span className={s.recoverHint}>
                  {ocrCount > 0
                    ? `${ocrCount} ${ocrCount === 1 ? "photo mentions" : "photos mention"} it: sketches, signs, whiteboards`
                    : "Reads the words in photos, sketches and scans"}
                </span>
              </span>
              <code className={s.recoverToken}>has:text-in-images</code>
              <Icon name="arrow" size={15} />
            </button>
          </li>
        ) : null}
        {filters.length ? (
          <li>
            <button
              type="button"
              className={s.recoverRow}
              onClick={onClearPills}
            >
              <span className={s.recoverIcon}>
                <Icon name="x" size={16} />
              </span>
              <span className={s.recoverText}>
                <span className={s.recoverLabel}>
                  Search without the filters
                </span>
                <span className={s.recoverHint}>
                  Keep the words, drop the tokens
                </span>
              </span>
              <Icon name="arrow" size={15} />
            </button>
          </li>
        ) : null}
        <li>
          <button
            type="button"
            className={s.recoverRow}
            onClick={() => act.run("when is the tasting?")}
          >
            <span className={s.recoverIcon}>
              <Icon name="quote" size={16} />
            </span>
            <span className={s.recoverText}>
              <span className={s.recoverLabel}>Ask it as a question</span>
              <span className={s.recoverHint}>
                Plain words work: &ldquo;when is the tasting?&rdquo;
              </span>
            </span>
            <Icon name="arrow" size={15} />
          </button>
        </li>
      </ul>
    </section>
  );
}

export function FirstRun({ onBack }: { onBack: () => void }) {
  return (
    <section className={s.first} aria-labelledby="c5-first">
      <div className={s.firstStory} aria-hidden="true">
        <div className={s.storyTask}>
          <span className={s.storyCheck} />
          <span className={s.storyTaskText}>Book the bus</span>
          <span className={s.storyChip}>
            <Glyph file={{ kind: "pdf" }} size={18} />
            Bus booking.pdf
          </span>
        </div>
        <span className={s.storyArrow}>
          <Icon name="down" size={16} />
        </span>
        <div className={s.storyAsk}>
          <Icon name="search" size={14} />
          <span className={s.storyTyped}>when does the bus leave?</span>
        </div>
        <div className={s.storyAnswer}>
          <span className={s.storyLine}>
            <strong>08:00</strong>, driver at the school gate
          </span>
          <span className={s.storyQuote}>
            &ldquo;Driver at the school gate from{" "}
            <mark className={s.markStatic}>08:00</mark>&rdquo; · Bus
            booking.pdf, page 1
          </span>
        </div>
      </div>
      <div className={s.firstCopy}>
        <h2 id="c5-first" className={s.firstTitle}>
          Riverside market has no files yet
        </h2>
        <p className={s.firstBody}>
          Attach a file to any task and it becomes searchable here, including
          what&rsquo;s written inside it. Then ask it things, like when the bus
          leaves.
        </p>
        <div className={s.firstActions}>
          <button type="button" className={s.btnPrimary}>
            <Icon name="task" size={15} />
            Open Tasks
          </button>
          <button type="button" className={s.btn}>
            <Icon name="drive" size={15} />
            Connect Google Drive
          </button>
          <button type="button" className={s.btnGhost} onClick={onBack}>
            Back to the sample projects
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
