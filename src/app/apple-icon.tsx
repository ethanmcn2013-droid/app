import { ImageResponse } from "next/og";
import { SuiteMark } from "@/lib/brand/suite-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon, dot + broadcast ring on paper (option 6). */
export default function AppleIcon() {
  return new ImageResponse(<SuiteMark canvas={180} borderRadius={36} />, size);
}
