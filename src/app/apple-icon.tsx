import { ImageResponse } from "next/og";
import { SIGNAL_INK, SuiteMark } from "@/lib/brand/suite-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon: the ring and dot on the ink tile. */
export default function AppleIcon() {
  return new ImageResponse(<SuiteMark canvas={180} borderRadius={36} background={SIGNAL_INK} />, size);
}
