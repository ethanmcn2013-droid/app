"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { BoardCanvas } from "./board";
import { BoardSwitcher, ProjectCard } from "./card";
import { BOARDS, TOOLS, type GlyphId, type KindId } from "./data";
import { Icon } from "./glyphs";
import { BOARD_INDEX, hang, initialState, kindOf, nameOf, rekind, takeDown, type BoardState } from "./model";
import { BrowseSheet, Toast, ToolSheet } from "./sheet";
import s from "./c2.module.css";

type Sheet = { kind: "tool"; id: GlyphId } | { kind: "browse" } | null;
type ToastState = { id: number; text: string; undo?: boolean } | null;

export default function ShadowBoard() {
  const reduced = useReducedMotion();
  const [boardId, setBoardId] = useState("mara");
  const [states, setStates] = useState<Record<string, BoardState>>(() =>
    Object.fromEntries(BOARDS.map((b) => [b.id, initialState(b)])),
  );
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const undoRef = useRef<BoardState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const board = BOARD_INDEX[boardId];
  const st = states[boardId];

  const say = useCallback((text: string, undo?: BoardState) => {
    undoRef.current = undo ?? null;
    setToast({ id: Date.now(), text, undo: !!undo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 5200);
  }, []);

  const update = (fn: (x: BoardState) => BoardState) => setStates((all) => ({ ...all, [boardId]: fn(all[boardId]) }));

  const onHang = (id: GlyphId) => {
    const before = st;
    update((x) => hang(x, id));
    setSheet(null);
    say(`${nameOf(id, st.kind)} is on the board.`, before);
  };

  const onTakeDown = (id: GlyphId) => {
    const before = st;
    update((x) => takeDown(x, id));
    setSheet(null);
    say(`${nameOf(id, st.kind)} taken down. Your ${TOOLS[id].kept} is kept for 30 days.`, before);
  };

  const onKind = (k: KindId) => {
    if (k === st.kind) return;
    update((x) => rekind(x, k));
    say(`Set up for ${kindOf(k)?.label.toLowerCase()}. Nothing on the board moved.`);
  };

  const onUndo = () => {
    const prev = undoRef.current;
    if (!prev) return;
    setStates((all) => ({ ...all, [boardId]: { ...prev, moved: null } }));
    setToast(null);
    undoRef.current = null;
  };

  const onPick = (id: string) => {
    setBoardId(id);
    setSheet(null);
    setToast(null);
  };

  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <header className={s.head}>
          <div className={s.headText}>
            <h1 className={s.h1}>Apps and tools</h1>
            <p className={s.lead}>
              Every Project has a board. What is on hangs in place. Outlines show what{" "}
              {st.kind ? kindOf(st.kind)?.noun : "a Project like this"} usually needs and you have not added yet.
            </p>
          </div>
          <div className={s.headActions}>
            {board.canEdit ? (
              <button type="button" className={s.ghostButton} onClick={() => setSheet({ kind: "browse" })}>
                <Icon name="plus" size={15} /> Every tool
              </button>
            ) : null}
            <BoardSwitcher current={boardId} states={states} onPick={onPick} />
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={boardId}
            className={s.layout}
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ProjectCard board={board} st={st} onKind={onKind} />
            <LayoutGroup id={boardId}>
              <BoardCanvas
                board={board}
                st={st}
                onOpen={(id) => setSheet({ kind: "tool", id })}
                onHang={onHang}
                onBrowse={() => setSheet({ kind: "browse" })}
                onKind={onKind}
              />
            </LayoutGroup>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {sheet?.kind === "tool" ? (
          <ToolSheet
            key={`tool-${sheet.id}`}
            id={sheet.id}
            board={board}
            st={st}
            onClose={closeSheet}
            onHang={onHang}
            onTakeDown={onTakeDown}
            onOpenTool={(id) => {
              setSheet(null);
              say(`In the full app, ${nameOf(id, st.kind)} opens here.`);
            }}
          />
        ) : sheet?.kind === "browse" ? (
          <BrowseSheet key="browse" board={board} st={st} onClose={closeSheet} onHang={onHang} />
        ) : null}
      </AnimatePresence>

      <Toast toast={toast} onUndo={onUndo} />
    </div>
  );
}
