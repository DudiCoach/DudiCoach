-- Auth trigger security assertions for public.handle_new_user().
-- Runs on any replayed DB (clean or upgraded) AFTER the fixtures are seeded.
-- Fails hard (ON_ERROR_STOP + raised exceptions) when an assertion is false.
-- The functional signup smoke runs in an explicit transaction rolled back
-- afterwards, so it leaves no rows behind.

set client_min_messages to warning;

do $$
begin
  -- 1. No client or PUBLIC EXECUTE on the SECURITY DEFINER trigger helper.
  if has_function_privilege(
    'public', 'public.handle_new_user()', 'execute'
  ) or has_function_privilege(
    'anon', 'public.handle_new_user()', 'execute'
  ) or has_function_privilege(
    'authenticated', 'public.handle_new_user()', 'execute'
  ) or has_function_privilege(
    'authenticator', 'public.handle_new_user()', 'execute'
  ) or has_function_privilege(
    'service_role', 'public.handle_new_user()', 'execute'
  ) then
    raise exception 'AUTH-ASSERT 1 FAIL: client/PUBLIC EXECUTE on public.handle_new_user()';
  end if;

  -- 2. Internal trigger-execution path preserved.
  if not has_function_privilege(
    'supabase_auth_admin', 'public.handle_new_user()', 'execute'
  ) then
    raise exception 'AUTH-ASSERT 2 FAIL: supabase_auth_admin lost EXECUTE on public.handle_new_user()';
  end if;

  -- 3. Function attributes unchanged.
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'handle_new_user'
      and p.prorettype = 'trigger'::regtype
      and p.prosecdef
      and p.proowner = 'postgres'::regrole
      and p.proconfig = array['search_path=public']
  ) then
    raise exception 'AUTH-ASSERT 3 FAIL: handle_new_user attributes altered';
  end if;

  -- 4. Trigger still present and enabled.
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = 'on_auth_user_created'
      and t.tgenabled <> 'D'
      and not t.tgisinternal
  ) then
    raise exception 'AUTH-ASSERT 4 FAIL: on_auth_user_created trigger missing or disabled';
  end if;
end;
$$;

-- 5. Functional smoke: inserting auth.users still auto-creates the profile.
-- Explicit transaction + rollback: no rows survive this gate.
begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'trigger-smoke@auth-test.local',
  crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  now(), now(), '', '', '', ''
);

do $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000002'
      and display_name = 'trigger-smoke'
  ) then
    raise exception 'AUTH-ASSERT 5 FAIL: signup trigger did not create the profile row';
  end if;
end;
$$;

rollback;
