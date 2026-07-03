import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ForStudents } from "@/components/marketing/for-students";

export const metadata = {
  title: "Tasks for students · A whole semester in one workspace",
  description:
    "Four classes, three group projects, two midterms, one job application, all in one workspace. The full tier at the student price: €9.99 a year, any student email.",
  openGraph: {
    title: "The semester in one place.",
    description:
      "Made for college and the study group. The full tier for €9.99 a year, any student email.",
    type: "article",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The semester in one place.",
    description: "The full tier for €9.99 a year. Any student email.",
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
