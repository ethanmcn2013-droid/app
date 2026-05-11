import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { TemplatesGallery } from "@/components/marketing/templates-gallery";
import { TEMPLATES } from "@/lib/templates";

export const metadata = {
  title: "Templates — Tasks",
  description:
    "Drop-in task lists and starter workspaces. Wedding planning, thesis sprints, freelance onboarding - the work, pre-written. Apply with one click.",
  openGraph: {
    title: "Tasks templates — drop-in task lists",
    description:
      "Pre-written task lists and starter workspaces for the moments that recur. Apply to any workspace. Free on every tier.",
    type: "website",
    images: ["/opengraph-image"],
  },
};

export default function TemplatesPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <TemplatesGallery templates={TEMPLATES} />
      </main>
      <SiteFooter />
    </>
  );
}
