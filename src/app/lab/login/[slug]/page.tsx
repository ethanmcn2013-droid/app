/**
 * /lab/login/[slug] — one direction, full bleed, with the review switcher over
 * it. Slugs come from the directions manifest; anything else is a 404.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  LOGIN_DIRECTIONS,
  findDirection,
} from "@/components/lab/login/directions";
import { LabSwitcher } from "@/components/lab/login/lab-switcher";
import { DirectionSpineV2 } from "@/components/lab/login/direction-spine-v2";
import { DirectionSpine } from "@/components/lab/login/direction-spine";
import { DirectionDesk } from "@/components/lab/login/direction-desk";
import { DirectionLine } from "@/components/lab/login/direction-line";
import { DirectionRail } from "@/components/lab/login/direction-rail";

export function generateStaticParams() {
  return LOGIN_DIRECTIONS.map((direction) => ({ slug: direction.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const direction = findDirection(slug);
  return {
    title: direction
      ? `${direction.letter} · ${direction.name} · login lab`
      : "Login lab",
    robots: { index: false, follow: false },
  };
}

export default async function LoginDirectionRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const direction = findDirection(slug);
  if (!direction) notFound();

  return (
    <>
      {direction.slug === "spine-v2" && <DirectionSpineV2 />}
      {direction.slug === "spine" && <DirectionSpine />}
      {direction.slug === "desk" && <DirectionDesk />}
      {direction.slug === "line" && <DirectionLine />}
      {direction.slug === "rail" && <DirectionRail />}
      <LabSwitcher current={direction.slug} />
    </>
  );
}
