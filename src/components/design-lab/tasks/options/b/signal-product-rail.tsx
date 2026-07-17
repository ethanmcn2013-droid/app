"use client";

import { RailIcon, type RailIconName } from "./signal-rail-icons";
import styles from "./signal-shell.module.css";

const CORE_PRODUCTS: Array<{ key: RailIconName; label: string }> = [
  { key: "notes", label: "Notes" },
  { key: "tasks", label: "Tasks" },
  { key: "timeline", label: "Timeline" },
  { key: "signal", label: "Signal" },
];

const UTILITIES: Array<{ key: RailIconName; label: string }> = [
  { key: "updates", label: "Updates" },
  { key: "team", label: "Team" },
  { key: "settings", label: "Settings" },
];

const PREVIEW_TIP = "Preview only in this lab";

export function SignalProductRail({ onSearchRequest }: { onSearchRequest: () => void }) {
  return (
    <aside aria-label="Signal Studio products" className={styles.signalRail} data-signal-product-rail="true">
      <button
        aria-disabled="true"
        aria-label="Signal Studio Home"
        className={styles.railHome}
        data-tip={`Signal Studio Home · ${PREVIEW_TIP}`}
        type="button"
      >
        <span aria-hidden="true" className={styles.railHomeTile}><span className={styles.railHomeDot} /></span>
      </button>
      <span aria-hidden="true" className={styles.railDivider} />
      <nav aria-label="Products" className={styles.railProducts}>
        {CORE_PRODUCTS.map((product) => {
          const active = product.key === "tasks";
          return (
            <button
              aria-current={active ? "page" : undefined}
              aria-disabled={active ? undefined : "true"}
              className={styles.railProduct}
              data-active={active || undefined}
              data-product={product.key}
              data-tip={active ? `${product.label} · current product` : `${product.label} · ${PREVIEW_TIP}`}
              key={product.key}
              type="button"
            >
              <span aria-hidden="true" className={styles.railTile}>
                <RailIcon accentClassName={styles.iconAccent} name={product.key} size={20} />
              </span>
              <span className={styles.railLabel}>{product.label}</span>
            </button>
          );
        })}
      </nav>
      <span aria-hidden="true" className={styles.railDivider} />
      <button
        aria-disabled="true"
        className={styles.railProduct}
        data-product="more"
        data-tip={`More products · ${PREVIEW_TIP}`}
        type="button"
      >
        <span aria-hidden="true" className={styles.railTile}>
          <RailIcon accentClassName={styles.iconAccent} name="more" size={20} />
        </span>
        <span className={styles.railLabel}>More</span>
      </button>
      <span className={styles.railSpacer} />
      <button
        aria-label="Search"
        className={styles.railUtility}
        data-tip="Search this view · press /"
        onClick={onSearchRequest}
        type="button"
      >
        <RailIcon name="search" size={18} />
      </button>
      {UTILITIES.map((utility) => (
        <button
          aria-disabled="true"
          aria-label={utility.label}
          className={styles.railUtility}
          data-tip={`${utility.label} · ${PREVIEW_TIP}`}
          key={utility.key}
          type="button"
        >
          <RailIcon name={utility.key} size={18} />
        </button>
      ))}
      <div className={styles.railAccount} title="Ethan · Founder">
        <span aria-hidden="true">EC</span>
        <span className={styles.srOnly}>Signed in as Ethan</span>
      </div>
    </aside>
  );
}
