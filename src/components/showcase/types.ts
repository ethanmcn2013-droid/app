import type { Task, UserId } from "@/lib/data";

export type ViewMode = "board" | "list" | "timeline";

export type DemoState = {
  view: ViewMode;
  tasks: Task[];
  cursors: Record<
    UserId,
    {
      x: number;
      y: number;
      visible: boolean;
      grabbing: boolean;
      reading: boolean;
      /** Brief 600ms post-arrival window during which the label is
       *  still visible, gives the eye time to read the name on a
       *  cursor that just popped in. */
      justArrived: boolean;
      label?: string;
    }
  >;
  pickedTaskId: string | null;
  pickedBy: UserId | null;
  ghostX: number;
  ghostY: number;
  /** The teammate's earlier note shown above the live-typed comment in
   *  the inline thread. Domain-true (drawn from the active pack), so a
   *  wedding planner watching the demo reads "RSVPs at 89%, on pace."
   * , their own world, not a generic placeholder. */
  staticComment: string;
  openCommentTaskId: string | null;
  typingFromUser: UserId | null;
  typingProgress: number;
  postedComment: { user: UserId; text: string } | null;
  reactions: { id: string; emoji: string; x: number; y: number }[];
  activity: { id: string; user: UserId; verb: string; target: string }[];
  nudgeOpen: boolean;
  nudgeTask: string | null;
  nudgeStage: "idle" | "open" | "sending" | "sent";
  burndown: number[];
  dependencyHighlight: [string, string] | null;
  completedFlash: string | null;
  scene: string;
  filterByAssignee: UserId | null;
};
