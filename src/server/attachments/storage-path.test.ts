import assert from "node:assert/strict";
import test from "node:test";
import { relative } from "node:path";
import { buildAttachmentStoragePath } from "./storage-path";

const root = "C:\\isolated\\tasks-uploads";

test("attachment paths remain under the upload root for legitimate ids", () => {
  const result = buildAttachmentStoragePath({
    root,
    workspaceId: "ws-a",
    taskId: "t-123",
    attachmentId: "att-456",
    filename: "brief.pdf",
  });
  assert.equal(relative(root, result).startsWith(".."), false);
  assert.match(result, /ws-a[\\/]t-123[\\/]att-456-brief\.pdf$/);
});

for (const taskId of ["../outside", "..\\outside", "/absolute", "t/child", "t%2fchild"]) {
  test(`attachment paths safely encode custom task id ${JSON.stringify(taskId)}`, () => {
    const result = buildAttachmentStoragePath({
      root,
      workspaceId: "ws-a",
      taskId,
      attachmentId: "att-456",
      filename: "brief.pdf",
    });
    assert.equal(relative(root, result).startsWith(".."), false);
    assert.doesNotMatch(relative(root, result), /outside|absolute|t[\\/]child/);
  });
}

test("attachment paths reject an empty task id", () => {
  assert.throws(() => buildAttachmentStoragePath({
    root,
    workspaceId: "ws-a",
    taskId: "",
    attachmentId: "att-456",
    filename: "brief.pdf",
  }), /invalid task id/);
});

for (const filename of ["../brief.pdf", "..\\brief.pdf", ".hidden", "brief/name.pdf"]) {
  test(`attachment paths reject unsafe filename ${JSON.stringify(filename)}`, () => {
    assert.throws(
      () => buildAttachmentStoragePath({
        root,
        workspaceId: "ws-a",
        taskId: "t-123",
        attachmentId: "att-456",
        filename,
      }),
      /invalid filename/,
    );
  });
}
