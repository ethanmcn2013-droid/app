import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForStudents } from "@/components/marketing/for-students";

export const metadata = {
  title: "Signal Studio for Students: Your Semester Without the Noise",
  description:
    "A calm student workspace for notes, tasks, timelines, and one clear signal on what needs attention. €9.99 a year with any student email.",
  openGraph: {
    title: "Your semester, without the noise.",
    description:
      "Notes, Tasks, Timeline, and Signal for students. €9.99 a year with any working student email.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your semester, without the noise.",
    description: "Signal Studio for Students is €9.99 a year. Any student email.",
  },
};

export default function ForStudentsPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <ForStudents />
      </main>
      <SiteFooter />
    </>
  );
}
