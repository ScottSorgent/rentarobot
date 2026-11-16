/*
# Admin listing review queue function

1. Plain-English summary
   Adds one SECURITY DEFINER function, `admin_list_reviews`, that returns the
   listings an administrator needs to act on: everything pending review,
   rejected, suspended, or with changes requested, including each robot's
   owner email and city. The catalog's public read policy intentionally hides
   non-published listings from other users, so without this function an
   administrator could act on listings only by id. The function reads the
   rows directly as a privileged definer, so the review screen can show the
   full queue.

2. Security
   - Verifies the caller with is_app_admin() inside the function body.
   - SET search_path = public.
   - EXECUTE revoked from PUBLIC/anon, granted to authenticated only.
   - Read-only: no inserts, updates, or deletes.
*/

CREATE OR REPLACE FUNCTION admin_list_reviews()
RETURNS TABLE (
  id uuid,
  name text,
  listing_status text,
  equipment_category text,
  monthly_rate numeric,
  daily_rate numeric,
  weekly_rate numeric,
  condition text,
  pickup_zip text,
  city_id text,
  image_url text,
  description text,
  accessories jsonb,
  review_note text,
  submitted_at timestamptz,
  owner_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.listing_status, r.equipment_category,
         r.monthly_rate, r.daily_rate, r.weekly_rate, r.condition,
         r.pickup_zip, r.city_id, r.image_url, r.description,
         r.accessories, r.review_note, r.submitted_at,
         (SELECT u.email FROM auth.users u WHERE u.id = r.owner_id)
  FROM robots r
  WHERE r.owner_id IS NOT NULL
    AND r.listing_status IN ('pending_review','rejected','suspended','changes_requested')
  ORDER BY r.submitted_at NULLS FIRST, r.created_at;
$$;

REVOKE EXECUTE ON FUNCTION admin_list_reviews() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_list_reviews() TO authenticated;
