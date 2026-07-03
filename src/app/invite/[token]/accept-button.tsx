"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction } from "@/server/actions/settings";
import { useToast } from "@/components/primitives/toast";

/** The accept-invite client island. Calls the server action, routes
 *  to the joined workspace's board on success, surfaces the action's
 *  error message on failure. */
export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await acceptInviteAction(token);
        toast(`Joined ${result.workspaceName}`, {
          tone: "success",
          body: "Open the board, you're in.",
        });
        router.push("/app/board?invite=accepted");
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px disabled:opacity-60"
      >
        {pending ? "Joining…" : "Accept invite"}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      </button>
      {error ? (
        <p className="text-[12.5px] text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}
