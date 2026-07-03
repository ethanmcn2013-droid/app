"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "@/components/primitives/dialog";

type Reason =
  | "edit"
  | "comment"
  | "addTask"
  | "complete"
  | "share";

type Ctx = {
  /** True when the consumer is in guest (read-only) mode. */
  isGuest: boolean;
  /** Trigger the progressive auth modal. The reason customizes copy. */
  promptSignUp: (reason: Reason) => void;
};

const GuestAuthContext = createContext<Ctx | null>(null);

export function GuestAuthProvider({
  isGuest,
  children,
}: {
  isGuest: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("edit");

  const promptSignUp = useCallback(
    (r: Reason) => {
      if (!isGuest) return; // owners can do this freely
      setReason(r);
      setOpen(true);
    },
    [isGuest],
  );

  const value = useMemo<Ctx>(
    () => ({ isGuest, promptSignUp }),
    [isGuest, promptSignUp],
  );

  return (
    <GuestAuthContext.Provider value={value}>
      {children}
      <SignUpDialog
        open={open}
        reason={reason}
        onClose={() => setOpen(false)}
      />
    </GuestAuthContext.Provider>
  );
}

export function useGuestAuth(): Ctx {
  const v = useContext(GuestAuthContext);
  // Default behaviour outside a guest context: treat as owner, this
  // makes the hook safe to call from /app/* without conditional logic.
  if (!v) return { isGuest: false, promptSignUp: () => {} };
  return v;
}

const REASON_COPY: Record<Reason, { headline: string; body: string }> = {
  edit: {
    headline: "Sign up to edit this task.",
    body: "You're viewing a shared workspace. Make a free account to make changes, your edits sync back to the team.",
  },
  comment: {
    headline: "Sign up to join the conversation.",
    body: "Comments need a name attached. Make a free account in 30 seconds and you're in.",
  },
  addTask: {
    headline: "Sign up to add tasks.",
    body: "You're viewing a shared workspace. Sign up to write your own, and start your own list while you're at it.",
  },
  complete: {
    headline: "Sign up to mark things done.",
    body: "Checkmarks need an owner. Make a free account so the team knows who closed it out.",
  },
  share: {
    headline: "Sign up to share more workspaces.",
    body: "You're already inside a shared one. Make a free account to spin up your own and invite anyone you want.",
  },
};

function SignUpDialog({
  open,
  reason,
  onClose,
}: {
  open: boolean;
  reason: Reason;
  onClose: () => void;
}) {
  const copy = REASON_COPY[reason];
  return (
    <Dialog open={open} onClose={onClose} labelledBy="signup-headline">
      <div className="px-6 pb-5 pt-5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
          One step
        </div>
        <h2
          id="signup-headline"
          className="mt-1.5 text-balance text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink"
        >
          {copy.headline}
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-ink-soft">
          {copy.body}
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-medium text-white transition-transform hover:-translate-y-px"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Continue with email
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-[13.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continue with Google
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 block w-full text-center text-[12px] text-ink-quiet transition-colors hover:text-ink-soft"
        >
          Keep browsing as a guest
        </button>
      </div>
    </Dialog>
  );
}
