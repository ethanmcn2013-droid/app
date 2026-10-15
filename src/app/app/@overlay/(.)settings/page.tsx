import SettingsPage from "../../settings/page";
import { SettingsOverlay } from "@/components/app/settings/settings-overlay";

export default function InterceptedSettingsPage() {
  return (
    <SettingsOverlay>
      <SettingsPage />
    </SettingsOverlay>
  );
}
