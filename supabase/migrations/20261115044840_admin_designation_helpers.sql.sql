/*
# Admin designation by email

1. Summary
- Adds admin-only helpers so designated administrators can list existing
  admins (with emails) and add new admins by email, without the browser
  ever reading the auth schema directly.

2. New Functions (SECURITY DEFINER)
- `admin_list_admins()` — returns user_id, email and created_at for every
  designated administrator. Caller must already be an admin.
- `admin_add_admin_by_email(p_email text)` — resolves the email to an auth
  user and designates them. Lowercases/trims the email; raises a neutral
  error if no account matches. Caller must already be an admin.

3. Security
- Both functions: EXECUTE revoked from PUBLIC and anon, granted to
  authenticated. Each verifies is_app_admin() internally, so only current
  admins can call them.
*/

CREATE OR REPLACE FUNCTION admin_list_admins()
RETURNS TABLE (user_id uuid, email text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.user_id, u.email, a.created_at
  FROM app_admins a
  JOIN auth.users u ON u.id = a.user_id
  WHERE is_app_admin()
  ORDER BY a.created_at;
$$;

CREATE OR REPLACE FUNCTION admin_add_admin_by_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email_clean text;
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_email_clean := lower(btrim(coalesce(p_email, '')));
  IF v_email_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email_clean LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No account found with that email';
  END IF;

  INSERT INTO app_admins (user_id, added_by) VALUES (v_user_id, auth.uid())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_list_admins() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_add_admin_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_add_admin_by_email(text) TO authenticated;
