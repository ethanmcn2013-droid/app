/**
 * Notes module public surface.
 *
 * Exports the real module page component (NotebookPage) for use in the
 * /app/notes route segment. Import only from this barrel; do not reach
 * into src/modules/notes internals directly.
 */
export { default as NotebookPage } from "./app/page";
