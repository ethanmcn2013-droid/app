"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ASSETS, BOARDS, EVERYTHING_ORDER, INITIAL_VERDICTS, PEOPLE, PROJECTS, TASKS, TONES, bare, type Asset, type Board, type ProjectId, type ToneId, type Verdict } from "./data";
import { fallbackVars, place } from "./layout";
import { Avatar, Face, Tile } from "./tiles";
import { ShareModal } from "./share";
import { Lightbox } from "./lightbox";
import * as I from "./icons";
import s from "./moodwall.module.css";

type VerdictMap = Record<string, { by: string; verdict: Verdict; fresh?: boolean }>;
type Toast = { key: number; text: string; undo?: () => void };
type Arrival = { key: number; id: string; board: string; by: string; verdict: Verdict };

function paletteOf(list: Asset[]): ToneId[] {
  const score = new Map<ToneId, number>();
  for (const a of list) a.tones.forEach((t, i) => score.set(t, (score.get(t) ?? 0) + (3 - Math.min(i, 2))));
  return [...score.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([t]) => t);
}

function inkFor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? "#141414" : "#ffffff";
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export default function MoodwallConcept() {
  const reduce = useReducedMotion();
  const [projectId, setProjectId] = useState<ProjectId>("mara");
  const [assets, setAssets] = useState<Asset[]>(ASSETS);
  const [boards, setBoards] = useState<Board[]>(BOARDS);
  const [active, setActive] = useState<string>("tablescape");
  const [tone, setTone] = useState<ToneId | null>(null);
  const [hoverTone, setHoverTone] = useState<ToneId | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<VerdictMap>(INITIAL_VERDICTS);
  const [sharing, setSharing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [dragging, setDragging] = useState<string[] | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [bumps, setBumps] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [width, setWidth] = useState(0);
  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [menu, setMenu] = useState<null | "board" | "task" | "project" | "share" | "palette">(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [allArrivals, setAllArrivals] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [offscreen, setOffscreen] = useState<string[]>([]);
  const [pulse, setPulse] = useState<{ id: string; key: number } | null>(null);
  const [nudged, setNudged] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [tabFade, setTabFade] = useState({ l: false, r: false });

  const rootRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const wallRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lassoStart = useRef<{ x: number; y: number; base: string[]; moved: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const toastKey = useRef(0);
  const arrivalKey = useRef(0);

  /* ── derived ─────────────────────────────────────────────────── */
  const project = PROJECTS.find((p) => p.id === projectId)!;
  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const projectAssets = useMemo(() => {
    const rank = (id: string) => {
      const i = EVERYTHING_ORDER.indexOf(id);
      return i < 0 ? -1 : i;
    };
    return assets.filter((a) => a.project === projectId).sort((x, y) => rank(x.id) - rank(y.id));
  }, [assets, projectId]);
  const projectBoards = boards.filter((b) => b.project === projectId);
  const board = active === "all" ? null : (boards.find((b) => b.id === active) ?? null);
  const base = useMemo(() => (board ? board.items.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a)) : projectAssets), [board, byId, projectAssets]);
  const palette = useMemo(() => paletteOf(base.filter((a) => !a.broken)), [base]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((a) => (!tone || a.tones.includes(tone)) && (!q || [a.name, a.task, a.vendor, a.domain, a.caption, ...a.tones.map((t) => TONES[t].name)].join(" ").toLowerCase().includes(q)));
  }, [base, tone, query]);

  // Measured wall once we know the width; until then (server render and the
  // first hydrated frame) the same wall is drawn by CSS from custom properties.
  const layout = useMemo(() => (width ? place(visible, width) : null), [visible, width]);
  const fallback = useMemo(() => (width ? null : fallbackVars(visible)), [visible, width]);

  const reviewedIn = (b: Board) => b.items.filter((id) => verdicts[id]).length;
  const lovedIn = (b: Board) => b.items.filter((id) => verdicts[id]?.verdict === "love").length;

  /* ── effects: measure, keyboard, paste, timers ───────────────── */
  useEffect(() => {
    const el = wallRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Board tabs scroll sideways when they run out of room; fade whichever edge has more.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const check = () => {
      const l = el.scrollLeft > 2;
      const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setTabFade((cur) => (cur.l === l && cur.r === r ? cur : { l, r }));
    };
    const ro = new ResizeObserver(check);
    ro.observe(el);
    // New boards and renames change the width of the row without resizing it.
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    el.addEventListener("scroll", check, { passive: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("scroll", check);
    };
  }, []);

  const showToast = useCallback((text: string, undo?: () => void) => {
    toastKey.current += 1;
    const key = toastKey.current;
    setToast({ key, text, undo });
    const id = window.setTimeout(() => setToast((cur) => (cur?.key === key ? null : cur)), undo ? 5200 : 3200);
    timers.current.push(id);
  }, []);

  const addToBoard = useCallback(
    (boardId: string, ids: string[]) => {
      const target = boards.find((b) => b.id === boardId);
      if (!target) return;
      const fresh = ids.filter((id) => !target.items.includes(id));
      if (!fresh.length) {
        showToast(`Already on ${target.name}`);
        return;
      }
      setBoards((bs) => bs.map((b) => (b.id === boardId ? { ...b, items: [...b.items, ...fresh] } : b)));
      setBumps((m) => ({ ...m, [boardId]: (m[boardId] ?? 0) + 1 }));
      showToast(`Added ${fresh.length === 1 ? (byId.get(fresh[0])?.name ?? "1 file") : `${fresh.length} files`} to ${target.name}`, () => {
        setBoards((bs) => bs.map((b) => (b.id === boardId ? { ...b, items: b.items.filter((id) => !fresh.includes(id)) } : b)));
        setToast(null);
      });
    },
    [boards, byId, showToast],
  );

  const addLink = useCallback(
    (boardId: string, raw: string) => {
      let url: URL;
      try {
        url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
      } catch {
        showToast("That doesn't look like a link");
        return;
      }
      const domain = url.hostname.replace(/^www\./, "");
      const id = `l${Date.now()}`;
      setAssets((as) => [...as, { id, project: projectId, name: domain, kind: "link", ratio: 0.62, tones: ["ivory"], domain, detail: url.pathname.length > 1 ? url.pathname : "Pasted just now", source: "Link", by: "Orla", added: "Just now" }]);
      setBoards((bs) => bs.map((b) => (b.id === boardId ? { ...b, items: [...b.items, id] } : b)));
      setBumps((m) => ({ ...m, [boardId]: (m[boardId] ?? 0) + 1 }));
      setLinkDraft("");
      showToast(`Added ${domain}`);
    },
    [projectId, showToast],
  );

  const newBoard = useCallback(
    (ids: string[] = []) => {
      const id = `b${Date.now()}`;
      setBoards((bs) => [...bs, { id, project: projectId, name: ids.length ? "New picks" : "Untitled board", items: ids }]);
      setActive(id);
      setRenaming(id);
      setTone(null);
      setSelected([]);
      setMenu(null);
      if (ids.length) showToast(`Made a board from ${ids.length} ${ids.length === 1 ? "file" : "files"}`);
      return id;
    },
    [projectId, showToast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open) setOpen(null);
        else if (sharing) setSharing(null);
        else if (menu) setMenu(null);
        else if (selected.length) setSelected([]);
        else if (tone) setTone(null);
        return;
      }
      if (open && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const i = visible.findIndex((a) => a.id === open);
        const n = visible.length;
        if (n) setOpen(visible[(i + (e.key === "ArrowRight" ? 1 : -1) + n) % n].id);
        return;
      }
      if (open || sharing || isTyping(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(visible.filter((a) => !a.broken).map((a) => a.id));
      } else if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
        window.requestAnimationFrame(() => searchRef.current?.focus());
      } else if (/^[1-5]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
        const t = palette[Number(e.key) - 1];
        if (t) setTone((cur) => (cur === t ? null : t));
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !board) return;
      const text = e.clipboardData?.getData("text")?.trim() ?? "";
      if (/^(https?:\/\/|www\.)\S+$/.test(text)) {
        e.preventDefault();
        addLink(board.id, text);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (menu && !(e.target as HTMLElement).closest?.("[role=menu], [aria-haspopup]")) setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [open, sharing, menu, selected, tone, visible, palette, board, addLink]);

  /* ── selection ───────────────────────────────────────────────── */
  const toggle = (id: string, range: boolean) => {
    if (range && anchor) {
      const ids = visible.map((a) => a.id);
      const [i, j] = [ids.indexOf(anchor), ids.indexOf(id)].sort((x, y) => x - y);
      if (i >= 0 && j >= 0) {
        setSelected((cur) => [...new Set([...cur, ...ids.slice(i, j + 1)])]);
        return;
      }
    }
    setAnchor(id);
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const revealTab = (id: string) => {
    window.requestAnimationFrame(() => {
      const bar = tabsRef.current;
      const tab = bar?.querySelector<HTMLElement>(`[data-board="${id}"]`);
      if (!bar || !tab) return;
      const pad = 40;
      if (tab.offsetLeft - pad < bar.scrollLeft) bar.scrollTo({ left: tab.offsetLeft - pad, behavior: reduce ? "auto" : "smooth" });
      else if (tab.offsetLeft + tab.offsetWidth + pad > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: tab.offsetLeft + tab.offsetWidth + pad - bar.clientWidth, behavior: reduce ? "auto" : "smooth" });
    });
  };

  const switchBoard = (id: string) => {
    setActive(id);
    setTone(null);
    setHoverTone(null);
    setMenu(null);
    setUnread((m) => (m[id] ? { ...m, [id]: 0 } : m));
    setOffscreen([]);
    revealTab(id);
    // A new board starts at its top, just under the sticky tabs.
    const root = rootRef.current;
    const sec = sectionRef.current;
    const bar = tabsRef.current?.closest("nav");
    if (root && sec && bar) {
      const top = sec.offsetTop - bar.offsetHeight;
      if (root.scrollTop > top) root.scrollTo({ top });
    }
  };

  /** Scroll a tile into the middle of the wall and let it announce itself. */
  const showTile = (id: string) => {
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-tile="${id}"]`);
    el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    setPulse((p) => ({ id, key: (p?.key ?? 0) + 1 }));
    setOffscreen((list) => list.filter((x) => x !== id));
  };

  const onRootScroll = () => {
    if (!offscreen.length) return;
    const root = rootRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const still = offscreen.filter((id) => {
      const r = root.querySelector(`[data-tile="${id}"]`)?.getBoundingClientRect();
      return !r || r.top > box.bottom - 80 || r.bottom < box.top + 120;
    });
    if (still.length !== offscreen.length) setOffscreen(still);
  };

  /* ── drag into boards ────────────────────────────────────────── */
  const onTileDragStart = (id: string, e: DragEvent<HTMLElement>) => {
    const ids = selected.includes(id) ? selected : [id];
    e.dataTransfer.setData("text/plain", ids.join(","));
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.className = s.ghost;
    ghost.textContent = ids.length === 1 ? (byId.get(id)?.name ?? "1 file") : `${ids.length} files`;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 16, 16);
    window.setTimeout(() => ghost.remove(), 0);
    setDragging(ids);
  };
  const endDrag = () => {
    setDragging(null);
    setDropOn(null);
  };
  const dropProps = (boardId: string | "new") => ({
    onDragOver: (e: DragEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (dropOn !== boardId) setDropOn(boardId);
    },
    onDragLeave: () => setDropOn((cur) => (cur === boardId ? null : cur)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const ids = (e.dataTransfer.getData("text/plain") || "").split(",").filter((x) => byId.has(x));
      endDrag();
      if (!ids.length) return;
      if (boardId === "new") newBoard(ids);
      else addToBoard(boardId, ids);
    },
  });

  /* ── lasso from the margins ──────────────────────────────────── */
  const onSectionDown = (e: RPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const t = e.target as HTMLElement;
    if (t.closest("[data-tile], button, a, input, textarea, [data-nolasso]")) return;
    lassoStart.current = { x: e.clientX, y: e.clientY, base: e.shiftKey ? selected : [], moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onSectionMove = (e: RPointerEvent<HTMLElement>) => {
    const st = lassoStart.current;
    const sec = sectionRef.current;
    if (!st || !sec) return;
    if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 5) return;
    st.moved = true;
    const box = { l: Math.min(st.x, e.clientX), t: Math.min(st.y, e.clientY), r: Math.max(st.x, e.clientX), b: Math.max(st.y, e.clientY) };
    const sr = sec.getBoundingClientRect();
    setLasso({ x: box.l - sr.left, y: box.t - sr.top, w: box.r - box.l, h: box.b - box.t });
    const hits: string[] = [];
    sec.querySelectorAll<HTMLElement>("[data-tile]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.left < box.r && r.right > box.l && r.top < box.b && r.bottom > box.t) hits.push(el.dataset.tile!);
    });
    setSelected([...new Set([...st.base, ...hits.filter((h) => !byId.get(h)?.broken)])]);
  };
  const onSectionUp = () => {
    const st = lassoStart.current;
    lassoStart.current = null;
    setLasso(null);
    if (st && !st.moved && !st.base.length) setSelected([]);
  };

  /* ── sharing and the client's reactions ──────────────────────── */
  const shareBoard = board && sharing === board.id ? board : sharing ? (boards.find((b) => b.id === sharing) ?? null) : null;

  const settle = (id: string) => {
    const tid = window.setTimeout(() => setVerdicts((m) => (m[id]?.fresh ? { ...m, [id]: { ...m[id], fresh: false } } : m)), 1600);
    timers.current.push(tid);
  };

  const setVerdict = (id: string, v: Verdict | null) => {
    if (v) settle(id);
    setVerdicts((m) => {
      const next = { ...m };
      if (v) next[id] = { by: project.client[0], verdict: v, fresh: true };
      else delete next[id];
      return next;
    });
  };

  const send = (b: Board) => {
    const who = project.client;
    setBoards((bs) => bs.map((x) => (x.id === b.id ? { ...x, shared: { with: who, on: "Just now" } } : x)));
    setSharing(null);
    setActive(b.id);
    setNudged((m) => ({ ...m, [b.id]: false }));
    setAllArrivals(false);
    showToast(`Sent to ${who.join(" and ")}. Their reactions will land on each picture.`);
    const pending = b.items.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a && a.kind === "image" && !verdicts[a.id])).slice(0, 3);
    const script: Verdict[] = ["love", "love", "pass"];
    pending.forEach((a, i) => {
      const by = who[i % who.length];
      const id = window.setTimeout(
        () => {
          setVerdicts((m) => ({ ...m, [a.id]: { by, verdict: script[i], fresh: true } }));
          settle(a.id);
          arrivalKey.current += 1;
          const key = arrivalKey.current;
          setArrivals((list) => [{ key, id: a.id, board: b.id, by, verdict: script[i] }, ...list]);
          if (activeRef.current !== b.id) setUnread((m) => ({ ...m, [b.id]: (m[b.id] ?? 0) + 1 }));
          if (activeRef.current !== b.id && activeRef.current !== "all") return;
          // Landed somewhere the user can't see: collect it in the jump chip.
          const root = rootRef.current;
          const tile = root?.querySelector(`[data-tile="${a.id}"]`)?.getBoundingClientRect();
          const box = root?.getBoundingClientRect();
          if (tile && box && (tile.top > box.bottom - 80 || tile.bottom < box.top + 120)) setOffscreen((list) => [...list, a.id]);
        },
        2400 + i * 1900,
      );
      timers.current.push(id);
    });
  };

  const selectionAssets = selected.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a));
  const openAsset = open ? byId.get(open) : undefined;
  const openIndex = open ? visible.findIndex((a) => a.id === open) : -1;

  const kindsLine = useMemo(() => {
    const pics = base.filter((a) => a.kind === "image").length;
    const other = base.length - pics;
    return `${pics} ${pics === 1 ? "picture" : "pictures"}${other ? `, ${other} ${other === 1 ? "document, quote or link" : "documents, quotes and links"}` : ""}`;
  }, [base]);

  const activeTone = hoverTone ?? tone;
  const toneCount = (t: ToneId) => base.filter((a) => a.tones.includes(t)).length;
  const imagesOf = (b: Board) => b.items.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a && a.kind === "image" && !a.broken));
  const clients = project.client.join(" and ");

  // One verb for the primary action, whatever board is open.
  const shareReady = Boolean(board && board.items.length);
  const primaryLabel = board?.shared && shareReady ? `Update ${board.shared.with.length === 1 ? `${board.shared.with[0]}'s` : "their"} page` : "Share as a page";
  const primaryShort = board?.shared && shareReady ? "Update" : "Share";
  const onPrimary = () => {
    if (board && shareReady) setSharing(board.id);
    else setMenu(menu === "share" ? null : "share");
  };
  const boardArrivals = board ? arrivals.filter((x) => x.board === board.id) : [];

  const renderTile = (a: Asset) => (
    <Tile
      asset={a}
      selected={selected.includes(a.id)}
      selecting={selected.length > 0}
      dimmed={Boolean(hoverTone && hoverTone !== tone && !a.tones.includes(hoverTone))}
      verdict={board?.shared || !board ? verdicts[a.id] : undefined}
      pulse={pulse?.id === a.id ? pulse.key : undefined}
      onToggle={toggle}
      onOpen={setOpen}
      onDragStart={onTileDragStart}
      onDragEnd={endDrag}
      onLongPress={(id) => setSelected((cur) => (cur.includes(id) ? cur : [...cur, id]))}
      onRelink={(id) => {
        setAssets((as) => as.map((x) => (x.id === id ? { ...x, broken: false, kind: "image", scene: "terrace", variant: 0, tones: ["night", "candle", "sky"], name: "Festoon reference.jpg" } : x)));
        showToast("Found it in Cian's Drive, in Lighting / references");
      }}
      onRemove={(id) => {
        if (board) setBoards((bs) => bs.map((b) => (b.id === board.id ? { ...b, items: b.items.filter((x) => x !== id) } : b)));
        showToast("Removed from this board");
      }}
    />
  );

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div ref={rootRef} className={s.root} data-dragging={dragging ? "" : undefined} onScroll={onRootScroll}>
      <header className={`${s.head} ${searchOpen || query ? s.headSearching : ""}`}>
        <div className={s.headMain}>
          <span className={s.projectMark} style={{ background: project.colour }} aria-hidden="true">
            {project.initials}
          </span>
          <div className={s.headText}>
            <h1 className={s.title}>
              <button type="button" className={s.titleBtn} aria-haspopup="menu" aria-expanded={menu === "project"} onClick={() => setMenu(menu === "project" ? null : "project")}>
                {project.name}
                <I.Chevron size={16} />
              </button>
            </h1>
            <p className={s.sub}>
              {project.line} <span aria-hidden="true">·</span> {projectAssets.length} files
            </p>
            {menu === "project" ? (
              <div className={`${s.pop} ${s.popProject}`} role="menu">
                {PROJECTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={p.id === projectId}
                    className={s.popItem}
                    onClick={() => {
                      setProjectId(p.id);
                      setActive("all");
                      setTone(null);
                      setSelected([]);
                      setMenu(null);
                    }}
                  >
                    <span className={s.projectDot} style={{ background: p.colour }}>
                      {p.initials}
                    </span>
                    <span className={s.popText}>
                      {p.name}
                      <em>{p.line}</em>
                    </span>
                    {p.id === projectId ? <I.Check size={14} /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className={s.headTools}>
          <button
            type="button"
            className={`${s.btn} ${s.iconOnly} ${s.searchToggle}`}
            aria-label="Find in this project"
            aria-expanded={searchOpen || Boolean(query)}
            onClick={() => {
              setSearchOpen((v) => !v);
              window.requestAnimationFrame(() => searchRef.current?.focus());
            }}
          >
            <I.Search size={15} />
          </button>
          <label className={s.search}>
            <I.Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => {
                if (!query) setSearchOpen(false);
              }}
              placeholder="Find a picture, colour or task"
              aria-label="Find in this project"
            />
            {query ? (
              <button type="button" className={s.searchClear} onClick={() => setQuery("")} aria-label="Clear search">
                <I.Close size={12} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>
          <button type="button" className={`${s.btn} ${s.uploadBtn}`} onClick={() => showToast("Drop files anywhere on the wall to upload")} aria-label="Upload">
            <I.Upload size={14} />
            <span className={s.hideXs}>Upload</span>
          </button>
          <div className={s.shareGroup}>
            <button type="button" className={s.btnPrimary} aria-haspopup={shareReady ? undefined : "menu"} aria-expanded={shareReady ? undefined : menu === "share"} onClick={onPrimary}>
              <I.Share size={14} />
              <span className={s.hideXs}>{primaryLabel}</span>
              <span className={s.showXs}>{primaryShort}</span>
            </button>
            {menu === "share" ? (
              <div className={`${s.pop} ${s.popShare}`} role="menu">
                <div className={s.popHead}>Share which board?</div>
                {projectBoards.map((b) => {
                  const empty = !b.items.length;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="menuitem"
                      disabled={empty}
                      className={`${s.popItem} ${s.popBoard}`}
                      onClick={() => {
                        switchBoard(b.id);
                        setSharing(b.id);
                      }}
                    >
                      <BoardThumbs assets={imagesOf(b)} />
                      <span className={s.popText}>
                        {b.name}
                        <em>{empty ? "Empty. Add a few pictures first." : b.shared ? `Shared with ${b.shared.with.join(" and ")}, ${reviewedIn(b)} of ${b.items.length} reviewed` : `${b.items.length} files, only your team can see it`}</em>
                      </span>
                    </button>
                  );
                })}
                {selected.length ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${s.popItem} ${s.popAccent}`}
                    onClick={() => {
                      const id = newBoard(selected);
                      setSharing(id);
                    }}
                  >
                    <I.Plus size={14} /> Make a board from the {selected.length} selected
                  </button>
                ) : (
                  <p className={s.popNote}>
                    <I.Lasso size={14} />
                    <span>Or pick pictures on the wall first. Share then makes a board from just those.</span>
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Board tabs and the colour strip (sticky, so tiles can be dragged up to them) ── */}
      <nav className={s.bar} aria-label="Boards">
        <div className={s.tabsWrap} data-fade-l={tabFade.l ? "" : undefined} data-fade-r={tabFade.r ? "" : undefined}>
          <div ref={tabsRef} className={s.tabs} role="tablist">
            <button type="button" role="tab" data-board="all" aria-selected={active === "all"} className={`${s.tab} ${active === "all" ? s.tabOn : ""}`} onClick={() => switchBoard("all")}>
              Everything <span className={s.count}>{projectAssets.length}</span>
            </button>
            {projectBoards.map((b) => {
              const on = active === b.id;
              const fresh = unread[b.id] ?? 0;
              return (
                <motion.button
                  key={b.id}
                  type="button"
                  role="tab"
                  data-board={b.id}
                  aria-selected={on}
                  aria-label={fresh ? `${b.name}, ${b.items.length} files, ${fresh} new ${fresh === 1 ? "reaction" : "reactions"}` : undefined}
                  className={`${s.tab} ${on ? s.tabOn : ""} ${dragging ? s.tabReady : ""} ${dropOn === b.id ? s.tabDrop : ""}`}
                  onClick={() => switchBoard(b.id)}
                  {...dropProps(b.id)}
                  animate={dropOn === b.id && !reduce ? { y: -2, scale: 1.04 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 26 }}
                >
                  <motion.span key={bumps[b.id] ?? 0} className={s.tabInner} initial={bumps[b.id] && !reduce ? { scale: 1.22 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 14 }}>
                    {b.shared ? <Avatar name={b.shared.with[0]} size={16} /> : null}
                    {renaming === b.id ? (
                      <input
                        className={s.rename}
                        defaultValue={b.name}
                        autoFocus
                        aria-label="Board name"
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                          e.stopPropagation();
                        }}
                        onBlur={(e) => {
                          const name = e.currentTarget.value.trim() || "Untitled board";
                          setBoards((bs) => bs.map((x) => (x.id === b.id ? { ...x, name } : x)));
                          setRenaming(null);
                        }}
                        size={Math.max(8, b.name.length)}
                      />
                    ) : (
                      <span onDoubleClick={() => setRenaming(b.id)} title="Double-click to rename">
                        {b.name}
                      </span>
                    )}
                    {renaming === b.id ? null : fresh ? (
                      <motion.span className={s.unread} initial={reduce ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }} aria-hidden="true">
                        {fresh} new
                      </motion.span>
                    ) : (
                      <span className={s.count}>
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span key={b.items.length} initial={reduce ? false : { y: 9, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -9, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className={s.countNum}>
                            {b.items.length}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    )}
                  </motion.span>
                </motion.button>
              );
            })}
            <button type="button" className={`${s.tab} ${s.tabNew} ${dropOn === "new" ? s.tabDrop : ""}`} onClick={() => newBoard()} {...dropProps("new")}>
              <I.Plus size={13} /> New board
            </button>
          </div>
        </div>

        {/* Wide: the strip itself. Narrow: a swatch button that opens the same colours as a list. */}
        <div className={s.paletteWrap} data-nolasso hidden={!palette.length} onMouseLeave={() => setHoverTone(null)}>
          <span className={s.paletteLabel}>
            <span className={s.paletteText} aria-live="polite">
              {activeTone ? (
                <>
                  {TONES[activeTone].name} <span className={s.paletteN}>{toneCount(activeTone)}</span>
                </>
              ) : board ? (
                "Colours on this board"
              ) : (
                "Colours in this project"
              )}
            </span>
            {tone && (!hoverTone || hoverTone === tone) ? (
              <button type="button" className={s.clearTone} onClick={() => setTone(null)} aria-label={`Clear the ${TONES[tone].name.toLowerCase()} filter`}>
                <I.Close size={12} />
              </button>
            ) : null}
          </span>
          <div className={s.palette} role="group" aria-label="Filter by colour">
            {palette.map((t, i) => {
              const on = tone === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${TONES[t].name}, ${toneCount(t)} files. Shortcut ${i + 1}`}
                  className={`${s.swatch} ${on ? s.swatchOn : ""} ${tone && !on ? s.swatchOff : ""}`}
                  style={{ "--sw": TONES[t].hex, color: inkFor(TONES[t].hex) } as CSSProperties}
                  onMouseEnter={() => setHoverTone(t)}
                  onFocus={() => setHoverTone(t)}
                  onBlur={() => setHoverTone(null)}
                  onClick={() => {
                    setTone(on ? null : t);
                    setHoverTone(null);
                  }}
                >
                  {on ? <I.Check size={12} /> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className={s.paletteMenu} data-nolasso hidden={!palette.length}>
          <button
            type="button"
            className={`${s.paletteBtn} ${tone ? s.paletteBtnOn : ""}`}
            aria-haspopup="menu"
            aria-expanded={menu === "palette"}
            aria-label={tone ? `Colour filter: ${TONES[tone].name}` : "Filter by colour"}
            onClick={() => setMenu(menu === "palette" ? null : "palette")}
          >
            <span className={s.paletteDots} aria-hidden="true">
              {(tone ? [tone] : palette.slice(0, 4)).map((t) => (
                <i key={t} style={{ background: TONES[t].hex }} />
              ))}
            </span>
            {tone ? <span className={s.paletteBtnName}>{TONES[tone].name}</span> : null}
          </button>
          {menu === "palette" ? (
            <div className={`${s.pop} ${s.popPalette}`} role="menu">
              <div className={s.popHead}>Colours in {board ? board.name : "this project"}</div>
              {palette.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="menuitemradio"
                  aria-checked={tone === t}
                  className={s.popItem}
                  onClick={() => {
                    setTone(tone === t ? null : t);
                    setMenu(null);
                  }}
                >
                  <span className={s.popSwatch} style={{ background: TONES[t].hex }} />
                  <span className={s.popText}>{TONES[t].name}</span>
                  <span className={s.count}>{toneCount(t)}</span>
                  {tone === t ? <I.Check size={14} /> : null}
                </button>
              ))}
              {tone ? (
                <button
                  type="button"
                  role="menuitem"
                  className={`${s.popItem} ${s.popAccent}`}
                  onClick={() => {
                    setTone(null);
                    setMenu(null);
                  }}
                >
                  Show every colour
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>

      <section ref={sectionRef} className={s.section} onPointerDown={onSectionDown} onPointerMove={onSectionMove} onPointerUp={onSectionUp} onPointerCancel={onSectionUp} aria-label="Wall">
        {/* ── Board status ── */}
        {board?.shared && board.items.length ? (
          <SharedBanner
            board={board}
            reviewed={reviewedIn(board)}
            loved={lovedIn(board)}
            nudged={Boolean(nudged[board.id])}
            onOpen={() => setSharing(board.id)}
            onNudge={() => {
              setNudged((m) => ({ ...m, [board.id]: true }));
              showToast(`Reminder sent to ${board.shared!.with.join(" and ")}`);
            }}
          >
            <ArrivalStack
              items={boardArrivals}
              expanded={allArrivals}
              onExpand={() => setAllArrivals(true)}
              onShow={showTile}
              onClear={() => setArrivals((list) => list.filter((x) => x.board !== board.id))}
              byId={byId}
            />
          </SharedBanner>
        ) : board && board.items.length ? (
          <div className={s.quietStatus} data-nolasso>
            <span>{kindsLine}. Only your team can see this board.</span>
            <button type="button" className={s.linkBtn} onClick={() => setSharing(board.id)}>
              Share as a page for {clients}
            </button>
          </div>
        ) : !board ? (
          <div className={s.quietStatus} data-nolasso>
            <span>{kindsLine}.</span>
            <span className={s.hint}>
              <I.Lasso size={14} /> Drag pictures up onto a board, or draw a box from the margin to pick several.
            </span>
          </div>
        ) : null}

        {board && !board.items.length ? (
          <EmptyBoard
            board={board}
            clients={clients}
            candidates={projectAssets.filter((a) => !a.broken)}
            linkDraft={linkDraft}
            setLinkDraft={setLinkDraft}
            onLink={(url) => addLink(board.id, url)}
            onAdd={(id) => addToBoard(board.id, [id])}
            onDragStart={onTileDragStart}
            onDragEnd={endDrag}
            dropping={dropOn === `zone-${board.id}`}
            zoneProps={{
              onDragOver: (e: DragEvent) => {
                if (!dragging) return;
                e.preventDefault();
                setDropOn(`zone-${board.id}`);
              },
              onDragLeave: () => setDropOn(null),
              onDrop: (e: DragEvent) => {
                e.preventDefault();
                const ids = (e.dataTransfer.getData("text/plain") || "").split(",").filter((x) => byId.has(x));
                endDrag();
                if (ids.length) addToBoard(board.id, ids);
              },
            }}
          />
        ) : null}

        {tone && !visible.length ? (
          <p className={s.none}>
            Nothing on this board in {TONES[tone].name.toLowerCase()}.{" "}
            <button type="button" className={s.linkBtn} onClick={() => setTone(null)}>
              Show everything
            </button>
          </p>
        ) : null}
        {query && !visible.length ? <p className={s.none}>Nothing matches &ldquo;{query}&rdquo; here.</p> : null}

        <div ref={wallRef} className={`${s.wall} ${layout ? "" : s.wallFb}`} style={layout ? { height: layout.height } : (fallback?.wall as CSSProperties)}>
          {layout ? (
            <AnimatePresence initial={false}>
              {visible.map((a, i) => {
                const p = layout.px.get(a.id)!;
                return (
                  <motion.div
                    key={a.id}
                    className={s.slot}
                    style={{ width: layout.colW, height: p.h }}
                    initial={reduce ? { opacity: 0, x: p.x, y: p.y } : { opacity: 0, x: p.x, y: p.y + 18, scale: 0.97 }}
                    animate={{ opacity: 1, x: p.x, y: p.y, scale: 1 }}
                    exit={{ opacity: 0, scale: reduce ? 1 : 0.94, transition: { duration: 0.16 } }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 30, mass: 0.9, delay: Math.min(i * 0.014, 0.42) }}
                  >
                    {renderTile(a)}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : (
            visible.map((a) => (
              <div key={a.id} className={`${s.slot} ${s.fb}`} style={fallback?.tiles.get(a.id) as CSSProperties}>
                {renderTile(a)}
              </div>
            ))
          )}
        </div>

        {lasso ? <div className={s.lasso} style={{ left: lasso.x, top: lasso.y, width: lasso.w, height: lasso.h }} aria-hidden="true" /> : null}

        {visible.length ? (
          <p className={s.foot}>
            {visible.length === base.length ? `All ${base.length} shown.` : `${visible.length} of ${base.length} shown.`} <kbd>⌘</kbd>
            <kbd>A</kbd> selects all, <kbd>1</kbd>–<kbd>5</kbd> filter by colour.
          </p>
        ) : null}
      </section>

      {/* ── Floating layer: selection bar, toast and the new-reactions chip, stacked clear of the shell's own pill ── */}
      <div className={s.float}>
        <div className={s.floatStack}>
          <AnimatePresence>
            {selected.length ? (
              <motion.div
                key="bar"
                layout={!reduce}
                className={s.selBar}
                role="toolbar"
                aria-label={`${selected.length} selected`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 460, damping: 32 }}
              >
                <span className={s.selThumbs} aria-hidden="true">
                  {[...selectionAssets]
                    .sort((x, y) => Number(y.kind === "image") - Number(x.kind === "image"))
                    .slice(0, 3)
                    .map((a) => (
                      <span key={a.id} className={`${s.selThumb} ${a.kind === "image" ? "" : s.selThumbDoc}`}>
                        {a.kind === "image" ? <Face asset={a} /> : a.kind === "link" ? <I.Link size={14} /> : <I.Board size={14} />}
                      </span>
                    ))}
                </span>
                <span className={s.selCount}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={selected.length} initial={reduce ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }}>
                      {selected.length}
                    </motion.span>
                  </AnimatePresence>
                  <span className={s.hideSm}>selected</span>
                </span>
                <span className={s.selDivider} />
                <div className={s.selGroup}>
                  <button type="button" className={s.selBtn} aria-haspopup="menu" aria-expanded={menu === "board"} onClick={() => setMenu(menu === "board" ? null : "board")}>
                    <I.Board size={15} />
                    <span className={s.hideSm}>Add to board</span>
                    <span className={s.showSm}>Board</span>
                  </button>
                  {menu === "board" ? (
                    <div className={`${s.pop} ${s.popUp} ${s.popBoards}`} role="menu">
                      <div className={s.popHead}>
                        Add {selected.length} {selected.length === 1 ? "file" : "files"} to a board
                      </div>
                      {[...projectBoards]
                        .sort((x, y) => Number(x.id === board?.id) - Number(y.id === board?.id))
                        .map((b) => {
                          const have = selected.filter((id) => b.items.includes(id)).length;
                          const all = have === selected.length;
                          const here = b.id === board?.id;
                          const note = all ? (selected.length === 1 ? "Already here" : `All ${selected.length} already here`) : have ? `${have} of ${selected.length} already here` : `${b.items.length} ${b.items.length === 1 ? "file" : "files"}`;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              role="menuitem"
                              disabled={all}
                              className={`${s.popItem} ${s.popBoard} ${here ? s.popHere : ""}`}
                              onClick={() => {
                                addToBoard(b.id, selected);
                                setMenu(null);
                              }}
                            >
                              <BoardThumbs assets={imagesOf(b)} />
                              <span className={s.popText}>
                                {b.name}
                                <em>
                                  {here ? "This board. " : ""}
                                  {note}
                                </em>
                              </span>
                              {all ? <I.Check size={14} /> : null}
                            </button>
                          );
                        })}
                      <button type="button" role="menuitem" className={`${s.popItem} ${s.popAccent}`} onClick={() => newBoard(selected)}>
                        <I.Plus size={14} /> New board from these
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={s.selBtn}
                  onClick={() => {
                    if (board) setSharing(board.id);
                    else {
                      const id = newBoard(selected);
                      setSharing(id);
                    }
                    setSelected([]);
                  }}
                >
                  <I.Share size={15} />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  className={s.selBtn}
                  onClick={() => {
                    showToast(`Preparing ${selected.length} ${selected.length === 1 ? "file" : "files"} to download`);
                    setSelected([]);
                  }}
                >
                  <I.Download size={15} />
                  <span>Download</span>
                </button>
                <div className={s.selGroup}>
                  <button type="button" className={s.selBtn} aria-haspopup="menu" aria-expanded={menu === "task"} onClick={() => setMenu(menu === "task" ? null : "task")}>
                    <I.Task size={15} />
                    <span className={s.hideSm}>Attach to task</span>
                    <span className={s.showSm}>Task</span>
                  </button>
                  {menu === "task" ? (
                    <div className={`${s.pop} ${s.popUp} ${s.popRight}`} role="menu">
                      <div className={s.popHead}>Attach {selected.length} to a task</div>
                      {TASKS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="menuitem"
                          className={s.popItem}
                          onClick={() => {
                            showToast(`Attached ${selected.length} to ${t}`);
                            setMenu(null);
                            setSelected([]);
                          }}
                        >
                          <I.Task size={14} />
                          <span className={s.popText}>{t}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button type="button" className={`${s.selBtn} ${s.selClose}`} onClick={() => setSelected([])} aria-label="Clear selection">
                  <I.Close size={14} />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {toast ? (
              <motion.div key={toast.key} layout={!reduce} className={s.toast} role="status" initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 34 }}>
                <span>{toast.text}</span>
                {toast.undo ? (
                  <button type="button" onClick={toast.undo}>
                    Undo
                  </button>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {offscreen.length ? (
              <motion.button
                key="jump"
                type="button"
                layout={!reduce}
                className={s.jump}
                onClick={() => showTile(offscreen[0])}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 480, damping: 30 }}
              >
                <span className={s.jumpHeart} aria-hidden="true">
                  <I.Heart size={11} filled />
                </span>
                {offscreen.length} new {offscreen.length === 1 ? "reaction" : "reactions"}
                <I.Down size={14} />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {shareBoard ? (
          <ShareModal
            key="share"
            board={shareBoard}
            project={project}
            assets={shareBoard.items.map((id) => byId.get(id)).filter((a): a is Asset => Boolean(a))}
            palette={palette}
            verdicts={verdicts}
            onVerdict={setVerdict}
            onClose={() => setSharing(null)}
            onSend={() => send(shareBoard)}
            onCopy={() => showToast("Link copied")}
          />
        ) : null}
        {openAsset && openIndex >= 0 ? (
          <Lightbox
            key="lb"
            asset={openAsset}
            index={openIndex}
            total={visible.length}
            boards={projectBoards}
            verdict={verdicts[openAsset.id]}
            onClose={() => setOpen(null)}
            onNav={(d) => setOpen(visible[(openIndex + d + visible.length) % visible.length].id)}
            onToggleBoard={(bid) => {
              const b = boards.find((x) => x.id === bid);
              if (!b) return;
              if (b.items.includes(openAsset.id)) setBoards((bs) => bs.map((x) => (x.id === bid ? { ...x, items: x.items.filter((i) => i !== openAsset.id) } : x)));
              else addToBoard(bid, [openAsset.id]);
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function BoardThumbs({ assets }: { assets: Asset[] }) {
  return (
    <span className={s.boardThumbs} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={s.boardThumb}>
          {assets[i] ? <Face asset={assets[i]} /> : null}
        </span>
      ))}
    </span>
  );
}

function SharedBanner({ board, reviewed, loved, nudged, onOpen, onNudge, children }: { board: Board; reviewed: number; loved: number; nudged: boolean; onOpen: () => void; onNudge: () => void; children?: ReactNode }) {
  const total = board.items.length;
  const who = board.shared!.with;
  const names = who.join(" and ");
  const passed = reviewed - loved;
  const justNow = board.shared!.on === "Just now";
  const when = justNow ? "just now" : `on ${board.shared!.on}`;
  return (
    <div className={s.banner} data-nolasso>
      <div className={s.bannerTop}>
        <span className={s.bannerWho}>
          {who.map((w) => (
            <Avatar key={w} name={w} size={26} ring />
          ))}
        </span>
        <div className={s.bannerText}>
          <strong>
            <span className={s.bannerLong}>
              Shared with {names} {when},{" "}
            </span>
            {reviewed} of {total} reviewed
          </strong>
          <span className={s.bannerMeter} aria-hidden="true">
            <motion.i className={s.meterLove} initial={false} animate={{ width: `${(loved / total) * 100}%` }} transition={{ type: "spring", stiffness: 180, damping: 26 }} />
            <motion.i className={s.meterPass} initial={false} animate={{ width: `${(passed / total) * 100}%` }} transition={{ type: "spring", stiffness: 180, damping: 26 }} />
          </span>
          <span className={s.bannerSub}>
            {loved} loved, {passed} not for them, {total - reviewed} still to see
          </span>
        </div>
        <div className={s.bannerActions}>
          {reviewed < total ? (
            justNow || nudged ? (
              <span className={s.bannerSent}>
                <I.Check size={14} />
                <span className={s.hideXs}>{nudged ? "Reminder sent" : "Sent just now"}</span>
              </span>
            ) : (
              <button type="button" className={s.btn} onClick={onNudge} aria-label={`Nudge ${names}`}>
                <I.Bell size={14} />
                <span className={s.hideXs}>Nudge {names}</span>
              </button>
            )
          ) : null}
          <button type="button" className={s.btn} onClick={onOpen} aria-label="Open the page">
            <I.Eye size={14} />
            <span className={s.hideXs}>Open the page</span>
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function ArrivalStack({ items, expanded, onExpand, onShow, onClear, byId }: { items: Arrival[]; expanded: boolean; onExpand: () => void; onShow: (id: string) => void; onClear: () => void; byId: Map<string, Asset> }) {
  const reduce = useReducedMotion();
  const shown = expanded ? items : items.slice(0, 3);
  const more = items.length - shown.length;
  return (
    <AnimatePresence initial={false}>
      {items.length ? (
        <motion.div key="stack" className={s.arrivals} initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 380, damping: 36 }}>
          <div className={s.arrivalsHead}>
            <span>Just in from the page</span>
            <button type="button" className={s.linkBtnQuiet} onClick={onClear}>
              Clear
            </button>
          </div>
          <ul className={s.arrivalList} aria-live="polite">
            <AnimatePresence initial={false}>
              {shown.map((x) => {
                const a = byId.get(x.id);
                if (!a) return null;
                const what = a.caption ?? bare(a.name);
                return (
                  <motion.li key={x.key} className={s.arrival} initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 420, damping: 36 }}>
                    <div className={s.arrivalRow}>
                      <span className={s.arrivalThumb}>
                        <Face asset={a} />
                        <span className={s.arrivalBy} style={{ "--ring": PEOPLE[x.by] ?? "var(--v3-accent)" } as CSSProperties}>
                          <Avatar name={x.by} size={18} ring />
                        </span>
                      </span>
                      <span className={s.arrivalText}>
                        <span className={`${s.arrivalMark} ${x.verdict === "love" ? s.arrivalLove : ""}`} aria-hidden="true">
                          {x.verdict === "love" ? <I.Heart size={12} filled /> : <I.Pass size={12} />}
                        </span>
                        <b>{x.by}</b> {x.verdict === "love" ? "loved" : "passed on"} <span className={s.arrivalWhat}>{what}</span>
                      </span>
                      <span className={s.arrivalWhen}>Just now</span>
                      <button type="button" className={s.arrivalShow} onClick={() => onShow(x.id)} aria-label={`Show ${what} on the wall`}>
                        Show
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {more > 0 ? (
            <button type="button" className={s.arrivalsMore} onClick={onExpand}>
              {more} more
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EmptyBoard({
  board,
  clients,
  candidates,
  linkDraft,
  setLinkDraft,
  onLink,
  onAdd,
  onDragStart,
  onDragEnd,
  dropping,
  zoneProps,
}: {
  board: Board;
  clients: string;
  candidates: Asset[];
  linkDraft: string;
  setLinkDraft: (v: string) => void;
  onLink: (url: string) => void;
  onAdd: (id: string) => void;
  onDragStart: (id: string, e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  dropping: boolean;
  zoneProps: { onDragOver: (e: DragEvent) => void; onDragLeave: () => void; onDrop: (e: DragEvent) => void };
}) {
  const [all, setAll] = useState(false);
  const first = candidates.slice(0, 14);
  const list = all ? candidates : first;
  return (
    <div className={s.empty} data-nolasso>
      <div className={`${s.zone} ${dropping ? s.zoneOn : ""}`} {...zoneProps}>
        <div className={s.zoneArt} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2 className={s.zoneTitle}>Start {board.name === "Untitled board" ? "this board" : board.name} with a few pictures</h2>
        <ol className={s.steps}>
          <li>
            <span className={s.stepArt} aria-hidden="true">
              <i className={s.stepCard} />
              <i className={s.stepPlus}>
                <I.Plus size={10} />
              </i>
            </span>
            <span>
              <b>Drag from below, or click +</b>
              Pictures, quotes and documents from this project
            </span>
          </li>
          <li>
            <span className={s.stepArt} aria-hidden="true">
              <i className={s.stepLink}>
                <I.Link size={13} />
              </i>
            </span>
            <span>
              <b>Paste a link anywhere</b>
              Pinterest, Instagram or a supplier&rsquo;s page
            </span>
          </li>
        </ol>
        <form
          className={s.zoneForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (linkDraft.trim()) onLink(linkDraft.trim());
          }}
        >
          <I.Link size={14} />
          <input value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} placeholder="Paste a link" aria-label="Paste a link" />
          <button type="submit" className={s.btnSmall} disabled={!linkDraft.trim()}>
            Add
          </button>
        </form>
        <p className={s.zoneNote}>Once it has a few pictures you can share it as a page for {clients}. Double-click the board name to rename it.</p>
      </div>
      <div className={s.tray}>
        <div className={s.trayHead}>
          <span>
            From this project <span className={s.count}>{candidates.length}</span>
          </span>
          {candidates.length > first.length ? (
            <button type="button" className={s.linkBtn} onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? "Show fewer" : `Show all ${candidates.length}`}
            </button>
          ) : null}
        </div>
        <div className={`${s.trayRow} ${all ? s.trayAll : ""}`}>
          {list.map((a) => (
            <div key={a.id} className={s.trayItem} style={{ aspectRatio: `1 / ${a.ratio}` }} draggable onDragStart={(e) => onDragStart(a.id, e)} onDragEnd={onDragEnd}>
              <div className={s.trayFace}>
                <Face asset={a} />
              </div>
              <button type="button" className={s.trayAdd} onClick={() => onAdd(a.id)} aria-label={`Add ${bare(a.name)} to ${board.name}`}>
                <I.Plus size={13} />
              </button>
            </div>
          ))}
          {!all && candidates.length > first.length ? (
            <button type="button" className={s.trayMore} onClick={() => setAll(true)}>
              All {candidates.length}
              <I.Right size={14} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
