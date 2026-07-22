import "server-only";

import { NextResponse } from "next/server";
import { analyticsErrorResponse, PRIVATE_RESPONSE_HEADERS } from "./errors";
import { authorizeAnalyticsRequest } from "./policy";
import { parseAnalyticsQuery } from "./query";
import type { AnalyticsCalculation } from "./service";

export async function runAnalyticsRoute<T>(
  request: Request,
  calculate: (
    context: Awaited<ReturnType<typeof authorizeAnalyticsRequest>>,
  ) => Promise<AnalyticsCalculation<T>>,
): Promise<NextResponse> {
  const routeStarted = performance.now();
  try {
    const query = parseAnalyticsQuery(request);
    const context = await authorizeAnalyticsRequest(query);
    const result = await calculate(context);
    const routeMs = performance.now() - routeStarted;
    return NextResponse.json(result.data, {
      headers: {
        ...PRIVATE_RESPONSE_HEADERS,
        "Server-Timing": timingHeader(result.timingMs, routeMs),
      },
    });
  } catch (error) {
    return analyticsErrorResponse(error);
  }
}

export function timingHeader(calculationMs: number, routeMs: number): string {
  return `analytics;dur=${calculationMs.toFixed(1)}, total;dur=${routeMs.toFixed(1)}`;
}
