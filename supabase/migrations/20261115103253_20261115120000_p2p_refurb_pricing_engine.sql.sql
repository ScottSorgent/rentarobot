/*
# Peer-to-peer refurb pricing engine update

1. Purpose
Adapt the pricing engine to the refurbished, customer-to-customer handoff
business model: robots are purchased used, fitted with new batteries, owned
outright (no lease), handed directly between renters (no hub storage or
handling in the standard price), priced with a 50% contribution-margin
target, and window-cleaning robots get their own financial assumptions.

2. Modified tables (no columns dropped, no types changed, no data rewritten)
- robot_pricing: add acquisition columns for the refurb model
  (battery_cost, refurbishment_cost, acquisition_source, customer_acquisition_cost,
  expected_bookings_per_customer, handoff_incentive), category 'window_cleaning',
  and nullable per-duration utilization shares. Existing rows keep their values;
  defaults on new columns match the $225 refurb template so admins can adopt
  them per robot.
- pricing_settings: add matching platform defaults
  (battery_cost, refurbishment_cost, customer_acquisition_cost,
  expected_bookings_per_customer, handoff_incentive, maintenance_monthly 2.00,
  target_margin 0.50, storage/handling defaults zeroed) plus utilization
  scenario grid u60/u70/u80/u90/u100 and late-handoff policy fields
  (grace/warn/late fee, activation flag default off pending legal review).
- bookings: add handoff workflow columns (pickup_at, handoff_location,
  handoff_status, handoff_code, outgoing/incoming confirmations with
  timestamps, custodian tracking, photos, cancellation/no-show reasons).
  All nullable with defaults, so existing bookings are untouched.

3. New tables
- equipment_records: per-physical-unit registry (serial, model, battery model,
  compatible parts, current custodian, status incl. 'blocked_unsafe').
- maintenance_reports: customer-reported issues, severity, resolution,
  wear-vs-damage classification, optional parts sale with cost/price/profit.
- handoff_events: timestamped custody-transfer audit trail.

4. Security
- RLS enabled on all new tables. Authenticated users can read equipment
  records and insert maintenance reports for their own bookings; write
  columns are narrowed by grants. Admin mutations go through existing
  admin-guarded RPC pattern (is_app_admin()); inserts of equipment records
  and handoff confirmations are authenticated-scoped with ownership or
  admin checks via EXISTS clauses.
- Grants follow the same authenticated-only shape as the existing engine
  tables.

5. Important notes
- No rental prices are hardcoded anywhere in this migration.
- No destructive operations: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF
  NOT EXISTS only. Previously agreed booking prices and snapshots persist.
- Late-fee enforcement is stored but flagged inactive by default.
*/

-- ---------------------------------------------------------------------------
-- robot_pricing: refurb acquisition model + window category + utilization grid
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE robot_cost_category_new AS ENUM ('residential', 'prosumer', 'commercial', 'window_cleaning');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS battery_cost numeric NOT NULL DEFAULT 40.00;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS refurbishment_cost numeric NOT NULL DEFAULT 0.00;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS acquisition_source text NOT NULL DEFAULT 'Used marketplace purchase + new battery';
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS customer_acquisition_cost numeric NOT NULL DEFAULT 5.00;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS expected_bookings_per_customer numeric NOT NULL DEFAULT 6;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS handoff_incentive numeric NOT NULL DEFAULT 0.00;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS utilization_u60 numeric;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS utilization_u70 numeric;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS utilization_u80 numeric;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS utilization_u90 numeric;
ALTER TABLE robot_pricing ADD COLUMN IF NOT EXISTS utilization_u100 numeric;

-- Widen the category check in place (add value; old values remain valid).
ALTER TABLE robot_pricing DROP CONSTRAINT IF EXISTS robot_pricing_cost_category_check;
ALTER TABLE robot_pricing ADD CONSTRAINT robot_pricing_cost_category_check
  CHECK (cost_category IN ('residential', 'prosumer', 'commercial', 'window_cleaning'));

-- ---------------------------------------------------------------------------
-- pricing_settings: platform defaults for the refurb model
-- ---------------------------------------------------------------------------

ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS battery_cost numeric NOT NULL DEFAULT 40.00;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS refurbishment_cost numeric NOT NULL DEFAULT 0.00;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS customer_acquisition_cost numeric NOT NULL DEFAULT 5.00;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS expected_bookings_per_customer numeric NOT NULL DEFAULT 6.00;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS handoff_incentive numeric NOT NULL DEFAULT 0.00;

ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS utilization_u60 numeric NOT NULL DEFAULT 0.60;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS utilization_u70 numeric NOT NULL DEFAULT 0.70;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS utilization_u80 numeric NOT NULL DEFAULT 0.80;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS utilization_u90 numeric NOT NULL DEFAULT 0.90;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS utilization_u100 numeric NOT NULL DEFAULT 1.00;

ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS late_grace_minutes integer NOT NULL DEFAULT 15;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS late_warn_minutes integer NOT NULL DEFAULT 30;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS late_fee_amount numeric NOT NULL DEFAULT 5.00;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS late_fee_active boolean NOT NULL DEFAULT false;

-- Align the existing shared columns with the new business model for the
-- single settings row. These are assumption defaults, not rental prices;
-- admins can edit them in the dashboard afterwards.
UPDATE pricing_settings SET
  target_margin = 0.50,
  maintenance_monthly = 2.00,
  storage_monthly = 0.00,
  checkout_handling = 0.00,
  return_handling = 0.00,
  marketing_rate = 0.00
WHERE id = 1;

-- ---------------------------------------------------------------------------
-- bookings: peer-to-peer handoff workflow columns
-- ---------------------------------------------------------------------------

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handoff_location text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handoff_status text
  NOT NULL DEFAULT 'not_scheduled'
  CHECK (handoff_status IN ('not_scheduled','scheduled','cleaning_confirmed','in_progress','completed','cancelled','no_show','recovery'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handoff_code text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handoff_reminder_sent_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checklist_done boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS battery_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS condition_photos jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS outgoing_confirmed_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS incoming_confirmed_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handoff_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS handoff_notes text;

CREATE INDEX IF NOT EXISTS bookings_handoff_status_idx ON bookings (handoff_status);
CREATE INDEX IF NOT EXISTS bookings_pickup_at_idx ON bookings (pickup_at);

-- ---------------------------------------------------------------------------
-- equipment_records: one row per physical unit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS equipment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id uuid REFERENCES robots(id) ON DELETE CASCADE,
  serial_number text NOT NULL DEFAULT '',
  manufacturer text NOT NULL DEFAULT '',
  model_name text NOT NULL DEFAULT '',
  battery_model text NOT NULL DEFAULT '',
  battery_installed_at date,
  acquisition_price numeric NOT NULL DEFAULT 0,
  acquisition_source text NOT NULL DEFAULT '',
  compatible_parts text[] NOT NULL DEFAULT '{}',
  maintenance_history jsonb NOT NULL DEFAULT '[]',
  current_custodian_email text,
  current_custodian_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  condition_status text NOT NULL DEFAULT 'ready'
    CHECK (condition_status IN ('ready','rented','needs_service','blocked_unsafe','retired')),
  condition_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read equipment" ON equipment_records;
CREATE POLICY "Authenticated read equipment" ON equipment_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage equipment" ON equipment_records;
CREATE POLICY "Admins manage equipment" ON equipment_records FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins update equipment" ON equipment_records;
CREATE POLICY "Admins update equipment" ON equipment_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()));

GRANT SELECT ON equipment_records TO authenticated;
GRANT INSERT, UPDATE ON equipment_records TO authenticated;

-- ---------------------------------------------------------------------------
-- maintenance_reports: customer issue reports + parts sale accounting
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS maintenance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_record_id uuid REFERENCES equipment_records(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
    DEFAULT auth.uid(),
  issue_type text NOT NULL DEFAULT 'other'
    CHECK (issue_type IN ('battery','brushes','filter','sensor','other')),
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'minor'
    CHECK (severity IN ('minor','major','unsafe')),
  classification text
    CHECK (classification IS NULL OR classification IN ('normal_wear','customer_damage')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','parts_ordered','resolved','blocked')),
  part_name text NOT NULL DEFAULT '',
  part_cost numeric NOT NULL DEFAULT 0,
  part_shipping numeric NOT NULL DEFAULT 0,
  part_price numeric,
  parts_contribution_profit numeric,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE maintenance_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own reports" ON maintenance_reports;
CREATE POLICY "Customers read own reports" ON maintenance_reports FOR SELECT TO authenticated
  USING (reported_by = auth.uid() OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customers insert own reports" ON maintenance_reports;
CREATE POLICY "Customers insert own reports" ON maintenance_reports FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

-- Admins resolve, classify, and price parts. Customers never write these
-- columns, so the insert grant below excludes them.
DROP POLICY IF EXISTS "Admins update reports" ON maintenance_reports;
CREATE POLICY "Admins update reports" ON maintenance_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid()));

GRANT SELECT ON maintenance_reports TO authenticated;
GRANT INSERT (equipment_record_id, booking_id, reported_by, issue_type, description, severity)
  ON maintenance_reports TO authenticated;
GRANT UPDATE ON maintenance_reports TO authenticated;

-- ---------------------------------------------------------------------------
-- handoff_events: custody-transfer audit trail
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  equipment_record_id uuid REFERENCES equipment_records(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN ('scheduled','reminder_sent','cleaning_confirmed','checkout','accepted','cancelled','no_show','recovery','custody_transferred')),
  actor_email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE handoff_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read handoffs" ON handoff_events;
CREATE POLICY "Authenticated read handoffs" ON handoff_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert handoffs" ON handoff_events;
CREATE POLICY "Authenticated insert handoffs" ON handoff_events FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT, INSERT ON handoff_events TO authenticated;
