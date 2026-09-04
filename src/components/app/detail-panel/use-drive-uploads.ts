"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isDemoMode } from "@/lib/access-mode";
import { createDriveUploadAttempt, type DriveUploadView } from "@/lib/project-drive-upload-machine";
import { uploadToGoogleDriveResumableSession } from "@/lib/drive-resumable-upload";

type Entry = { id: string; name: string; size: number; state: DriveUploadView; attempt: ReturnType<typeof createDriveUploadAttempt> };

export function useDriveUploads(taskId: string, native: (taskId: string, file: File) => Promise<unknown>, onComplete: () => void) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const active = useRef(new Map<string, Entry>());
  const completed = useRef(onComplete);
  useEffect(() => { completed.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const attempts = active.current;
    return () => { attempts.forEach((entry) => entry.attempt.dispose()); attempts.clear(); };
  }, [taskId]);
  const add = useCallback(async (file: File) => {
    // Review intake is local-only, including native fallback. No action imports.
    if (isDemoMode()) return;
    const id = crypto.randomUUID();
    const attempt = createDriveUploadAttempt(taskId, id, file, {
      create: async (...args) => (await import("@/server/actions/drive-resource-uploads")).createDriveUploadSessionAction(...args),
      finalize: async (...args) => (await import("@/server/actions/drive-resource-uploads")).finalizeDriveUploadAction(...args),
      upload: uploadToGoogleDriveResumableSession, native,
    }, (state) => {
      const entry = active.current.get(id);
      if (!entry) return;
      entry.state = state;
      setEntries(Array.from(active.current.values()));
      if (state.phase === "complete") completed.current();
    });
    active.current.set(id, { id, name: file.name, size: file.size, state: attempt.snapshot(), attempt });
    setEntries(Array.from(active.current.values()));
    await attempt.run();
  }, [taskId, native]);
  return { entries, add };
}
