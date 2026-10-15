"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/primitives/dialog";
import styles from "./ping-overlay.module.css";

export function PingMic({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1M12 18v3m-3 0h6" />
  </svg>;
}

export function PingDock({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div className={styles.dock} aria-label="Ping commands">{children}</div>, document.body);
}

export function PingOverlay({ open, onClose, projectName, selectedCount, children }: {
  open: boolean; onClose: () => void; projectName: string | null; selectedCount: number; children: ReactNode;
}) {
  return <Dialog open={open} onClose={onClose} ariaLabel="Ping" width={460}>
    <div className={styles.overlay} data-testid="ping-overlay">
      <header className={styles.header}>
        <div className={styles.identity}><span className={styles.brandMark}><PingMic /></span><div>
          <h2 className={styles.name}>Ping</h2>
          <p className={styles.context} title={projectName || "Current Project"}>{projectName || "Current Project"}<span aria-hidden="true"> · </span>{selectedCount ? `${selectedCount} selected` : "New tasks"}</p>
        </div></div>
        <button type="button" className={styles.close} aria-label="Close Ping" data-dialog-skip-focus onClick={onClose}>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  </Dialog>;
}
