"use client";

/**
 * `/app/project` for someone who belongs to no Project yet: one plain line
 * and a New project button. The button opens a name field in place; creating
 * the Project lands on its own page here, with the Console above it.
 *
 * The same creation path as the Projects sidebar's "Add project" row
 * (`createProjectAction`), followed by the guarded Active Project switch
 * when it is available.
 */

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActiveProject } from "@/components/app/active-project-provider";
import { ShellIcon } from "@/components/shell/shell-icons";
import { parseProjectId } from "@/lib/projects/project-ref";
import { buildProjectUrl } from "@/lib/projects/project-url";
import { createProjectAction } from "@/server/actions/planning";
import styles from "./projects-first-run.module.css";

export function ProjectsFirstRun() {
  const router = useRouter();
  const activeProject = useActiveProject();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (naming) inputRef.current?.focus();
  }, [naming]);

  function cancel() {
    setNaming(false);
    setError(null);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.trim();
    if (!name || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createProjectAction(name, null);
        const id = parseProjectId(result.id);
        if (id && activeProject?.enabled) {
          const selection = activeProject.selectProject({ id, name }, { surface: "project" });
          if (selection.kind === "started") return;
        }
        // Creation already made the new Project the current one.
        if (id) router.replace(buildProjectUrl({ surface: "project" }, id));
        router.refresh();
      } catch {
        // Keep the draft so the name can be amended and tried again.
        setError("That project couldn’t be created. Check the name and try again.");
      }
    });
  }

  return (
    <main id="app-main-content" tabIndex={-1} className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden="true">
          <ShellIcon.projects size={20} />
        </span>
        <h1 className={styles.title}>No projects yet</h1>
        <p className={styles.text}>
          A project keeps its tasks, dates and files in one place. Start your first one and it shows up here.
        </p>
        {naming ? (
          <form
            className={styles.form}
            onSubmit={submit}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !pending) {
                event.preventDefault();
                cancel();
              }
            }}
          >
            <label htmlFor={inputId} className={styles.label}>
              Name your project
            </label>
            <input
              id={inputId}
              ref={inputRef}
              className={styles.input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="For example, Spring launch"
              maxLength={80}
              disabled={pending}
              aria-describedby={`${inputId}-hint`}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
            />
            {error ? (
              <p id={`${inputId}-hint`} className={styles.error} role="alert">
                {error}
              </p>
            ) : (
              <p id={`${inputId}-hint`} className={styles.hint}>
                You can change the name later.
              </p>
            )}
            <div className={styles.buttons}>
              <button type="submit" className={styles.primary} disabled={pending || !draft.trim()}>
                {pending ? "Creating…" : "Create project"}
              </button>
              <button type="button" className={styles.secondary} onClick={cancel} disabled={pending}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button ref={buttonRef} type="button" className={styles.primary} onClick={() => setNaming(true)}>
            <ShellIcon.plus size={14} />
            New project
          </button>
        )}
      </div>
    </main>
  );
}
