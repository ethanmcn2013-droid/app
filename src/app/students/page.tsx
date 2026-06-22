import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StudentsForm } from "@/components/marketing/students-form";

export const metadata = {
  title: "Tasks for students",
  description:
    "The full Workspace tier at the student price: €9.99 a year. Verify with any student email, no .edu needed.",
  openGraph: {
    title: "Tasks Workspace, the student rate.",
    description:
      "Verify any student email and you're in. The full Workspace tier for €9.99 a year.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tasks Workspace, the student rate.",
    description:
      "Any student email in. The full Workspace tier for €9.99 a year.",
  },
};

export default function StudentsPage() {
  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <StudentsForm />
      </main>
      <SiteFooter />
    </>
  );
}
