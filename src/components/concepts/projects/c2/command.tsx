"use client";

import { motion } from "motion/react";
import s from "./ledger.module.css";
import { KIND_LABEL, TEMPLATES, fmtDate, type Project } from "./data";
import { Icon, Kbd, StatusGlyph, Swatch } from "./parts";
import { Menu } from "./popovers";

export type Command =
  | { type: "go"; id: string }
  | { type: "template"; id: string }
  | { type: "new" }
  | { type: "group"; by: "status" | "owner" | "none" }
  | { type: "view"; id: "risk" | "wrapped" };

export function CommandMenu({ projects, onRun, onClose }: { projects: Project[]; onRun: (c: Command) => void; onClose: () => void }) {
  const items = [
    { id: "new", label: "New project", text: "new project create blank", icon: <Icon.plus size={14} />, hint: <Kbd>N</Kbd>, section: "Create" },
    ...TEMPLATES.map((t) => ({
      id: `tpl:${t.id}`,
      label: (
        <span className={s.cmdTpl}>
          <span>Create project from template: {t.name}</span>
          <span className={s.cmdTplBlurb}>{t.blurb}</span>
        </span>
      ),
      text: `create project from template ${t.name} ${KIND_LABEL[t.kind]}`,
      icon: <Icon.template size={14} />,
      section: "Create",
    })),
    ...projects.map((p) => ({
      id: `go:${p.id}`,
      label: (
        <span className={s.cmdGo}>
          <span className={s.cmdGoName}>{p.name}</span>
          <span className={s.cmdGoMeta}>{fmtDate(p.date)}</span>
        </span>
      ),
      text: `go to project ${p.name}`,
      icon: (
        <span className={s.cmdGoIcon}>
          <Swatch tone={p.tone} name={p.name} size={16} />
        </span>
      ),
      hint: <StatusGlyph status={p.status} />,
      section: "Go to project",
    })),
    { id: "grp:status", label: "Group by status", text: "group by status", icon: <Icon.group size={14} />, section: "View" },
    { id: "grp:owner", label: "Group by owner", text: "group by owner", icon: <Icon.group size={14} />, section: "View" },
    { id: "view:risk", label: "Show projects at risk", text: "show at risk", icon: <Icon.filter size={14} />, section: "View" },
    { id: "view:wrapped", label: "Show wrapped projects", text: "show wrapped archive", icon: <Icon.archive size={14} />, section: "View" },
  ];

  return (
    <div
      className={s.layer}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <motion.div className={s.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={onClose} />
      <motion.div
        className={s.cmdk}
        role="dialog"
        aria-label="Command menu"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Menu
          search
          placeholder="Go to a project, create one, or change the view"
          items={items}
          onSelect={(id) => {
            if (id === "new") onRun({ type: "new" });
            else if (id.startsWith("tpl:")) onRun({ type: "template", id: id.slice(4) });
            else if (id.startsWith("go:")) onRun({ type: "go", id: id.slice(3) });
            else if (id.startsWith("grp:")) onRun({ type: "group", by: id.slice(4) as "status" | "owner" });
            else if (id.startsWith("view:")) onRun({ type: "view", id: id.slice(5) as "risk" | "wrapped" });
          }}
          footer={
            <div className={s.cmdFoot}>
              <span>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> move
              </span>
              <span>
                <Kbd>↵</Kbd> run
              </span>
              <span>
                <Kbd>esc</Kbd> close
              </span>
            </div>
          }
        />
      </motion.div>
    </div>
  );
}
