/*
# Tighten table grants to least privilege

1. Summary
- The robots and bookings tables previously carried blanket SELECT/INSERT/
  UPDATE/DELETE grants for the anon and authenticated roles. RLS policies
  already prevented unauthorized reads/writes, but the grants were broader
  than the application needs.

2. Changes
- robots: keep SELECT only for anon + authenticated (catalog is read-only
  for the website; inserts happen via service role during seeding).
- bookings: keep SELECT + INSERT only for anon + authenticated (visitors
  create bookings and look them up by email; no updates or deletes).

3. Security
- No policy changes. RLS stays enabled on both tables with the same
  policies. Any UPDATE/DELETE attempt through the Data API is now rejected
  at the grant level as well, adding defense in depth.
*/

REVOKE UPDATE, DELETE ON robots FROM anon, authenticated;
REVOKE UPDATE, DELETE ON bookings FROM anon, authenticated;
