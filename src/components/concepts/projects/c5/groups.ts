import type { Project } from "./data";

export type Group = { id: "coming" | "nodate" | "wrapped"; label: string; projects: Project[] };

export function groupProjects(projects: Project[]): Group[] {
  const coming = projects
    .filter((p) => !p.wrapped && p.date)
    .sort((a, b) => (a.date as string).localeCompare(b.date as string));
  const nodate = projects.filter((p) => !p.wrapped && !p.date);
  const wrapped = projects
    .filter((p) => p.wrapped)
    .sort((a, b) => (b.wrapped as { on: string }).on.localeCompare((a.wrapped as { on: string }).on));
  return [
    { id: "coming", label: "Coming up", projects: coming },
    { id: "nodate", label: "No date", projects: nodate },
    { id: "wrapped", label: "Wrapped", projects: wrapped },
  ];
}

export function railOrder(projects: Project[]): Project[] {
  return groupProjects(projects).flatMap((g) => g.projects);
}
