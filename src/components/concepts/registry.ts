import type { ComponentType } from "react";
/**
 * Concept gallery registry (review/demo only). Each concept lives in its own
 * folder: src/components/concepts/<view>/c<n>/{meta.ts,index.tsx,...}.
 */
import { meta as overview1Meta } from "./overview/c1/meta";
import { meta as overview2Meta } from "./overview/c2/meta";
import { meta as overview3Meta } from "./overview/c3/meta";
import { meta as overview4Meta } from "./overview/c4/meta";
import { meta as overview5Meta } from "./overview/c5/meta";
import { meta as projects1Meta } from "./projects/c1/meta";
import { meta as projects2Meta } from "./projects/c2/meta";
import { meta as projects3Meta } from "./projects/c3/meta";
import { meta as projects4Meta } from "./projects/c4/meta";
import { meta as projects5Meta } from "./projects/c5/meta";
import { meta as files1Meta } from "./files/c1/meta";
import { meta as files2Meta } from "./files/c2/meta";
import { meta as files3Meta } from "./files/c3/meta";
import { meta as files4Meta } from "./files/c4/meta";
import { meta as files5Meta } from "./files/c5/meta";
import type { ConceptMeta } from "./types";

export const CONCEPTS: readonly ConceptMeta[] = [
  overview1Meta,
  overview2Meta,
  overview3Meta,
  overview4Meta,
  overview5Meta,
  projects1Meta,
  projects2Meta,
  projects3Meta,
  projects4Meta,
  projects5Meta,
  files1Meta,
  files2Meta,
  files3Meta,
  files4Meta,
  files5Meta,
];

export const CONCEPT_LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {
  "overview/1": () => import("./overview/c1"),
  "overview/2": () => import("./overview/c2"),
  "overview/3": () => import("./overview/c3"),
  "overview/4": () => import("./overview/c4"),
  "overview/5": () => import("./overview/c5"),
  "projects/1": () => import("./projects/c1"),
  "projects/2": () => import("./projects/c2"),
  "projects/3": () => import("./projects/c3"),
  "projects/4": () => import("./projects/c4"),
  "projects/5": () => import("./projects/c5"),
  "files/1": () => import("./files/c1"),
  "files/2": () => import("./files/c2"),
  "files/3": () => import("./files/c3"),
  "files/4": () => import("./files/c4"),
  "files/5": () => import("./files/c5"),
};
