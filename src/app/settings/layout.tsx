import { Suspense } from "react";
import { SettingsChrome } from "@/components/settings/settings-chrome";
import { isDemoMode } from "@/lib/access-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings · Tasks",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demo = isDemoMode();
  return (
    <Suspense fallback={null}>
      <SettingsChrome>
        {demo ? (
          <>
            <p
              role="status"
              className="mb-5 rounded-md border border-brand/20 bg-brand-soft px-3 py-2 text-xs font-medium text-brand"
            >
              Review preview, settings are read-only.
            </p>
            <div inert aria-disabled="true">
              {children}
            </div>
          </>
        ) : (
          children
        )}
      </SettingsChrome>
    </Suspense>
  );
}
