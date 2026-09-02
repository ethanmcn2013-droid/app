import "server-only";

/**
 * Project Drive's complete OAuth authority.
 *
 * Keep the list in this isolated module so a contract test can compare the
 * requested set without interpreting an OAuth URL. Widening this list is a
 * founder decision: `drive.file` is the control that keeps every file the app
 * did not create outside the credential's reach.
 */
export const GOOGLE_DRIVE_FILE_SCOPE =
  "https://www.googleapis.com/auth/drive.file" as const;

/** The one and only scope an authorization request may contain. */
export const GOOGLE_DRIVE_SCOPES = Object.freeze([
  GOOGLE_DRIVE_FILE_SCOPE,
] as const);

export class GoogleDriveScopeError extends Error {
  readonly code = "unexpected-scope-set" as const;

  constructor() {
    super("google-drive: the granted scope set was not exactly drive.file");
    this.name = "GoogleDriveScopeError";
  }
}

/**
 * Turn Google's space-delimited token response into a stable set.
 *
 * Duplicate values are deliberately retained. An exact one-scope contract
 * should reject a malformed response containing the right value twice rather
 * than silently normalising it into something acceptable.
 */
export function parseGoogleDriveScopes(
  value: string | readonly string[] | null | undefined,
): readonly string[] {
  if (typeof value === "string") {
    return Object.freeze(value.trim().split(/\s+/).filter(Boolean));
  }
  if (!value) return Object.freeze([]);
  return Object.freeze(value.map((scope) => scope.trim()).filter(Boolean));
}

/** True only for exactly one value, exactly `drive.file`. */
export function isExactGoogleDriveScopeSet(
  value: string | readonly string[] | null | undefined,
): boolean {
  const scopes = parseGoogleDriveScopes(value);
  return scopes.length === 1 && scopes[0] === GOOGLE_DRIVE_FILE_SCOPE;
}

/** Refuse missing, duplicated, or widened grants before a token is stored. */
export function assertExactGoogleDriveScopeSet(
  value: string | readonly string[] | null | undefined,
): void {
  if (!isExactGoogleDriveScopeSet(value)) {
    throw new GoogleDriveScopeError();
  }
}
