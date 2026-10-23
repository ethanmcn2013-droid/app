import "server-only";

/** Search may lag accepted writes. A deadline is uncertainty, never absence. */
export async function boundedSubfolderProviderCall<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Drive folder provider deadline exceeded")); }, 15_000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function canonicalSubfolderUrl(folderId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,256}$/.test(folderId)) throw new Error("Invalid Drive folder identity");
  return `https://drive.google.com/drive/folders/${folderId}`;
}
