import type { RuntimeWatch } from '../runtime-policy';

/** The local fixture declares exactly one synthetic component Error. Preserve
 * the watcher's array identity so subsequent audit/capture errors stay visible. */
export function removeDeclaredComponentError(runtime: RuntimeWatch, prefix: string, id: string) {
  const expected = prefix + ': uncaught error Error: Synthetic materiality failure: ' + id;
  const matches = runtime.issues.flatMap((issue, index) =>
    issue.kind === 'console' && issue.message.split('\n')[0] === expected ? [index] : []);
  if (matches.length !== 1) throw Error('Expected exactly one declared synthetic component error');
  runtime.issues.splice(matches[0], 1);
}
