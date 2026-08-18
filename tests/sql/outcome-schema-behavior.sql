-- Constraint/trigger behavior matrix for the athlete session outcome schema.
-- Runs on any replayed DB (clean or upgraded) AFTER fixtures are seeded.
-- Every case records pass/fail into a temp table; the final block fails the
-- run when any case did not pass.

set client_min_messages to warning;

create temp table outcome_result (name text primary key, status text not null default 'fail');

-- ---------- Accepted cases ----------

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000001';
  v_athlete uuid := 'a0000000-0000-0000-0000-000000000001';
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
begin
  -- A1: complete outcome without feedback text.
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
  values (v_plan, v_athlete, 4, 1, v_today, 'completed', 1, 1, 0);
  insert into outcome_result values ('a1_complete_without_text', 'pass');

  -- A2: complete outcome with feedback text and full pain detail.
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_location, pain_side, feedback_text)
  values (v_plan, v_athlete, 4, 2, v_today, 'completed', 10, 5, 8, 'knee', 'left', 'tough session');
  insert into outcome_result values ('a2_complete_with_text', 'pass');

  -- A3: skipped outcome (rpe must be NULL).
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
  values (v_plan, v_athlete, 4, 3, v_today, 'skipped', null, 3, 2);
  insert into outcome_result values ('a3_skipped_rpe_null', 'pass');

  -- A4: partial status valid with rpe present.
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
  values (v_plan, v_athlete, 4, 4, v_today, 'partial', 5, 2, 1);
  insert into outcome_result values ('a4_partial_rpe', 'pass');

  -- A5: trimmed length-1 feedback on a text-only row (no outcome).
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, feedback_text)
  values (v_plan, v_athlete, 4, 5, ' a ');
  insert into outcome_result values ('a5_trimmed_length_1', 'pass');

  -- A6: trimmed 2000-character boundary with surrounding padding.
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, feedback_text)
  values (v_plan, v_athlete, 4, 6, ' ' || repeat('a', 2000));
  insert into outcome_result values ('a6_trimmed_2000', 'pass');

  -- A7: every pain_location key accepted (pain > 0), one row reused.
  declare
    v_keys text[] := array[
      'head','neck','shoulder','chest_ribs','abdomen','upper_back','lower_back',
      'pelvis_sacrum','arm','elbow','wrist_hand','hip_groin','buttock','thigh',
      'knee','lower_leg','ankle_achilles','foot','other'
    ];
    v_key text;
    v_n integer := 0;
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_location)
    values (v_plan, v_athlete, 4, 7, v_today, 'completed', 1, 1, 1, 'other');
    foreach v_key in array v_keys loop
      update public.plan_session_feedback
      set pain_location = v_key, pain_score = 1
      where plan_id = v_plan and week_number = 4 and day_number = 7;
      v_n := v_n + 1;
    end loop;
    insert into outcome_result values ('a7_pain_location_keys_' || v_n::text, 'pass');
  end;

  -- A8: every pain_side key accepted (pain > 0, with location), one row reused.
  declare
    v_sides text[] := array['left', 'right', 'bilateral', 'central'];
    v_side text;
    v_n integer := 0;
  begin
    foreach v_side in array v_sides loop
      update public.plan_session_feedback
      set pain_side = v_side, pain_location = 'knee', pain_score = 1
      where plan_id = v_plan and week_number = 4 and day_number = 7;
      v_n := v_n + 1;
    end loop;
    insert into outcome_result values ('a8_pain_side_keys_' || v_n::text, 'pass');
  end;

  -- A9: pain zero with no location/side; pain > 0 with location only.
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
  values (v_plan, v_athlete, 3, 2, v_today, 'completed', 1, 1, 0);
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_location)
  values (v_plan, v_athlete, 3, 3, v_today, 'completed', 1, 1, 1, 'lower_back');
  insert into outcome_result values ('a9_pain_zero_and_location_only', 'pass');

  -- A10: session_date today accepted (insert and update).
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
  values (v_plan, v_athlete, 3, 4, v_today, 'completed', 1, 1, 0);
  update public.plan_session_feedback
  set session_date = v_today
  where plan_id = v_plan and week_number = 3 and day_number = 4;
  insert into outcome_result values ('a10_session_date_today', 'pass');

  -- A11: pain_score = 10 accepted (upper boundary) with location and side.
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_location, pain_side)
  values (v_plan, v_athlete, 3, 5, v_today, 'completed', 10, 1, 10, 'lower_back', 'central');
  insert into outcome_result values ('a11_pain_score_10', 'pass');
end;
$$;

-- ---------- Deterministic timezone boundary (design §10) ----------
-- The trigger computes its reference date as (now() at time zone
-- 'Europe/Warsaw')::date. A wrongly UTC- or session-based trigger cannot be
-- discriminated behaviorally at every wall-clock time (the calendars only
-- differ inside the daily overlap window), so the deterministic checks are:
--   1. structural: the helper's source text pins the Europe/Warsaw zone;
--   2. behavioral under a UTC session: the Warsaw-today date is accepted and
--      Warsaw-tomorrow is rejected, proving session-timezone independence
--      (a session-dependent trigger would reject Warsaw-today during the
--      overlap window, and a UTC-based one would reject it differently).
-- Both runs always pass for the correct trigger in every calendar state.
set timezone to 'UTC';

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000001';
  v_athlete uuid := 'a0000000-0000-0000-0000-000000000001';
  v_warsaw_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_def text;
begin
  select pg_get_functiondef(
    'public.enforce_plan_session_feedback_session_date_not_future()'::regprocedure
  ) into v_def;

  if v_def not ilike '%at time zone ''Europe/Warsaw''%' then
    raise exception 'A11 FAIL: date trigger does not use the Europe/Warsaw zone: %', v_def;
  end if;
  insert into outcome_result values ('a11_trigger_uses_europe_warsaw', 'pass');

  -- A12: Warsaw-today accepted under a UTC session.
  insert into public.plan_session_feedback
    (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
  values (v_plan, v_athlete, 3, 6, v_warsaw_today, 'completed', 1, 1, 0);
  insert into outcome_result values ('a12_utc_session_warsaw_today_accepted', 'pass');

  -- A13: Warsaw-tomorrow rejected under a UTC session.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
    values (v_plan, v_athlete, 3, 7, v_warsaw_today + 1, 'completed', 1, 1, 0);
    insert into outcome_result values ('a13_utc_session_warsaw_tomorrow_rejected', 'unexpectedly accepted');
  exception when invalid_parameter_value then
    insert into outcome_result values ('a13_utc_session_warsaw_tomorrow_rejected', 'pass');
  end;
end;
$$;

set timezone to default;

-- ---------- Rejected cases ----------

do $$
declare
  v_plan uuid := 'e0000000-0000-0000-0000-000000000001';
  v_athlete uuid := 'a0000000-0000-0000-0000-000000000001';
  v_today date := (now() at time zone 'Europe/Warsaw')::date;
  v_tomorrow date := v_today + 1;
begin
  -- R1: whitespace-only feedback (spaces).
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, feedback_text)
    values (v_plan, v_athlete, 2, 1, v_today, 'completed', 1, 1, 1, '   ');
    insert into outcome_result values ('r1_whitespace_only', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r1_whitespace_only', 'pass');
  end;

  -- R2: whitespace-only feedback variants (TAB / LF / CR / mixed).
  declare
    v_ws text[] := array[E'\t', E'\n', E'\r', E' \t\r\n '];
    v_w text;
    v_i integer := 0;
  begin
    foreach v_w in array v_ws loop
      v_i := v_i + 1;
      begin
        insert into public.plan_session_feedback
          (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, feedback_text)
        values (v_plan, v_athlete, 2, 2, v_today, 'completed', 1, 1, 1, v_w);
        insert into outcome_result values ('r2_ws_' || v_i::text, 'unexpectedly accepted');
      exception when check_violation then
        insert into outcome_result values ('r2_ws_' || v_i::text, 'pass');
      end;
    end loop;
  end;

  -- R3: feedback longer than 2000 after trim.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, feedback_text)
    values (v_plan, v_athlete, 2, 3, repeat('a', 2001));
    insert into outcome_result values ('r3_trimmed_2001', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r3_trimmed_2001', 'pass');
  end;

  -- R4: partial outcome — status only.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_status)
    values (v_plan, v_athlete, 2, 4, 'completed');
    insert into outcome_result values ('r4_status_only', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r4_status_only', 'pass');
  end;

  -- R5: partial outcome — status + date, missing wellbeing.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status)
    values (v_plan, v_athlete, 2, 5, v_today, 'completed');
    insert into outcome_result values ('r5_missing_wellbeing', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r5_missing_wellbeing', 'pass');
  end;

  -- R6: partial outcome — completed without rpe.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
    values (v_plan, v_athlete, 2, 6, v_today, 'completed', null, 1, 1);
    insert into outcome_result values ('r6_completed_no_rpe', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r6_completed_no_rpe', 'pass');
  end;

  -- R7: skipped WITH rpe.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
    values (v_plan, v_athlete, 2, 7, v_today, 'skipped', 1, 1, 1);
    insert into outcome_result values ('r7_skipped_with_rpe', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r7_skipped_with_rpe', 'pass');
  end;

  -- R8: rpe out of range (0 and 11).
  declare
    v_rpe_values integer[] := array[0, 11];
    v_r integer;
  begin
    foreach v_r in array v_rpe_values loop
      begin
        insert into public.plan_session_feedback
          (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
        values (v_plan, v_athlete, 2, 7, v_today, 'completed', v_r, 1, 1);
        insert into outcome_result values ('r8_rpe_' || v_r::text, 'unexpectedly accepted');
      exception when check_violation then
        insert into outcome_result values ('r8_rpe_' || v_r::text, 'pass');
      end;
    end loop;
  end;

  -- R9: wellbeing out of range (0 and 6).
  declare
    v_wb integer[] := array[0, 6];
    v_w integer;
  begin
    foreach v_w in array v_wb loop
      begin
        insert into public.plan_session_feedback
          (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
        values (v_plan, v_athlete, 2, 7, v_today, 'completed', 1, v_w, 1);
        insert into outcome_result values ('r9_wellbeing_' || v_w::text, 'unexpectedly accepted');
      exception when check_violation then
        insert into outcome_result values ('r9_wellbeing_' || v_w::text, 'pass');
      end;
    end loop;
  end;

  -- R10: pain_score out of range (-1 and 11).
  declare
    v_ps integer[] := array[-1, 11];
    v_p integer;
  begin
    foreach v_p in array v_ps loop
      begin
        insert into public.plan_session_feedback
          (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
        values (v_plan, v_athlete, 2, 7, v_today, 'completed', 1, 1, v_p);
        insert into outcome_result values ('r10_pain_score_' || v_p::text, 'unexpectedly accepted');
      exception when check_violation then
        insert into outcome_result values ('r10_pain_score_' || v_p::text, 'pass');
      end;
    end loop;
  end;

  -- R11: invalid session_status.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
    values (v_plan, v_athlete, 2, 7, v_today, 'done', 1, 1, 1);
    insert into outcome_result values ('r11_invalid_status', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r11_invalid_status', 'pass');
  end;

  -- R12: invalid pain_location and pain_side keys.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_location)
    values (v_plan, v_athlete, 2, 7, v_today, 'completed', 1, 1, 1, 'knee2');
    insert into outcome_result values ('r12_invalid_location', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r12_invalid_location', 'pass');
  end;

  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_location, pain_side)
    values (v_plan, v_athlete, 2, 7, v_today, 'completed', 1, 1, 1, 'knee', 'sideways');
    insert into outcome_result values ('r12_invalid_side', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r12_invalid_side', 'pass');
  end;

  -- R13: pain_side without pain_location.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_side)
    values (v_plan, v_athlete, 2, 7, v_today, 'completed', 1, 1, 1, 'left');
    insert into outcome_result values ('r13_side_without_location', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r13_side_without_location', 'pass');
  end;

  -- R14: pain_location/side while pain_score = 0.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_location)
    values (v_plan, v_athlete, 2, 7, v_today, 'completed', 1, 1, 0, 'knee');
    insert into outcome_result values ('r14_location_with_pain_zero', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r14_location_with_pain_zero', 'pass');
  end;

  -- R15: future session_date rejected by trigger (insert and update).
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
    values (v_plan, v_athlete, 2, 7, v_tomorrow, 'completed', 1, 1, 1);
    insert into outcome_result values ('r15_future_date_insert', 'unexpectedly accepted');
  exception when invalid_parameter_value then
    insert into outcome_result values ('r15_future_date_insert', 'pass');
  end;

  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
    values (v_plan, v_athlete, 2, 7, v_today, 'completed', 1, 1, 1);
    update public.plan_session_feedback
    set session_date = v_tomorrow
    where plan_id = v_plan and week_number = 2 and day_number = 7;
    insert into outcome_result values ('r15_future_date_update', 'unexpectedly accepted');
  exception when invalid_parameter_value then
    insert into outcome_result values ('r15_future_date_update', 'pass');
  end;

  -- R16: duplicate (plan, week, day) rejected.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, feedback_text)
    values (v_plan, v_athlete, 1, 1, 'duplicate');
    insert into outcome_result values ('r16_unique_per_session', 'unexpectedly accepted');
  exception when unique_violation then
    insert into outcome_result values ('r16_unique_per_session', 'pass');
  end;

  -- R17: partial outcome accompanied by otherwise-valid text.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_status, feedback_text)
    values (v_plan, v_athlete, 2, 7, 'completed', 'valid looking text');
    insert into outcome_result values ('r17_partial_with_text', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r17_partial_with_text', 'pass');
  end;

  -- R18: outcome with status but without session_date.
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_status, session_rpe, wellbeing, pain_score)
    values (v_plan, v_athlete, 2, 7, 'completed', 1, 1, 1);
    insert into outcome_result values ('r18_status_without_date', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r18_status_without_date', 'pass');
  end;

  -- R19: pain_side while pain_score = 0 (location NULL).
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score, pain_side)
    values (v_plan, v_athlete, 2, 7, v_today, 'completed', 1, 1, 0, 'left');
    insert into outcome_result values ('r19_side_with_pain_zero', 'unexpectedly accepted');
  exception when check_violation then
    insert into outcome_result values ('r19_side_with_pain_zero', 'pass');
  end;
end;
$$;

-- Final verdict: any non-pass case fails the run.
do $$
declare
  v_failures text;
begin
  select string_agg(name || ': ' || status, E'\n')
  into v_failures
  from outcome_result
  where status <> 'pass';

  if v_failures is not null then
    raise exception 'BEHAVIOR TESTS FAILED:%', E'\n' || v_failures;
  end if;
end;
$$;

drop table outcome_result;