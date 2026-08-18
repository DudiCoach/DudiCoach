-- Upgrade-replay assertions: 17-migration DB with legacy data upgraded by
-- the outcome schema migrations. Runs AFTER 20260727120000 + 20001 applied
-- via psql and after fixtures + security + behavior suites.

set client_min_messages to warning;

-- U1: every legacy text-only row survived, unchanged, without inferred outcome.
do $$
declare
  v_total integer;
  v_bad integer;
begin
  select count(*) into v_total
  from public.plan_session_feedback
  where id in (
    'f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000003'
  );

  if v_total <> 3 then
    raise exception 'UPGRADE-ASSERT U1 FAIL: expected 3 legacy rows, found %', v_total;
  end if;

  select count(*) into v_bad
  from public.plan_session_feedback
  where id in (
    'f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000003'
  )
  and (
    session_date is not null or session_status is not null or session_rpe is not null
    or wellbeing is not null or pain_score is not null or pain_location is not null
    or pain_side is not null
  );

  if v_bad <> 0 then
    raise exception 'UPGRADE-ASSERT U1 FAIL: % legacy row(s) have inferred outcome fields', v_bad;
  end if;
end;
$$;

-- U2: legacy text content is byte-identical.
do $$
declare
  v_text text;
begin
  select feedback_text into v_text
  from public.plan_session_feedback
  where id = 'f0000000-0000-0000-0000-000000000002';

  if v_text is distinct from '  padded  legacy  feedback  ' then
    raise exception 'UPGRADE-ASSERT U2 FAIL: legacy text altered';
  end if;
end;
$$;

-- U3: one-row-per-session uniqueness still enforced after the upgrade.
do $$
begin
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, feedback_text)
    values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, 1, 'dup');
    raise exception 'UPGRADE-ASSERT U3 FAIL: duplicate (plan, week, day) accepted';
  exception when unique_violation then
    null;
  end;
end;
$$;

-- U4: the date trigger is live on the upgraded schema.
do $$
begin
  begin
    insert into public.plan_session_feedback
      (plan_id, athlete_id, week_number, day_number, session_date, session_status, session_rpe, wellbeing, pain_score)
    values (
      'e0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000001',
      4, 7,
      (now() at time zone 'Europe/Warsaw')::date + 1,
      'completed', 1, 1, 1
    );
    raise exception 'UPGRADE-ASSERT U4 FAIL: future session_date accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

-- U5: every row satisfies the new trimmed-feedback rule post-validation.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.plan_session_feedback
  where feedback_text is not null
    and (
      feedback_text !~ '[^[:space:]]'
      or length(
        regexp_replace(feedback_text, '^[[:space:]]+|[[:space:]]+$', '', 'g')
      ) not between 1 and 2000
    );

  if v_bad <> 0 then
    raise exception 'UPGRADE-ASSERT U5 FAIL: % row(s) violate the trimmed feedback rule', v_bad;
  end if;
end;
$$;