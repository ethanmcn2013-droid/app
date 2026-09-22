import { ImageResponse } from "next/og";
import { SuiteMark } from "@/lib/brand/suite-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Android maskable icon, the dot centred well inside the 80% safe zone. */
export default function MaskableIcon() {
  return new ImageResponse(<SuiteMark canvas={512} />, size);
}
