import { isRedirectError } from "next/dist/client/components/redirect-error";

/** Next rejects a client Server Action promise with this control-flow error
 * while following redirect(). Only the destination this selection requested
 * may continue waiting for its server-verified route snapshot. */
export function isExpectedProjectSwitchRedirect(error: unknown, destination: string): boolean {
  return isRedirectError(error) &&
    error.digest.split(";").slice(2, -2).join(";") === destination;
}
