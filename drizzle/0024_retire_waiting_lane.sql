-- 0024 · retire the raw-text waiting lane (T·121, board truth phase 2)
--
-- Since 2026-07-19 the board's fifth column, Waiting, was persisted as the
-- raw string 'waiting' in the unconstrained lane column — out of contract
-- with the four canonical lanes, invisible to lane-typed surfaces until
-- T·116 taught them to render it. The column system is config-defined now:
-- Waiting is a custom column claim (board_column_key), lane returns to the
-- canonical four, and affected workspaces are seeded a config that names
-- Waiting explicitly so their board renders identically before and after.
--
-- Order matters: configs are seeded while lane='waiting' rows still
-- identify the affected workspaces; the row rewrite runs last.

-- 1. Affected workspaces with NO stored column config: store the default
--    five-column config (what their board already renders), so Waiting is
--    theirs to rename or delete like any other custom column.
INSERT INTO meta (key, value, updated_at)
SELECT 'board:' || w.id || ':columns',
       '{"system":{},"custom":[{"key":"waiting","name":"Waiting"}],"order":["todo","doing","review","waiting","done"],"colors":{},"descriptions":{},"limits":{}}',
       unixepoch()
FROM workspaces w
WHERE EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.workspace_id = w.id AND t.lane = 'waiting'
      )
  AND NOT EXISTS (
        SELECT 1 FROM meta m WHERE m.key = 'board:' || w.id || ':columns'
      );
--> statement-breakpoint
-- 2. Affected workspaces WITH a stored config that does not know the
--    waiting key yet: append the custom column and its order slot. The
--    '"waiting"' guard is quote-delimited, so keys that merely contain
--    the word (col-waiting-x) do not suppress the append.
UPDATE meta
SET value = json_set(
      json_set(
        value,
        '$.custom[#]', json('{"key":"waiting","name":"Waiting"}')
      ),
      '$.order[#]', 'waiting'
    ),
    updated_at = unixepoch()
WHERE key IN (
        SELECT 'board:' || w.id || ':columns'
        FROM workspaces w
        WHERE EXISTS (
                SELECT 1 FROM tasks t
                WHERE t.workspace_id = w.id AND t.lane = 'waiting'
              )
      )
  AND value NOT LIKE '%"waiting"%';
--> statement-breakpoint
-- 3. The rows themselves: a Waiting task becomes a claim on the waiting
--    column with the canonical in-motion lane. No row is deleted; the
--    board, share, print, embed and export all resolve the same column
--    for the claim as they did for the raw text.
UPDATE tasks
SET board_column_key = 'waiting',
    lane = 'doing'
WHERE lane = 'waiting';
