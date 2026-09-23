/** Isolated test child. Accepts only an explicit synthetic database path. */
import { createClient } from "@libsql/client";
import { assertProjectId } from "../../../lib/projects/project-ref";
import { createLocalConversationDatabaseAdapter } from "../database";
import { createConversationService } from "../service";

async function main() {
  const [path, mode] = process.argv.slice(2);
  if (!path || !path.includes("signal-conversation-pc06-") || !["commit", "recover"].includes(mode)) throw new Error("invalid_fixture_input");
  const client = createClient({ url: `file:${path}` });
  const service = createConversationService(createLocalConversationDatabaseAdapter({ client }));
  const projectId = assertProjectId("synthetic_project_a");
  const actorId = "synthetic_alice";
  const room = await service.ensureProjectConversation({ actorId, projectId });
  if (!room.ok) throw new Error(room.code);
  const clientRequestId = "request_restart_001";
  const input = { projectId, conversationId: room.value.conversationId, clientRequestId, expectedAudienceEpoch: room.value.audienceEpoch, body: "Synthetic restart recovery", rootId: null, mentionUserIds: ["synthetic_bob"] };
  if (mode === "commit") {
    const sent = await service.sendMessage({ actorId, input });
    if (!sent.ok) throw new Error(sent.code);
    // Terminate the process after the transaction commits, before emitting its receipt.
    process.exit(0);
  }
  const recovered = await service.getReceipt({ actorId, projectId, conversationId: room.value.conversationId, clientRequestId });
  const retried = await service.sendMessage({ actorId, input });
  process.stdout.write(JSON.stringify({ recovered, retried }));
  client.close();
}
void main().catch(() => { process.stderr.write("restart_fixture_failed\n"); process.exitCode = 1; });
