-- US-022 structured outcome RPC gates.
-- Runs after the base outcome schema tests. Uses isolated athlete/plan IDs so it
-- does not depend on or collide with US-014 rows.

set client_min_messages to warning;

create temp table us022_result (name text primary key, status text not null default 'fail');
grant select, insert, update on us022_result to anon, authenticated;

do $$
declare
  v_coach_b uuid := 'c0000000-0000-0000-0000-000000000099';
  v_athlete_b uuid := 'a0000000-0000-0000-0000-000000000099';
  v_plan_b uuid := 'e0000000-0000-0000-0000-000000000099';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_coach_b,
    'authenticated', 'authenticated', 'coach-b@us022.local',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

  insert into public.athletes (id, coach_id, name, share_code, share_active)
  values (v_athlete_b, v_coach_b, 'US-022 Athlete B', 'QRSTUV', true);

  insert into public.training_plans (id, athlete_id, plan_name, phase, plan_json)
  select v_plan_b, v_athlete_b, 'US-022 Plan B', phase, plan_json
  from public.training_plans
  where id = 'e0000000-0000-0000-0000-000000000001';

  insert into us022_result values ('seed_isolated_athlete_plan', 'pass');
end;
$$;

do $$
declare
  v_upsert regprocedure := 'public.upsert_plan_session_feedback_v2(character,uuid,integer,integer,date,text,integer,integer,integer,text,text,text)'::regprocedure;
  v_read regprocedure := 'public.get_plan_session_feedback_by_share_code_v2(character,uuid,integer,integer)'::regprocedure;
  v_helper regprocedure := 'public.consume_plan_session_feedback_write_limit(uuid)'::regprocedure;
begin
  if v_upsert is null or v_read is null or v_helper is null then
    raise exception 'US022-G1 FAIL: expected v2/helper RPC signature missing';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'upsert_plan_session_feedback_v2',
        'get_plan_session_feedback_by_share_code_v2',
        'consume_plan_session_feedback_write_limit'
      )
      and (not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog, pg_temp'])
  ) then
    raise exception 'US022-G1 FAIL: v2/helper RPC SECURITY DEFINER/search_path regression';
  end if;

  if has_function_privilege('public', v_upsert, 'execute')
     or has_function_privilege('public', v_read, 'execute')
     or has_function_privilege('public', v_helper, 'execute')
     or has_function_privilege('anon', v_helper, 'execute')
     or has_function_privilege('authenticated', v_helper, 'execute') then
    raise exception 'US022-G1 FAIL: unexpected PUBLIC/client helper or v2 execute';
  end if;

  if not has_function_privilege('anon', v_upsert, 'execute')
     or not has_function_privilege('authenticated', v_upsert, 'execute')
     or not has_function_privilege('anon', v_read, 'execute')
     or not has_function_privilege('authenticated', v_read, 'execute') then
    raise exception 'US022-G1 FAIL: expected anon/authenticated v2 execute missing';
  end if;

  insert into us022_result values ('g1_rpc_acl_search_path', 'pass');
end;
$$;

set role anon;

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000099';
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_id uuid;
  v_text text;
  v_status text;
  v_rows integer;
begin
  select t.id, t.feedback_text, t.session_status
  into v_id, v_text, v_status
  from public.upsert_plan_session_feedback_v2(
    'qrstuv', v_plan, 1, 1, v_today, 'completed', 5, 0, 7, null, null, null
  ) t;

  if v_id is null or v_text is not null or v_status <> 'completed' then
    raise exception 'US022-G2 FAIL: outcome-only upsert mismatch';
  end if;

  select t.feedback_text, t.session_status
  into v_text, v_status
  from public.get_plan_session_feedback_by_share_code_v2('QRSTUV', v_plan, 1, 1) t;

  if v_text is not null or v_status <> 'completed' then
    raise exception 'US022-G2 FAIL: v2 read mismatch';
  end if;

  select count(*) into v_rows
  from public.get_plan_session_feedback_by_share_code_v2('ZZZZZZ', v_plan, 1, 1);
  if v_rows <> 0 then
    raise exception 'US022-G2 FAIL: unknown share code returned rows';
  end if;

  insert into us022_result values ('g2_outcome_only_write_read', 'pass');
end;
$$;

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000099';
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_rpe integer;
  v_feedback text;
begin
  select t.session_rpe, t.feedback_text
  into v_rpe, v_feedback
  from public.upsert_plan_session_feedback_v2(
    'QRSTUV', v_plan, 1, 2, v_today, 'skipped', 3, 2, null, null, null, E'  ok\r\n  '
  ) t;

  if v_rpe is not null or v_feedback <> E'ok\n' then
    raise exception 'US022-G3 FAIL: skipped/sanitized feedback mismatch: rpe %, text %', v_rpe, v_feedback;
  end if;

  insert into us022_result values ('g3_skipped_and_sanitized_text', 'pass');
end;
$$;

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000099';
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  begin
    perform public.upsert_plan_session_feedback_v2(
      'QRSTUV', v_plan, 1, 3, v_today, 'completed', 5, 0, null, null, null, null
    );
    raise exception 'US022-G4 FAIL: completed without RPE accepted';
  exception when invalid_parameter_value then
    insert into us022_result values ('g4_completed_without_rpe_rejected', 'pass');
  end;

  begin
    perform public.upsert_plan_session_feedback_v2(
      'QRSTUV', v_plan, 1, 3, v_today, 'skipped', 5, 0, 1, null, null, null
    );
    raise exception 'US022-G5 FAIL: skipped with RPE accepted';
  exception when invalid_parameter_value then
    insert into us022_result values ('g5_skipped_with_rpe_rejected', 'pass');
  end;

  begin
    perform public.upsert_plan_session_feedback_v2(
      'QRSTUV', v_plan, 1, 3, v_today, 'completed', 5, 0, 7, 'knee', null, null
    );
    raise exception 'US022-G6 FAIL: pain=0 with location accepted';
  exception when invalid_parameter_value then
    insert into us022_result values ('g6_pain_zero_location_rejected', 'pass');
  end;
end;
$$;

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000099';
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  perform public.upsert_plan_session_feedback_v2(
    'QRSTUV', v_plan, 1, 4, v_today, 'partial', 4, 1, 6, 'knee', 'left', null
  );

  insert into us022_result values ('g7_pain_location_side_via_rpc', 'pass');
end;
$$;

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000099';
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_status text;
begin
  perform public.upsert_plan_session_feedback_v2(
    'QRSTUV', v_plan, 1, 5, v_today, 'completed', 4, 1, 6, null, null, null
  );

  perform public.upsert_plan_session_feedback('QRSTUV', v_plan, 1, 5, 'legacy edit after outcome');

  select t.session_status into v_status
  from public.get_plan_session_feedback_by_share_code_v2('QRSTUV', v_plan, 1, 5) t;

  if v_status <> 'completed' then
    raise exception 'US022-G8 FAIL: v1 edit cleared outcome';
  end if;

  insert into us022_result values ('g8_v1_preserves_existing_outcome', 'pass');
end;
$$;

reset role;
delete from public.plan_session_feedback_write_limits
where athlete_id = 'a0000000-0000-0000-0000-000000000099';
insert into public.plan_session_feedback_write_limits (
  athlete_id,
  window_started_at,
  write_count,
  updated_at
)
values (
  'a0000000-0000-0000-0000-000000000099',
  now(),
  20,
  now()
);
set role anon;

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000099';
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  begin
    perform public.upsert_plan_session_feedback_v2(
      'QRSTUV', v_plan, 1, 6, v_today, 'completed', 4, 0, 6, null, null, null
    );
    raise exception 'US022-G9 FAIL: over-limit write accepted';
  exception when others then
    if SQLSTATE = 'PT429' then
      insert into us022_result values ('g9_rate_limit_20_per_10_min', 'pass');
    else
      raise;
    end if;
  end;
end;
$$;

reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000099', false);
do $$
declare
  v_n integer;
begin
  select count(*) into v_n
  from public.plan_session_feedback
  where athlete_id = 'a0000000-0000-0000-0000-000000000099';

  if v_n = 0 then
    raise exception 'US022-G10 FAIL: owning coach cannot read own feedback rows';
  end if;

  begin
    insert into public.plan_session_feedback (plan_id, athlete_id, week_number, day_number, feedback_text)
    values ('e0000000-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000099', 2, 2, 'direct write');
    raise exception 'US022-G10 FAIL: authenticated direct insert accepted';
  exception when insufficient_privilege then
    null;
  end;

  insert into us022_result values ('g10_authenticated_select_only_rls_owner', 'pass');
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', false);
do $$
declare
  v_n integer;
begin
  select count(*) into v_n
  from public.plan_session_feedback
  where athlete_id = 'a0000000-0000-0000-0000-000000000099';

  if v_n <> 0 then
    raise exception 'US022-G11 FAIL: cross-coach read leaked rows: %', v_n;
  end if;

  insert into us022_result values ('g11_authenticated_select_only_rls_cross_coach', 'pass');
end;
$$;
reset role;

do $$
declare
  v_failures text;
begin
  select string_agg(name || '=' || status, ', ' order by name)
  into v_failures
  from us022_result
  where status <> 'pass';

  if v_failures is not null then
    raise exception 'US-022 outcome RPC gates failed: %', v_failures;
  end if;
end;
$$;
