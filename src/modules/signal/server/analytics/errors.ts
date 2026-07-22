import "server-only";

import { NextResponse } from "next/server";
import { AnalyticsApiError } from "./api-error";
export { AnalyticsApiError } from "./api-error";
export type { AnalyticsErrorCode } from "./api-error";

export function analyticsErrorResponse(error: unknown): NextResponse {
  if (error instanceof AnalyticsApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      {
        status: error.status,
        headers: PRIVATE_RESPONSE_HEADERS,
      },
    );
  }

  console.error("[signal-analytics] unhandled API error", safeErrorForLog(error));
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Signal could not calculate this view.",
      },
    },
    { status: 500, headers: PRIVATE_RESPONSE_HEADERS },
  );
}

export const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization",
} as const;

function safeErrorForLog(error: unknown): Readonly<Record<string, unknown>> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError" };
}
