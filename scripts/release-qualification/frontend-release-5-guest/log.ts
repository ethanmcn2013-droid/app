export const fixtureLogs: unknown[][] = [];
export function opLog(...args: unknown[]) { fixtureLogs.push(args); }
