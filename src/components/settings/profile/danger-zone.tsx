"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Dialog } from "@/components/primitives/dialog";

/**
 * App Store 5.1.1(v) compliant account deletion.
 *
 * Confirm dialog → typed email match → POST /api/account/delete →
 * Clerk.signOut() → redirect home. Server purges Turso data first,
 * then calls Clerk admin delete. The dialog requires typing the user's
 * primary email (case-insensitive, trimmed) before the destructive
 * action enables, standard danger-confirm pattern.
 *
 * Dialog overlay-close is guarded during the pending state, a tap
 * outside the modal while deletion is in flight is ignored. Without
 * that guard, the user could dismiss the dialog mid-fetch and lose
 * visibility on the success / failure result while the server still
 * completes the deletion.
 */
export function DangerZone({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <div className="mt-10 rounded-lg border border-rose-100 bg-rose-50/40 p-5">
      <h2 className="text-[14px] font-semibold tracking-tight text-rose-900">
        Delete account
      </h2>
      <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.6] text-rose-800/80">
        Closes your Signal account across every product, Tasks, Notes,
        Roadmap, Analytics. Workspaces you own are deleted with you, including
        anyone you&apos;ve invited. There&apos;s no undo.
      </p>
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-rose-700 transition-colors hover:bg-rose-50"
        >
          Delete account
        </button>
      </div>
      <Dialog
        open={open}
        onClose={pending ? () => {} : () => setOpen(false)}
        labelledBy="delete-title"
      >
        <DeleteFlow
          email={email}
          onClose={() => setOpen(false)}
          pending={pending}
          setPending={setPending}
        />
      </Dialog>
    </div>
  );
}

function humaniseError(message: string | undefined, status: number): string {
  if (status === 401) return "You're signed out. Sign in again, then retry.";
  if (status === 500)
    return "Something went wrong on our end. Try again in a moment. If it keeps failing, email hello@signalstudio.ie.";
  return message ?? `Delete failed (${status}).`;
}

function DeleteFlow({
  email,
  onClose,
  pending,
  setPending,
}: {
  email: string;
  onClose: () => void;
  pending: boolean;
  setPending: (v: boolean) => void;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function runDelete() {
    if (!matches || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(humaniseError(body.message, res.status));
      }
      await signOut({ redirectUrl: "/" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  }

  return (
    <div className="p-6">
      <h2
        id="delete-title"
        className="text-[16px] font-semibold tracking-tight text-ink"
      >
        Type your email to confirm
      </h2>
      <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
        This deletes your Signal account immediately and irreversibly.
        Workspaces you own are removed, along with everyone you&apos;ve invited.
        We can&apos;t bring it back.
      </p>
      <div className="mt-4">
        <label
          htmlFor="confirm-email"
          className="text-[11px] uppercase tracking-[0.12em] text-ink-faint"
        >
          Your email
        </label>
        <input
          id="confirm-email"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={email}
          autoComplete="off"
          disabled={pending}
          className={
            "mt-1 w-full rounded-md border bg-white px-3 py-2 text-[13.5px] text-ink outline-none transition-colors disabled:opacity-60 " +
            (matches
              ? "border-rose-400 focus:border-rose-500"
              : "border-line focus:border-ink-soft/40")
          }
        />
      </div>
      {error ? (
        <p className="mt-3 text-[12px] text-rose-700">{error}</p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-md px-3 py-1.5 text-[12.5px] text-ink-quiet transition-colors hover:text-ink disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={runDelete}
          disabled={!matches || pending}
          className={
            "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors " +
            (matches && !pending
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "cursor-not-allowed bg-rose-200 text-rose-50/70")
          }
        >
          {pending ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </div>
  );
}
