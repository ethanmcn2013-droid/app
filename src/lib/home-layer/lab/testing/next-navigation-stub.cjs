/**
 * `next/navigation` stand-in for the lab-guard tests.
 *
 * `notFound()` throws a tagged error, exactly as the real one throws a
 * digest-tagged error that the Next runtime catches and renders as a 404. The
 * test can therefore assert the guard genuinely refused rather than asserting
 * that its source mentions the word.
 *
 * `redirect()` throws a different, deliberately loud error. The guard must
 * never redirect: a redirect to /sign-in confirms the route exists. If this
 * ever fires, the guard has stopped being a 404.
 */

const NOT_FOUND_MARKER = "LAB_GUARD_NOT_FOUND";

function notFound() {
  const error = new Error(NOT_FOUND_MARKER);
  error.digest = NOT_FOUND_MARKER;
  throw error;
}

function redirect(url) {
  throw new Error(
    `LAB_GUARD_REDIRECTED to ${url}. The lab guard must refuse with notFound(), never a redirect.`,
  );
}

function forbidden() {
  throw new Error(
    "LAB_GUARD_FORBIDDEN. The lab guard must refuse with notFound(), never a 403.",
  );
}

module.exports = { NOT_FOUND_MARKER, notFound, redirect, forbidden };
