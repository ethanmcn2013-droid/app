"use client";

import { useId, useState, useTransition } from "react";
import { inviteMemberByEmailAction } from "@/server/actions/settings";
import type { ProjectId } from "@/lib/projects/project-ref";
import styles from "./header-invite.module.css";

/** The existing invitation action remains the authority for access and capacity. */
export function HeaderInvite({ projectId }: { projectId: ProjectId }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form className={styles.form} onSubmit={(event) => {
      event.preventDefault();
      const address = email.trim();
      if (!address || pending) return;
      setNotice(null);
      setLink(null);
      startTransition(async () => {
        try {
          const result = await inviteMemberByEmailAction(address, "member", projectId);
          if (result.reason === "already-member") {
            setNotice(`${address} is already in this project.`);
          } else if (result.reason === "cooldown") {
            setNotice("An invite was sent recently. Wait an hour before resending.");
          } else if (result.reason === "email-unavailable" || result.reason === "delivery-unconfirmed") {
            if (result.acceptUrl) {
              setLink({ email: result.email, url: result.acceptUrl });
              setEmail("");
            }
            setNotice(result.reason === "email-unavailable"
              ? (result.acceptUrl ? "Invite created. No email was sent. Share the link below." : "No email was sent and no invite link is available. Try again.")
              : "Email delivery is unconfirmed. Check with them before sending again.");
          } else if (result.reason === "invite-no-longer-active") {
            setNotice("The invite is no longer active. Check with them before trying again.");
          } else {
            setNotice(`Invite sent to ${address}. It lasts seven days.`);
            setEmail("");
          }
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Couldn’t invite. Try again.");
        }
      });
    }}>
      <label htmlFor={id}>Invite people</label>
      <p className={styles.hint}>Members can work on this project. Invites last seven days.</p>
      <input id={id} type="email" autoComplete="email" placeholder="Email address" required value={email} disabled={pending} onChange={(event) => setEmail(event.target.value)} />
      <button type="submit" disabled={pending || !email.trim()}>{pending ? "Creating invite…" : "Create invite"}</button>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      {link ? <div className={styles.link}>
        <label htmlFor={`${id}-link`}>Link for {link.email}</label>
        <p className={styles.hint}>Only this verified email can accept.</p>
        <input id={`${id}-link`} type="text" readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} />
        <button type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(link.url);
            setNotice("Invite link copied.");
          } catch {
            setNotice("Couldn’t copy. Select the link and copy it manually.");
          }
        }}>Copy invite link</button>
      </div> : null}
    </form>
  );
}
