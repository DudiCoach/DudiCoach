-- Migration: harden handle_new_user EXECUTE grants (Lane C forward-fix).
-- Scope: least-privilege ACL for the auth signup trigger function only.
-- public.handle_new_user() is a SECURITY DEFINER trigger helper owned by
-- postgres and fired by the on_auth_user_created trigger on auth.users
-- (table owned by supabase_auth_admin). It must never be directly callable
-- by client roles, yet Supabase default function grants expose EXECUTE to
-- PUBLIC (inherited by anon/authenticated) and service_role.
--
-- Target ACL:
--   PUBLIC/anon/authenticated/authenticator/service_role: no EXECUTE
--   supabase_auth_admin: EXECUTE (internal trigger-execution path)
-- Function body, owner, search_path, and the trigger itself are unchanged.
--
-- Rollback: forward-fix only. If an internal role regresses, grant EXECUTE
-- to that proven internal role explicitly; never re-grant clients/PUBLIC.

begin;

-- Bound catalog-lock waits; grant changes are fast metadata operations.
set local lock_timeout = '10s';

-- Fail fast without leaking data when run out of order or on drift.
do $$
begin
  if to_regprocedure('public.handle_new_user()') is null then
    raise exception 'Required function public.handle_new_user() is missing';
  end if;

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
    raise exception 'Required trigger auth.users.on_auth_user_created is missing or disabled';
  end if;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
revoke all on function public.handle_new_user() from authenticator;
revoke all on function public.handle_new_user() from service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- Assert the intended end-state.
do $$
begin
  -- No client or PUBLIC execute path.
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
    raise exception 'Grant hardening failed: client/PUBLIC EXECUTE on public.handle_new_user()';
  end if;

  -- Internal trigger-execution path preserved.
  if not has_function_privilege(
    'supabase_auth_admin', 'public.handle_new_user()', 'execute'
  ) then
    raise exception 'Grant hardening failed: supabase_auth_admin lost EXECUTE on public.handle_new_user()';
  end if;

  -- Function attributes unchanged: SECURITY DEFINER, owner postgres,
  -- hardened search_path. The trigger engine runs it as the owner.
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
    raise exception 'Grant hardening failed: handle_new_user attributes altered';
  end if;

  -- Trigger still present and enabled.
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
    raise exception 'Grant hardening failed: on_auth_user_created trigger missing or disabled';
  end if;
end;
$$;

commit;
