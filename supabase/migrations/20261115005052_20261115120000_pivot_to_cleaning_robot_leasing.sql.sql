/*
# Pivot the catalog to cleaning robots and add lease plans

1. Purpose
- Reposition the shared catalog for independent housecleaners who need cleaning equipment for client homes.
- Replace industrial, warehouse, concierge and companion listing content with floor-care, sanitizing, window-cleaning and detail-cleaning robots.
- Preserve each existing robot row and slug so existing bookmarks and bookings keep their references.

2. Modified Tables
- `robots`
  - Add `monthly_rate`, the USD price for a 30-day lease.
  - Update names, descriptions, photos, pricing, specifications and features to cleaning-focused equipment.
- `bookings`
  - Add `plan_type`, either `rental` for short-term use or `lease` for a monthly plan.
  - Existing bookings default to `rental`.

3. Security
- No access rules are changed. Existing public catalog read and booking policies remain in place.
- Existing table grants continue to apply to the added columns.

4. Important Notes
- The migration is additive and updates existing rows in place; it does not delete tables, columns or booking records.
- All updates use stable robot slugs so the migration can be safely replayed on a rebuilt database.
*/

ALTER TABLE robots
  ADD COLUMN IF NOT EXISTS monthly_rate numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'rental';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_plan_type_check'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_plan_type_check CHECK (plan_type IN ('rental', 'lease'));
  END IF;
END $$;

UPDATE robots SET
  name = 'MopMate Pro X1',
  tagline = 'Autonomous floor scrubber for multi-room homes',
  description = 'MopMate Pro X1 gives independent housecleaners a dependable second set of hands for large homes. It maps rooms, vacuums and mops in one pass, and returns to its dock to recharge between client visits.',
  image_url = 'https://images.pexels.com/photos/8566433/pexels-photo-8566433.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 89.00,
  weekly_rate = 429.00,
  monthly_rate = 1290.00,
  location = 'San Francisco, CA',
  specs = '{"Cleaning": "Vacuum + mop", "Battery": "180 min", "Coverage": "Up to 2,000 sq ft", "Mapping": "3D room-level", "Noise": "58 dB"}',
  features = '["Multi-room mapping", "Vacuum and mop in one pass", "Auto recharge and resume", "Quiet daytime mode", "Setup walkthrough included"]'::jsonb
WHERE slug = 'atlas-concierge-x1';

UPDATE robots SET
  name = 'SteamLift Detailer S7',
  tagline = 'Steam and sanitize hard surfaces without harsh chemicals',
  description = 'SteamLift Detailer S7 handles kitchens, bathrooms and high-touch surfaces between appointments. Its guided cleaning paths, refillable tank and controlled steam output help housecleaners deliver a consistently polished finish.',
  image_url = 'https://images.pexels.com/photos/7641526/pexels-photo-7641526.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 69.00,
  weekly_rate = 369.00,
  monthly_rate = 1090.00,
  location = 'Detroit, MI',
  specs = '{"Cleaning": "Steam + sanitize", "Runtime": "120 min", "Tank": "1.2 L", "Surfaces": "Tile, stone, sealed wood", "Control": "Guided path"}',
  features = '["Chemical-light sanitizing", "Adjustable steam control", "Refillable water tank", "Surface-safe modes", "Operator training included"]'::jsonb
WHERE slug = 'arcweld-pro-7';

UPDATE robots SET
  name = 'SweepRoute Home AMR',
  tagline = 'Self-navigating sweeper for large homes and busy routes',
  description = 'SweepRoute Home AMR keeps moving through large or multi-level homes while you handle the detail work. It maps the floor plan, navigates around furniture and reports completed rooms so you can stay focused on the client.',
  image_url = 'https://images.pexels.com/photos/8566426/pexels-photo-8566426.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 79.00,
  weekly_rate = 429.00,
  monthly_rate = 1290.00,
  location = 'Chicago, IL',
  specs = '{"Coverage": "Up to 3,000 sq ft", "Battery": "10 h runtime", "Navigation": "LiDAR + vision", "Obstacle clearance": "2 cm", "Control": "Mobile dashboard"}',
  features = '["Whole-home mapping", "Room completion reports", "Obstacle avoidance", "Scheduled cleaning routes", "Remote status checks"]'::jsonb
WHERE slug = 'sortbot-warehouse-amr';

UPDATE robots SET
  name = 'GlassGlide Window S2',
  tagline = 'Edge-aware window and tile cleaning for spotless finishes',
  description = 'GlassGlide Window S2 takes the repetitive work out of large panes, mirrors and smooth tile. Secure edge detection and a controlled cleaning pattern help you finish detail-heavy homes faster and with less strain.',
  image_url = 'https://images.pexels.com/photos/4112723/pexels-photo-4112723.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 39.00,
  weekly_rate = 209.00,
  monthly_rate = 590.00,
  location = 'Austin, TX',
  specs = '{"Surfaces": "Glass + smooth tile", "Runtime": "90 min", "Safety": "Edge detection", "Cleaning": "Spray + wipe", "Control": "Remote control"}',
  features = '["Edge-aware navigation", "Streak-reducing wipe pattern", "Safety tether included", "Low-profile design", "Quick setup guide"]'::jsonb
WHERE slug = 'sentinel-patrol-s2';

UPDATE robots SET
  name = 'PolishBot Floor 2000',
  tagline = 'Professional floor polishing for a showroom finish',
  description = 'PolishBot Floor 2000 gives solo housecleaners a consistent way to refresh sealed wood, stone and hard flooring. Choose a gentle maintenance pass or a deeper polish cycle and let the robot keep a steady pace across open rooms.',
  image_url = 'https://images.pexels.com/photos/7641526/pexels-photo-7641526.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 99.00,
  weekly_rate = 549.00,
  monthly_rate = 1590.00,
  location = 'Boston, MA',
  specs = '{"Coverage": "Up to 1,800 sq ft", "Runtime": "150 min", "Surfaces": "Sealed hard floors", "Modes": "Maintain + polish", "Power": "Standard outlet"}',
  features = '["Consistent floor coverage", "Gentle maintenance mode", "Replaceable polishing pads", "Low-noise operation", "Compact transport case"]'::jsonb
WHERE slug = 'flexiarm-2000';

UPDATE robots SET
  name = 'StairScout Q9',
  tagline = 'Compact stair and edge cleaner for hard-to-reach spaces',
  description = 'StairScout Q9 helps you handle steps, thresholds and tight edges without wearing out your knees. Its compact body and swappable battery make it easy to carry from one client home to the next.',
  image_url = 'https://images.pexels.com/photos/8566430/pexels-photo-8566430.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 59.00,
  weekly_rate = 319.00,
  monthly_rate = 890.00,
  location = 'Houston, TX',
  specs = '{"Weight": "8 kg", "Battery": "90 min swappable", "Profile": "Low clearance", "Surfaces": "Carpet + hard floor", "Control": "Handheld remote"}',
  features = '["Stair-edge cleaning", "Swappable battery", "Low-clearance reach", "Carpet and hard-floor modes", "Carry case included"]'::jsonb
WHERE slug = 'scout-quadruped-q9';

UPDATE robots SET
  name = 'HomeMate Vacuum V3',
  tagline = 'Self-emptying vacuum and mop for recurring client visits',
  description = 'HomeMate Vacuum V3 vacuums and mops in one pass, avoids pet bowls and charging cables, and empties itself into a 60-day bagless base. It is a reliable way to keep recurring client homes looking fresh between your detail visits.',
  image_url = 'https://images.pexels.com/photos/7641488/pexels-photo-7641488.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  monthly_rate = 449.00
WHERE slug = 'homemate-vacuum-v3';

UPDATE robots SET
  name = 'DustBuddy C5',
  tagline = 'Compact dusting and detail robot for furnished homes',
  description = 'DustBuddy C5 handles repeatable dusting passes around furniture, baseboards and open floor areas. Bring it along for busy home-cleaning routes and use your time for the finishing touches that clients notice most.',
  image_url = 'https://images.pexels.com/photos/8566427/pexels-photo-8566427.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 35.00,
  weekly_rate = 189.00,
  monthly_rate = 540.00,
  location = 'San Francisco, CA',
  specs = '{"Coverage": "Up to 900 sq ft", "Battery": "180 min", "Profile": "8 cm", "Modes": "Dust + sweep", "Noise": "54 dB"}',
  features = '["Furniture-aware navigation", "Baseboard edge pass", "Quiet detail mode", "Scheduled routines", "Easy carry handle"]'::jsonb
WHERE slug = 'companion-buddy-c5';

UPDATE robots SET
  name = 'TidySweep Mini',
  tagline = 'Compact robot vacuum made for daily housecleaning routes',
  description = 'TidySweep Mini fits under sofas, beds and radiators where bigger robots cannot reach. Simple app controls, a 45-minute quick-clean mode and a whisper-quiet motor make it an easy companion for smaller homes and repeat appointments.',
  image_url = 'https://images.pexels.com/photos/6856823/pexels-photo-6856823.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  monthly_rate = 399.00
WHERE slug = 'tidysweep-mini';

UPDATE bookings
SET plan_type = 'rental'
WHERE plan_type IS NULL;
