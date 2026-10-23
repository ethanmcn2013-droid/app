import "server-only";
import { createHash } from "node:crypto";
import type { AssistantActionInput } from "./actions";
import type { AssistantActionResult } from "@/lib/ping/assistant/contract";
import { isAssistantDriveFolderPending } from "@/lib/ping/assistant/drive-folder";
import { AssistantActionRefusal, authorizeAssistantProject } from "./context";
import type { ProjectDriveSubfolderResult } from "@/server/connections/project-drive-subfolders";

export function assistantDriveFolderOperationId(actorId: string, runId: string, stepId: string) {
  const hex = createHash("sha256").update(JSON.stringify(["ping-drive-folder/1", actorId, runId, stepId])).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

/** Commit private intent custody before any canonical Drive prepare/provider work. */
export async function executeAssistantDriveFolder(input: AssistantActionInput): Promise<AssistantActionResult> {
  const step = input.step;
  if (step.kind !== "create_drive_subfolder") throw new AssistantActionRefusal("unsupported");
  const binding = input.boundTaskTargets?.[step.id];
  if (!binding?.projectState || !binding.driveFolder || binding.driveFolder.actorUserId !== input.actorId || binding.driveFolder.projectId !== binding.projectId || binding.driveFolder.folderName !== step.folderName) throw new AssistantActionRefusal("stale");
  const pending = await input.commitStep(input.stepId, input.fence, async tx => {
    const project = await authorizeAssistantProject(tx, input.actorId, binding.projectId, "manageProject");
    if (project.revision !== binding.projectState!.revision || project.archivedAt !== null || binding.projectState!.archivedAt !== null) throw new AssistantActionRefusal("stale");
    return { stepId: input.stepId, kind: step.kind, status: "completed", projectId: project.id, affectedCount: 0, code: "drive_folder_pending", summary: "Folder creation needs a status check. Existing folder access is unchanged; there is no Undo." };
  });
  if (!isAssistantDriveFolderPending(pending)) return pending;
  if (!input.driveFolders || !input.settleDriveFolderResult || !input.guardDriveFolderAttempt) return pending;
  const operationId = assistantDriveFolderOperationId(input.actorId, input.runId, input.stepId);
  const locator = { projectId: binding.projectId, actorUserId: input.actorId, operationId };
  try {
    let domain: ProjectDriveSubfolderResult | null;
    if (input.driveFolderRecoveryOnly) {
      domain = await input.driveFolders.read(locator);
      if(await input.driveFolders.retireUnattempted(locator))domain=null;
      const reconciled=await input.settleDriveFolderResult(input.actorId,input.runId,input.stepId,domain??{operationId,status:'pending',folderName:step.folderName,folderUrl:null});
      if(!isAssistantDriveFolderPending(reconciled))return reconciled;
      if(!domain)return pending;
    } else {
      await input.guardDriveFolderAttempt();
      domain = await input.driveFolders.prepare(binding.driveFolder, operationId, input.guardDriveFolderAttempt);
    }
    if (!["complete", "attention"].includes(domain.status)) {
      domain = await input.driveFolders.execute({ ...locator, recoveryOnly: input.driveFolderRecoveryOnly, assertMutationAllowed: input.guardDriveFolderAttempt });
    }
    if (domain.status !== "complete" && domain.status !== "attention") return pending;
    return await input.settleDriveFolderResult(input.actorId, input.runId, input.stepId, domain);
  } catch {
    // A committed original receipt is recoverable even if prepare, provider,
    // configuration or result settlement failed. Never infer success/absence.
    return pending;
  }
}
