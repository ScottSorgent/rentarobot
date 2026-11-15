/*
# Create secure provider onboarding

1. New Tables
- `provider_profiles`
  - `user_id`: authenticated owner and primary key.
  - Account preferences: legal name, display name, mobile phone, contact method and language.
  - Provider details: provider type, optional business information and team size.
  - Service details: service types, specialties, home ZIP, served areas and fee display preference.
  - Equipment readiness: owned equipment, models, automation experience and training.
  - Verification references: external payment account ID and verification status only; no SSN, full EIN or bank details.
  - Agreement timestamps and onboarding completion status.

2. Security
- Enable row-level security on `provider_profiles`.
- Authenticated users can read only their own profile.
- Direct client inserts, updates and deletes are revoked.
- Add `complete_provider_onboarding(jsonb)`, a `SECURITY DEFINER` function that derives ownership from `auth.uid()`, validates user-entered values, writes the editable profile fields, and records agreement timestamps.
- Payment account and verification fields are not accepted from the browser and are never changed by the onboarding function.
- Revoke function execution from public and anonymous roles; grant it only to authenticated users.

3. Important Notes
- Email and password remain in Supabase Auth; email is shown read-only during onboarding.
- Tax and payment verification are intentionally represented by status and external references so sensitive values stay with the payment or identity provider.
- The migration is idempotent and does not alter or delete existing bookings or robot catalog data.
*/

CREATE TABLE IF NOT EXISTS public.provider_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_legal_name text NOT NULL,
  display_name text NOT NULL,
  mobile_phone text NOT NULL,
  preferred_contact_method text NOT NULL CHECK (preferred_contact_method IN ('email', 'phone', 'sms')),
  preferred_language text NOT NULL DEFAULT 'English',
  provider_type text NOT NULL CHECK (provider_type IN ('individual', 'sole_proprietor', 'cleaning_company', 'company_employee')),
  legal_business_name text,
  public_business_name text,
  business_structure text,
  business_address text,
  business_website text,
  ein_status text NOT NULL DEFAULT 'not_provided' CHECK (ein_status IN ('not_provided', 'pending_external', 'verified_external')),
  owner_representative_name text,
  team_size integer NOT NULL DEFAULT 1 CHECK (team_size BETWEEN 1 AND 1000),
  service_types text[] NOT NULL DEFAULT '{}'::text[],
  other_specialties text,
  home_zip text NOT NULL,
  service_area_zips text[] NOT NULL DEFAULT '{}'::text[],
  rates_include_platform_fee boolean NOT NULL DEFAULT false,
  owned_equipment boolean NOT NULL DEFAULT false,
  equipment_models text,
  automation_experience text,
  training_completed text,
  payment_account_id text,
  payment_verification_status text NOT NULL DEFAULT 'not_connected' CHECK (payment_verification_status IN ('not_connected', 'pending', 'verified')),
  onboarding_completed boolean NOT NULL DEFAULT false,
  provider_agreement_accepted_at timestamptz,
  platform_terms_accepted_at timestamptz,
  privacy_policy_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.provider_profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.provider_profiles FROM authenticated;
GRANT SELECT ON public.provider_profiles TO authenticated;

DROP POLICY IF EXISTS "providers_read_own_profile" ON public.provider_profiles;
CREATE POLICY "providers_read_own_profile" ON public.provider_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.complete_provider_onboarding(p_profile jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  provider_type_value text := p_profile->>'provider_type';
  contact_method_value text := p_profile->>'preferred_contact_method';
  service_types_value text[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_profile->'service_types', '[]'::jsonb)));
  service_areas_value text[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_profile->'service_area_zips', '[]'::jsonb)));
  team_size_value integer := NULLIF(p_profile->>'team_size', '')::integer;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF jsonb_typeof(p_profile) <> 'object' THEN
    RAISE EXCEPTION 'Invalid onboarding data';
  END IF;

  IF NULLIF(trim(p_profile->>'full_legal_name'), '') IS NULL
    OR NULLIF(trim(p_profile->>'display_name'), '') IS NULL
    OR NULLIF(trim(p_profile->>'mobile_phone'), '') IS NULL
    OR NULLIF(trim(p_profile->>'home_zip'), '') IS NULL THEN
    RAISE EXCEPTION 'Required profile information is missing';
  END IF;

  IF contact_method_value NOT IN ('email', 'phone', 'sms') THEN
    RAISE EXCEPTION 'Invalid contact method';
  END IF;

  IF provider_type_value NOT IN ('individual', 'sole_proprietor', 'cleaning_company', 'company_employee') THEN
    RAISE EXCEPTION 'Invalid provider type';
  END IF;

  IF provider_type_value <> 'individual'
    AND (
      NULLIF(trim(p_profile->>'legal_business_name'), '') IS NULL
      OR NULLIF(trim(p_profile->>'business_structure'), '') IS NULL
      OR NULLIF(trim(p_profile->>'business_address'), '') IS NULL
      OR NULLIF(trim(p_profile->>'owner_representative_name'), '') IS NULL
    ) THEN
    RAISE EXCEPTION 'Business information is incomplete';
  END IF;

  IF team_size_value IS NULL OR team_size_value < 1 OR team_size_value > 1000 THEN
    RAISE EXCEPTION 'Invalid team size';
  END IF;

  IF cardinality(service_types_value) = 0 OR EXISTS (
    SELECT 1 FROM unnest(service_types_value) AS service_type
    WHERE service_type NOT IN ('Residential cleaning', 'Storefront cleaning', 'Office or commercial cleaning')
  ) THEN
    RAISE EXCEPTION 'Invalid service types';
  END IF;

  IF cardinality(service_areas_value) = 0 THEN
    RAISE EXCEPTION 'At least one service area is required';
  END IF;

  INSERT INTO public.provider_profiles (
    user_id,
    full_legal_name,
    display_name,
    mobile_phone,
    preferred_contact_method,
    preferred_language,
    provider_type,
    legal_business_name,
    public_business_name,
    business_structure,
    business_address,
    business_website,
    ein_status,
    owner_representative_name,
    team_size,
    service_types,
    other_specialties,
    home_zip,
    service_area_zips,
    rates_include_platform_fee,
    owned_equipment,
    equipment_models,
    automation_experience,
    training_completed,
    onboarding_completed,
    provider_agreement_accepted_at,
    platform_terms_accepted_at,
    privacy_policy_accepted_at,
    updated_at
  ) VALUES (
    actor_id,
    trim(p_profile->>'full_legal_name'),
    trim(p_profile->>'display_name'),
    trim(p_profile->>'mobile_phone'),
    contact_method_value,
    COALESCE(NULLIF(trim(p_profile->>'preferred_language'), ''), 'English'),
    provider_type_value,
    NULLIF(trim(p_profile->>'legal_business_name'), ''),
    NULLIF(trim(p_profile->>'public_business_name'), ''),
    NULLIF(trim(p_profile->>'business_structure'), ''),
    NULLIF(trim(p_profile->>'business_address'), ''),
    NULLIF(trim(p_profile->>'business_website'), ''),
    CASE WHEN p_profile->>'ein_status' = 'pending_external' THEN 'pending_external' ELSE 'not_provided' END,
    NULLIF(trim(p_profile->>'owner_representative_name'), ''),
    team_size_value,
    service_types_value,
    NULLIF(trim(p_profile->>'other_specialties'), ''),
    trim(p_profile->>'home_zip'),
    service_areas_value,
    COALESCE((p_profile->>'rates_include_platform_fee')::boolean, false),
    COALESCE((p_profile->>'owned_equipment')::boolean, false),
    NULLIF(trim(p_profile->>'equipment_models'), ''),
    NULLIF(trim(p_profile->>'automation_experience'), ''),
    NULLIF(trim(p_profile->>'training_completed'), ''),
    true,
    now(),
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_legal_name = EXCLUDED.full_legal_name,
    display_name = EXCLUDED.display_name,
    mobile_phone = EXCLUDED.mobile_phone,
    preferred_contact_method = EXCLUDED.preferred_contact_method,
    preferred_language = EXCLUDED.preferred_language,
    provider_type = EXCLUDED.provider_type,
    legal_business_name = EXCLUDED.legal_business_name,
    public_business_name = EXCLUDED.public_business_name,
    business_structure = EXCLUDED.business_structure,
    business_address = EXCLUDED.business_address,
    business_website = EXCLUDED.business_website,
    ein_status = EXCLUDED.ein_status,
    owner_representative_name = EXCLUDED.owner_representative_name,
    team_size = EXCLUDED.team_size,
    service_types = EXCLUDED.service_types,
    other_specialties = EXCLUDED.other_specialties,
    home_zip = EXCLUDED.home_zip,
    service_area_zips = EXCLUDED.service_area_zips,
    rates_include_platform_fee = EXCLUDED.rates_include_platform_fee,
    owned_equipment = EXCLUDED.owned_equipment,
    equipment_models = EXCLUDED.equipment_models,
    automation_experience = EXCLUDED.automation_experience,
    training_completed = EXCLUDED.training_completed,
    onboarding_completed = true,
    provider_agreement_accepted_at = COALESCE(provider_profiles.provider_agreement_accepted_at, now()),
    platform_terms_accepted_at = COALESCE(provider_profiles.platform_terms_accepted_at, now()),
    privacy_policy_accepted_at = COALESCE(provider_profiles.privacy_policy_accepted_at, now()),
    updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_provider_onboarding(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_provider_onboarding(jsonb) TO authenticated;
