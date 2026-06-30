import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";
import { StudentsForm } from "@/components/marketing/students-form";

export const metadata = {
  title: "Signal Studio for Students",
  description:
    "Verify any working student email and keep Signal Studio for Students at €9.99 a year while you study.",
  openGraph: {
    title: "Signal Studio for Students",
    description:
      "Your semester, without the noise. Verify any working student email and keep the €9.99 yearly student rate.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Signal Studio for Students",
    description:
      "Verify any working student email and keep the €9.99 yearly student rate.",
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
