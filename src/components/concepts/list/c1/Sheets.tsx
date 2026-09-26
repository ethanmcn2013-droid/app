"use client";

import { Icon, Kbd } from "./glyphs";
import s from "./list.module.css";

const GROUPS: { title: string; rows: [React.ReactNode, string][] }[] = [
  {
    title: "Move around",
    rows: [
      [<><Kbd>J</Kbd> <Kbd>K</Kbd></>, "Next and previous task"],
      [<><Kbd>X</Kbd></>, "Select the task in focus"],
      [<><Kbd>⇧</Kbd> <Kbd>J</Kbd></>, "Extend the selection down"],
      [<><Kbd>⌘</Kbd> <Kbd>A</Kbd></>, "Select everything shown"],
      [<><Kbd>1</Kbd>–<Kbd>5</Kbd></>, "Switch saved view"],
      [<><Kbd>Esc</Kbd></>, "Clear the command, then the selection"],
    ],
  },
  {
    title: "Change",
    rows: [
      [<><Kbd>S</Kbd></>, "Set status"],
      [<><Kbd>A</Kbd></>, "Assign someone"],
      [<><Kbd>D</Kbd></>, "Set a due date"],
      [<><Kbd>P</Kbd></>, "Set priority"],
      [<><Kbd>L</Kbd></>, "Add or remove labels"],
      [<><Kbd>M</Kbd></>, "Move to another project"],
      [<><Kbd>C</Kbd></>, "Mark as done"],
      [<><Kbd>⌫</Kbd></>, "Delete"],
      [<><Kbd>Z</Kbd></>, "Undo the last change"],
    ],
  },
];

const EXAMPLES: [string, string][] = [
  ["orla friday high", "Assign to Orla, due Friday, high priority"],
  ["review, tomorrow", "Move to Review, due tomorrow"],
  ["new: Call the florist, aoife, mon", "Create a task in the focused group"],
  ["late kitchen", "With nothing selected: show late kitchen tasks"],
];

export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className={s.modalScrim} onClick={onClose}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-labelledby="c1-keys" onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <h2 id="c1-keys">Keyboard shortcuts</h2>
          <p>Everything here also works with a click. Keys are just faster.</p>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close" autoFocus>
            <Icon name="close" />
          </button>
        </div>
        <div className={s.keyCols}>
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              <dl>
                {g.rows.map(([k, label]) => (
                  <div key={label} className={s.keyRow}>
                    <dt>{label}</dt>
                    <dd>{k}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <section className={s.examples}>
          <h3>
            The command line <Kbd>/</Kbd>
          </h3>
          <p>Write the change in plain words, in any order. Names, days, priorities, statuses and labels all work.</p>
          <dl>
            {EXAMPLES.map(([cmd, what]) => (
              <div key={cmd} className={s.exampleRow}>
                <dt>
                  <code>{cmd}</code>
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
