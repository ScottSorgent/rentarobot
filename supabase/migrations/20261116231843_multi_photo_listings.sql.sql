/*
# Multi-photo listings, server-side upload limits, and photo management

1. New column on `robots`
- `photo_urls` (text[], nullable): every photograph on a listing, in order
  (index 1 is the primary thumbnail). Existing rows are backfilled with their
  current single `image_url` so old listings keep working unchanged. Nothing
  is dropped or overwritten; `image_url` stays the primary thumbnail and is
  kept in sync whenever photos change.

2. Server-side upload limits (storage bucket `listing-photos`)
- Maximum file size: 5 MB per photo.
- Allowed types: image/jpeg, image/png, image/webp.
- These are enforced by the storage service for every upload, closing the
  browser-only validation gap. Owner-folder restrictions (each owner can only
  write inside their own account folder) are unchanged.

3. Updated functions
- `owner_create_listing`: now also stores the full photo list (capped at 8)
  in `photo_urls`; `image_url` remains photo 1. All previous validation
  (ownership, ZIP, price bounds, at least one photo) is unchanged.
- `owner_update_listing`: owners may now edit `photo_urls` for their own
  listings (reorder, replace, remove). When the photo list changes,
  `image_url` follows the new first photo. Existing rules preserved: only the
  owner's own rows, only allowlisted fields, ZIP validation, and edits to a
  rejected/changes-requested listing return it to review.

4. New function
- `owner_photo_can_delete(p_url text) RETURNS boolean`: SECURITY DEFINER.
  True only when the caller owns the storage folder the URL points to AND no
  row in `robots` references the URL (neither as image_url nor in
  photo_urls). Used by the edit flow so a photo removed from one listing is
  never deleted while another listing still shows it.

5. Security notes
- All functions are revoked from PUBLIC/anon and granted to authenticated.
- Ownership checks use auth.uid(); search_path is pinned.
- No destructive schema changes; no existing rows are altered except the
  additive photo_urls backfill.
*/

ALTER TABLE robots ADD COLUMN IF NOT EXISTS photo_urls text[];

UPDATE robots
SET photo_urls = ARRAY[image_url]
WHERE photo_urls IS NULL AND image_url IS NOT NULL;

UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'listing-photos';

CREATE OR REPLACE FUNCTION owner_create_listing(
  p_listing jsonb,
  p_photo_urls text[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_uid uuid := auth.uid();
v_robot_id uuid;
v_monthly numeric := (p_listing->>'monthly_rate')::numeric;
v_daily numeric := (p_listing->>'daily_rate')::numeric;
v_weekly numeric := (p_listing->>'weekly_rate')::numeric;
v_city text;
v_photos text[];
BEGIN
IF v_uid IS NULL THEN
RAISE EXCEPTION 'Sign in to create a listing';
END IF;

IF COALESCE(array_length(p_photo_urls, 1), 0) < 1 THEN
RAISE EXCEPTION 'Add at least one photo of your robot';
END IF;
v_photos := p_photo_urls[1:8];

SELECT city_id INTO v_city FROM lookup_zip(COALESCE(p_listing->>'pickup_zip', ''));
IF v_city IS NULL THEN
RAISE EXCEPTION 'ZIP code not recognized';
END IF;

IF COALESCE(v_monthly, 0) <= 0 AND COALESCE(v_daily, 0) <= 0 THEN
RAISE EXCEPTION 'Enter a monthly rental price (or a daily price for humanoid robots)';
END IF;
IF v_monthly > 0 AND (v_monthly < 5 OR v_monthly > 100000) THEN
RAISE EXCEPTION 'Monthly price must be between $5 and $100,000';
END IF;

IF COALESCE(p_listing->>'condition', '') NOT IN ('new','refurbished','used') THEN
RAISE EXCEPTION 'Indicate whether the robot is new, refurbished, or used';
END IF;

INSERT INTO robots (
  name, slug, category, tagline, description, image_url,
  monthly_rate, daily_rate, weekly_rate, specs, features,
  status, rating, reviews_count, location,
  owner_id, city_id, pickup_zip, condition, accessories,
  pickup_instructions, return_instructions, blackout_dates,
  delivery_available, delivery_fee, equipment_category,
  listing_status, submitted_at, photo_urls
) VALUES (
  left(COALESCE(p_listing->>'name', ''), 80),
  left(lower(regexp_replace(COALESCE(p_listing->>'name',''), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6), 100),
  COALESCE(p_listing->>'category', 'residential'),
  left(COALESCE(p_listing->>'tagline', ''), 140),
  left(COALESCE(p_listing->>'description', ''), 4000),
  v_photos[1],
  v_monthly, v_daily, v_weekly,
  COALESCE(p_listing->'specs', '{}'::jsonb),
  COALESCE(p_listing->'features', '[]'::jsonb),
  'available',
  0, 0,
  left(COALESCE(p_listing->>'location_label', ''), 80),
  v_uid, v_city,
  left(regexp_replace(COALESCE(p_listing->>'pickup_zip',''), '\D', '', 'g'), 5),
  p_listing->>'condition',
  COALESCE(p_listing->'accessories', '[]'::jsonb),
  left(COALESCE(p_listing->>'pickup_instructions',''), 1000),
  left(COALESCE(p_listing->>'return_instructions',''), 1000),
  COALESCE(p_listing->'blackout_dates', '[]'::jsonb),
  COALESCE((p_listing->>'delivery_available')::boolean, false),
  COALESCE((p_listing->>'delivery_fee')::numeric, 0),
  COALESCE(p_listing->>'equipment_category', 'vacuum_mop'),
  'pending_review',
  now(),
  v_photos
)
RETURNING id INTO v_robot_id;

INSERT INTO pricing_audit (robot_id, scope, summary, changed_by)
VALUES (v_robot_id, 'listing', 'Owner submitted listing for review.', v_uid);

RETURN v_robot_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION owner_create_listing(jsonb, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owner_create_listing(jsonb, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION owner_update_listing(
  p_robot_id uuid,
  p_patch jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_allowed text[] := ARRAY[
  'name','tagline','description','monthly_rate','daily_rate','weekly_rate',
  'condition','accessories','pickup_instructions','return_instructions',
  'blackout_dates','delivery_available','delivery_fee','equipment_category',
  'specs','features','pickup_zip','photo_urls'
];
v_key text;
v_new_zip text;
v_new_city text;
v_photos text[];
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM robots WHERE id = p_robot_id AND owner_id = auth.uid()
) THEN
RAISE EXCEPTION 'You can only edit your own listings';
END IF;

FOR v_key IN SELECT jsonb_object_keys(p_patch)
LOOP
IF NOT (v_key = ANY (v_allowed)) THEN
RAISE EXCEPTION 'Field not editable: %', v_key;
END IF;
END LOOP;

IF p_patch ? 'photo_urls' THEN
  v_photos := ARRAY(SELECT jsonb_array_elements_text(p_patch->'photo_urls'));
  IF COALESCE(array_length(v_photos, 1), 0) < 1 THEN
    RAISE EXCEPTION 'Add at least one photo of your robot';
  END IF;
  v_photos := v_photos[1:8];
END IF;

v_new_zip := p_patch->>'pickup_zip';
IF v_new_zip IS NOT NULL THEN
SELECT city_id INTO v_new_city FROM lookup_zip(v_new_zip);
IF v_new_city IS NULL THEN
RAISE EXCEPTION 'ZIP code not recognized';
END IF;
END IF;

UPDATE robots SET
  name = COALESCE(left(p_patch->>'name', 80), name),
  tagline = COALESCE(left(p_patch->>'tagline', 140), tagline),
  description = COALESCE(left(p_patch->>'description', 4000), description),
  monthly_rate = COALESCE((p_patch->>'monthly_rate')::numeric, monthly_rate),
  daily_rate = COALESCE((p_patch->>'daily_rate')::numeric, daily_rate),
  weekly_rate = COALESCE((p_patch->>'weekly_rate')::numeric, weekly_rate),
  condition = COALESCE(p_patch->>'condition', condition),
  accessories = COALESCE(p_patch->'accessories', accessories),
  pickup_instructions = COALESCE(left(p_patch->>'pickup_instructions', 1000), pickup_instructions),
  return_instructions = COALESCE(left(p_patch->>'return_instructions', 1000), return_instructions),
  blackout_dates = COALESCE(p_patch->'blackout_dates', blackout_dates),
  delivery_available = COALESCE((p_patch->>'delivery_available')::boolean, delivery_available),
  delivery_fee = COALESCE((p_patch->>'delivery_fee')::numeric, delivery_fee),
  equipment_category = COALESCE(p_patch->>'equipment_category', equipment_category),
  specs = COALESCE(p_patch->'specs', specs),
  features = COALESCE(p_patch->'features', features),
  pickup_zip = COALESCE(left(regexp_replace(v_new_zip, '\D', '', 'g'), 5), pickup_zip),
  city_id = COALESCE(v_new_city, city_id),
  photo_urls = COALESCE(v_photos, photo_urls),
  image_url = COALESCE(v_photos[1], image_url),
  listing_status = CASE
    WHEN listing_status IN ('rejected','changes_requested') THEN 'pending_review'
    ELSE listing_status
  END,
  submitted_at = CASE
    WHEN listing_status IN ('rejected','changes_requested') THEN now()
    ELSE submitted_at
  END
WHERE id = p_robot_id AND owner_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION owner_update_listing(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION owner_update_listing(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION owner_photo_can_delete(p_url text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
IF auth.uid() IS NULL OR p_url IS NULL THEN
  RETURN false;
END IF;

-- The caller may only delete files inside their own storage folder.
IF NOT EXISTS (
  SELECT 1
  FROM storage.objects o
  WHERE o.bucket_id = 'listing-photos'
    AND o.name = substring(p_url from 'listing-photos/(.+)$')
    AND (storage.foldername(o.name))[1] = auth.uid()::text
) THEN
  RETURN false;
END IF;

-- Never allow deletion while any listing still references the photo.
IF EXISTS (
  SELECT 1 FROM robots
  WHERE image_url = p_url OR p_url = ANY(photo_urls)
) THEN
  RETURN false;
END IF;

RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION owner_photo_can_delete(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION owner_photo_can_delete(text) TO authenticated;
