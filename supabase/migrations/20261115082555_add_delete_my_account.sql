/*
# Add delete-account function for users

1. Plain-English summary
- Users can now permanently delete their own account from the profile screen.
- A new server-side function removes the signed-in user's bookings, provider
  profile, administrator designation, and the auth account itself. Ownership is
  derived from the signed-in session; no user-supplied identifiers are trusted.

2. New functions
- `delete_my_account()`: SECURITY DEFINER, no arguments. Requires an
  authenticated session. Deletes the caller's bookings (including legacy
  guest bookings matched by the account email), the provider profile row
  (cascade), the app admin row (cascade), then the auth user. Returns void.

3. Security
- EXECUTE revoked from PUBLIC and anon; granted to authenticated only.
- The function identifies the caller exclusively via auth.uid() and reads the
  email from the server-side auth schema, never from parameters.

4. Important notes
- No table or policy changes; provider profile updates continue to flow
  through the existing `complete_provider_onboarding` function.
- Idempotent: safe to re-apply; deleting a non-existent user is a no-op.
*/

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_email text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO actor_email FROM auth.users WHERE id = actor_id;

  DELETE FROM public.bookings WHERE user_id = actor_id;
  DELETE FROM public.bookings WHERE user_id IS NULL AND renter_email = lower(actor_email);
  DELETE FROM public.provider_profiles WHERE user_id = actor_id;
  DELETE FROM public.app_admins WHERE user_id = actor_id;
  DELETE FROM auth.users WHERE id = actor_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
