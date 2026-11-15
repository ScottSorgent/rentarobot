/*
# Add user accounts: link bookings to signed-in users

1. Summary
- The platform is adding email/password sign-in. Bookings must now belong to
  the customer who made them. This migration adds an owner column to
  `bookings` and replaces the anonymous "anyone can insert/read" policies
  with owner-scoped ones.

2. Modified Tables
- `bookings`:
  - new column `user_id` (uuid, references auth.users, cascades on delete,
    defaults to the authenticated user's id so clients that omit it still
    record the owner). Nullable because rows created before this change
    have no owner.

3. Security Changes
- Drop the previous public policies on `bookings`
  (`public_insert_bookings`, `public_read_bookings`).
- New policies, scoped to authenticated users only:
  - `select_own_bookings`: users see only their own bookings.
  - `insert_own_bookings`: users can only create bookings recorded as
    their own.
- Revoke the anon role's access to `bookings` entirely (visitors must
  sign in to book).
- `robots` remains publicly readable (catalog browsing without sign-in).

4. Notes
- Email/password auth is handled by Supabase Auth (no custom tables).
- Existing anonymous bookings keep NULL user_id and are no longer visible
  to end users; they remain for record-keeping.
*/

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);

DROP POLICY IF EXISTS "public_insert_bookings" ON bookings;
DROP POLICY IF EXISTS "public_read_bookings" ON bookings;

DROP POLICY IF EXISTS "select_own_bookings" ON bookings;
CREATE POLICY "select_own_bookings" ON bookings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bookings" ON bookings;
CREATE POLICY "insert_own_bookings" ON bookings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON bookings FROM anon;
