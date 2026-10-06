import {
  commit,
  redo,
  startHistory,
  undo,
  type Automation,
  type History,
} from "@/lib/automations/graph";

/**
 * What the editor remembers besides the drawing itself: what is selected,
 * whether the edit panel is open, which steps have just appeared (so only
 * they animate in) and the last thing said to a screen reader.
 */
export type EditorState = Readonly<{
  history: History;
  selection: readonly string[];
  link: string | null;
  panel: boolean;
  fresh: readonly string[];
  said: Readonly<{ text: string; n: number }>;
  /** A refusal worth showing as well as saying ("that would make a circle"). */
  hint: Readonly<{ text: string; n: number }> | null;
}>;

export type EditorAction =
  | Readonly<{
      type: "apply";
      doc: Automation;
      now: number;
      tag?: string;
      select?: readonly string[];
      fresh?: readonly string[];
      say?: string;
      panel?: boolean;
    }>
  | Readonly<{ type: "undo" }>
  | Readonly<{ type: "redo" }>
  | Readonly<{ type: "select"; ids: readonly string[]; panel?: boolean }>
  | Readonly<{ type: "selectLink"; id: string | null }>
  | Readonly<{ type: "panel"; open: boolean }>
  | Readonly<{ type: "say"; text: string; show?: boolean }>
  | Readonly<{ type: "settled" }>
  | Readonly<{ type: "hintDone"; n: number }>;

export function initEditor(doc: Automation): EditorState {
  return { history: startHistory(doc), selection: [], link: null, panel: false, fresh: [], said: { text: "", n: 0 }, hint: null };
}

/** After any change to the drawing, forget selections that no longer exist. */
function settle(state: EditorState): EditorState {
  const doc = state.history.present;
  const alive = new Set(doc.steps.map((step) => step.id));
  const selection = state.selection.every((id) => alive.has(id)) ? state.selection : state.selection.filter((id) => alive.has(id));
  const link = state.link && doc.links.some((entry) => entry.id === state.link) ? state.link : null;
  return { ...state, selection, link, panel: state.panel && selection.length > 0 };
}

const say = (state: EditorState, text: string | undefined): EditorState["said"] =>
  text ? { text, n: state.said.n + 1 } : state.said;

export function reduceEditor(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "apply": {
      const history = commit(state.history, action.doc, action.tag ?? null, action.now);
      if (history === state.history && !action.select && !action.say) return state;
      return settle({
        ...state,
        history,
        selection: action.select ?? state.selection,
        link: action.select ? null : state.link,
        fresh: action.fresh ?? state.fresh,
        panel: action.panel ?? state.panel,
        said: say(state, action.say),
      });
    }
    case "undo": {
      const history = undo(state.history);
      if (history === state.history) return { ...state, said: say(state, "Nothing to undo") };
      return settle({ ...state, history, fresh: [], said: say(state, "Undone") });
    }
    case "redo": {
      const history = redo(state.history);
      if (history === state.history) return { ...state, said: say(state, "Nothing to redo") };
      return settle({ ...state, history, fresh: [], said: say(state, "Redone") });
    }
    case "select":
      return settle({ ...state, selection: action.ids, link: null, panel: action.panel ?? state.panel });
    case "selectLink":
      return { ...state, link: action.id, selection: [], panel: false };
    case "panel":
      return settle({ ...state, panel: action.open });
    case "say": {
      const said = say(state, action.text);
      return { ...state, said, hint: action.show ? { text: action.text, n: said.n } : state.hint };
    }
    case "settled":
      return state.fresh.length === 0 ? state : { ...state, fresh: [] };
    case "hintDone":
      return state.hint?.n === action.n ? { ...state, hint: null } : state;
  }
}
