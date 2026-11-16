/*
# Switch to peer-to-peer monthly marketplace pricing

1. What changed (plain English)
   Rent-A-Robot no longer owns robots or sets retail prices. Owners list their
   robots at a monthly rate; the platform earns a commission (a percent of the
   owner's monthly price) plus a small flat service fee paid by the renter.
   Rental prices are MONTHLY ONLY — daily and weekly pricing is retired.

2. Table changes
   - `pricing_settings`: new columns
     - `commission_pct` (default 0.15) — platform share of each monthly price
     - `service_fee_flat` (default 25.00) — flat fee added to the renter's total
     - `min_lease_months` (default 1) — minimum booking length in months
   - `robots`: `monthly_rate` is THE list price. `daily_rate` and
     `weekly_rate` remain only as legacy columns for old bookings.

3. Function changes
   - `admin_apply_catalog_rates(p_robot_id, p_monthly, p_summary)`: new
     monthly-only version (RETURNS void) replaces the daily/weekly/monthly
     variant.
   - `admin_save_pricing_settings`: allowlist extended with the three new
     fields so admins can edit them through the existing screen.

4. Data updates
   - Row 1 of `pricing_settings` set to commission 15%, service fee $25,
     minimum term 1 month. No robot prices were changed by this migration.

5. Security
   - No new tables, so no new RLS or grants. Existing EXECUTE grants on the
     recreated functions are preserved by CREATE OR REPLACE; re-granted below
     for safety.
*/

ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS commission_pct numeric NOT NULL DEFAULT 0.15;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS service_fee_flat numeric NOT NULL DEFAULT 25.00;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS min_lease_months integer NOT NULL DEFAULT 1;

UPDATE pricing_settings
SET commission_pct = 0.15, service_fee_flat = 25.00, min_lease_months = 1
WHERE id = 1;

CREATE OR REPLACE FUNCTION admin_apply_catalog_rates(
  p_robot_id uuid,
  p_monthly numeric,
  p_summary text
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

  IF p_monthly IS NULL OR p_monthly < 0 OR p_monthly > 1000000 THEN
    RAISE EXCEPTION 'Invalid catalog price';
  END IF;

  UPDATE robots
  SET monthly_rate = p_monthly
  WHERE id = p_robot_id;

  INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
  VALUES (p_robot_id, 'catalog', p_summary, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION admin_save_pricing_settings(
  p_settings jsonb,
  p_summary text
)
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
      'avg_booking_days','verified',
      'commission_pct','service_fee_flat','min_lease_months'
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
      verified = COALESCE((p_settings->>'verified')::boolean, verified),
      commission_pct = COALESCE((p_settings->>'commission_pct')::numeric, commission_pct),
      service_fee_flat = COALESCE((p_settings->>'service_fee_flat')::numeric, service_fee_flat),
      min_lease_months = COALESCE((p_settings->>'min_lease_months')::int, min_lease_months)
  WHERE id = 1;

  INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
  VALUES (NULL, 'settings', p_summary, auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_apply_catalog_rates(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_save_pricing_settings(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_apply_catalog_rates(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_save_pricing_settings(jsonb, text) TO authenticated;
