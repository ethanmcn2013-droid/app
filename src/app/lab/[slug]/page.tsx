import { notFound } from "next/navigation";
import { LabStage } from "@/components/lab/switcher";
import { OPTIONS } from "@/components/lab/registry";

export const metadata = {
  title: "Tasks hero lab",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return OPTIONS.map((o) => ({ slug: o.slug }));
}

export default async function LabOptionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const option = OPTIONS.find((o) => o.slug === slug);
  if (!option) notFound();
  const Hero = option.Component;
  return (
    <main style={{ minHeight: "100svh", background: "var(--paper)" }}>
      <LabStage activeSlug={slug}>
        <Hero />
      </LabStage>
    </main>
  );
}
