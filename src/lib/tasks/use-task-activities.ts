"use client";

import { useEffect, useState } from "react";
import type { Activity } from "@/lib/data";

export function useTaskActivities(
  taskId: string | null,
  initialActivities: Activity[],
) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);

  // Re-sync whenever the parent passes fresh data (taskId change or
  // a re-fetch triggered by task.updatedAt).
  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  void taskId;
  return { activities };
}
