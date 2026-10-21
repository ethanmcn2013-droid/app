import "server-only";
import { ASSISTANT_VERSION, parseAssistantApiCommand, type AssistantApiResponse, type AssistantRunView } from "@/lib/ping/assistant/contract";
import { boundedPingJson } from "../http";

export type AssistantHttpService = {
  submit(actorId: string, request: unknown, signal?: AbortSignal): Promise<AssistantRunView>;
  view(actorId: string, runId: string): Promise<AssistantRunView>;
  lookup(actorId: string, requestId: string): Promise<AssistantRunView | null>;
  history(actorId: string): Promise<readonly AssistantRunView[]>;
  resume(actorId: string, runId: string): Promise<AssistantRunView>;
  apply(actorId: string, runId: string): Promise<AssistantRunView>;
  cancel(actorId: string, runId: string): Promise<AssistantRunView>;
  undo?(actorId:string,runId:string,stepId:string):Promise<AssistantRunView>;
};
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const reply = (body: AssistantApiResponse, status = 200) => Response.json(body, { status, headers });
const error = (code: string, message: string, status: number) => reply({ version: ASSISTANT_VERSION, ok: false, code, message }, status);
const validId = (value: string | null) => value !== null && /^[A-Za-z0-9_-]{8,160}$/.test(value);

/** Actor identity is derived from the signed-in session, never request JSON or a cookie-selected Project. */
export function createAssistantHttp(deps: {
  authenticate: () => Promise<string | null>;
  service: (actorId: string) => Promise<AssistantHttpService | null>;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      if (!["GET", "POST"].includes(request.method)) return error("method_not_allowed", "Use GET or POST.", 405);
      const url = new URL(request.url), origin = request.headers.get("origin");
      if (request.headers.get("sec-fetch-site") === "cross-site" ||
        (request.method === "POST" ? origin !== url.origin : origin !== null && origin !== url.origin))
        return error("unavailable", "This request is unavailable.", 404);
      const actor = await deps.authenticate();
      if (!actor) return error("unauthenticated", "Sign in to use Ping.", 401);
      const service = await deps.service(actor);
      if (!service) return reply({ version: ASSISTANT_VERSION, ok: true, available: false });
      if (request.method === "GET") {
        const runId = url.searchParams.get("runId"), requestId = url.searchParams.get("clientRequestId");
        if (runId && requestId || Array.from(url.searchParams.keys()).some(k => !["runId", "clientRequestId"].includes(k)) ||
          url.searchParams.getAll("runId").length > 1 || url.searchParams.getAll("clientRequestId").length > 1)
          return error("invalid_input", "Choose one original request to check.", 400);
        if (runId !== null) {
          if (!validId(runId)) return error("invalid_input", "The request reference is invalid.", 400);
          return reply({ version: ASSISTANT_VERSION, ok: true, available: true, run: await service.view(actor, runId) });
        }
        if (requestId !== null) {
          if (!validId(requestId)) return error("invalid_input", "The request reference is invalid.", 400);
          const run = await service.lookup(actor, requestId);
          return reply({ version: ASSISTANT_VERSION, ok: true, available: true, ...(run ? { run } : {}) });
        }
        return reply({ version: ASSISTANT_VERSION, ok: true, available: true, runs: await service.history(actor) });
      }
      const command = parseAssistantApiCommand(await boundedPingJson(request, 72_000));
      if (!command) return error("invalid_input", "The request could not be read. Shorten it and try again.", 400);
      if(command.operation==='undo'&&!service.undo)return error('unavailable','This action cannot be undone here.',404);
      // Browser input never authorizes an effect. Even forged execute mode becomes a waiting plan.
      const run = command.operation === "submit" ? await service.submit(actor, {...command.request,mode:'draft'}, request.signal) :
        command.operation==='undo'?await service.undo!(actor,command.runId,command.stepId):await service[command.operation](actor, command.runId);
      return reply({ version: ASSISTANT_VERSION, ok: true, available: true, run });
    } catch (caught) {
      const code = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "temporarily_unavailable";
      if (code === "request_conflict") return error(code, "This request reference already belongs to a different request. Check the original result.", 409);
      if(code==='stale')return error(code,'This item changed after Ping acted. Nothing was undone. Review the latest version first.',409);
      if(code==='unsupported')return error(code,'This action cannot be undone safely. Your saved work is unchanged.',409);
      if (["busy", "lease_lost", "uncertain"].includes(code)) return error(code, "Check the original request before continuing. It has not been repeated.", 409);
      if (code === "unavailable") return error(code, "This request is unavailable.", 404);
      if (code === "invalid_input") return error(code, "The request could not be applied.", 400);
      return error("temporarily_unavailable", "Ping could not return the result. Check the original request before trying again.", 503);
    }
  };
}
