/*
# Refine the catalog with premium cleaning models

1. Purpose
- Make the catalog feel premium and specialized for independent housecleaners.
- Focus every listing on deep floor cleaning, glass and window work, or edge and corner detail cleaning.
- Preserve existing robot rows, slugs and booking relationships while improving their presentation and capabilities.

2. Modified Tables
- `robots`
  - Update names, taglines, descriptions, images, daily rates, weekly rates and monthly lease rates.
  - Update specifications and feature lists to emphasize deep cleaning, glass care and edge access.
- `bookings`
  - No structural changes; existing rental and lease records remain intact.

3. Security
- No access rules, grants or ownership behavior are changed.
- The existing public catalog read policy remains in place.

4. Important Notes
- This migration updates existing rows in place and does not delete products or booking data.
- Updates use stable slugs so the migration is safe to replay on a rebuilt database.
*/

UPDATE robots SET
  name = 'MopMate DeepClean X1',
  tagline = 'High-suction vacuum and mop for a true deep clean',
  description = 'MopMate DeepClean X1 is built for independent housecleaners who want a visibly deeper finish in less time. It maps each room, lifts fine debris from hard floors and carpet, mops sealed surfaces, and returns to its dock between client visits.',
  image_url = '/premium-deep-clean-floor-robot.webp',
  daily_rate = 119.00,
  weekly_rate = 649.00,
  monthly_rate = 1890.00,
  specs = '{"Cleaning": "Deep vacuum + mop", "Suction": "12,000 Pa", "Coverage": "Up to 2,000 sq ft", "Mapping": "3D room-level", "Noise": "56 dB"}',
  features = '["High-suction deep clean", "Carpet and hard-floor modes", "Multi-room mapping", "Auto recharge and resume", "Setup walkthrough included"]'::jsonb
WHERE slug = 'atlas-concierge-x1';

UPDATE robots SET
  name = 'SteamLift Grout S7',
  tagline = 'Deep steam cleaning for grout, tile and high-touch surfaces',
  description = 'SteamLift Grout S7 tackles the detail work that makes a home feel truly clean. Its controlled steam system loosens buildup in grout lines, kitchens and bathrooms while guided passes help keep your results consistent from one appointment to the next.',
  image_url = 'https://images.pexels.com/photos/7641526/pexels-photo-7641526.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 99.00,
  weekly_rate = 549.00,
  monthly_rate = 1590.00,
  specs = '{"Cleaning": "Steam + detail scrub", "Runtime": "120 min", "Tank": "1.5 L", "Surfaces": "Tile, grout, stone", "Control": "Guided path"}',
  features = '["Deep grout cleaning", "Adjustable steam control", "Chemical-light sanitizing", "Surface-safe modes", "Operator training included"]'::jsonb
WHERE slug = 'arcweld-pro-7';

UPDATE robots SET
  name = 'SweepRoute DeepClean AMR',
  tagline = 'Long-running floor robot for large homes and repeat routes',
  description = 'SweepRoute DeepClean AMR gives solo cleaners more coverage on large homes and back-to-back appointments. It navigates room transitions, lifts embedded dust and reports completed areas so you can handle finishing work while it keeps moving.',
  image_url = 'https://images.pexels.com/photos/8566426/pexels-photo-8566426.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 129.00,
  weekly_rate = 699.00,
  monthly_rate = 1990.00,
  specs = '{"Coverage": "Up to 3,000 sq ft", "Battery": "10 h runtime", "Suction": "10,000 Pa", "Navigation": "LiDAR + vision", "Control": "Mobile dashboard"}',
  features = '["Whole-home deep mapping", "Room completion reports", "Obstacle avoidance", "Scheduled cleaning routes", "Remote status checks"]'::jsonb
WHERE slug = 'sortbot-warehouse-amr';

UPDATE robots SET
  name = 'GlassGlide Window Pro S2',
  tagline = 'Premium streak-free cleaning for windows, mirrors and glass doors',
  description = 'GlassGlide Window Pro S2 handles large panes, mirrors and smooth glass with edge-aware movement and steady pressure. It lets independent housecleaners offer a higher-end finish without spending the whole appointment on repetitive window work.',
  image_url = '/premium-window-cleaning-robot.webp',
  daily_rate = 89.00,
  weekly_rate = 479.00,
  monthly_rate = 1390.00,
  specs = '{"Surfaces": "Glass + mirrors", "Runtime": "120 min", "Safety": "Edge sensors + tether", "Cleaning": "Spray + wipe", "Finish": "Streak-reducing"}',
  features = '["Edge-aware navigation", "Streak-free wipe pattern", "Safety tether included", "Low-profile design", "Quick setup guide"]'::jsonb
WHERE slug = 'sentinel-patrol-s2';

UPDATE robots SET
  name = 'PolishBot Finish 2000',
  tagline = 'Deep floor refresh and polish for a showroom-ready finish',
  description = 'PolishBot Finish 2000 brings premium floor care to solo housecleaners. Use its deep scrub cycle for buildup, then switch to a controlled polish pass on sealed wood, stone and hard flooring for a finish clients can see immediately.',
  image_url = 'https://images.pexels.com/photos/8566430/pexels-photo-8566430.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 149.00,
  weekly_rate = 799.00,
  monthly_rate = 2290.00,
  specs = '{"Coverage": "Up to 1,800 sq ft", "Runtime": "150 min", "Surfaces": "Sealed hard floors", "Modes": "Deep scrub + polish", "Power": "Standard outlet"}',
  features = '["Deep scrub cycle", "Showroom polish mode", "Replaceable polishing pads", "Low-noise operation", "Compact transport case"]'::jsonb
WHERE slug = 'flexiarm-2000';

UPDATE robots SET
  name = 'CornerScout Q9',
  tagline = 'Edge and corner cleaner for stairs, baseboards and tight gaps',
  description = 'CornerScout Q9 is made for the places standard vacuums leave behind. Its slim body, edge brush and guided movement reach stair edges, baseboards, cabinet toe-kicks and tight gaps without forcing you to work on your knees.',
  image_url = '/premium-corner-cleaning-robot.webp',
  daily_rate = 79.00,
  weekly_rate = 429.00,
  monthly_rate = 1290.00,
  specs = '{"Weight": "8 kg", "Battery": "90 min swappable", "Profile": "Low clearance", "Reach": "Edges + corners", "Control": "Handheld remote"}',
  features = '["Baseboard edge brush", "Stair-edge cleaning", "Low-clearance reach", "Corner detail mode", "Carry case included"]'::jsonb
WHERE slug = 'scout-quadruped-q9';

UPDATE robots SET
  name = 'HomeMate DeepClean V3',
  tagline = 'Premium self-emptying vacuum and mop for recurring clients',
  description = 'HomeMate DeepClean V3 vacuums and mops in one pass, avoids pet bowls and charging cables, and empties itself into a 60-day bagless base. It is a reliable workhorse for recurring client homes between your detail visits.',
  image_url = 'https://images.pexels.com/photos/7641488/pexels-photo-7641488.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 39.00,
  weekly_rate = 209.00,
  monthly_rate = 599.00,
  specs = '{"Suction": "10,000 Pa", "Battery": "180 min", "Base": "60-day self-empty", "Mapping": "3D room-level", "Noise": "56 dB"}',
  features = '["Vacuum + mop in one pass", "Pet-hazard obstacle avoidance", "Per-room scheduling", "60-day self-emptying base", "Quiet evening mode"]'::jsonb
WHERE slug = 'homemate-vacuum-v3';

UPDATE robots SET
  name = 'EdgeBuddy C5',
  tagline = 'Detail robot for baseboards, furniture edges and fine dust',
  description = 'EdgeBuddy C5 handles repeatable detail passes around furniture, baseboards and open floor areas. Bring it along for premium home-cleaning routes and use your time for the finishing touches clients notice most.',
  image_url = 'https://images.pexels.com/photos/8566427/pexels-photo-8566427.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 59.00,
  weekly_rate = 319.00,
  monthly_rate = 899.00,
  specs = '{"Coverage": "Up to 900 sq ft", "Battery": "180 min", "Profile": "8 cm", "Modes": "Dust + edge sweep", "Noise": "54 dB"}',
  features = '["Furniture-aware navigation", "Baseboard edge pass", "Fine-dust filter", "Quiet detail mode", "Easy carry handle"]'::jsonb
WHERE slug = 'companion-buddy-c5';

UPDATE robots SET
  name = 'TidySweep Detail Mini',
  tagline = 'Compact deep-clean robot for corners, sofas and smaller homes',
  description = 'TidySweep Detail Mini fits under sofas, beds and radiators where bigger robots cannot reach. Its focused edge brush, quick-clean mode and quiet motor make it a premium companion for smaller homes and repeat appointments.',
  image_url = 'https://images.pexels.com/photos/6856823/pexels-photo-6856823.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  daily_rate = 35.00,
  weekly_rate = 189.00,
  monthly_rate = 549.00,
  specs = '{"Height": "7.2 cm", "Suction": "5,000 Pa", "Battery": "120 min", "Edge reach": "20 mm", "Noise": "52 dB"}',
  features = '["Ultra-low 7.2 cm profile", "Focused edge brush", "45-min deep-clean mode", "Whisper-quiet motor", "Auto recharge and resume"]'::jsonb
WHERE slug = 'tidysweep-mini';
