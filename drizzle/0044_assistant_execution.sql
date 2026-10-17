-- Private execution custody; no provider credentials, transcript or prompt log.
CREATE TABLE assistant_runs (
 id text PRIMARY KEY NOT NULL,
 actor_id text REFERENCES users(id) ON DELETE SET NULL,
 request_id text NOT NULL,
 request_hash text NOT NULL CONSTRAINT assistant_run_hash CHECK(length(request_hash)=64),
 request_json text CHECK(request_json IS NULL OR json_valid(request_json)),
 status text NOT NULL DEFAULT 'planning', plan_json text CONSTRAINT assistant_run_plan CHECK(plan_json IS NULL OR json_valid(plan_json)),
 result_json text CONSTRAINT assistant_run_result CHECK(result_json IS NULL OR json_valid(result_json)),
 cancelled_at integer, execution_authorized_at integer, revision integer NOT NULL DEFAULT 0, created_at integer NOT NULL, updated_at integer NOT NULL,
 budget_request_id text, budget_model text, budget_rate_card_id text,
 reserved_micro_usd integer NOT NULL DEFAULT 0 CONSTRAINT assistant_run_budget CHECK(reserved_micro_usd>=0),
 input_tokens integer, output_tokens integer, estimated_micro_usd integer,
 usage_state text NOT NULL DEFAULT 'not_reserved'
);
CREATE UNIQUE INDEX assistant_runs_actor_request ON assistant_runs(actor_id,request_id);
CREATE UNIQUE INDEX assistant_runs_budget_request ON assistant_runs(budget_request_id);
CREATE TABLE assistant_steps (
 id text PRIMARY KEY NOT NULL, run_id text NOT NULL REFERENCES assistant_runs(id) ON DELETE CASCADE,
 ordinal integer NOT NULL, step_key text NOT NULL,
 payload_json text NOT NULL CONSTRAINT assistant_step_payload CHECK(json_valid(payload_json)),
 payload_hash text NOT NULL CONSTRAINT assistant_step_hash CHECK(length(payload_hash)=64),
 status text NOT NULL DEFAULT 'pending', fence integer NOT NULL DEFAULT 0, lease_until integer,
 result_json text CONSTRAINT assistant_step_result CHECK(result_json IS NULL OR json_valid(result_json)),
 error_code text, delivery_state text NOT NULL DEFAULT 'not_applicable', delivery_json text CHECK(delivery_json IS NULL OR json_valid(delivery_json)), created_at integer NOT NULL, updated_at integer NOT NULL
);
CREATE UNIQUE INDEX assistant_steps_run_key ON assistant_steps(run_id,step_key);
CREATE UNIQUE INDEX assistant_steps_run_ordinal ON assistant_steps(run_id,ordinal);
