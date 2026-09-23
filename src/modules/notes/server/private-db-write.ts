/**
 * Drizzle includes SQL parameters in a failed write's error, including private
 * note text. Replace that exception at the Server Action boundary without a
 * cause or logger call, while allowing the client to keep its exact retry text.
 * Only database operations belong inside this wrapper; validation and
 * owner/version conflicts retain their specific recovery guidance.
 */
export async function privateNotesDbWrite<T>(
  write: () => Promise<T>,
  kind: "capture" | "edit",
): Promise<T> {
  try {
    return await write();
  } catch {
    throw new Error(
      kind === "capture"
        ? "That did not save. Your exact words are still here."
        : "That edit could not be saved.",
    );
  }
}
