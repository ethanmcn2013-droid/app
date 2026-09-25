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
import { meta as board1Meta } from "./board/c1/meta";
import { meta as board2Meta } from "./board/c2/meta";
import { meta as board3Meta } from "./board/c3/meta";
import { meta as board4Meta } from "./board/c4/meta";
import { meta as board5Meta } from "./board/c5/meta";
import { meta as list1Meta } from "./list/c1/meta";
import { meta as list2Meta } from "./list/c2/meta";
import { meta as list3Meta } from "./list/c3/meta";
import { meta as list4Meta } from "./list/c4/meta";
import { meta as list5Meta } from "./list/c5/meta";
import { meta as calendar1Meta } from "./calendar/c1/meta";
import { meta as calendar2Meta } from "./calendar/c2/meta";
import { meta as calendar3Meta } from "./calendar/c3/meta";
import { meta as calendar4Meta } from "./calendar/c4/meta";
import { meta as calendar5Meta } from "./calendar/c5/meta";
import { meta as analytics1Meta } from "./analytics/c1/meta";
import { meta as analytics2Meta } from "./analytics/c2/meta";
import { meta as analytics3Meta } from "./analytics/c3/meta";
import { meta as analytics4Meta } from "./analytics/c4/meta";
import { meta as analytics5Meta } from "./analytics/c5/meta";
import { meta as analytics6Meta } from "./analytics/c6/meta";
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
  board1Meta,
  board2Meta,
  board3Meta,
  board4Meta,
  board5Meta,
  list1Meta,
  list2Meta,
  list3Meta,
  list4Meta,
  list5Meta,
  calendar1Meta,
  calendar2Meta,
  calendar3Meta,
  calendar4Meta,
  calendar5Meta,
  analytics1Meta,
  analytics2Meta,
  analytics3Meta,
  analytics4Meta,
  analytics5Meta,
  analytics6Meta,
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
  "board/1": () => import("./board/c1"),
  "board/2": () => import("./board/c2"),
  "board/3": () => import("./board/c3"),
  "board/4": () => import("./board/c4"),
  "board/5": () => import("./board/c5"),
  "list/1": () => import("./list/c1"),
  "list/2": () => import("./list/c2"),
  "list/3": () => import("./list/c3"),
  "list/4": () => import("./list/c4"),
  "list/5": () => import("./list/c5"),
  "calendar/1": () => import("./calendar/c1"),
  "calendar/2": () => import("./calendar/c2"),
  "calendar/3": () => import("./calendar/c3"),
  "calendar/4": () => import("./calendar/c4"),
  "calendar/5": () => import("./calendar/c5"),
  "analytics/1": () => import("./analytics/c1"),
  "analytics/2": () => import("./analytics/c2"),
  "analytics/3": () => import("./analytics/c3"),
  "analytics/4": () => import("./analytics/c4"),
  "analytics/5": () => import("./analytics/c5"),
  "analytics/6": () => import("./analytics/c6"),
};
