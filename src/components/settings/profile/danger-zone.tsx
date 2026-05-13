"use client";

import { useState } from "react";
import { Dialog } from "@/components/primitives/dialog";

const DELETE_MAILTO = "hello@signalstudio.ie";

export function DangerZone({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-10 rounded-lg border border-rose-100 bg-rose-50/40 p-5">
      <h2 className="text-[14px] font-semibold tracking-tight text-rose-900">
        Delete account
      </h2>
      <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.6] text-rose-800/80">
        Closes your Signal account across every product — Tasks, Notes,
        Roadmap, Analytics. Workspaces you own are deleted with you, including
        anyone you've invited. There's no undo.
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
        onClose={() => setOpen(false)}
        labelledBy="delete-title"
      >
        <DeleteFlow email={email} onClose={() => setOpen(false)} />
      </Dialog>
    </div>
  );
}

function DeleteFlow({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const subject = encodeURIComponent("Delete my account");
  const body = encodeURIComponent(
    `Hi — please delete the Signal account for ${email}. I understand all my workspaces and data will be removed.`,
  );

  return (
    <div className="p-6">
      <h2
        id="delete-title"
        className="text-[16px] font-semibold tracking-tight text-ink"
      >
        Type your email to confirm
      </h2>
      <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-soft">
        Account deletion runs as a human-handled process today — you'll send a
        confirmation email and we delete inside one business day. That's a
        deliberate choice: we'd rather be slow than wrong about who pressed
        the button.
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
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-ink-soft/40"
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-[12.5px] text-ink-quiet transition-colors hover:text-ink"
        >
          Cancel
        </button>
        <a
          href={
            matches
              ? `mailto:${DELETE_MAILTO}?subject=${subject}&body=${body}`
              : "#"
          }
          aria-disabled={!matches}
          onClick={(e) => {
            if (!matches) {
              e.preventDefault();
              return;
            }
            setTimeout(onClose, 200);
          }}
          className={
            "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors " +
            (matches
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "cursor-not-allowed bg-rose-200 text-rose-50/70")
          }
        >
          Send delete request
        </a>
      </div>
    </div>
  );
}
