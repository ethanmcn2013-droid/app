"use client";

/**
 * The account menu behind the avatar in the top bar (sprint item 10).
 *
 * Grouped so it reads at a glance: who you are; Settings, Your activity,
 * Language and Get help; Upgrade, Give a guest pass and What's new; Log out;
 * then View profile. Anything without a service behind it yet says "Coming
 * soon" and does nothing, rather than pretending.
 *
 * Signed in, the name, photo and Log out come from Clerk. In the demo and
 * review builds there is no Clerk, so the same menu shows the demo operator
 * and Log out explains why it is not available.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { isDemoMode } from "@/lib/access-mode";
import { ShellIcon } from "./shell-icons";
import styles from "./shell.module.css";

const HELP_HREF = "mailto:hello@signalstudio.ie?subject=Signal%20Studio%20help";

type Identity = Readonly<{ name: string; email: string | null; imageUrl: string | null }>;

export function AccountMenu() {
  return isDemoMode() ? <AccountMenuView identity={{ name: "Demo operator", email: null, imageUrl: null }} onSignOut={null} /> : <ClerkAccountMenu />;
}

function ClerkAccountMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const identity: Identity = {
    name: user?.fullName?.trim() || user?.username || user?.primaryEmailAddress?.emailAddress || "Your account",
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    imageUrl: user?.hasImage ? user.imageUrl : null,
  };
  return <AccountMenuView identity={identity} onSignOut={() => void signOut({ redirectUrl: "/" })} />;
}

function initialsOf(name: string): string {
  const parts = name.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Avatar({ identity, size }: { identity: Identity; size: "sm" | "md" }) {
  return (
    <span className={styles.accountAvatar} data-size={size} aria-hidden="true">
      {identity.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Clerk's own avatar URL, already sized.
        <img src={identity.imageUrl} alt="" width={size === "sm" ? 28 : 36} height={size === "sm" ? 28 : 36} />
      ) : (
        initialsOf(identity.name)
      )}
    </span>
  );
}

function AccountMenuView({ identity, onSignOut }: { identity: Identity; onSignOut: (() => void) | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open, close]);

  // Up and down walk the entries, Home and End jump, Escape hands focus back.
  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => {
      event.preventDefault();
      items[(i + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") go(index + 1);
    else if (event.key === "ArrowUp") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(items.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") close();
  };

  return (
    <div ref={rootRef} className={styles.account}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.accountButton}
        aria-label={`Account: ${identity.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar identity={identity} size="sm" />
      </button>
      {open ? (
        <div ref={menuRef} className={`${styles.menu} ${styles.accountMenu}`} role="menu" aria-label="Account" onKeyDown={onMenuKey}>
          <div className={styles.accountHead}>
            <Avatar identity={identity} size="md" />
            <span className={styles.accountWho}>
              <span className={styles.accountName}>{identity.name}</span>
              {identity.email ? <span className={styles.accountEmail}>{identity.email}</span> : null}
            </span>
          </div>
          <div className={styles.menuGroup} role="group" aria-label="Your account">
            <Entry href="/app/settings" icon={<ShellIcon.settings />} onDone={close}>
              Settings
            </Entry>
            <Soon icon={<ShellIcon.pulse />}>Your activity</Soon>
            <Soon icon={<ShellIcon.layers />}>Language</Soon>
            <Entry href={HELP_HREF} icon={<ShellIcon.help />} onDone={close}>
              Get help
            </Entry>
          </div>
          <div className={styles.menuGroup} role="group" aria-label="Plan and news">
            <Entry href="/settings/plan" icon={<ShellIcon.arrowRight />} onDone={close}>
              Upgrade
            </Entry>
            <Soon icon={<ShellIcon.plus />}>Give a guest pass</Soon>
            <Soon icon={<ShellIcon.bell />}>What&apos;s new</Soon>
          </div>
          <div className={styles.menuGroup} role="group" aria-label="Session">
            {onSignOut ? (
              <button type="button" role="menuitem" onClick={onSignOut}>
                <ShellIcon.close /> Log out
              </button>
            ) : (
              <button type="button" role="menuitem" aria-disabled="true" className={styles.menuSoon} title="There is no account to leave in the demo.">
                <ShellIcon.close /> Log out <span className={styles.menuHint}>Not in the demo</span>
              </button>
            )}
          </div>
          <div className={styles.menuGroup} role="group" aria-label="Profile">
            <Entry href="/settings/profile" icon={<ShellIcon.checkCircle />} onDone={close}>
              View profile
            </Entry>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Entry({ href, icon, children, onDone }: { href: string; icon: ReactNode; children: ReactNode; onDone: () => void }) {
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} role="menuitem" onClick={() => onDone()}>
        {icon} {children}
      </a>
    );
  }
  return (
    <Link href={href} role="menuitem" onClick={() => onDone()}>
      {icon} {children}
    </Link>
  );
}

/** Shown so the shape of the finished menu is visible; it does nothing yet. */
function Soon({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" aria-disabled="true" className={styles.menuSoon} title="Coming soon">
      {icon} {children} <span className={styles.menuHint}>Coming soon</span>
    </button>
  );
}
