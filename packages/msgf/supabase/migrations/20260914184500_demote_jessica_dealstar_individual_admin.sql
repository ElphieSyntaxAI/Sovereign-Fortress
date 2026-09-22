-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-191e80fa-20260921T055901Z-internal
-- =============================================================================
-- jessica@dealstar.io is an individual (non-team) operator: COMPANY_ADMIN on a
-- personal sandbox. GLOBAL_ADMIN is only jessicapickens@elphiesyntax.com.

DO $$
DECLARE
  v_email constant text := 'jessica@dealstar.io';
  v_user_id uuid;
  v_username text;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(trim(email)) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE
      'demote_jessica_dealstar_to_individual_admin: % not in auth.users',
      v_email;
    RETURN;
  END IF;

  v_username := split_part(v_email, '@', 1);

  INSERT INTO public.p4_profiles (
    user_id,
    username,
    user_role,
    msgf_access_role,
    company_id,
    billing_license_type,
    current_credits
  )
  VALUES (
    v_user_id,
    v_username,
    'developer',
    'COMPANY_ADMIN',
    NULL,
    'lifetime',
    100000
  )
  ON CONFLICT (user_id) DO UPDATE SET
    msgf_access_role = 'COMPANY_ADMIN',
    company_id = NULL,
    billing_license_type = COALESCE(public.p4_profiles.billing_license_type, 'lifetime'),
    current_credits = GREATEST(public.p4_profiles.current_credits, 100000),
    updated_at = now();

  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'msgf_access_role', 'COMPANY_ADMIN',
        'role', 'COMPANY_ADMIN'
      ),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'msgf_access_role', 'COMPANY_ADMIN',
        'persona', 'individual_admin',
        'platform', 'gatedai'
      )
  WHERE id = v_user_id;
END $$;
