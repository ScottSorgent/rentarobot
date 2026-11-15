/*
# Restrict Pricing Management to designated administrators

1. Summary
- Pricing/cost configuration was writable by every signed-in account. This
  migration moves all pricing writes behind a server-checked administrator
  list so only designated admins can change costs, platform defaults, or
  catalog rates. Every provider keeps normal catalog read access.

2. New Tables
- `app_admins`: designation list of administrator user ids.
  - `user_id` (uuid, primary key, references auth.users) — the admin account.
  - `added_by` (uuid, nullable) — who designated this admin.
  - `created_at` — when the designation was made.
  Seeded with the project owner's account by email; safe to re-run (inserts
  only when that email exists and is not yet present).

3. New Functions (SECURITY DEFINER)
- `is_app_admin()` — returns whether the caller (auth.uid()) is designated
  in app_admins. Used by policies, functions, and the UI.
- `admin_update_robot_pricing(p_robot_id, p_patch jsonb, p_summary text)` —
  admin-only update of a robot's cost configuration. The caller is checked
  inside the function (never trust client claims). Accepts only known
  numeric/text/boolean pricing fields, rejects unknown keys, and validates
  that numeric values are finite and non-negative before writing. Writes a
  pricing_audit row.
- `admin_save_pricing_settings(p_settings jsonb, p_summary text)` —
  admin-only update of platform pricing defaults, same validation approach,
  plus an audit row.
- `admin_apply_catalog_rates(p_robot_id, p_daily, p_weekly, p_monthly, p_summary)`
  — admin-only update of the public catalog rates, rejecting negative or
  non-finite prices, plus an audit row.
- `admin_add_admin(p_user_id uuid)` and `admin_remove_admin(p_user_id uuid)`
  — admin-only designation management so the admin list can be maintained
  from the dashboard.

4. Security changes
- robot_pricing: UPDATE/INSERT policy is now admin-only
  (USING/WITH CHECK is_app_admin()). SELECT stays open to authenticated so
  the booking flow can read costs without exposing them to customers.
- pricing_settings: UPDATE policy admin-only; SELECT stays open to
  authenticated.
- robots: the previous blanket "Operators update catalog rates" policy is
  REPLACED by an admin-only policy; the column grant (daily/weekly/monthly
  rates) is unchanged, so non-admins can no longer write catalog rates.
- pricing_audit: INSERT policy is replaced by admin-only; inserts now happen
  through the admin functions, not directly from the client.
- All five admin functions: EXECUTE revoked from PUBLIC and anon, granted to
  authenticated. Each verifies is_app_admin() internally, so even a granted
  caller cannot act unless designated.
- No policy changes for bookings, provider_profiles, or hubs.

5. Notes
- If the owner's account does not exist yet at migration time, re-run the
  seed statement (idempotent) after creating the account, or designate
  admins from the dashboard once signed in as an existing admin.
*/

CREATE TABLE IF NOT EXISTS app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read admin list" ON app_admins;
CREATE POLICY "Admins read admin list" ON app_admins FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM app_admins a WHERE a.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_app_admin() TO authenticated;

DROP POLICY IF EXISTS "Operators update pricing" ON robot_pricing;
CREATE POLICY "Admins update pricing" ON robot_pricing FOR UPDATE TO authenticated
USING (is_app_admin()) WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "Operators insert pricing" ON robot_pricing;
CREATE POLICY "Admins insert pricing" ON robot_pricing FOR INSERT TO authenticated
WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "Operators update settings" ON pricing_settings;
CREATE POLICY "Admins update settings" ON pricing_settings FOR UPDATE TO authenticated
USING (is_app_admin()) WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "Operators update catalog rates" ON robots;
CREATE POLICY "Admins update catalog rates" ON robots FOR UPDATE TO authenticated
USING (is_app_admin()) WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "Operators insert audit" ON pricing_audit;
CREATE POLICY "Admins insert audit" ON pricing_audit FOR INSERT TO authenticated
WITH CHECK (is_app_admin());

CREATE OR REPLACE FUNCTION admin_update_robot_pricing(p_robot_id uuid, p_patch jsonb, p_summary text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'manufacturer','model_name','cost_category','retail_price','wholesale_cost',
    'wholesale_source','wholesale_verified','financing_method','monthly_payment',
    'term_months','rate_pct','payment_verified','useful_life_months','residual_value',
    'monthly_storage','monthly_insurance','monthly_maintenance','monthly_software',
    'monthly_hosting','checkout_handling','return_handling','processing_pct',
    'processing_fixed','expected_utilization','expected_monthly_bookings',
    'marketing_rate','target_margin','tax_rate','deposit_amount',
    'daily_override','weekly_override','monthly_override','hub_id'
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
    IF v_key IN ('cost_category') AND jsonb_typeof(v_value) = 'string'
       AND v_value #>> '{}' NOT IN ('residential','prosumer','commercial') THEN
      RAISE EXCEPTION 'Invalid category';
    END IF;
    IF v_key = 'financing_method' AND jsonb_typeof(v_value) = 'string'
       AND v_value #>> '{}' NOT IN ('owned','financed','supplier_leased') THEN
      RAISE EXCEPTION 'Invalid financing method';
    END IF;
  END LOOP;

  UPDATE robot_pricing
  SET updated_at = now(),
      manufacturer = COALESCE(p_patch->>'manufacturer', manufacturer),
      model_name = COALESCE(p_patch->>'model_name', model_name),
      cost_category = COALESCE(p_patch->>'cost_category', cost_category),
      retail_price = COALESCE((p_patch->>'retail_price')::numeric, retail_price),
      wholesale_cost = COALESCE((p_patch->>'wholesale_cost')::numeric, wholesale_cost),
      wholesale_source = COALESCE(p_patch->>'wholesale_source', wholesale_source),
      wholesale_verified = COALESCE((p_patch->>'wholesale_verified')::boolean, wholesale_verified),
      financing_method = COALESCE(p_patch->>'financing_method', financing_method),
      monthly_payment = COALESCE((p_patch->>'monthly_payment')::numeric, monthly_payment),
      term_months = COALESCE((p_patch->>'term_months')::int, term_months),
      rate_pct = COALESCE((p_patch->>'rate_pct')::numeric, rate_pct),
      payment_verified = COALESCE((p_patch->>'payment_verified')::boolean, payment_verified),
      useful_life_months = COALESCE((p_patch->>'useful_life_months')::int, useful_life_months),
      residual_value = COALESCE((p_patch->>'residual_value')::numeric, residual_value),
      monthly_storage = COALESCE((p_patch->>'monthly_storage')::numeric, monthly_storage),
      monthly_insurance = COALESCE((p_patch->>'monthly_insurance')::numeric, monthly_insurance),
      monthly_maintenance = COALESCE((p_patch->>'monthly_maintenance')::numeric, monthly_maintenance),
      monthly_software = COALESCE((p_patch->>'monthly_software')::numeric, monthly_software),
      monthly_hosting = COALESCE((p_patch->>'monthly_hosting')::numeric, monthly_hosting),
      checkout_handling = COALESCE((p_patch->>'checkout_handling')::numeric, checkout_handling),
      return_handling = COALESCE((p_patch->>'return_handling')::numeric, return_handling),
      processing_pct = COALESCE((p_patch->>'processing_pct')::numeric, processing_pct),
      processing_fixed = COALESCE((p_patch->>'processing_fixed')::numeric, processing_fixed),
      expected_utilization = COALESCE((p_patch->>'expected_utilization')::numeric, expected_utilization),
      expected_monthly_bookings = COALESCE((p_patch->>'expected_monthly_bookings')::numeric, expected_monthly_bookings),
      marketing_rate = COALESCE((p_patch->>'marketing_rate')::numeric, marketing_rate),
      target_margin = COALESCE((p_patch->>'target_margin')::numeric, target_margin),
      tax_rate = COALESCE((p_patch->>'tax_rate')::numeric, tax_rate),
      deposit_amount = COALESCE((p_patch->>'deposit_amount')::numeric, deposit_amount),
      daily_override = COALESCE((p_patch->>'daily_override')::numeric, daily_override),
      weekly_override = COALESCE((p_patch->>'weekly_override')::numeric, weekly_override),
      monthly_override = COALESCE((p_patch->>'monthly_override')::numeric, monthly_override),
      hub_id = COALESCE((p_patch->>'hub_id')::uuid, hub_id)
  WHERE robot_id = p_robot_id;

  INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
  VALUES (p_robot_id, 'robot', p_summary, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION admin_save_pricing_settings(p_settings jsonb, p_summary text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_value jsonb;
  v_json text;
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_settings)
  LOOP
    IF v_key NOT IN (
      'marketing_rate','target_margin','processing_pct','processing_fixed',
      'storage_monthly','insurance_monthly','maintenance_monthly','software_monthly',
      'hosting_monthly','checkout_handling','return_handling','utilization_base',
      'robots_per_hub','weekly_discount','monthly_discount','tax_rate',
      'avg_booking_days','verified'
    ) THEN
      RAISE EXCEPTION 'Field not editable: %', v_key;
    END IF;
    v_value := p_settings -> v_key;
    IF jsonb_typeof(v_value) = 'number' THEN
      v_json := v_value::text;
      IF v_json ~ '[eE]' OR v_json ~ '[^0-9.\-]' OR v_value::numeric < 0 OR v_value::numeric > 100000000 THEN
        RAISE EXCEPTION 'Invalid value for %', v_key;
      END IF;
    END IF;
  END LOOP;

  UPDATE pricing_settings
  SET updated_at = now(),
      marketing_rate = COALESCE((p_settings->>'marketing_rate')::numeric, marketing_rate),
      target_margin = COALESCE((p_settings->>'target_margin')::numeric, target_margin),
      processing_pct = COALESCE((p_settings->>'processing_pct')::numeric, processing_pct),
      processing_fixed = COALESCE((p_settings->>'processing_fixed')::numeric, processing_fixed),
      storage_monthly = COALESCE((p_settings->>'storage_monthly')::numeric, storage_monthly),
      insurance_monthly = COALESCE((p_settings->>'insurance_monthly')::numeric, insurance_monthly),
      maintenance_monthly = COALESCE((p_settings->>'maintenance_monthly')::numeric, maintenance_monthly),
      software_monthly = COALESCE((p_settings->>'software_monthly')::numeric, software_monthly),
      hosting_monthly = COALESCE((p_settings->>'hosting_monthly')::numeric, hosting_monthly),
      checkout_handling = COALESCE((p_settings->>'checkout_handling')::numeric, checkout_handling),
      return_handling = COALESCE((p_settings->>'return_handling')::numeric, return_handling),
      utilization_base = COALESCE((p_settings->>'utilization_base')::numeric, utilization_base),
      robots_per_hub = COALESCE((p_settings->>'robots_per_hub')::int, robots_per_hub),
      weekly_discount = COALESCE((p_settings->>'weekly_discount')::numeric, weekly_discount),
      monthly_discount = COALESCE((p_settings->>'monthly_discount')::numeric, monthly_discount),
      tax_rate = COALESCE((p_settings->>'tax_rate')::numeric, tax_rate),
      avg_booking_days = COALESCE((p_settings->>'avg_booking_days')::int, avg_booking_days),
      verified = COALESCE((p_settings->>'verified')::boolean, verified)
  WHERE id = 1;

  INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
  VALUES (NULL, 'settings', p_summary, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION admin_apply_catalog_rates(
  p_robot_id uuid, p_daily numeric, p_weekly numeric, p_monthly numeric, p_summary text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_daily IS NULL OR p_weekly IS NULL OR p_monthly IS NULL
     OR p_daily < 0 OR p_weekly < 0 OR p_monthly < 0
     OR p_daily > 1000000 OR p_weekly > 1000000 OR p_monthly > 1000000 THEN
    RAISE EXCEPTION 'Invalid catalog prices';
  END IF;

  UPDATE robots
  SET daily_rate = p_daily, weekly_rate = p_weekly, monthly_rate = p_monthly
  WHERE id = p_robot_id;

  INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
  VALUES (p_robot_id, 'catalog', p_summary, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION admin_add_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO app_admins (user_id, added_by) VALUES (p_user_id, auth.uid())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION admin_remove_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM app_admins WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_robot_pricing(uuid, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_save_pricing_settings(jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_apply_catalog_rates(uuid, numeric, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_add_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_remove_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_update_robot_pricing(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_save_pricing_settings(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_apply_catalog_rates(uuid, numeric, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_add_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_remove_admin(uuid) TO authenticated;

INSERT INTO app_admins (user_id)
SELECT id FROM auth.users WHERE email = 'scott@rentarobot.com'
ON CONFLICT (user_id) DO NOTHING;
