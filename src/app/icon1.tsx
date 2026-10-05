import { ImageResponse } from "next/og";
import { SIGNAL_INK, SuiteMark } from "@/lib/brand/suite-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Android maskable icon: the mark on the ink tile, inside the 80% safe zone. */
export default function MaskableIcon() {
  return new ImageResponse(<SuiteMark canvas={512} background={SIGNAL_INK} />, size);
}
