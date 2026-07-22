"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { SettingsSection } from "@/components/settings/section";
import { NameAvatarRow } from "./name-avatar-row";
import { EmailRow } from "./email-row";
import { PasswordRow } from "./password-row";
import { TwoFactorRow } from "./two-factor-row";
import { SessionsRow } from "./sessions-row";
import { OAuthRow } from "./oauth-row";
import { DangerZone } from "./danger-zone";
import { DataPrivacy } from "./data-privacy";

export function ProfilePanel() {
  const { isLoaded, user } = useUser();
  const [pending, setPending] = useState(false);

  if (!isLoaded) return <ProfileSkeleton />;
  if (!user) return null;

  return (
    <SettingsSection
      title="Profile"
      description="The you that everyone you collaborate with sees."
    >
      <div className="-mt-2">
        <NameAvatarRow user={user} setPending={setPending} pending={pending} />
        <EmailRow user={user} />
        <PasswordRow user={user} />
        <TwoFactorRow user={user} />
        <SessionsRow user={user} />
        <OAuthRow user={user} />
        <DataPrivacy />
        <DangerZone email={user.primaryEmailAddress?.emailAddress ?? ""} />
      </div>
    </SettingsSection>
  );
}

function ProfileSkeleton() {
  return (
    <SettingsSection title="Profile">
      <div className="space-y-4 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-md bg-bg-sunken/60"
          />
        ))}
      </div>
    </SettingsSection>
  );
}
