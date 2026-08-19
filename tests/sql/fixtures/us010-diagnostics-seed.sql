-- US-010 diagnostics SQL test fixtures (local Supabase stack only).
-- Adds a second coach + athlete used by the cross-coach RLS gates.
-- Runs AFTER session-outcome-seed.sql (coach A = c0000...0001, athlete A = a0000...0001).

set client_min_messages to warning;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000003',
  'authenticated', 'authenticated', 'coach-b@outcome-test.local',
  crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

insert into public.athletes (
  id, coach_id, name, share_code, share_active
)
values (
  'a0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000003',
  'Diagnostics Gate Athlete B', 'CDEFGH', true
);