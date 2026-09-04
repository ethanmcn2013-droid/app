"use client";

import { useEffect, useRef, useState } from "react";
import { isDemoMode } from "@/lib/access-mode";
import { projectDriveUiEnabled } from "@/lib/project-drive-ui";
import { createDriveRecoveryController, driveRecoveryCopy, type RecoverableDriveRow } from "@/lib/project-drive-upload-recovery";

export function useDriveUploadRecovery(taskId: string, refresh: () => Promise<void>) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  const controller = useRef<ReturnType<typeof createDriveRecoveryController> | null>(null);
  const [state, setState] = useState<keyof typeof driveRecoveryCopy | null>(null);
  useEffect(() => {
    const current = createDriveRecoveryController(taskId, {
      async recover(task, id) {
        if (isDemoMode()) return "review";
        if (!projectDriveUiEnabled()) return "disabled";
        const { recoverDriveUploadAction } = await import("@/server/actions/drive-upload-recovery");
        return recoverDriveUploadAction(task, id);
      },
      refresh: () => refreshRef.current(), changed: setState,
    });
    controller.current = current;
    return () => { current.dispose(); controller.current = null; };
  }, [taskId]);
  return { state, check: (rows: readonly RecoverableDriveRow[], actorId: string, mountedIds: readonly string[]) => {
    if (isDemoMode() || !projectDriveUiEnabled()) return;
    return controller.current?.check(rows, actorId, mountedIds);
  } };
}
