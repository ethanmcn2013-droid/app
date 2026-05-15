import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForStudents } from "@/components/marketing/for-students";

export const metadata = {
  title: "Tasks for Students — A Whole Semester in One Workspace",
  description:
    "Four classes, three group projects, two midterms, one job application — all in one workspace. Free forever, or the full tier free for two years with a .edu address.",
  openGraph: {
    title: "The semester in one place.",
    description:
      "Free for college, free for the study group. A .edu address gets the full tier free for two years.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The semester in one place.",
    description: "Free forever. .edu gets the full tier free for two years.",
  },
};

export default function ForStudentsPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <ForStudents />
      </main>
      <SiteFooter />
    </>
  );
}
