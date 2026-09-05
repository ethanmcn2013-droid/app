/** Serializable readback of the canonical project date, never a second date store. */
export type SponsoredWeddingDate = {
  projectId: string;
  weddingDate: string | null;
  revision: number;
  canManage: boolean;
  access: {
    status: "active" | "expired" | "revoked" | "none";
    expiresAt: string | null;
  };
};

export type WeddingDateUpdate = {
  projectId: string;
  expectedRevision: number;
  weddingDate: string | null;
};

export type WeddingDateResult =
  | { ok: true; data: SponsoredWeddingDate }
  | { ok: false; reason: "unavailable" | "invalid-date" | "conflict" | "failed" | "preview" };

export const WEDDING_DATE_ERRORS = {
  unavailable: "This wedding date is no longer available to update. Reopen the project to check your access.",
  "invalid-date": "Enter a valid wedding date, or leave it blank if it is not set yet.",
  conflict: "This project changed while you were editing. Refresh the page before saving your date again.",
  failed: "We could not confirm your date was saved. Refresh the page to check it before trying again.",
  preview: "This preview does not save dates.",
} as const;
