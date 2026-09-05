CREATE TABLE event_purchase_designations (
 id TEXT PRIMARY KEY NOT NULL,
 purchaser_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 checkout_authorized_at INTEGER CHECK (checkout_authorized_at > 0),
 provider_reference TEXT,
 settled_at INTEGER,
 original_expires_at INTEGER,
 designation TEXT NOT NULL DEFAULT 'pending' CHECK (designation IN ('pending','designated','paid_undesignated')),
 reason TEXT CHECK (reason IN ('owner_changed','membership_removed','project_archived','project_deleting')),
 settlement_authorized_at INTEGER,
 revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0,1)),
 CHECK (provider_reference IS NULL OR (provider_reference GLOB 'stripe:cs_*' AND length(provider_reference) <= 255)),
 CHECK (
  (purchaser_user_id IS NULL AND id GLOB 'ered_*' AND designation = 'designated' AND provider_reference IS NULL AND checkout_authorized_at IS NULL AND settlement_authorized_at IS NULL AND reason IS NULL AND settled_at IS NOT NULL AND settled_at > 0 AND original_expires_at IS NOT NULL AND original_expires_at > settled_at)
  OR
  (purchaser_user_id IS NOT NULL AND checkout_authorized_at IS NOT NULL AND (
  (designation = 'pending' AND settled_at IS NULL AND original_expires_at IS NULL AND reason IS NULL AND settlement_authorized_at IS NULL AND revoked = 0)
  OR
  (designation <> 'pending' AND provider_reference IS NOT NULL AND settled_at IS NOT NULL AND settled_at > 0 AND original_expires_at IS NOT NULL AND original_expires_at > settled_at AND
   ((designation = 'designated' AND reason IS NULL AND settlement_authorized_at IS NOT NULL AND settlement_authorized_at >= checkout_authorized_at)
    OR (designation = 'paid_undesignated' AND reason IS NOT NULL AND settlement_authorized_at IS NULL)))))
 )
);
--> statement-breakpoint
CREATE UNIQUE INDEX event_purchase_reference_unique ON event_purchase_designations(provider_reference) WHERE provider_reference IS NOT NULL;
--> statement-breakpoint
CREATE INDEX event_purchase_project_idx ON event_purchase_designations(workspace_id);
--> statement-breakpoint
CREATE TRIGGER event_purchase_facts_immutable
BEFORE UPDATE ON event_purchase_designations
WHEN ((NEW.id IS NOT OLD.id
 OR NEW.purchaser_user_id IS NOT OLD.purchaser_user_id
 OR NEW.checkout_authorized_at IS NOT OLD.checkout_authorized_at
 OR (OLD.provider_reference IS NOT NULL AND NEW.provider_reference IS NOT OLD.provider_reference)
 OR (OLD.designation <> 'pending' AND NEW.settlement_authorized_at IS NOT OLD.settlement_authorized_at))
 AND NOT (OLD.purchaser_user_id IS NOT NULL AND NEW.purchaser_user_id IS NULL
  AND NEW.id GLOB 'ered_*' AND NEW.id IS NOT OLD.id
  AND NEW.provider_reference IS NULL AND NEW.checkout_authorized_at IS NULL AND NEW.settlement_authorized_at IS NULL))
 OR NEW.workspace_id IS NOT OLD.workspace_id
 OR (OLD.designation <> 'pending' AND (
  NEW.settled_at IS NOT OLD.settled_at
  OR NEW.original_expires_at IS NOT OLD.original_expires_at
  OR NEW.designation IS NOT OLD.designation
  OR NEW.reason IS NOT OLD.reason
 ))
 OR NEW.revoked < OLD.revoked
BEGIN
 SELECT RAISE(ABORT, 'Event purchase facts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER event_purchase_purchaser_erasure
BEFORE DELETE ON users
BEGIN
 DELETE FROM event_purchase_designations WHERE purchaser_user_id = OLD.id AND designation <> 'designated';
 UPDATE event_purchase_designations
 SET id = 'ered_' || lower(hex(randomblob(16))), purchaser_user_id = NULL,
  provider_reference = NULL, checkout_authorized_at = NULL, settlement_authorized_at = NULL
 WHERE purchaser_user_id = OLD.id AND designation = 'designated';
END;
--> statement-breakpoint
CREATE TRIGGER event_purchase_project_erasure
BEFORE DELETE ON workspaces
BEGIN
 DELETE FROM event_purchase_designations WHERE workspace_id = OLD.id;
END;
