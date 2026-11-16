/*
# Peer-to-peer owner marketplace foundation

1. Plain-English summary
   Rent-A-Robot becomes an Airbnb-style marketplace where individual owners
   list their own robots for rent in their city. This migration adds:
   - A reference dataset of cities and the ZIP codes belonging to each, so a
     customer anywhere in a city (any of its ZIP codes) sees every listing in
     that city, and listings in other cities stay hidden.
   - Owner-listing fields on the robots table (who owns it, where it is
     picked up, its condition, accessories, pickup/return instructions,
     delivery option, blackout dates, and its review status).
   - A listing review trail for administrator approval.
   - A notification signup list for cities with no robots yet.
   - Booking columns recording who the owner is and what they are owed.

2. New tables
   - `cities` — one row per rental city: id (slug like 'stockton-ca'),
     name, state, state_code. Public reference data.
   - `zip_cities` — maps each ZIP code to the city or cities it belongs to
     (a few ZIP codes legitimately belong to two cities). Public reference.
   - `listing_reviews` — administrator actions on owner listings
     (approved / rejected / suspended / changes requested) with a note.
   - `notify_requests` — email signups for cities with no listings yet.

3. Modified tables
   - `robots` — new columns: `owner_id` (null = curated platform fleet
     available in every city), `city_id`, `pickup_zip`, `condition`,
     `accessories` (jsonb array), `pickup_instructions`, `return_instructions`,
     `blackout_dates` (jsonb array of {start,end}), `delivery_available`,
     `delivery_fee`, `equipment_category`, `listing_status` (default
     'published' so all existing curated robots stay visible), `review_note`,
     `submitted_at`, `reviewed_at`, `approved_at`, `owner_notes`.
     All existing rows keep their data; nothing is deleted or overwritten.
   - `bookings` — new columns: `owner_id`, `owner_payout` (80%),
     `platform_commission` (20%), `cancelled_at`, `refund_status`.
   - `provider_profiles` — new column `preferred_city_id` storing the
     customer's chosen rental city.

4. Security
   - RLS enabled on new tables. `cities` and `zip_cities` are intentionally
     public reference data (read-only for everyone; only the platform
     seeds them).
   - `listing_reviews`: admins insert/select via helper functions; owners can
     read reviews of their own robots.
   - `notify_requests`: anyone may sign up (validated email); nothing is
     readable through the API.
   - `robots` read policies are tightened: the public sees published rows and
     the curated fleet (owner_id null); owners also see their own drafts and
     rejected listings. No public write access — owner changes go through
     SECURITY DEFINER functions that verify the caller.
   - Storage: a public 'listing-photos' bucket where owners may upload only
     into their own user-id folder.
*/

-- ---------- Reference geography ----------

CREATE TABLE IF NOT EXISTS cities (
  id text PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL,
  state_code text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS cities_name_state_idx ON cities (lower(name), state_code);
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS zip_cities (
  zip text NOT NULL,
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  PRIMARY KEY (zip, city_id)
);
ALTER TABLE zip_cities ENABLE ROW LEVEL SECURITY;

INSERT INTO cities (id, name, state, state_code) VALUES
  ('stockton-ca','Stockton','California','CA'),
  ('sacramento-ca','Sacramento','California','CA'),
  ('modesto-ca','Modesto','California','CA'),
  ('san-francisco-ca','San Francisco','California','CA'),
  ('oakland-ca','Oakland','California','CA'),
  ('san-jose-ca','San Jose','California','CA'),
  ('fresno-ca','Fresno','California','CA'),
  ('los-angeles-ca','Los Angeles','California','CA'),
  ('san-diego-ca','San Diego','California','CA'),
  ('long-beach-ca','Long Beach','California','CA'),
  ('bakersfield-ca','Bakersfield','California','CA'),
  ('anaheim-ca','Anaheim','California','CA'),
  ('riverside-ca','Riverside','California','CA'),
  ('santa-clara-ca','Santa Clara','California','CA'),
  ('lodi-ca','Lodi','California','CA'),
  ('manteca-ca','Manteca','California','CA'),
  ('tracy-ca','Tracy','California','CA'),
  ('turlock-ca','Turlock','California','CA'),
  ('elk-grove-ca','Elk Grove','California','CA'),
  ('roseville-ca','Roseville','California','CA'),
  ('dublin-ca','Dublin','California','CA'),
  ('pleasanton-ca','Pleasanton','California','CA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO zip_cities (zip, city_id) VALUES
  -- Stockton (multiple ZIP codes, one city)
  ('95201','stockton-ca'),('95202','stockton-ca'),('95203','stockton-ca'),
  ('95204','stockton-ca'),('95205','stockton-ca'),('95206','stockton-ca'),
  ('95207','stockton-ca'),('95208','stockton-ca'),('95209','stockton-ca'),
  ('95210','stockton-ca'),('95212','stockton-ca'),('95215','stockton-ca'),
  ('95219','stockton-ca'),('95220','stockton-ca'),('95269','stockton-ca'),
  -- Sacramento
  ('95811','sacramento-ca'),('95814','sacramento-ca'),('95815','sacramento-ca'),
  ('95816','sacramento-ca'),('95817','sacramento-ca'),('95818','sacramento-ca'),
  ('95819','sacramento-ca'),('95820','sacramento-ca'),('95821','sacramento-ca'),
  ('95822','sacramento-ca'),('95823','sacramento-ca'),('95824','sacramento-ca'),
  ('95825','sacramento-ca'),('95826','sacramento-ca'),('95827','sacramento-ca'),
  ('95828','sacramento-ca'),('95829','sacramento-ca'),('95831','sacramento-ca'),
  ('95832','sacramento-ca'),('95833','sacramento-ca'),('95834','sacramento-ca'),
  ('95835','sacramento-ca'),('95838','sacramento-ca'),('95841','sacramento-ca'),
  ('95842','sacramento-ca'),('95843','sacramento-ca'),('95864','sacramento-ca'),
  -- Modesto
  ('95350','modesto-ca'),('95351','modesto-ca'),('95354','modesto-ca'),
  ('95355','modesto-ca'),('95356','modesto-ca'),('95357','modesto-ca'),('95358','modesto-ca'),
  -- San Francisco
  ('94102','san-francisco-ca'),('94103','san-francisco-ca'),('94104','san-francisco-ca'),
  ('94105','san-francisco-ca'),('94107','san-francisco-ca'),('94108','san-francisco-ca'),
  ('94109','san-francisco-ca'),('94110','san-francisco-ca'),('94112','san-francisco-ca'),
  ('94114','san-francisco-ca'),('94115','san-francisco-ca'),('94116','san-francisco-ca'),
  ('94117','san-francisco-ca'),('94118','san-francisco-ca'),('94121','san-francisco-ca'),
  ('94122','san-francisco-ca'),('94123','san-francisco-ca'),('94124','san-francisco-ca'),
  ('94127','san-francisco-ca'),('94131','san-francisco-ca'),('94132','san-francisco-ca'),
  ('94133','san-francisco-ca'),('94134','san-francisco-ca'),
  -- Oakland
  ('94601','oakland-ca'),('94602','oakland-ca'),('94603','oakland-ca'),
  ('94605','oakland-ca'),('94606','oakland-ca'),('94607','oakland-ca'),
  ('94608','oakland-ca'),('94609','oakland-ca'),('94610','oakland-ca'),
  ('94611','oakland-ca'),('94612','oakland-ca'),('94618','oakland-ca'),
  ('94619','oakland-ca'),('94620','oakland-ca'),('94621','oakland-ca'),
  -- San Jose
  ('95108','san-jose-ca'),('95110','san-jose-ca'),('95111','san-jose-ca'),
  ('95112','san-jose-ca'),('95116','san-jose-ca'),('95117','san-jose-ca'),
  ('95118','san-jose-ca'),('95120','san-jose-ca'),('95121','san-jose-ca'),
  ('95122','san-jose-ca'),('95123','san-jose-ca'),('95124','san-jose-ca'),
  ('95125','san-jose-ca'),('95126','san-jose-ca'),('95127','san-jose-ca'),
  ('95128','san-jose-ca'),('95129','san-jose-ca'),('95130','san-jose-ca'),
  ('95131','san-jose-ca'),('95132','san-jose-ca'),('95133','san-jose-ca'),
  ('95134','san-jose-ca'),('95135','san-jose-ca'),('95136','san-jose-ca'),
  ('95138','san-jose-ca'),('95139','san-jose-ca'),('95148','san-jose-ca'),
  -- Fresno
  ('93701','fresno-ca'),('93702','fresno-ca'),('93703','fresno-ca'),
  ('93704','fresno-ca'),('93705','fresno-ca'),('93706','fresno-ca'),
  ('93707','fresno-ca'),('93708','fresno-ca'),('93710','fresno-ca'),
  ('93711','fresno-ca'),('93712','fresno-ca'),('93715','fresno-ca'),
  ('93716','fresno-ca'),('93720','fresno-ca'),('93721','fresno-ca'),
  ('93722','fresno-ca'),('93725','fresno-ca'),('93726','fresno-ca'),
  ('93727','fresno-ca'),('93728','fresno-ca'),('93730','fresno-ca'),('93737','fresno-ca'),
  -- Los Angeles
  ('90001','los-angeles-ca'),('90002','los-angeles-ca'),('90003','los-angeles-ca'),
  ('90004','los-angeles-ca'),('90005','los-angeles-ca'),('90006','los-angeles-ca'),
  ('90007','los-angeles-ca'),('90008','los-angeles-ca'),('90011','los-angeles-ca'),
  ('90012','los-angeles-ca'),('90013','los-angeles-ca'),('90014','los-angeles-ca'),
  ('90015','los-angeles-ca'),('90016','los-angeles-ca'),('90017','los-angeles-ca'),
  ('90018','los-angeles-ca'),('90019','los-angeles-ca'),('90020','los-angeles-ca'),
  ('90021','los-angeles-ca'),('90022','los-angeles-ca'),('90023','los-angeles-ca'),
  ('90024','los-angeles-ca'),('90025','los-angeles-ca'),('90026','los-angeles-ca'),
  ('90027','los-angeles-ca'),('90028','los-angeles-ca'),('90029','los-angeles-ca'),
  ('90031','los-angeles-ca'),('90032','los-angeles-ca'),('90033','los-angeles-ca'),
  ('90034','los-angeles-ca'),('90035','los-angeles-ca'),('90036','los-angeles-ca'),
  ('90037','los-angeles-ca'),('90038','los-angeles-ca'),('90039','los-angeles-ca'),
  ('90041','los-angeles-ca'),('90042','los-angeles-ca'),('90043','los-angeles-ca'),
  ('90044','los-angeles-ca'),('90045','los-angeles-ca'),('90046','los-angeles-ca'),
  ('90047','los-angeles-ca'),('90048','los-angeles-ca'),('90049','los-angeles-ca'),
  ('90056','los-angeles-ca'),('90057','los-angeles-ca'),('90058','los-angeles-ca'),
  ('90061','los-angeles-ca'),('90062','los-angeles-ca'),('90063','los-angeles-ca'),
  ('90064','los-angeles-ca'),('90065','los-angeles-ca'),('90066','los-angeles-ca'),
  ('90067','los-angeles-ca'),('90068','los-angeles-ca'),
  -- San Diego
  ('92101','san-diego-ca'),('92102','san-diego-ca'),('92103','san-diego-ca'),
  ('92104','san-diego-ca'),('92105','san-diego-ca'),('92106','san-diego-ca'),
  ('92107','san-diego-ca'),('92108','san-diego-ca'),('92109','san-diego-ca'),
  ('92110','san-diego-ca'),('92111','san-diego-ca'),('92113','san-diego-ca'),
  ('92114','san-diego-ca'),('92115','san-diego-ca'),('92116','san-diego-ca'),
  ('92117','san-diego-ca'),('92119','san-diego-ca'),('92120','san-diego-ca'),
  ('92121','san-diego-ca'),('92122','san-diego-ca'),('92123','san-diego-ca'),
  ('92124','san-diego-ca'),('92125','san-diego-ca'),('92126','san-diego-ca'),
  ('92127','san-diego-ca'),('92128','san-diego-ca'),('92129','san-diego-ca'),
  ('92130','san-diego-ca'),('92131','san-diego-ca'),('92134','san-diego-ca'),
  -- Long Beach
  ('90802','long-beach-ca'),('90803','long-beach-ca'),('90804','long-beach-ca'),
  ('90805','long-beach-ca'),('90806','long-beach-ca'),('90807','long-beach-ca'),
  ('90808','long-beach-ca'),('90810','long-beach-ca'),('90813','long-beach-ca'),
  ('90814','long-beach-ca'),('90815','long-beach-ca'),('90822','long-beach-ca'),
  -- Bakersfield
  ('93301','bakersfield-ca'),('93304','bakersfield-ca'),('93305','bakersfield-ca'),
  ('93306','bakersfield-ca'),('93307','bakersfield-ca'),('93308','bakersfield-ca'),
  ('93309','bakersfield-ca'),('93312','bakersfield-ca'),('93313','bakersfield-ca'),
  -- Anaheim
  ('92801','anaheim-ca'),('92802','anaheim-ca'),('92804','anaheim-ca'),
  ('92805','anaheim-ca'),('92806','anaheim-ca'),('92807','anaheim-ca'),('92808','anaheim-ca'),
  -- Riverside
  ('92501','riverside-ca'),('92504','riverside-ca'),('92505','riverside-ca'),
  ('92506','riverside-ca'),('92507','riverside-ca'),('92508','riverside-ca'),('92509','riverside-ca'),
  -- Santa Clara
  ('95050','santa-clara-ca'),('95051','santa-clara-ca'),('95052','santa-clara-ca'),('95054','santa-clara-ca'),
  -- Lodi, Manteca, Tracy, Turlock, Elk Grove, Roseville
  ('95240','lodi-ca'),('95241','lodi-ca'),('95242','lodi-ca'),
  ('95336','manteca-ca'),('95337','manteca-ca'),
  ('95304','tracy-ca'),('95376','tracy-ca'),('95377','tracy-ca'),
  ('95380','turlock-ca'),('95381','turlock-ca'),('95382','turlock-ca'),
  ('95624','elk-grove-ca'),('95757','elk-grove-ca'),('95758','elk-grove-ca'),
  ('95661','roseville-ca'),('95678','roseville-ca'),('95747','roseville-ca'),
  -- 94588 legitimately belongs to two postal cities: Pleasanton and Dublin.
  ('94588','pleasanton-ca'),('94588','dublin-ca'),
  ('94566','pleasanton-ca'),('94568','dublin-ca')
ON CONFLICT (zip, city_id) DO NOTHING;

-- ---------- Owner listing fields on robots ----------

ALTER TABLE robots
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_id text REFERENCES cities(id),
  ADD COLUMN IF NOT EXISTS pickup_zip text,
  ADD COLUMN IF NOT EXISTS condition text CHECK (condition IN ('new','refurbished','used')),
  ADD COLUMN IF NOT EXISTS accessories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pickup_instructions text,
  ADD COLUMN IF NOT EXISTS return_instructions text,
  ADD COLUMN IF NOT EXISTS blackout_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipment_category text
    NOT NULL DEFAULT 'vacuum_mop'
    CHECK (equipment_category IN ('vacuum_mop','window_cleaning','floor_polishing','carpet_deep_cleaning','humanoid','other_specialized')),
  ADD COLUMN IF NOT EXISTS listing_status text
    NOT NULL DEFAULT 'published'
    CHECK (listing_status IN ('draft','pending_review','published','paused','rejected','suspended','changes_requested')),
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_notes text;

-- Humanoid platform robots keep their category consistent with their rates.
UPDATE robots SET equipment_category = 'humanoid'
WHERE coalesce(daily_rate, 0) > 0 OR coalesce(weekly_rate, 0) > 0;

CREATE INDEX IF NOT EXISTS robots_city_listing_idx ON robots (city_id, listing_status) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS robots_owner_idx ON robots (owner_id);

-- ---------- Listing review trail ----------

CREATE TABLE IF NOT EXISTS listing_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id uuid NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('approved','rejected','suspended','changes_requested')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE listing_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins record listing reviews" ON listing_reviews;
CREATE POLICY "Admins record listing reviews"
ON listing_reviews FOR INSERT
TO authenticated
WITH CHECK (is_app_admin());

DROP POLICY IF EXISTS "Admins read listing reviews" ON listing_reviews;
CREATE POLICY "Admins read listing reviews"
ON listing_reviews FOR SELECT
TO authenticated
USING (is_app_admin() OR EXISTS (
  SELECT 1 FROM robots r WHERE r.id = robot_id AND r.owner_id = auth.uid()
));

GRANT SELECT, INSERT ON listing_reviews TO authenticated;

-- ---------- Notification signup for empty cities ----------

CREATE TABLE IF NOT EXISTS notify_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id text NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notify_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join the notify list" ON notify_requests;
CREATE POLICY "Anyone can join the notify list"
ON notify_requests FOR INSERT
TO anon, authenticated
WITH CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

GRANT INSERT ON notify_requests TO anon, authenticated;

-- ---------- Booking payout + cancellation columns ----------

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_payout numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_commission numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_status text
    CHECK (refund_status IN ('none','requested','processing','refunded'));

CREATE INDEX IF NOT EXISTS bookings_robot_dates_idx ON bookings (robot_id, start_date, end_date);

-- ---------- Customer preferred city ----------

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS preferred_city_id text REFERENCES cities(id);

-- ---------- Robots read policies: published + curated fleet + own drafts ----------

DROP POLICY IF EXISTS "public_read_robots" ON robots;
CREATE POLICY "Catalog robots are publicly readable"
ON robots FOR SELECT
TO anon, authenticated
USING (
  listing_status = 'published'
  OR owner_id IS NULL
  OR owner_id = auth.uid()
);

-- No table-level INSERT/UPDATE/DELETE for clients on robots: owner changes go
-- through SECURITY DEFINER functions (owner_create_listing, etc.).

-- ---------- Reference data readable by everyone ----------

GRANT SELECT ON cities, zip_cities TO anon, authenticated;

-- ---------- Storage: owner listing photos ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-photos', 'listing-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Owners upload photos to own folder" ON storage.objects;
CREATE POLICY "Owners upload photos to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listing-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Anyone can view listing photos" ON storage.objects;
CREATE POLICY "Anyone can view listing photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'listing-photos');

DROP POLICY IF EXISTS "Owners manage own photo folder" ON storage.objects;
CREATE POLICY "Owners manage own photo folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listing-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
VALUES (NULL, 'settings', 'Peer-to-peer marketplace foundation: city/ZIP reference data, owner listing fields, listing review trail, notify list, booking payout columns.', NULL);
