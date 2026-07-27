import { notFound } from "next/navigation";
import { isReviewMode } from "@/lib/access-mode";
import { TimelineOwnerLab } from "./timeline-owner-lab";

export const metadata = {
  title: "Timeline owner workspace · local review",
  description: "Private local review lab for the Timeline owner experience.",
  robots: { index: false, follow: false },
};

type SearchParams = {
  option?: string;
  project?: string;
};

export default async function TimelineOwnerLabPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isReviewMode()) notFound();

  const params = await searchParams;
  const option =
    params.option === "b" || params.option === "c" ? params.option : "a";
  const project =
    params.project === "website" || params.project === "wedding"
      ? params.project
      : "personal";

  return <TimelineOwnerLab initialOption={option} initialProject={project} />;
}
