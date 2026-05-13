import { Suspense } from "react";
import { SettingsChrome } from "@/components/settings/settings-chrome";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings · Tasks",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <SettingsChrome>{children}</SettingsChrome>
    </Suspense>
  );
}
