export type ConceptView = "overview" | "projects" | "files" | "board" | "list" | "calendar" | "analytics";

export type ConceptMeta = {
  view: ConceptView;
  n: 1 | 2 | 3 | 4 | 5 | 6;
  /** Two to four words. */
  title: string;
  /** One sentence: the idea this concept bets on. */
  thesis: string;
};
