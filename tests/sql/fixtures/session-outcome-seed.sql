-- Session outcome SQL test fixtures (local Supabase stack only).
-- Fixed UUIDs/values shared by every assertion file in tests/sql/.

set client_min_messages to warning;

-- Coach identity (auth.users + profiles).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'coach@outcome-test.local',
  crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

-- Profile row is created automatically by the on_auth_user_created trigger.

-- Athlete with active share code.
insert into public.athletes (
  id, coach_id, name, share_code, share_active
)
values (
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'Outcome Test Athlete', 'ABCDEF', true
);

-- One valid 4-week plan (plan_json has no DB-level shape constraint; the
-- week/day numbers must exist for the upsert RPC week/day gate).
do $$
declare
  v_plan jsonb := '{"planName":"Outcome Test Plan","phase":"building","weeks":[]}'::jsonb;
  v_days jsonb;
  v_w integer;
  v_d integer;
begin
  for v_w in 1..4 loop
    v_days := '[]'::jsonb;
    for v_d in 1..7 loop
      v_days := v_days || jsonb_build_object(
        'dayNumber', v_d,
        'dayName', 'Day ' || v_d,
        'focus', 'Test focus',
        'exercises', '[]'::jsonb
      );
    end loop;
    v_plan := jsonb_set(
      v_plan,
      '{weeks}',
      (v_plan -> 'weeks') || jsonb_build_object('weekNumber', v_w, 'days', v_days)
    );
  end loop;

  insert into public.training_plans (id, athlete_id, plan_name, phase, plan_json)
  values (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Outcome Test Plan', 'building', v_plan
  );
end;
$$;