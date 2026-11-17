/*
# Reference fleet: company robots shown as examples, not rentable in catalog

1. Purpose
- The 7 company-owned demo robots (owner_id IS NULL: HydroScrub Wash Pro 9,
  SkyGlide Window Elite X7, AuroraHome Butler H1, CuisineCraft Chef C2,
  GlassGlide Window Pro S2, PerimeterEdge Detail S5, PolishBot Finish 2000)
  should no longer appear in the Robotic Catalog or be bookable.
- They remain in the database and on the home page as REFERENCE EXAMPLES,
  showing owners and users what the platform expects from a rentable listing.
- Owner-submitted listings keep flowing through the normal publish/approve
  pipeline and remain fully bookable in the catalog. Nothing is deleted.

2. Modified Tables
- `robots`: new column `reference_only` (boolean, NOT NULL, default false).
  Set to TRUE for all current company rows (owner_id IS NULL). Rows owned by
  robot owners are untouched and stay false, so all existing owner listings
  behave exactly as before.

3. Modified Functions
- `bookable_robots(p_city_id)`: now returns ONLY published owner listings
  (reference_only = false) matching the customer's city. Company reference
  robots no longer appear in any catalog.
- NEW `reference_fleet_robots()`: read-only listing of published reference
  robots for the home page showcase. SECURITY INVOKER, so robots RLS still
  applies (these rows are already publicly readable via the existing
  "Catalog robots are publicly readable" SELECT policy).
- `create_booking_guarded(...)`: same booking logic as before, plus a new
  guard that rejects bookings against reference_only robots ("This robot is
  a reference example and not available for rent"), so the guard holds even
  if someone reaches a reference robot by direct request.

4. Security
- No RLS changes: the existing robots SELECT policy already covers reference
  rows (listing_status = 'published'), and writes are unchanged.
- `reference_fleet_robots()` is not SECURITY DEFINER; EXECUTE revoked from
  PUBLIC and granted to anon + authenticated for the signed-out/signed-in
  home page.

5. Important Notes
- Idempotent: safe to re-run. No data is deleted; no columns are dropped.
- Owner features (listing creation, editing, photo management, dashboard,
  admin review) are unaffected.
*/

-- 1. Flag column + backfill for current company rows
ALTER TABLE robots ADD COLUMN IF NOT EXISTS reference_only boolean NOT NULL DEFAULT false;

UPDATE robots SET reference_only = true WHERE owner_id IS NULL AND reference_only = false;

-- 2. Catalog returns only real owner listings in the customer's city
CREATE OR REPLACE FUNCTION public.bookable_robots(p_city_id text)
RETURNS TABLE(id uuid, name text, slug text, category text, tagline text,
description text, image_url text, monthly_rate numeric,
daily_rate numeric, weekly_rate numeric, rating numeric,
reviews_count integer, location text, specs jsonb, features jsonb,
status text, owner_id uuid, listing_city_id text,
pickup_zip text, condition text, accessories jsonb,
pickup_instructions text, return_instructions text,
blackout_dates jsonb, delivery_available boolean, delivery_fee numeric,
equipment_category text, listing_status text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT r.id, r.name, r.slug, r.category, r.tagline,
r.description, r.image_url, r.monthly_rate,
r.daily_rate, r.weekly_rate, r.rating,
r.reviews_count, r.location, r.specs, r.features,
r.status,
r.owner_id, r.city_id,
r.pickup_zip, r.condition, r.accessories,
r.pickup_instructions, r.return_instructions,
r.blackout_dates, r.delivery_available, r.delivery_fee,
r.equipment_category, r.listing_status
FROM robots r
WHERE r.listing_status = 'published'
AND r.reference_only = false
AND r.city_id = p_city_id
ORDER BY r.monthly_rate DESC;
$function$;

-- 3. Read-only reference fleet for the home page showcase
CREATE OR REPLACE FUNCTION public.reference_fleet_robots()
RETURNS TABLE(id uuid, name text, slug text, category text, tagline text,
description text, image_url text, monthly_rate numeric,
daily_rate numeric, weekly_rate numeric, rating numeric,
reviews_count integer, location text, specs jsonb, features jsonb,
status text, owner_id uuid, listing_city_id text,
pickup_zip text, condition text, accessories jsonb,
pickup_instructions text, return_instructions text,
blackout_dates jsonb, delivery_available boolean, delivery_fee numeric,
equipment_category text, listing_status text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT r.id, r.name, r.slug, r.category, r.tagline,
r.description, r.image_url, r.monthly_rate,
r.daily_rate, r.weekly_rate, r.rating,
r.reviews_count, r.location, r.specs, r.features,
r.status,
r.owner_id, r.city_id,
r.pickup_zip, r.condition, r.accessories,
r.pickup_instructions, r.return_instructions,
r.blackout_dates, r.delivery_available, r.delivery_fee,
r.equipment_category, r.listing_status
FROM robots r
WHERE r.reference_only = true
AND r.listing_status = 'published'
ORDER BY r.monthly_rate DESC;
$function$;

REVOKE EXECUTE ON FUNCTION public.reference_fleet_robots() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reference_fleet_robots() TO anon, authenticated;

-- 4. Bookings: refuse reference robots even when addressed directly
CREATE OR REPLACE FUNCTION public.create_booking_guarded(p_robot_id uuid, p_start date, p_months integer, p_renter_name text, p_renter_email text, p_renter_phone text, p_usage_type text, p_city_id text, p_notes text, p_damage_protection boolean, p_delivery boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_uid uuid := auth.uid();
v_robot robots%ROWTYPE;
v_end date;
v_booking_id uuid;
v_subtotal numeric;
v_tax numeric;
v_protection numeric;
v_delivery_fee numeric;
v_total numeric;
v_commission numeric;
v_payout numeric;
v_overlap integer;
v_blackout boolean;
BEGIN
IF v_uid IS NULL THEN
RAISE EXCEPTION 'Sign in to book';
END IF;

SELECT * INTO v_robot FROM robots WHERE id = p_robot_id;
IF NOT FOUND THEN
RAISE EXCEPTION 'Robot not found';
END IF;
IF v_robot.reference_only THEN
RAISE EXCEPTION 'This robot is a reference example and not available for rent';
END IF;
IF v_robot.listing_status <> 'published' THEN
RAISE EXCEPTION 'This robot is not currently accepting reservations';
END IF;

IF v_robot.owner_id IS NOT NULL AND v_robot.city_id IS DISTINCT FROM p_city_id THEN
RAISE EXCEPTION 'This robot is not available in your city';
END IF;

IF COALESCE(p_months, 0) < 1 OR p_months > 24 THEN
RAISE EXCEPTION 'Lease length must be between 1 and 24 months';
END IF;

v_end := (p_start + make_interval(months => p_months))::date - 1;

SELECT count(*) INTO v_overlap
FROM bookings b
WHERE b.robot_id = p_robot_id
AND b.status IN ('pending','confirmed')
AND b.start_date <= v_end
AND b.end_date >= p_start;
IF v_overlap > 0 THEN
RAISE EXCEPTION 'Those dates are already reserved';
END IF;

SELECT EXISTS (
SELECT 1
FROM jsonb_array_elements(v_robot.blackout_dates) bd
WHERE (bd->>'start')::date <= v_end
AND (bd->>'end')::date >= p_start
) INTO v_blackout;
IF v_blackout THEN
RAISE EXCEPTION 'The owner has blocked those dates';
END IF;

v_subtotal := round(v_robot.monthly_rate * p_months, 2);
v_tax := 0;
v_protection := CASE WHEN p_damage_protection THEN round(v_subtotal * 0.09, 2) ELSE 0 END;
v_delivery_fee := CASE WHEN p_delivery AND v_robot.delivery_available THEN round(v_robot.delivery_fee, 2) ELSE 0 END;
v_total := v_subtotal + v_tax + v_protection + v_delivery_fee;
v_commission := round(v_total * 0.20, 2);
v_payout := GREATEST(round(v_total - v_commission - round(v_total * 0.029 + 0.30, 2), 2), 0);

INSERT INTO bookings (
robot_id, user_id, renter_name, renter_email, renter_phone,
usage_type, plan_type, start_date, end_date, days, total_price,
notes, status, duration_type, minimum_term_months,
deposit_amount, delivery_fee, damage_protection_fee, tax_amount,
pricing_snapshot, owner_id, owner_payout, platform_commission,
refund_status
) VALUES (
p_robot_id, v_uid, left(p_renter_name, 100), lower(left(p_renter_email, 200)), left(p_renter_phone, 40),
COALESCE(p_usage_type, v_robot.category), 'lease', p_start, v_end,
(v_end - p_start + 1), v_total,
left(p_notes, 1000), 'pending', 'monthly', p_months,
0, v_delivery_fee, v_protection, v_tax,
jsonb_build_object(
'duration_type', 'monthly', 'unit_price', v_robot.monthly_rate,
'units', p_months, 'base_price', v_subtotal,
'tax_amount', v_tax, 'deposit_amount', 0,
'delivery_fee', v_delivery_fee,
'damage_protection_fee', v_protection,
'total_price', v_total, 'service_fee', 0,
'minimum_term_months', p_months,
'pricing_version', '2026-11-marketplace-20pct-v4',
'recorded_at', now()
),
v_robot.owner_id, v_payout, v_commission,
'none'
)
RETURNING id INTO v_booking_id;

RETURN jsonb_build_object('status', 'ok', 'booking_id', v_booking_id,
'total', v_total, 'owner_payout', v_payout, 'platform_commission', v_commission);
END;
$function$;
