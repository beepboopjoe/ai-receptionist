-- Rename contacts.patient_type → contacts.contact_type to align with the
-- contacts table name (table itself was never patients; only this column
-- and a few code paths still carried legacy "patient" naming).

ALTER TABLE contacts RENAME COLUMN patient_type TO contact_type;

-- Backfill historical workflow_triggered values that store the literal
-- string 'new_patient' / 'existing_patient' on calls. The WorkflowType
-- union in shared types is changing to the _contact suffix at the same
-- time, so existing rows would otherwise become unreadable.
UPDATE calls
   SET workflow_triggered = REPLACE(workflow_triggered, '_patient', '_contact')
 WHERE workflow_triggered LIKE '%\_patient' ESCAPE '\';
