"use client";

import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties } from "react";
import { Art, hueVar } from "./art";
import { FIT_LABEL, toolById, type Fit, type Story, type ToolId } from "./data";
import { ArrowRight, CheckIcon, ToolTile } from "./glyphs";
import { plural, type Enabled } from "./reader";
import styles from "./c3.module.css";

/* ── Your kit ─────────────────────────────────────────────────────── */

export function KitStrip({
  kit,
  enabled,
  early,
  fit,
  onFit,
  onManage,
  fresh,
}: {
  kit: ToolId[];
  enabled: Enabled;
  early: boolean;
  fit: Fit | null;
  onFit: (f: Fit | null) => void;
  onManage: () => void;
  fresh: ToolId | null;
}) {
  return (
    <section className={`${styles.kit} ${early ? styles.kitEarly : ""}`} aria-labelledby="kit-title">
      <div className={styles.kitHead}>
        <h2 id="kit-title" className={styles.kitTitle}>
          Your kit
        </h2>
        <span className={styles.kitSub}>{early ? "What every Project starts with" : `${plural(kit.length, "tool")} turned on`}</span>
      </div>
      <ul className={styles.kitRow}>
        <AnimatePresence initial={false}>
          {kit.map((id) => {
            const n = (enabled[id] ?? []).length;
            return (
              <motion.li
                key={id}
                layout
                className={`${styles.kitItem} ${fresh === id ? styles.kitItemFresh : ""}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", damping: 26, stiffness: 380 }}
                title={`${toolById(id).name}: on for ${plural(n, "Project")}`}
              >
                <span className={styles.kitTileWrap}>
                  <ToolTile id={id} />
                  <span className={styles.kitTick} aria-label="On">
                    <CheckIcon size={9} />
                  </span>
                </span>
                <span className={styles.kitName}>{toolById(id).name}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {early ? (
        <div className={styles.fit}>
          <span className={styles.fitLabel}>Start with a story that fits you</span>
          <span className={styles.fitChips} role="group" aria-label="Start with a story that fits you">
            {(Object.keys(FIT_LABEL) as Fit[]).map((f) => (
              <button key={f} type="button" aria-pressed={fit === f} className={`${styles.fitChip} ${fit === f ? styles.fitChipOn : ""}`} onClick={() => onFit(fit === f ? null : f)}>
                {FIT_LABEL[f]}
              </button>
            ))}
          </span>
        </div>
      ) : (
        <button type="button" className={styles.manage} onClick={onManage}>
          Manage
        </button>
      )}
    </section>
  );
}

/* ── the lead story ───────────────────────────────────────────────── */

export function LeadStory({ story, onOpen, hidden }: { story: Story; onOpen: () => void; hidden: boolean }) {
  const style = { "--hue": hueVar(story.hue) } as CSSProperties;
  return (
    <article className={styles.lead} style={style}>
      <div className={styles.leadText}>
        <h3 className={styles.leadTitle}>
          <button type="button" className={styles.stretch} onClick={onOpen}>
            {story.headline}
          </button>
        </h3>
        <p className={styles.leadDek}>{story.dek}</p>
        <p className={styles.byline}>
          <span className={styles.teamMark} style={{ background: hueVar(story.hue) }} aria-hidden>
            {story.team}
          </span>
          <span>
            <span className={styles.bylineName}>{story.byline}</span>
            <span className={styles.bylineMeta}>{plural(story.minutes, "minute")} to read</span>
          </span>
        </p>
        <div className={styles.leadFoot}>
          <span className={styles.toolsLine}>
            {story.tools.map((t) => (
              <span key={t} className={styles.toolChip}>
                <ToolTile id={t} size="sm" />
                {toolById(t).name}
              </span>
            ))}
          </span>
          <span className={styles.readCue} aria-hidden>
            Read the story <ArrowRight />
          </span>
        </div>
      </div>
      <div className={styles.leadArtSlot}>
        {!hidden && (
          <motion.div layoutId={`art-${story.id}`} className={styles.leadArt} style={style}>
            <Art id={story.id} hue={story.hue} lead />
          </motion.div>
        )}
      </div>
    </article>
  );
}

/* ── a story card ─────────────────────────────────────────────────── */

export function StoryCard({ story, enabled, onOpen, hidden, span }: { story: Story; enabled: Enabled; onOpen: () => void; hidden: boolean; span: "third" | "half" }) {
  const style = { "--hue": hueVar(story.hue) } as CSSProperties;
  const tool = toolById(story.primary);
  const used = (enabled[story.primary] ?? []).length;
  const core = tool.status === "core" && used > 0;
  return (
    <article className={`${styles.card} ${span === "half" ? styles.cardHalf : ""}`} style={style}>
      <div className={styles.cardArtSlot}>
        {!hidden && (
          <motion.div layoutId={`art-${story.id}`} className={styles.cardArt} style={style}>
            <Art id={story.id} hue={story.hue} />
          </motion.div>
        )}
      </div>
      <div className={styles.cardBody}>
        {core ? (
          <span className={styles.usedLine}>
            <CheckIcon /> You use this on {plural(used, "Project")}
          </span>
        ) : (
          <span className={styles.toolsLine}>
            {story.tools.map((t) => (
              <span key={t} className={styles.toolChipQuiet}>
                <ToolTile id={t} size="sm" />
                {toolById(t).name}
              </span>
            ))}
          </span>
        )}
        <h3 className={styles.cardTitle}>
          <button type="button" className={styles.stretch} onClick={onOpen}>
            {story.headline}
          </button>
        </h3>
        <p className={styles.cardDek}>{story.dek}</p>
        <p className={styles.cardByline}>
          <span className={styles.teamMarkSm} style={{ background: hueVar(story.hue) }} aria-hidden>
            {story.team}
          </span>
          {story.byline}
        </p>
      </div>
    </article>
  );
}
