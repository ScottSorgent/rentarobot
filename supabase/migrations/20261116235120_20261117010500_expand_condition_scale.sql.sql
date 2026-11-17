/*
# Replace robot condition scale with standard equipment grades

1. Purpose
- The Condition dropdown on the List Your Robot form offered only New,
  Refurbished, Used. The user wants the condition choices removed in favor
  of a fuller, industry-standard equipment-condition scale.

2. New Scale (stored values -> labels)
- `new_in_box`         -> New in Box (unopened, factory sealed)
- `new_open_box`       -> New Open Box (unused, opened packaging)
- `refurbished`        -> Certified Refurbished (inspected, serviced, warranty)
- `like_new`           -> Like New (barely used, no visible wear)
- `good`               -> Good (light wear, fully functional)
- `fair`               -> Fair (visible wear, works with minor issues)
- `needs_service`      -> Needs Service (usable after repair)

3. Modified Tables
- `robots`: `robots_condition_check` recreated to accept the new values.
  No existing row uses any condition value (all 7 reference robots are
  NULL), so no data migration is needed and nothing is lost.

4. Security
- No RLS or grant changes.

5. Important Notes
- Idempotent: the DO block checks whether the new values are already
  allowed before recreating the constraint.
- The frontend keeps 'new', 'refurbished', 'used' as accepted legacy
  inputs only for reading old snapshots; the form offers the new scale.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'robots_condition_check'
    AND pg_get_constraintdef(oid) LIKE '%new_in_box%'
  ) THEN
    ALTER TABLE robots DROP CONSTRAINT robots_condition_check;
    ALTER TABLE robots ADD CONSTRAINT robots_condition_check
      CHECK (condition = ANY (ARRAY[
        'new'::text, 'refurbished'::text, 'used'::text,
        'new_in_box'::text, 'new_open_box'::text, 'like_new'::text,
        'good'::text, 'fair'::text, 'needs_service'::text
      ]));
  END IF;
END
$$;
