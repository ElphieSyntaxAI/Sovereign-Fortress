-- =============================================================================
-- @msgf-license-header
-- Proprietary and Confidential
-- Copyright (c) Elphie Syntax LLC. All Rights Reserved.
--
-- Unauthorized copying, distribution, publication, or reverse-engineering
-- is strictly prohibited without prior written consent from Elphie Syntax LLC.
--
-- Distribution Build ID: MSGF-fca2d532-20260923T201750Z-internal
-- =============================================================================
-- DealStar partner operator: GLOBAL_ADMIN for cross-tenant token savings / ops dashboard.
-- Also set MSGF_GLOBAL_ADMIN_EMAILS=jessica@dealstar.io on Cloud Run for belt-and-suspenders sign-in.

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
      'promote_jessica_dealstar_global_admin: % not in auth.users — sign up first, then re-run migrations or create:platform-admin',
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
    'GLOBAL_ADMIN',
    NULL,
    'lifetime',
    100000
  )
  ON CONFLICT (user_id) DO UPDATE SET
    msgf_access_role = 'GLOBAL_ADMIN',
    company_id = NULL,
    billing_license_type = COALESCE(public.p4_profiles.billing_license_type, 'lifetime'),
    current_credits = GREATEST(public.p4_profiles.current_credits, 100000),
    updated_at = now();

  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'msgf_access_role', 'GLOBAL_ADMIN',
        'role', 'GLOBAL_ADMIN'
      ),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'msgf_access_role', 'GLOBAL_ADMIN',
        'persona', 'global_admin',
        'platform', 'gatedai'
      )
  WHERE id = v_user_id;
END $$;
