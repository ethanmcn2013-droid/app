import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StudentsForm } from "@/components/marketing/students-form";

export const metadata = {
  title: "Free for students — Tasks",
  description:
    "Verify a .edu address and get Pro for the full school year, on us.",
  openGraph: {
    title: "Tasks Pro, free for students.",
    description:
      "Verify a .edu and you're in. Full school year. No card, no trial, no catch.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tasks Pro, free for students.",
    description:
      ".edu in, full school year out. No card, no trial, no catch.",
  },
};

export default function StudentsPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <StudentsForm />
      </main>
      <SiteFooter />
    </>
  );
}
