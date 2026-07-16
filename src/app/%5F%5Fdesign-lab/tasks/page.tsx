import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isReviewMode } from "@/lib/access-mode";
import { isTasksDesignLabEnabled } from "@/lib/design-lab/tasks-lab-guard";
import { parseLabRoute } from "@/components/design-lab/tasks/query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tasks design lab · Signal Studio",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TasksDesignLabPage({ searchParams }: PageProps) {
  if (!isTasksDesignLabEnabled({
    nodeEnv: process.env.NODE_ENV,
    flag: process.env.SIGNAL_TASKS_DESIGN_LAB,
    reviewMode: isReviewMode(),
  })) {
    notFound();
  }

  const resolved = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") params.set(key, value);
  }
  const initialRoute = parseLabRoute(params.toString());
  const { TasksDesignLab } = await import("@/components/design-lab/tasks/tasks-design-lab");
  return <TasksDesignLab initialRoute={initialRoute} />;
}
