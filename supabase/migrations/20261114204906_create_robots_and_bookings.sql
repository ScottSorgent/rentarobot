/*
# Robot rental platform: robots catalog + bookings

1. New Tables
- `robots`: rental catalog items.
  - `id` (uuid, primary key)
  - `name` (text, robot display name)
  - `slug` (text, unique URL-friendly identifier)
  - `category` (text, 'commercial' or 'residential')
  - `tagline` (text, short marketing line)
  - `description` (text, long description)
  - `image_url` (text, photo of the robot)
  - `daily_rate` (numeric, USD per day)
  - `weekly_rate` (numeric, USD per week)
  - `rating` (numeric, average review score)
  - `reviews_count` (integer, number of reviews)
  - `location` (text, pickup / service city)
  - `specs` (jsonb, key/value technical specs like payload, battery, runtime)
  - `features` (jsonb, array of feature highlights)
  - `status` (text, 'available', 'rented', or 'maintenance')
  - `created_at` (timestamp)
- `bookings`: rental reservations made by visitors.
  - `id` (uuid, primary key)
  - `robot_id` (uuid, foreign key to robots)
  - `renter_name` (text, customer name)
  - `renter_email` (text, customer email, used to look up bookings)
  - `renter_phone` (text, optional phone)
  - `usage_type` (text, 'commercial' or 'residential')
  - `start_date` (date, rental start)
  - `end_date` (date, rental end)
  - `days` (integer, rental duration in days)
  - `total_price` (numeric, quoted total in USD)
  - `notes` (text, optional customer notes)
  - `status` (text, 'pending' by default)
  - `created_at` (timestamp)

2. Security
- Enable RLS on both tables.
- No sign-in screen exists: this is a single-tenant catalog where the data is
  intentionally shared/public. Policies target `anon, authenticated`.
- `robots`: public read-only (no anon writes; catalog managed via service role).
- `bookings`: anonymous visitors may create bookings and read bookings
  (needed for the "my bookings" lookup by email in a no-auth app).
- Grants: SELECT on robots; SELECT/INSERT on bookings for anon + authenticated.

3. Seed Data
- 9 robots across commercial and residential categories with photos, rates,
  specs and features.
*/

CREATE TABLE IF NOT EXISTS robots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('commercial', 'residential')),
  tagline text NOT NULL,
  description text NOT NULL,
  image_url text NOT NULL,
  daily_rate numeric(10,2) NOT NULL,
  weekly_rate numeric(10,2) NOT NULL,
  rating numeric(2,1) NOT NULL DEFAULT 4.5,
  reviews_count integer NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT 'San Francisco, CA',
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  robot_id uuid NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
  renter_name text NOT NULL,
  renter_email text NOT NULL,
  renter_phone text,
  usage_type text NOT NULL DEFAULT 'commercial' CHECK (usage_type IN ('commercial', 'residential')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL,
  total_price numeric(10,2) NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_robot_id ON bookings(robot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(renter_email);

ALTER TABLE robots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON robots TO anon, authenticated;
GRANT SELECT, INSERT ON bookings TO anon, authenticated;

DROP POLICY IF EXISTS "public_read_robots" ON robots;
CREATE POLICY "public_read_robots" ON robots
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_bookings" ON bookings;
CREATE POLICY "public_insert_bookings" ON bookings
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_bookings" ON bookings;
CREATE POLICY "public_read_bookings" ON bookings
FOR SELECT TO anon, authenticated USING (true);

INSERT INTO robots (name, slug, category, tagline, description, image_url, daily_rate, weekly_rate, rating, reviews_count, location, specs, features, status) VALUES
(
  'Atlas Concierge X1',
  'atlas-concierge-x1',
  'commercial',
  'A welcoming humanoid for lobbies, events and front-of-house',
  'Atlas Concierge X1 greets visitors, answers questions in 32 languages, badges guests and escorts them to their destination. Its expressive face display and smooth gesture set make it a natural fit for hotels, expo halls and corporate lobbies. Ships with a concierge scripting studio so your team can customize greetings, FAQ answers and workflows in minutes.',
  'https://images.pexels.com/photos/8566470/pexels-photo-8566470.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  349.00, 1950.00, 4.9, 212, 'San Francisco, CA',
  '{"Height": "1.7 m", "Weight": "56 kg", "Battery": "12 h runtime", "Languages": "32", "Connectivity": "5G + Wi-Fi 6"}',
  '["Multilingual guest greeting", "Badge printing integration", "Wayfinding escort mode", "Custom FAQ scripting studio", "Live human handoff calls"]'::jsonb,
  'available'
),
(
  'ArcWeld Pro 7',
  'arcweld-pro-7',
  'commercial',
  'Precision MIG/TIG welding arm with automated seam tracking',
  'ArcWeld Pro 7 brings automated welding to short-run production without a permanent installation. The arm tracks seams with vision guidance, adapts to material thickness on the fly and logs every weld for QA. Ideal for fabrication shops covering seasonal peaks or a one-off contract that needs certified weld quality.',
  'https://images.pexels.com/photos/11951215/pexels-photo-11951215.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  589.00, 3350.00, 4.8, 96, 'Detroit, MI',
  '{"Payload": "20 kg", "Reach": "1.9 m", "Repeatability": "±0.05 mm", "Processes": "MIG, TIG, plasma", "Power": "480 V 3-phase"}',
  '["Vision-based seam tracking", "Certified weld quality logging", "Quick-swap torch heads", "Fume extraction ready", "On-site operator training included"]'::jsonb,
  'available'
),
(
  'SortBot Warehouse AMR',
  'sortbot-warehouse-amr',
  'commercial',
  'Autonomous mobile robot for picking, sorting and line feeding',
  'SortBot moves totes and pallets around your floor autonomously, mapping your warehouse in a single walkthrough. It integrates with WMS systems, coordinates fleets of up to 40 units and re-routes around obstacles in real time. Rent one to pilot automation or a fleet for peak season.',
  'https://images.pexels.com/photos/36522028/pexels-photo-36522028.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  429.00, 2450.00, 4.7, 158, 'Chicago, IL',
  '{"Payload": "600 kg", "Speed": "2.0 m/s", "Battery": "10 h, opportunity charging", "Navigation": "LiDAR + vision SLAM", "Fleet": "Up to 40 units"}',
  '["One-day facility mapping", "WMS / ERP integrations", "Fleet coordination dashboard", "Pallet and tote attachments", "24/7 remote monitoring"]'::jsonb,
  'available'
),
(
  'Sentinel Patrol S2',
  'sentinel-patrol-s2',
  'commercial',
  'Humanoid security patrols with thermal vision and live alerts',
  'Sentinel Patrol S2 walks scheduled or randomized patrol routes through offices, yards and parking structures. Thermal cameras, license-plate reading and two-way voice connect to your security operations center. Every patrol is logged with timestamped footage stored securely in the cloud.',
  'https://images.pexels.com/photos/35280153/pexels-photo-35280153.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  399.00, 2250.00, 4.6, 134, 'Austin, TX',
  '{"Height": "1.8 m", "Battery": "14 h runtime", "Cameras": "Thermal + 4K optical", "Recognition": "Plates, faces, badges", "Weather": "IP66 rated"}',
  '["Thermal anomaly detection", "License-plate recognition", "Two-way security operator intercom", "Randomized patrol schedules", "Incident video exports"]'::jsonb,
  'available'
),
(
  'FlexiArm 2000',
  'flexiarm-2000',
  'commercial',
  'Collaborative assembly arm for labs and light manufacturing',
  'FlexiArm 2000 is a collaborative arm that works safely next to people with no caging. Hand-guided teaching means your team programs a new task by physically walking the arm through it. Great for electronics assembly, sample handling, kitting and repetitive quality checks.',
  'https://images.pexels.com/photos/34207369/pexels-photo-34207369.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  479.00, 2690.00, 4.8, 87, 'Boston, MA',
  '{"Payload": "12 kg", "Reach": "1.3 m", "Repeatability": "±0.02 mm", "Safety": "ISO/TS 15066 collaborative", "Power": "110 V standard outlet"}',
  '["Hand-guided teaching", "Runs on standard outlet power", "Force-limited collaboration", "Vision pick-and-place kit", "Compact mobile base option"]'::jsonb,
  'available'
),
(
  'Scout Quadruped Q9',
  'scout-quadruped-q9',
  'commercial',
  'All-terrain inspection dog for plants, pipelines and construction',
  'Scout Q9 climbs stairs, scrambles over rubble and squeezes through crawl spaces to inspect places people should not go. Thermal, gas-sensing and acoustic payloads catch failing bearings, leaks and hotspots before they become outages. Operator control is as easy as a game controller.',
  'https://images.pexels.com/photos/8294625/pexels-photo-8294625.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  329.00, 1850.00, 4.7, 143, 'Houston, TX',
  '{"Weight": "38 kg", "Battery": "90 min swappable", "Speed": "1.7 m/s", "Payloads": "Thermal, gas, acoustic", "Rating": "IP67"}',
  '["Stair and rubble traversal", "Thermal hotspot detection", "Gas leak sensing", "Automated inspection routes", "Swappable batteries"]'::jsonb,
  'available'
),
(
  'HomeMate Vacuum V3',
  'homemate-vacuum-v3',
  'residential',
  'Self-emptying robot vacuum with room-level mapping',
  'HomeMate Vacuum V3 vacuums and mops in one pass, avoids pet bowls and charging cables, and empties itself into a 60-day bagless base. Schedule by room from your phone and let it handle the daily reset while you are out.',
  'https://images.pexels.com/photos/7641488/pexels-photo-7641488.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  29.00, 149.00, 4.8, 1204, 'San Francisco, CA',
  '{"Suction": "8,000 Pa", "Battery": "180 min", "Base": "60-day self-empty", "Mapping": "3D room-level", "Noise": "58 dB"}',
  '["Vacuum + mop in one pass", "Pet-hazard obstacle avoidance", "Per-room scheduling", "60-day self-emptying base", "Quiet evening mode"]'::jsonb,
  'available'
),
(
  'Companion Buddy C5',
  'companion-buddy-c5',
  'residential',
  'Friendly companion robot for kids, seniors and care settings',
  'Companion Buddy C5 chats, plays memory games, reminds about medications and calls family members by voice. Its soft-face display and gentle voice were designed with care professionals for dementia support and childhood learning. A favorite for respite care and independent living.',
  'https://images.pexels.com/photos/8566540/pexels-photo-8566540.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  49.00, 269.00, 4.9, 318, 'San Francisco, CA',
  '{"Height": "0.9 m", "Battery": "16 h runtime", "Voice": "Natural conversation", "Reminders": "Medication + calendar", "Privacy": "Local mic processing"}',
  '["Medication reminders", "Family video call button", "Memory and learning games", "Fall-check-in routine", "No cloud microphone storage"]'::jsonb,
  'available'
),
(
  'TidySweep Mini',
  'tidysweep-mini',
  'residential',
  'Compact robot vacuum made for apartments and small homes',
  'TidySweep Mini fits under sofas, beds and radiators where bigger robots cannot reach. Simple app controls, a 45-minute quick-clean mode and a whisper-quiet 52 dB motor make it the easy way to keep a small place spotless.',
  'https://images.pexels.com/photos/6856823/pexels-photo-6856823.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  25.00, 129.00, 4.6, 742, 'San Francisco, CA',
  '{"Height": "7.2 cm", "Suction": "4,000 Pa", "Battery": "120 min", "Noise": "52 dB", "Dustbin": "400 ml"}',
  '["Ultra-low 7.2 cm profile", "45-min quick clean mode", "Whisper-quiet motor", "One-button operation", "Auto recharge and resume"]'::jsonb,
  'available'
)
ON CONFLICT (slug) DO NOTHING;
