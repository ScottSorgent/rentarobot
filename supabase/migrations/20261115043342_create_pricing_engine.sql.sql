/*
# Dynamic rental pricing engine

1. Summary
- Adds database-backed, editable cost configuration for every robot plus
  platform-wide pricing defaults, so recommended daily/weekly/monthly prices
  are calculated from actual costs instead of hardcoded rates.

2. New Tables
- `hubs`: third-party janitorial distribution hubs that store, charge, check
  out and receive returned robots. `robot_capacity` defaults to 10.
- `robot_pricing`: one cost-configuration row per robot (unique on robot_id):
  - identity: manufacturer, model, category ('residential' | 'prosumer' | 'commercial')
  - acquisition: retail_price, wholesale_cost, wholesale_source,
    wholesale_verified (never treat retail as wholesale; unverified costs are
    flagged as estimates in the admin UI)
  - financing: financing_method ('owned' | 'financed' | 'supplier_leased'),
    monthly_payment, term_months, rate_pct, payment_verified.
    For 'owned' robots the engine uses straight-line depreciation
    ((wholesale_cost - residual_value) / useful_life_months) instead of a
    payment, so depreciation and principal are never double-counted.
  - lifespan: useful_life_months, residual_value
  - monthly fixed costs: storage, insurance, maintenance reserve, software,
    hosting
  - per-booking costs: checkout_handling, return_handling
  - rates: processing_pct, processing_fixed
  - planning: expected_utilization (0-1), expected_monthly_bookings
  - commercial: marketing_rate, target_margin, tax_rate, deposit_amount
  - optional admin overrides: daily_override, weekly_override, monthly_override
    (NULL = use the calculated price)
  - hub_id links the robot to its distribution hub
- `pricing_settings`: single-row platform defaults (marketing 20%, target
  margin 35%, utilization 80%, 10 robots per hub, $15 storage, $2 hosting,
  $10 combined handling, processing fees, weekly/monthly discount targets,
  average booking length). Edited through the admin screen.
- `pricing_audit`: immutable history of pricing changes (robot_id, scope,
  summary of what changed, who changed it, when).

3. Modified Tables
- `bookings`: added pricing_snapshot (jsonb, immutable record of the price
  shown at booking time), duration_type ('daily' | 'weekly' | 'monthly'),
  minimum_term_months, deposit_amount, delivery_fee, damage_protection_fee,
  checkout_handling_cost, return_handling_cost, tax_amount, hub_id.
  Existing rows keep NULL/zero on the new columns and their original prices.

4. Security
- RLS enabled on hubs, robot_pricing, pricing_settings, pricing_audit.
- Interim access model: signed-in operators (authenticated) may read and
  update pricing configuration; anonymous visitors have no access, so
  wholesale costs and margins never reach the public catalog or booking
  lookup. When a role-based admin system is introduced, the policies below
  are the single place to tighten.
- robots gets a column-restricted UPDATE grant (rates only) with a matching
  policy so the pricing screen can apply recommended prices to the catalog.
- pricing_audit is INSERT + SELECT only; rows are never updated or deleted.

5. Notes
- Seeded pricing rows use the documented example assumptions ($1,500
  acquisition, $41.70/month supplier lease over 36 months) and are explicitly
  marked unverified/estimated until supplier quotes are obtained.
- pricing_settings.id is a constant 1 (single row), so no sequence grant is
  needed for it.
*/

CREATE TABLE IF NOT EXISTS hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  robot_capacity integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS robot_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id uuid NOT NULL UNIQUE REFERENCES robots(id) ON DELETE CASCADE,
  manufacturer text NOT NULL DEFAULT 'Unspecified',
  model_name text NOT NULL DEFAULT '',
  cost_category text NOT NULL DEFAULT 'commercial'
    CHECK (cost_category IN ('residential', 'prosumer', 'commercial')),
  retail_price numeric NOT NULL DEFAULT 0,
  wholesale_cost numeric NOT NULL DEFAULT 0,
  wholesale_source text NOT NULL DEFAULT 'Not yet provided',
  wholesale_verified boolean NOT NULL DEFAULT false,
  financing_method text NOT NULL DEFAULT 'supplier_leased'
    CHECK (financing_method IN ('owned', 'financed', 'supplier_leased')),
  monthly_payment numeric NOT NULL DEFAULT 0,
  term_months integer NOT NULL DEFAULT 36,
  rate_pct numeric NOT NULL DEFAULT 0,
  payment_verified boolean NOT NULL DEFAULT false,
  useful_life_months integer NOT NULL DEFAULT 48,
  residual_value numeric NOT NULL DEFAULT 0,
  monthly_storage numeric NOT NULL DEFAULT 15,
  monthly_insurance numeric NOT NULL DEFAULT 0,
  monthly_maintenance numeric NOT NULL DEFAULT 0,
  monthly_software numeric NOT NULL DEFAULT 0,
  monthly_hosting numeric NOT NULL DEFAULT 2,
  checkout_handling numeric NOT NULL DEFAULT 5,
  return_handling numeric NOT NULL DEFAULT 5,
  processing_pct numeric NOT NULL DEFAULT 0.029,
  processing_fixed numeric NOT NULL DEFAULT 0.30,
  expected_utilization numeric NOT NULL DEFAULT 0.80,
  expected_monthly_bookings numeric NOT NULL DEFAULT 4,
  marketing_rate numeric NOT NULL DEFAULT 0.20,
  target_margin numeric NOT NULL DEFAULT 0.35,
  tax_rate numeric NOT NULL DEFAULT 0,
  deposit_amount numeric NOT NULL DEFAULT 0,
  daily_override numeric,
  weekly_override numeric,
  monthly_override numeric,
  hub_id uuid REFERENCES hubs(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pricing_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  marketing_rate numeric NOT NULL DEFAULT 0.20,
  target_margin numeric NOT NULL DEFAULT 0.35,
  processing_pct numeric NOT NULL DEFAULT 0.029,
  processing_fixed numeric NOT NULL DEFAULT 0.30,
  storage_monthly numeric NOT NULL DEFAULT 15,
  insurance_monthly numeric NOT NULL DEFAULT 0,
  maintenance_monthly numeric NOT NULL DEFAULT 0,
  software_monthly numeric NOT NULL DEFAULT 0,
  hosting_monthly numeric NOT NULL DEFAULT 2,
  checkout_handling numeric NOT NULL DEFAULT 5,
  return_handling numeric NOT NULL DEFAULT 5,
  utilization_base numeric NOT NULL DEFAULT 0.80,
  robots_per_hub integer NOT NULL DEFAULT 10,
  weekly_discount numeric NOT NULL DEFAULT 0.12,
  monthly_discount numeric NOT NULL DEFAULT 0.25,
  tax_rate numeric NOT NULL DEFAULT 0,
  avg_booking_days integer NOT NULL DEFAULT 7,
  verified boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pricing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id uuid REFERENCES robots(id) ON DELETE SET NULL,
  scope text NOT NULL DEFAULT 'robot',
  summary text NOT NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators read hubs" ON hubs;
CREATE POLICY "Operators read hubs" ON hubs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Operators read pricing" ON robot_pricing;
CREATE POLICY "Operators read pricing" ON robot_pricing FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Operators update pricing" ON robot_pricing;
CREATE POLICY "Operators update pricing" ON robot_pricing FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Operators insert pricing" ON robot_pricing;
CREATE POLICY "Operators insert pricing" ON robot_pricing FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Operators read settings" ON pricing_settings;
CREATE POLICY "Operators read settings" ON pricing_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Operators update settings" ON pricing_settings;
CREATE POLICY "Operators update settings" ON pricing_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Operators read audit" ON pricing_audit;
CREATE POLICY "Operators read audit" ON pricing_audit FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Operators insert audit" ON pricing_audit;
CREATE POLICY "Operators insert audit" ON pricing_audit FOR INSERT TO authenticated WITH CHECK (true);

GRANT SELECT ON hubs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON robot_pricing TO authenticated;
GRANT SELECT, UPDATE ON pricing_settings TO authenticated;
GRANT SELECT, INSERT ON pricing_audit TO authenticated;

DROP POLICY IF EXISTS "Operators update catalog rates" ON robots;
CREATE POLICY "Operators update catalog rates" ON robots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
GRANT UPDATE (daily_rate, weekly_rate, monthly_rate) ON robots TO authenticated;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_type text
  CHECK (duration_type IS NULL OR duration_type IN ('daily', 'weekly', 'monthly'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS minimum_term_months integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS damage_protection_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checkout_handling_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS return_handling_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS hub_id uuid REFERENCES hubs(id) ON DELETE SET NULL;

INSERT INTO pricing_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO hubs (name, city, zip)
SELECT 'Central Distribution Hub', 'San Francisco', '94107'
WHERE NOT EXISTS (SELECT 1 FROM hubs);

INSERT INTO robot_pricing (robot_id, hub_id, manufacturer, model_name)
SELECT r.id, h.id, 'Unspecified', r.name
FROM robots r
CROSS JOIN (SELECT id FROM hubs ORDER BY created_at LIMIT 1) h
WHERE NOT EXISTS (SELECT 1 FROM robot_pricing rp WHERE rp.robot_id = r.id);

UPDATE robot_pricing
SET wholesale_cost = 1500,
    retail_price = 1999,
    financing_method = 'supplier_leased',
    monthly_payment = 41.70,
    term_months = 36,
    wholesale_source = 'Example placeholder - replace with supplier quote',
    wholesale_verified = false,
    payment_verified = false,
    residual_value = 150
WHERE wholesale_cost = 0 AND monthly_payment = 0;
