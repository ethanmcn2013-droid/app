import { ProfilePanel } from "@/components/settings/profile/profile-panel";
import { SettingsSection } from "@/components/settings/section";
import { isDemoMode } from "@/lib/access-mode";

export default function ProfileSettingsPage() {
  if (isDemoMode()) {
    return (
      <SettingsSection
        title="Profile"
        description="The you that everyone you collaborate with sees."
      >
        <div className="rounded-lg border border-line-soft bg-white p-4">
          <p className="text-sm font-medium text-ink">Orla</p>
          <p className="mt-1 text-xs text-ink-quiet">
            orla@theorchard.example, review identity
          </p>
        </div>
      </SettingsSection>
    );
  }
  return <ProfilePanel />;
}
