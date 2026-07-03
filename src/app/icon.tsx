import { ImageResponse } from "next/og";
import { SuiteMark } from "@/lib/brand/suite-mark";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab icon, dot + broadcast ring on paper (option 6). */
export default function Icon() {
  return new ImageResponse(<SuiteMark canvas={32} />, size);
}
