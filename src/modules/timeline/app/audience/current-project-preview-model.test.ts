import assert from "node:assert/strict";
import test from "node:test";
import { selectCurrentPreviewWorkspace } from "./current-project-preview-model";
const own={suiteWorkspaceId:"project-a",slug:"bound-a"};
const member={kind:"member",context:{workspaceId:"project-a",planningPeriodId:"period-a"}};
test("current preview accepts only the exact authorized existing Project binding",()=>{
  assert.equal(selectCurrentPreviewWorkspace([own],"project-a","period-a",member),own);
  assert.equal(selectCurrentPreviewWorkspace([own],"project-a",undefined,member),own);
  for(const [workspaces,project,period,proof] of [
    [[own],"project-b",undefined,member],[[own],"project-a","period-b",member],
    [[own],"project-a",undefined,{kind:"not_member"}],
    [[],"project-a",undefined,member],[[own,{...own}],"project-a",undefined,member],
  ] as const)assert.equal(selectCurrentPreviewWorkspace(workspaces,project,period,proof),null);
});
