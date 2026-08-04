"use client";

/**
 * Timeline's own error boundary, previously orphaned in the module tree
 * while failures fell through to the Tasks-voiced app boundary ("Back to
 * board"). A Timeline failure speaks Timeline and routes back to timelines.
 */
export { default } from "@/modules/timeline/app/error";
