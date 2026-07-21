import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vercel build output — exclude so lint doesn't flood on deploy artifacts.
    ".vercel/**",
    // Deterministic browser evidence is generated locally and in CI.
    "experience/output/**",
  ]),
  {
    // GRANDFATHERED lint debt: these five files were ported verbatim from
    // notes.git (which never ran these rules). Refactoring their state
    // patterns is post-cutover backlog, not port scope — parity beats lint.
    // Ratchet rule (same spirit as .ds-grandfather.json): this list may only
    // SHRINK. New module code starts lint-clean.
    files: [
      "src/modules/notes/app/Notebook.tsx",
      "src/modules/notes/app/PrivateNotesEmptyState.tsx",
      "src/modules/notes/app/hybrid/HybridNotebook.tsx",
      "src/modules/notes/app/notebook/hooks.ts",
      "src/modules/notes/app/page.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
    },
  },
]);

export default eslintConfig;
