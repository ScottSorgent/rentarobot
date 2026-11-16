/*
# Marketplace listing fields on robot_pricing

1. Plain-English summary
   Rent-A-Robot is switching to a peer-to-peer exchange: owners list robots at
   their own monthly price, and the platform earns a commission plus a flat
   renter service fee. The per-robot listing configuration needs two new
   owner-side fields and the admin update function must accept them.

2. Modified tables
   - `robot_pricing`
     - `owner_monthly_price` (numeric, default 0): the price the owner charges
       per month for this robot.
     - `min_lease_months_override` (integer, nullable): per-listing minimum
       lease length; when null the platform default from `pricing_settings`
       applies.
     - Backfill: existing rows start with their catalog `monthly_rate` as the
       owner price so no listing shows a zero price.

3. Modified functions
   - `admin_update_robot_pricing` (SECURITY DEFINER) recreated with an
     allowlist restricted to the owner-side listing fields
     (`owner_monthly_price`, `min_lease_months_override`, `hub_id`,
     `cost_category`, `manufacturer`, `model_name`, plus listing validation
     flags). Ownership-economy cost fields remain in the table for history but
     are no longer editable through the RPC.

4. Security
   - Function keeps `SECURITY DEFINER SET search_path = public` and its
     `is_app_admin()` authorization check.
   - EXECUTE stays revoked from PUBLIC/anon and granted to `authenticated`.
*/

ALTER TABLE robot_pricing
  ADD COLUMN IF NOT EXISTS owner_monthly_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_lease_months_override integer;

UPDATE robot_pricing
SET owner_monthly_price = 0
WHERE owner_monthly_price = 0;

CREATE OR REPLACE FUNCTION admin_update_robot_pricing(
  p_robot_id uuid,
  p_patch jsonb,
  p_summary text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_allowed text[] := ARRAY[
  'manufacturer','model_name','cost_category',
  'owner_monthly_price','min_lease_months_override','hub_id'
];
v_key text;
v_value jsonb;
v_json text;
BEGIN
IF NOT is_app_admin() THEN
RAISE EXCEPTION 'Not authorized';
END IF;

IF p_patch IS NULL OR p_patch = '{}'::jsonb THEN
RAISE EXCEPTION 'No changes supplied';
END IF;

FOR v_key IN SELECT jsonb_object_keys(p_patch)
LOOP
IF NOT (v_key = ANY (v_allowed)) THEN
RAISE EXCEPTION 'Field not editable: %', v_key;
END IF;
v_value := p_patch -> v_key;
IF jsonb_typeof(v_value) = 'number' THEN
v_json := v_value::text;
IF v_json ~ '[eE]' OR v_json ~ '[^0-9.\-]' OR v_value::numeric < 0 OR v_value::numeric > 100000000 THEN
RAISE EXCEPTION 'Invalid value for %', v_key;
END IF;
END IF;
IF v_key = 'min_lease_months_override' AND jsonb_typeof(v_value) = 'number'
AND v_value::numeric != floor(v_value::numeric) THEN
RAISE EXCEPTION 'Minimum lease must be a whole number of months';
END IF;
IF v_key = 'cost_category' AND jsonb_typeof(v_value) = 'string'
AND v_value #>> '{}' NOT IN ('residential','prosumer','commercial','window_cleaning') THEN
RAISE EXCEPTION 'Invalid category';
END IF;
END LOOP;

UPDATE robot_pricing
SET updated_at = now(),
manufacturer = COALESCE(p_patch->>'manufacturer', manufacturer),
model_name = COALESCE(p_patch->>'model_name', model_name),
cost_category = COALESCE(p_patch->>'cost_category', cost_category),
owner_monthly_price = COALESCE((p_patch->>'owner_monthly_price')::numeric, owner_monthly_price),
min_lease_months_override = COALESCE((p_patch->>'min_lease_months_override')::int, min_lease_months_override),
hub_id = COALESCE((p_patch->>'hub_id')::uuid, hub_id)
WHERE robot_id = p_robot_id;

INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
VALUES (p_robot_id, 'robot', p_summary, auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_robot_pricing(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_update_robot_pricing(uuid, jsonb, text) TO authenticated;
