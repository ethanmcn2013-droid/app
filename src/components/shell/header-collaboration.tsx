"use client";

import { Suspense, useLayoutEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AvatarStack } from "@/components/app/presence/avatar-stack";
import { HeaderInvite } from "@/components/tasks/header-invite";
import { Popover } from "@/components/tasks/ui";
import { headerRouteKey, headerScopeAllowed, visibleHeaderData, type HeaderCollaborationData } from "@/lib/projects/header-collaboration-scope";
import { useHeaderCollaboration } from "./header-collaboration-context";
import styles from "./header-collaboration.module.css";

/** Only the small header slot uses search params; the application never suspends behind it. */
export function HeaderCollaboration() {
  return <Suspense fallback={null}><CurrentPageCollaboration /></Suspense>;
}

function CurrentPageCollaboration() {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const context = useHeaderCollaboration();
  const dispatch = context?.dispatch;
  const key = headerRouteKey(pathname, new URLSearchParams(search.toString()));
  useLayoutEffect(() => { dispatch?.({ type: "route", routeKey: key }); }, [dispatch, key]);
  const data = context ? visibleHeaderData(context.state, key) : null;
  if (!data || !headerScopeAllowed(pathname, new URLSearchParams(search.toString()))) return null;
  return <HeaderProjectControls key={`${key}:${context?.state.epoch}`} data={data} />;
}

export function HeaderProjectControls({ data }: { data: HeaderCollaborationData }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [pageLink, setPageLink] = useState(data.href);
  const open = Boolean(anchor);
  const [notice, setNotice] = useState("");
  return <div className={styles.controls}>
    <span className={styles.avatars}><AvatarStack members={data.members} max={3} size="sm" label={`Members of ${data.projectName}`} /></span>
    <button className={styles.share} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={(event) => { setPageLink(new URL(data.href, window.location.origin).href); setAnchor(open ? null : event.currentTarget); }}>Share</button>
    <Popover open={open} anchor={anchor} onClose={() => setAnchor(null)} label={`Share ${data.projectName}`} width={340} align="end">
      <div className={styles.panel}>
        <div className={styles.heading}><h2>Share {data.projectName}</h2><button type="button" className={styles.close} aria-label="Close sharing" onClick={() => { anchor?.focus(); setAnchor(null); }}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button></div>
        <p className={styles.hint}>People with Project access can open this page link.</p>
        <button className={styles.copy} type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(new URL(data.href, window.location.origin).href); setNotice("Page link copied. Project access is still required."); }
          catch { setNotice("Couldn’t copy. Select the page link below and copy it manually."); }
        }}>Copy page link</button>
        <label className={styles.linkLabel}>Page link<input readOnly value={pageLink} onFocus={(event) => event.currentTarget.select()} /></label>
        <p className={styles.notice} role="status">{notice}</p>
        <ul className={styles.members} aria-label="Project members">{data.members.map((person) => <li key={person.id}>
          <AvatarStack members={[person]} max={1} size="sm" label={person.name} />
          <span>{person.name}</span><small>{person.role === "owner" ? "Owner" : "Member"}</small>
        </li>)}</ul>
        {data.canInvite ? <HeaderInvite key={data.projectId} projectId={data.projectId} /> : null}
      </div>
    </Popover>
  </div>;
}
