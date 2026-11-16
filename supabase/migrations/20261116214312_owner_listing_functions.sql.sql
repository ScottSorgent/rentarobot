/*
# Owner listing lifecycle, city lookup, and guarded booking functions

1. Plain-English summary
   These SECURITY DEFINER functions are the only way the browser can create
   or change owner listings and bookings. Every one of them verifies the
   caller's identity server-side, so hiding listings in the interface is
   never the only protection:
   - `lookup_zip` — public lookup turning a ZIP code into the standardized
     city or cities it belongs to (supports ZIPs shared by two cities).
   - `owner_create_listing` — owner submits a complete listing; validates the
     ZIP against the reference data, derives the standardized city, and
     stores the robot as pending administrator review.
   - `owner_update_listing` — owner edits their own listing; edits put a
     rejected or changes-requested listing back into review.
   - `owner_set_listing_status` — pause/resume/submit for review.
   - `admin_review_listing` — administrator approves, rejects, suspends, or
     requests changes; records the decision in the review trail.
   - `bookable_robots` — the city-filtered catalog query: published listings
     in the caller's city (all ZIP codes of that city) plus the curated
     platform fleet.
   - `create_booking_guarded` — the only booking write path: re-checks the
     robot is published, in the customer's city (or curated), not blacked
     out, and has no overlapping pending/confirmed reservation; computes the
     20/80 split server-side and records the owner payout.
   - `cancel_booking_guarded` — cancellation by the booking's owner with
     refund state.

2. Security
   - All functions SET search_path = public.
   - EXECUTE revoked from PUBLIC/anon, granted to authenticated, except
     `lookup_zip` and `bookable_robots` (public catalog browsing), which stay
     granted to anon + authenticated.
   - Owner functions verify robot ownership via owner_id = auth.uid().
   - Admin function verifies via is_app_admin().
   - Booking validation never trusts client prices: the monthly rate is read
     from the robots table inside the function.
*/

-- ---------- Public ZIP lookup for visitors and the listing wizard ----------

CREATE OR REPLACE FUNCTION lookup_zip(p_zip text)
RETURNS TABLE (city_id text, city_name text, state text, state_code text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.name, c.state, c.state_code
  FROM zip_cities z JOIN cities c ON c.id = z.city_id
  WHERE z.zip = left(regexp_replace(p_zip, '\D', '', 'g'), 5);
$$;

REVOKE EXECUTE ON FUNCTION lookup_zip(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_zip(text) TO anon, authenticated;

-- ---------- Owner listing lifecycle ----------

CREATE OR REPLACE FUNCTION owner_create_listing(
  p_listing jsonb,
  p_photo_urls text[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_uid uuid := auth.uid();
v_city text;
v_robot_id uuid;
v_monthly numeric;
v_daily numeric;
v_weekly numeric;
BEGIN
IF v_uid IS NULL THEN
RAISE EXCEPTION 'Sign in to list a robot';
END IF;

SELECT city_id INTO v_city FROM lookup_zip(COALESCE(p_listing->>'pickup_zip', ''));
IF v_city IS NULL THEN
RAISE EXCEPTION 'ZIP code not recognized. Enter a valid ZIP in a supported city.';
END IF;

v_monthly := COALESCE((p_listing->>'monthly_rate')::numeric, 0);
v_daily := (p_listing->>'daily_rate')::numeric;
v_weekly := (p_listing->>'weekly_rate')::numeric;
IF v_monthly <= 0 AND COALESCE(v_daily, 0) <= 0 THEN
RAISE EXCEPTION 'Enter a monthly rental price (or a daily price for humanoid robots)';
END IF;
IF v_monthly > 0 AND (v_monthly < 5 OR v_monthly > 100000) THEN
RAISE EXCEPTION 'Monthly price must be between $5 and $100,000';
END IF;

IF COALESCE(array_length(p_photo_urls, 1), 0) < 1 THEN
RAISE EXCEPTION 'Add at least one photo of your robot';
END IF;

IF COALESCE(p_listing->>'condition', '') NOT IN ('new','refurbished','used') THEN
RAISE EXCEPTION 'Indicate whether the robot is new, refurbished, or used';
END IF;

INSERT INTO robots (
  name, slug, category, tagline, description, image_url,
  monthly_rate, daily_rate, weekly_rate, specs, features,
  status, rating, reviews_count, location,
  owner_id, city_id, pickup_zip, condition, accessories,
  pickup_instructions, return_instructions, blackout_dates,
  delivery_available, delivery_fee, equipment_category,
  listing_status, submitted_at
) VALUES (
  left(COALESCE(p_listing->>'name', ''), 80),
  left(lower(regexp_replace(COALESCE(p_listing->>'name',''), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6), 100),
  COALESCE(p_listing->>'category', 'residential'),
  left(COALESCE(p_listing->>'tagline', ''), 140),
  left(COALESCE(p_listing->>'description', ''), 4000),
  p_photo_urls[1],
  v_monthly, v_daily, v_weekly,
  COALESCE(p_listing->'specs', '{}'::jsonb),
  COALESCE(p_listing->'features', '[]'::jsonb),
  'available',
  0, 0,
  left(COALESCE(p_listing->>'location_label', ''), 80),
  v_uid, v_city,
  left(regexp_replace(COALESCE(p_listing->>'pickup_zip',''), '\D', '', 'g'), 5),
  p_listing->>'condition',
  COALESCE(p_listing->'accessories', '[]'::jsonb),
  left(COALESCE(p_listing->>'pickup_instructions',''), 1000),
  left(COALESCE(p_listing->>'return_instructions',''), 1000),
  COALESCE(p_listing->'blackout_dates', '[]'::jsonb),
  COALESCE((p_listing->>'delivery_available')::boolean, false),
  COALESCE((p_listing->>'delivery_fee')::numeric, 0),
  COALESCE(p_listing->>'equipment_category', 'vacuum_mop'),
  'pending_review',
  now()
)
RETURNING id INTO v_robot_id;

INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
VALUES (v_robot_id, 'listing', 'Owner submitted listing for review.', v_uid);

RETURN v_robot_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION owner_create_listing(jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owner_create_listing(jsonb, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION owner_update_listing(
  p_robot_id uuid,
  p_patch jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_allowed text[] := ARRAY[
  'name','tagline','description','monthly_rate','daily_rate','weekly_rate',
  'condition','accessories','pickup_instructions','return_instructions',
  'blackout_dates','delivery_available','delivery_fee','equipment_category',
  'specs','features','pickup_zip'
];
v_key text;
v_new_zip text;
v_new_city text;
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM robots WHERE id = p_robot_id AND owner_id = auth.uid()
) THEN
RAISE EXCEPTION 'You can only edit your own listings';
END IF;

FOR v_key IN SELECT jsonb_object_keys(p_patch)
LOOP
IF NOT (v_key = ANY (v_allowed)) THEN
RAISE EXCEPTION 'Field not editable: %', v_key;
END IF;
END LOOP;

v_new_zip := p_patch->>'pickup_zip';
IF v_new_zip IS NOT NULL THEN
SELECT city_id INTO v_new_city FROM lookup_zip(v_new_zip);
IF v_new_city IS NULL THEN
RAISE EXCEPTION 'ZIP code not recognized';
END IF;
END IF;

UPDATE robots SET
  name = COALESCE(left(p_patch->>'name', 80), name),
  tagline = COALESCE(left(p_patch->>'tagline', 140), tagline),
  description = COALESCE(left(p_patch->>'description', 4000), description),
  monthly_rate = COALESCE((p_patch->>'monthly_rate')::numeric, monthly_rate),
  daily_rate = COALESCE((p_patch->>'daily_rate')::numeric, daily_rate),
  weekly_rate = COALESCE((p_patch->>'weekly_rate')::numeric, weekly_rate),
  condition = COALESCE(p_patch->>'condition', condition),
  accessories = COALESCE(p_patch->'accessories', accessories),
  pickup_instructions = COALESCE(left(p_patch->>'pickup_instructions', 1000), pickup_instructions),
  return_instructions = COALESCE(left(p_patch->>'return_instructions', 1000), return_instructions),
  blackout_dates = COALESCE(p_patch->'blackout_dates', blackout_dates),
  delivery_available = COALESCE((p_patch->>'delivery_available')::boolean, delivery_available),
  delivery_fee = COALESCE((p_patch->>'delivery_fee')::numeric, delivery_fee),
  equipment_category = COALESCE(p_patch->>'equipment_category', equipment_category),
  specs = COALESCE(p_patch->'specs', specs),
  features = COALESCE(p_patch->'features', features),
  pickup_zip = COALESCE(left(regexp_replace(v_new_zip, '\D', '', 'g'), 5), pickup_zip),
  city_id = COALESCE(v_new_city, city_id),
  listing_status = CASE
    WHEN listing_status IN ('rejected','changes_requested') THEN 'pending_review'
    ELSE listing_status
  END,
  submitted_at = CASE
    WHEN listing_status IN ('rejected','changes_requested') THEN now()
    ELSE submitted_at
  END
WHERE id = p_robot_id AND owner_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION owner_update_listing(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owner_update_listing(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION owner_set_listing_status(
  p_robot_id uuid,
  p_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM robots WHERE id = p_robot_id AND owner_id = auth.uid()
) THEN
RAISE EXCEPTION 'You can only manage your own listings';
END IF;

IF p_status NOT IN ('draft','pending_review','paused','published') THEN
RAISE EXCEPTION 'Unsupported status change';
END IF;

IF p_status = 'published' THEN
IF NOT EXISTS (
  SELECT 1 FROM robots
  WHERE id = p_robot_id AND owner_id = auth.uid() AND approved_at IS NOT NULL
) THEN
RAISE EXCEPTION 'Listing must be approved before publishing';
END IF;
END IF;

UPDATE robots
SET listing_status = p_status,
    submitted_at = CASE WHEN p_status = 'pending_review' THEN now() ELSE submitted_at END
WHERE id = p_robot_id AND owner_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION owner_set_listing_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owner_set_listing_status(uuid, text) TO authenticated;

-- ---------- Administrator listing review ----------

CREATE OR REPLACE FUNCTION admin_review_listing(
  p_robot_id uuid,
  p_action text,
  p_note text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
IF NOT is_app_admin() THEN
RAISE EXCEPTION 'Not authorized';
END IF;

IF p_action NOT IN ('approved','rejected','suspended','changes_requested') THEN
RAISE EXCEPTION 'Unsupported review action';
END IF;

UPDATE robots SET
  listing_status = CASE p_action
    WHEN 'approved' THEN 'published'
    WHEN 'rejected' THEN 'rejected'
    WHEN 'suspended' THEN 'suspended'
    WHEN 'changes_requested' THEN 'changes_requested'
  END,
  review_note = p_note,
  reviewed_at = now(),
  approved_at = CASE WHEN p_action = 'approved' THEN now() ELSE approved_at END
WHERE id = p_robot_id;

INSERT INTO listing_reviews (robot_id, reviewer_id, action, note)
VALUES (p_robot_id, auth.uid(), p_action, p_note);
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_review_listing(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_review_listing(uuid, text, text) TO authenticated;

-- ---------- City-filtered catalog ----------

CREATE OR REPLACE FUNCTION bookable_robots(p_city_id text)
RETURNS TABLE (
  id uuid, name text, slug text, category text, tagline text,
  description text, image_url text, monthly_rate numeric,
  daily_rate numeric, weekly_rate numeric, rating numeric,
  reviews_count integer, location text, specs jsonb, features jsonb,
  status text,
  owner_id uuid, listing_city_id text,
  pickup_zip text, condition text, accessories jsonb,
  pickup_instructions text, return_instructions text,
  blackout_dates jsonb, delivery_available boolean, delivery_fee numeric,
  equipment_category text, listing_status text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
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
    AND (
      r.owner_id IS NULL
      OR r.city_id = p_city_id
    )
  ORDER BY r.owner_id NULLS FIRST, r.monthly_rate DESC;
$$;

REVOKE EXECUTE ON FUNCTION bookable_robots(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bookable_robots(text) TO anon, authenticated;

-- ---------- Guarded booking creation ----------

CREATE OR REPLACE FUNCTION create_booking_guarded(
  p_robot_id uuid,
  p_start date,
  p_months integer,
  p_renter_name text,
  p_renter_email text,
  p_renter_phone text,
  p_usage_type text,
  p_city_id text,
  p_notes text,
  p_damage_protection boolean,
  p_delivery boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION create_booking_guarded(uuid, date, integer, text, text, text, text, text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_booking_guarded(uuid, date, integer, text, text, text, text, text, text, boolean, boolean) TO authenticated;

-- ---------- Guarded cancellation ----------

CREATE OR REPLACE FUNCTION cancel_booking_guarded(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM bookings
  WHERE id = p_booking_id AND user_id = auth.uid()
) THEN
RAISE EXCEPTION 'You can only cancel your own bookings';
END IF;

UPDATE bookings
SET status = 'cancelled',
    cancelled_at = now(),
    refund_status = CASE
      WHEN start_date > current_date + 2 THEN 'refunded'
      ELSE 'requested'
    END
WHERE id = p_booking_id AND user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION cancel_booking_guarded(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_booking_guarded(uuid) TO authenticated;
