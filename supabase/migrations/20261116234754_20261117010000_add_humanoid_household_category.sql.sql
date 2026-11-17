/*
# Add humanoid_household equipment category

1. Purpose
- Owners listing robots currently have one "humanoid" choice. The List Your
  Robot form splits this into two options:
  - "Humanoid Chef Robot" (existing `humanoid` value — cooking/kitchen robots)
  - "Humanoid Household Task Robot" (NEW `humanoid_household` value — laundry,
    tidy-up, general household tasks)
- This migration only widens what the database accepts; no rows are changed.

2. Modified Tables
- `robots`: the `robots_equipment_category_check` constraint is recreated to
  also allow 'humanoid_household'. The existing 'humanoid' value and all
  other values keep their meaning, so existing listings are untouched.

3. Security
- No RLS or grant changes.

4. Important Notes
- Idempotent: the new constraint is only created after dropping the old one
  by name, and the DO block checks whether the value is already allowed.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'robots_equipment_category_check'
    AND pg_get_constraintdef(oid) LIKE '%humanoid_household%'
  ) THEN
    ALTER TABLE robots DROP CONSTRAINT robots_equipment_category_check;
    ALTER TABLE robots ADD CONSTRAINT robots_equipment_category_check
      CHECK (equipment_category = ANY (ARRAY[
        'vacuum_mop'::text, 'window_cleaning'::text, 'floor_polishing'::text,
        'carpet_deep_cleaning'::text, 'humanoid'::text, 'humanoid_household'::text,
        'other_specialized'::text
      ]));
  END IF;
END
$$;
