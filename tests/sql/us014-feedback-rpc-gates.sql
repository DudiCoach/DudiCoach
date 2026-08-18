-- US-014 RPC gate tests for the public feedback path by share code.
-- Covers: inactive share code, non-existent week/day, cross-athlete plan
-- access, feedback normalization, idempotent upsert, read roundtrip.
-- Runs on any replayed DB (clean or upgraded) AFTER fixtures are seeded.
-- Same verdict pattern as outcome-schema-behavior.sql.

set client_min_messages to warning;

create temp table us014_result (name text primary key, status text not null default 'fail');

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000001';
  v_athlete uuid := 'a0000000-0000-0000-0000-000000000001';
  v_code char(6) := 'ABCDEF';
  v_other_athlete uuid;
  v_other_plan uuid;
  v_n integer;
  v_text text;
begin
  -- G1: happy-path upsert returns exactly one row with normalized text.
  select count(*) into v_n
  from public.upsert_plan_session_feedback(v_code, v_plan, 1, 1, 'Swietny trening');
  if v_n = 1 then
    insert into us014_result values ('g01_upsert_ok', 'pass');
  else
    insert into us014_result values ('g01_upsert_ok', 'rows=' || v_n);
  end if;

  -- G2: idempotent upsert keeps a single row and updates the text.
  select count(*) into v_n
  from public.upsert_plan_session_feedback(v_code, v_plan, 1, 1, 'Zaktualizowana opinia');
  if v_n = 1 then
    select count(*) into v_n
    from public.plan_session_feedback
    where plan_id = v_plan and week_number = 1 and day_number = 1
      and feedback_text = 'Zaktualizowana opinia';
    if v_n = 1 then
      insert into us014_result values ('g02_upsert_idempotent', 'pass');
    else
      insert into us014_result values ('g02_upsert_idempotent', 'text not updated');
    end if;
  else
    insert into us014_result values ('g02_upsert_idempotent', 'rows=' || v_n);
  end if;

  -- G3: read roundtrip via share code returns the stored row.
  select count(*) into v_n
  from public.get_plan_session_feedback_by_share_code(v_code, v_plan, 1, 1);
  if v_n = 1 then
    insert into us014_result values ('g03_get_roundtrip', 'pass');
  else
    insert into us014_result values ('g03_get_roundtrip', 'rows=' || v_n);
  end if;

  -- G4: no feedback yet for a concrete day -> zero rows, no exception.
  -- (1,7) is never written by any test suite in this repo.
  select count(*) into v_n
  from public.get_plan_session_feedback_by_share_code(v_code, v_plan, 1, 7);
  if v_n = 0 then
    insert into us014_result values ('g04_get_no_feedback_zero_rows', 'pass');
  else
    insert into us014_result values ('g04_get_no_feedback_zero_rows', 'rows=' || v_n);
  end if;

  -- G5: upsert with an INACTIVE share code -> zero rows (sanitized).
  update public.athletes set share_active = false where id = v_athlete;
  select count(*) into v_n
  from public.upsert_plan_session_feedback(v_code, v_plan, 2, 2, 'niedostepne');
  if v_n = 0 then
    insert into us014_result values ('g05_upsert_inactive_code_zero_rows', 'pass');
  else
    insert into us014_result values ('g05_upsert_inactive_code_zero_rows', 'rows=' || v_n);
  end if;

  -- G6: read with an INACTIVE share code -> zero rows (sanitized).
  select count(*) into v_n
  from public.get_plan_session_feedback_by_share_code(v_code, v_plan, 1, 1);
  if v_n = 0 then
    insert into us014_result values ('g06_get_inactive_code_zero_rows', 'pass');
  else
    insert into us014_result values ('g06_get_inactive_code_zero_rows', 'rows=' || v_n);
  end if;
  update public.athletes set share_active = true where id = v_athlete;

  -- Remove week 2 from the plan JSON so (2,1) is a valid week/day number
  -- that does not exist in the plan -> exercises the 'Week/day does not
  -- exist in plan' branch (valid codes 1-4 / days 1-7 always pass the
  -- numeric gates, so the existence check needs a missing JSON entry).
  update public.training_plans
  set plan_json = plan_json #- '{weeks,1}'
  where id = v_plan;

  -- G7: week/day not present in plan_json -> 22023 'Week/day does not exist in plan'.
  begin
    perform public.upsert_plan_session_feedback(v_code, v_plan, 2, 1, 'x');
    insert into us014_result values ('g07_upsert_nonexistent_day_22023', 'unexpectedly accepted');
  exception when sqlstate '22023' then
    if sqlerrm like '%Week/day does not exist in plan%' then
      insert into us014_result values ('g07_upsert_nonexistent_day_22023', 'pass');
    else
      insert into us014_result values ('g07_upsert_nonexistent_day_22023', 'wrong message: ' || sqlerrm);
    end if;
  end;

  -- G8: non-existent week -> 22023 'Invalid week number'.
  begin
    perform public.upsert_plan_session_feedback(v_code, v_plan, 5, 1, 'x');
    insert into us014_result values ('g08_upsert_nonexistent_week_22023', 'unexpectedly accepted');
  exception when sqlstate '22023' then
    if sqlerrm like '%Invalid week number%' then
      insert into us014_result values ('g08_upsert_nonexistent_week_22023', 'pass');
    else
      insert into us014_result values ('g08_upsert_nonexistent_week_22023', 'wrong message: ' || sqlerrm);
    end if;
  end;

  -- G9: invalid day number -> 22023 'Invalid day number'.
  begin
    perform public.upsert_plan_session_feedback(v_code, v_plan, 1, 0, 'x');
    insert into us014_result values ('g09_upsert_invalid_day_22023', 'unexpectedly accepted');
  exception when sqlstate '22023' then
    if sqlerrm like '%Invalid day number%' then
      insert into us014_result values ('g09_upsert_invalid_day_22023', 'pass');
    else
      insert into us014_result values ('g09_upsert_invalid_day_22023', 'wrong message: ' || sqlerrm);
    end if;
  end;

  -- G10: whitespace-only feedback -> 22023 'Feedback cannot be empty'.
  begin
    perform public.upsert_plan_session_feedback(v_code, v_plan, 2, 3, '   ');
    insert into us014_result values ('g10_upsert_empty_feedback_22023', 'unexpectedly accepted');
  exception when sqlstate '22023' then
    if sqlerrm like '%Feedback cannot be empty%' then
      insert into us014_result values ('g10_upsert_empty_feedback_22023', 'pass');
    else
      insert into us014_result values ('g10_upsert_empty_feedback_22023', 'wrong message: ' || sqlerrm);
    end if;
  end;

  -- G11: feedback over 2000 chars -> 22023 'Feedback too long'.
  begin
    perform public.upsert_plan_session_feedback(v_code, v_plan, 2, 4, repeat('a', 2001));
    insert into us014_result values ('g11_upsert_long_feedback_22023', 'unexpectedly accepted');
  exception when sqlstate '22023' then
    if sqlerrm like '%Feedback too long%' then
      insert into us014_result values ('g11_upsert_long_feedback_22023', 'pass');
    else
      insert into us014_result values ('g11_upsert_long_feedback_22023', 'wrong message: ' || sqlerrm);
    end if;
  end;

  -- G12: read path also rejects a missing week/day -> 22023.
  begin
    perform public.get_plan_session_feedback_by_share_code(v_code, v_plan, 2, 1);
    insert into us014_result values ('g12_get_nonexistent_day_22023', 'unexpectedly accepted');
  exception when sqlstate '22023' then
    if sqlerrm like '%Week/day does not exist in plan%' then
      insert into us014_result values ('g12_get_nonexistent_day_22023', 'pass');
    else
      insert into us014_result values ('g12_get_nonexistent_day_22023', 'wrong message: ' || sqlerrm);
    end if;
  end;

  -- G13: cross-athlete access - second athlete with its own active code/plan.
  insert into public.athletes (id, coach_id, name, share_code, share_active)
  values ('a0000000-0000-0000-0000-000000000002',
          'c0000000-0000-0000-0000-000000000001',
          'US-014 Other Athlete', 'GHIJKL', true)
  on conflict (id) do nothing;
  v_other_athlete := 'a0000000-0000-0000-0000-000000000002';
  insert into public.training_plans (id, athlete_id, plan_name, phase, plan_json)
  values ('e0000000-0000-0000-0000-000000000002', v_other_athlete,
          'Other Plan', 'building', '{"planName":"Other Plan","phase":"building","weeks":[]}'::jsonb)
  on conflict (id) do nothing;
  v_other_plan := 'e0000000-0000-0000-0000-000000000002';

  -- Athlete A's code with athlete B's plan -> zero rows.
  select count(*) into v_n
  from public.upsert_plan_session_feedback(v_code, v_other_plan, 1, 1, 'x');
  if v_n = 0 then
    insert into us014_result values ('g13_cross_athlete_upsert_zero_rows', 'pass');
  else
    insert into us014_result values ('g13_cross_athlete_upsert_zero_rows', 'rows=' || v_n);
  end if;

  -- G14: read with athlete A's code on athlete B's plan -> zero rows.
  select count(*) into v_n
  from public.get_plan_session_feedback_by_share_code(v_code, v_other_plan, 1, 1);
  if v_n = 0 then
    insert into us014_result values ('g14_cross_athlete_get_zero_rows', 'pass');
  else
    insert into us014_result values ('g14_cross_athlete_get_zero_rows', 'rows=' || v_n);
  end if;

  -- G15: feedback normalization strips control chars (except TAB/LF) and trims.
  select count(*) into v_n
  from public.upsert_plan_session_feedback(v_code, v_plan, 3, 5, E'  hi\x07 there  ');
  select feedback_text into v_text
  from public.plan_session_feedback
  where plan_id = v_plan and week_number = 3 and day_number = 5;
  if v_n = 1 and v_text = 'hi there' then
    insert into us014_result values ('g15_feedback_normalized', 'pass');
  else
    insert into us014_result values ('g15_feedback_normalized', 'text=' || coalesce(v_text, 'NULL'));
  end if;

  -- G16: upsert must not write rows for another athlete's plan via their code.
  select count(*) into v_n
  from public.upsert_plan_session_feedback('GHIJKL', v_plan, 1, 1, 'x');
  if v_n = 0 then
    insert into us014_result values ('g16_other_code_own_plan_zero_rows', 'pass');
  else
    insert into us014_result values ('g16_other_code_own_plan_zero_rows', 'rows=' || v_n);
  end if;
end;
$$;

-- Final verdict: any non-pass case fails the run.
do $$
declare
  v_failures text;
begin
  select string_agg(name || ': ' || status, E'\n')
  into v_failures
  from us014_result
  where status <> 'pass';

  if v_failures is not null then
    raise exception 'US-014 RPC GATE TESTS FAILED:%', E'\n' || v_failures;
  end if;
end;
$$;

drop table us014_result;