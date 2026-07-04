/**
 * Persistent authed app chrome — a thin wrapper over the shared SuiteHeader.
 *
 * The suite now has ONE header shell (src/components/chrome/suite-header.tsx)
 * for both the marketing header and the app chrome. The app chrome passes the
 * SuiteSwitcher as the launcher with no wordmark — the active pill is the
 * product identity, so no "/ product" breadcrumb is drawn — and the account
 * menu as the account slot. Geometry, hairline, and background come from the
 * shared shell, so a cross-product jump swaps only the body; the chrome holds
 * still and matches the public header byte-for-byte.
 */

import { SuiteSwitcher } from "@/components/app/suite-switcher-pills";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";
import { SuiteHeader } from "@/components/chrome/suite-header";

export function SuiteChrome() {
  return (
    <SuiteHeader
      launcher={<SuiteSwitcher current="tasks" />}
      nav={[]}
      account={<UserButtonWithSuite current="tasks" />}
    />
  );
}
