import { ImageResponse } from "next/og";
import { SuiteMark } from "@/lib/brand/suite-mark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab icon, a single indigo dot on ink. */
export default function Icon() {
  return new ImageResponse(<SuiteMark canvas={32} />, size);
}
