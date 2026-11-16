/*
# Add "Robot Owner" account type

1. Plain-English summary
   Adds `robot_owner` as an allowed account type so owners can sign up through
   the normal onboarding flow (no separate registration) and existing
   customers can switch to or add robot-owner functionality from their
   profile without creating a new account. Nothing else about onboarding
   changes: same screens, same data, same single profile row per user.

2. Modified objects
   - `provider_profiles.provider_type` CHECK constraint: adds 'robot_owner'
     to the allowed values. Existing values are untouched.
   - `complete_provider_onboarding` (void): server-side validation now also
     accepts 'robot_owner'. The body is re-created verbatim from the deployed
     version; only the validation list changed.

3. Security
   - No policy, grant, or privilege changes. The function keeps its existing
     privileges and search_path.
*/

ALTER TABLE provider_profiles
  DROP CONSTRAINT provider_profiles_provider_type_check;
ALTER TABLE provider_profiles
  ADD CONSTRAINT provider_profiles_provider_type_check
  CHECK (provider_type = ANY (ARRAY['individual'::text, 'sole_proprietor'::text, 'cleaning_company'::text, 'company_employee'::text, 'homeowner'::text, 'renter'::text, 'robot_owner'::text]));

CREATE OR REPLACE FUNCTION complete_provider_onboarding(p_profile jsonb)
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
OR NULLIF(trim(p_profile->>'mobile_phone'), '') IS NULL
OR NULLIF(trim(p_profile->>'home_zip'), '') IS NULL THEN
RAISE EXCEPTION 'Required profile information is missing';
END IF;

IF contact_method_value IS NOT NULL
AND contact_method_value NOT IN ('email', 'phone', 'sms') THEN
RAISE EXCEPTION 'Invalid contact method';
END IF;

IF provider_type_value NOT IN ('individual', 'sole_proprietor', 'cleaning_company', 'company_employee', 'homeowner', 'renter', 'robot_owner') THEN
RAISE EXCEPTION 'Invalid provider type';
END IF;

IF provider_type_value IN ('sole_proprietor', 'cleaning_company', 'company_employee')
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
COALESCE(NULLIF(trim(p_profile->>'display_name'), ''), trim(p_profile->>'full_legal_name')),
trim(p_profile->>'mobile_phone'),
COALESCE(contact_method_value, 'email'),
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
