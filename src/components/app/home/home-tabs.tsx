import Link from "next/link";
import styles from "./home-tabs.module.css";

/** Home's two views retain their existing data and runtime boundaries. */
export function HomeTabs({ active }: {
  active: "home" | "inbox";
}) {
  return (
    <nav className={styles.tabs} aria-label="Home views">
      {([{ id: "home", label: "Home", href: "/app/home" },
        { id: "inbox", label: "Inbox", href: "/app/inbox" }] as const).map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={styles.tab}
          aria-current={active === tab.id ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
