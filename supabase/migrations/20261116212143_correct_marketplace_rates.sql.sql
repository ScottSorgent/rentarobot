/*
# Correct marketplace commission rates and non-humanoid rental prices

1. Plain-English summary
   An audit found the catalog's monthly prices for the specialized cleaning
   robots ($1,790 to $2,990 per month) far above market. Those figures were
   entered when the catalog pivoted to premium-only robots and were never
   validated; they are not produced by any multiplier bug. This migration
   corrects the owner-listed prices for the five NON-humanoid robots to
   realistic monthly rates (the reference rate for a standard vacuum/mop is
   about $36.99), sets the platform commission to the new 20% / 80% split,
   and records a $1-per-monthly-rental hosting allocation.

   The two humanoid robots (AuroraHome Butler H1, CuisineCraft Chef C2) keep
   their existing owner-set monthly prices. Humanoid rentals also support
   daily and weekly terms; their existing daily ($289/$259) and weekly
   ($1,549/$1,399) rates are preserved and become editable fields.

2. Modified tables
   - `robots` (no schema change): non-humanoid `monthly_rate` corrected to the
     new owner prices. Humanoid rows keep their monthly rate. All existing
     `daily_rate` / `weekly_rate` values are kept for humanoids.
   - `robot_pricing` (no schema change): `owner_monthly_price` synced to the
     corrected catalog rate for non-humanoids; humanoids untouched.
   - `pricing_settings`: `commission_pct` set to 0.20 (20% platform, 80%
     owner payout), `hosting_monthly` set to 1.00 ($1 per monthly rental,
     internal platform expense).

3. Data changes (before -> after)
   - GlassGlide Window Pro S2:      $1,790.00 -> $79.00 /month
   - PerimeterEdge Detail S5:       $2,190.00 -> $89.00 /month
   - SkyGlide Window Elite X7:      $2,590.00 -> $119.00 /month
   - PolishBot Finish 2000:         $2,690.00 -> $129.00 /month
   - HydroScrub Wash Pro 9:         $2,990.00 -> $149.00 /month
   - AuroraHome Butler H1:          unchanged ($4,790.00 /month)
   - CuisineCraft Chef C2:          unchanged ($4,290.00 /month)
   - Historical bookings and their stored pricing snapshots are NOT touched.

4. Security
   - No privilege, policy, or grant changes.
   - One pricing_audit row records the correction.
*/

-- Corrected owner-set monthly prices for the five non-humanoid robots,
-- identified by stable name (never by generated id).
UPDATE robots r
SET monthly_rate = v.corrected_monthly
FROM (VALUES
  ('GlassGlide Window Pro S2',   79.00::numeric),
  ('PerimeterEdge Detail S5',    89.00::numeric),
  ('SkyGlide Window Elite X7',  119.00::numeric),
  ('PolishBot Finish 2000',     129.00::numeric),
  ('HydroScrub Wash Pro 9',     149.00::numeric)
) AS v(robot_name, corrected_monthly)
WHERE r.name = v.robot_name;

UPDATE robot_pricing p
SET owner_monthly_price = r.monthly_rate
FROM robots r
WHERE r.id = p.robot_id
  AND r.name IN (
    'GlassGlide Window Pro S2', 'PerimeterEdge Detail S5',
    'SkyGlide Window Elite X7', 'PolishBot Finish 2000',
    'HydroScrub Wash Pro 9'
  );

-- New marketplace financial structure: 20% platform / 80% owner, and the
-- $1-per-monthly-rental hosting allocation as an internal expense.
UPDATE pricing_settings
SET commission_pct = 0.20,
    hosting_monthly = 1.00
WHERE id = 1;

INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
VALUES (NULL, 'settings', 'Corrected non-humanoid monthly prices ($79-$149), set commission to 20% and hosting allocation to $1/monthly rental.', NULL);
