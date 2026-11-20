/* Where each piece of a tool's data comes from, before you add it. */

import { FILES, NOTES, POSTS, PRESS, PROOFS, projectById, SUPPLIERS, toolById, type Guest, type ProjectId, type Section, type Step, type Table, type Task, type ToolId } from "./data";

export type Source = { what: string; from: string };
export type Sources = { items: Source[]; empty?: string };

export type Live = { tasks: Task[]; guests: Guest[]; tables: Table[]; mfSteps: Step[]; orchardSteps: Step[]; sections: Section[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function sourcesFor(tool: ToolId, project: ProjectId, live: Live): Sources {
  const p = projectById(project);
  const tasks = live.tasks.filter((t) => t.project === project);
  const starts = { items: [], empty: `Nothing in ${p.name} fits ${toolById(tool).name} yet, so it opens on its first step.` };

  switch (tool) {
    case "tasks":
      return {
        items: [
          { what: plural(tasks.filter((t) => !t.done).length, "task") + " to do", from: `Everyone in ${p.name}` },
          { what: plural(tasks.filter((t) => t.done).length, "task") + " done", from: "Ticked off this week" },
        ],
      };

    case "seating":
    case "guests": {
      if (project !== "mf") return starts;
      const seated = live.guests.filter((g) => g.table !== null).length;
      const waiting = live.guests.length - seated;
      const diets = live.guests.filter((g) => g.diet).length;
      const list = { what: `${plural(live.guests.length, "guest")}, ${seated} with a table`, from: "The guest list Mara pasted on 3 September" };
      const food = { what: `${plural(diets, "dietary note")}`, from: "Replies by text and email, added by Mara and Finn" };
      if (tool === "guests") return { items: [list, { what: `${waiting} still waiting for a table`, from: "Seating" }, food] };
      return {
        items: [list, { what: `${plural(live.tables.length, "table")} of 8 in the barn`, from: "Barn floor plan.png, in Files" }, { what: "Top table: Mara, Finn and six", from: "Task: Seating plan due 2 Oct" }],
      };
    }

    case "dayplan": {
      if (project === "mf") {
        const placed = tasks.filter((t) => t.at !== undefined).length;
        return {
          items: [
            { what: plural(live.mfSteps.length, "step") + ", 8am to 1am", from: "The Orchard's Saturday plan, the venue for the day" },
            { what: placed ? plural(placed, "task") + " with a time" : "Tasks with a time", from: placed ? "Tasks you placed on the day" : "Drag a task onto a time and it shows here" },
            { what: "Supplier names on each step", from: "Suppliers booked through The Orchard" },
          ],
        };
      }
      if (project === "orchard") {
        return {
          items: [
            { what: plural(live.orchardSteps.length, "step") + " for Saturday", from: "Written by Dara on Wednesday" },
            { what: "Speeches at 7:30pm", from: "Moved by Dara on Saturday" },
          ],
        };
      }
      return starts;
    }

    case "timer":
      if (project === "orchard") return { items: [{ what: "Counts down to the next step", from: "Day plan, live on the night" }] };
      if (project === "mf") return { items: [{ what: "31 steps to count down to", from: "Day plan" }], empty: "Pick a step and it starts counting." };
      return starts;

    case "suppliers":
      if (project === "orchard") {
        return {
          items: [
            { what: `${plural(SUPPLIERS.length, "supplier")} with a phone number`, from: "Contracts in Files" },
            { what: "Who is here and who is due", from: "Day plan" },
          ],
        };
      }
      if (project === "mf") return { items: [{ what: "9 suppliers named on the day", from: "Day plan steps" }], empty: "Phone numbers are added as you go." };
      return starts;

    case "budget":
      if (project === "mf") {
        return {
          items: [
            { what: "€640 florist balance", from: "Task: Pay the florist balance" },
            { what: "Planned costs", from: "Budget.xlsx, in Files" },
          ],
        };
      }
      return starts;

    case "forms":
      if (project === "mf") return { items: [{ what: "27 people to ask about food", from: "Guest list, the ones still waiting" }] };
      return starts;

    case "outline":
    case "split":
    case "study": {
      if (tool === "split" && project !== "riverside") {
        const people = new Set(tasks.map((t) => t.who)).size;
        return { items: [{ what: `${plural(tasks.length, "task")} across ${plural(people, "person", "people")}`, from: `Tasks in ${p.name}` }, { what: "Who each one is for", from: "The name on each task" }] };
      }
      if (project !== "riverside") return starts;
      const words = live.sections.reduce((a, s) => a + s.words, 0);
      if (tool === "outline") return { items: [{ what: `${plural(live.sections.length, "part")}, ${words.toLocaleString("en-IE")} words so far`, from: "The essay plan Priya wrote" }] };
      if (tool === "split") return { items: [{ what: "Who has each part", from: "Shared doc" }, { what: "Words written against each target", from: "Shared doc" }] };
      return { items: [{ what: "Four people to study with", from: "Riverside study group" }] };
    }

    case "social":
      return project === "hollis" ? { items: [{ what: `${plural(POSTS.length, "post")} this week`, from: "Planned by Aoife and Cian" }] } : starts;
    case "press":
      return project === "hollis" ? { items: [{ what: `${plural(PRESS.length, "journalist")}`, from: "The press kit list, sent 25 September" }] } : starts;
    case "proofs":
      return project === "hollis" ? { items: [{ what: `${plural(PROOFS.length, "design")} with their notes`, from: "Uploaded by the printer" }] } : starts;
    case "notes":
      return { items: [{ what: plural(NOTES[project].length, "note"), from: `Written in ${p.name}` }] };
    case "files":
      return { items: [{ what: plural(FILES.length, "file"), from: "Added to the Project drive" }] };
    case "calendar":
      return { items: [], empty: "Dates stay here until you connect Google or Outlook." };
    case "whatsapp":
      return { items: [], empty: "Nothing comes in until you link a group." };
    case "email":
      return { items: [], empty: "Nothing comes in until you forward the first email." };
    default:
      return starts;
  }
}
