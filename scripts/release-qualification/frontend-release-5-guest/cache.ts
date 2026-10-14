export const invalidations: string[] = [];
export function revalidatePath(path: string) { invalidations.push(path); }
