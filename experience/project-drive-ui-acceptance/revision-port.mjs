/** Extract the actual hook unchanged. The controlled context value is an
 * explicit local fixture input; it does not establish Provider freshness. */
export function revisionPortModule(source) {
  const start = source.indexOf('export function useAuthoritativeTaskRevision(taskId: string): number {');
  const end = source.indexOf('\nexport function useTasksState()', start);
  if (start < 0 || end < 0) throw Error('Actual authoritative revision hook unavailable');
  const hook = source.slice(start, end).trim();
  if (!hook.includes('useContext(AuthoritativeTaskContext)') || !hook.includes('versions.get(taskId)?.revision ?? 0'))
    throw Error('Authoritative revision contract changed; fixture review required');
  return `import React,{createContext,useContext} from 'react';
import type {AuthoritativeTaskVersions} from '@/lib/tasks/authoritative-refresh';
const AuthoritativeTaskContext=createContext<AuthoritativeTaskVersions|null>(null);
${hook}
export function FixtureRevisionProvider({children}){
  const versions=new Map([['drive-task',{signature:'synthetic-local-read',revision:0}]]);
  return <AuthoritativeTaskContext.Provider value={versions}>{children}</AuthoritativeTaskContext.Provider>;
}`;
}
