-- 0026 · workspaces.currency + workspaces.budget_cents (T·124, phase 5)
--
-- Money, narrowly: a project gets one currency label and one operator
-- budget. Both nullable, both additive; no existing row changes. NULL
-- currency keeps the USD label existing amounts were entered under —
-- relabelling stored numbers would change the operator's claim, which
-- the ratified boundary forbids.

ALTER TABLE workspaces ADD COLUMN currency TEXT;
--> statement-breakpoint
ALTER TABLE workspaces ADD COLUMN budget_cents INTEGER;
