-- US-022 Structured Session Outcomes: RPC v2 + shared public write limiter.
-- Scope: additive RPCs, shared rate limiting for v1/v2 public writes, and
-- coach read ACL alignment with the existing RLS SELECT policy.
-- Lane C. Design: docs/design/US-022-structured-session-outcomes.md.

begin;

-- Coach route reads plan_session_feedback directly as authenticated. Keep anon
-- table access closed; allow only coach SELECT guarded by the existing RLS policy.
revoke all on table public.plan_session_feedback from public;
revoke all on table public.plan_session_feedback from anon;
revoke all on table public.plan_session_feedback from authenticated;
grant select on table public.plan_session_feedback to authenticated;

create table if not exists public.plan_session_feedback_write_limits (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  window_started_at timestamptz not null,
  write_count integer not null,
  updated_at timestamptz not null default now(),
  constraint plan_session_feedback_write_limits_count_check
    check (write_count between 1 and 20)
);

alter table public.plan_session_feedback_write_limits enable row level security;
revoke all on table public.plan_session_feedback_write_limits from public;
revoke all on table public.plan_session_feedback_write_limits from anon;
revoke all on table public.plan_session_feedback_write_limits from authenticated;

create or replace function public.consume_plan_session_feedback_write_limit(
  p_athlete_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_now timestamptz := pg_catalog.now();
  v_window interval := interval '10 minutes';
  v_retry_after integer;
begin
  if p_athlete_id is null then
    raise exception 'athlete_id is required'
      using errcode = '22023';
  end if;

  insert into public.plan_session_feedback_write_limits as rl (
    athlete_id,
    window_started_at,
    write_count,
    updated_at
  )
  values (p_athlete_id, v_now, 1, v_now)
  on conflict (athlete_id)
  do update
    set window_started_at = case
          when rl.window_started_at <= v_now - v_window then v_now
          else rl.window_started_at
        end,
        write_count = case
          when rl.window_started_at <= v_now - v_window then 1
          else rl.write_count + 1
        end,
        updated_at = v_now
    where rl.window_started_at <= v_now - v_window
       or rl.write_count < 20;

  if found then
    return;
  end if;

  select greatest(
    1,
    ceiling(extract(epoch from (rl.window_started_at + v_window - v_now)))::integer
  )
  into v_retry_after
  from public.plan_session_feedback_write_limits rl
  where rl.athlete_id = p_athlete_id;

  raise exception 'Feedback write rate limit exceeded'
    using errcode = 'PT429', hint = coalesce(v_retry_after, 600)::text;
end;
$$;

revoke all on function public.consume_plan_session_feedback_write_limit(uuid) from public;
revoke all on function public.consume_plan_session_feedback_write_limit(uuid) from anon;
revoke all on function public.consume_plan_session_feedback_write_limit(uuid) from authenticated;
revoke all on function public.consume_plan_session_feedback_write_limit(uuid) from authenticator;
revoke all on function public.consume_plan_session_feedback_write_limit(uuid) from service_role;

-- Preserve the v1 signature and return shape; add only the shared limiter.
create or replace function public.upsert_plan_session_feedback(
  p_code char(6),
  p_plan_id uuid,
  p_week_number integer,
  p_day_number integer,
  p_feedback_text text
)
returns table (
  id uuid,
  plan_id uuid,
  athlete_id uuid,
  week_number smallint,
  day_number smallint,
  feedback_text text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete_id uuid;
  v_feedback_text text;
begin
  if p_week_number is null or p_week_number < 1 or p_week_number > 4 then
    raise exception 'Invalid week number'
      using errcode = '22023';
  end if;

  if p_day_number is null or p_day_number < 1 or p_day_number > 7 then
    raise exception 'Invalid day number'
      using errcode = '22023';
  end if;

  -- Strip control chars except TAB (0x09) and LF (0x0A), then trim.
  v_feedback_text := btrim(
    regexp_replace(
      coalesce(p_feedback_text, ''),
      E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]',
      '',
      'g'
    )
  );

  if length(v_feedback_text) < 1 then
    raise exception 'Feedback cannot be empty'
      using errcode = '22023';
  end if;

  if length(v_feedback_text) > 2000 then
    raise exception 'Feedback too long'
      using errcode = '22023';
  end if;

  select a.id
  into v_athlete_id
  from public.athletes a
  join public.training_plans tp
    on tp.athlete_id = a.id
   and tp.id = p_plan_id
  where a.share_code = upper(p_code)
    and a.share_active = true;

  -- Keep "not found/not authorized" behavior sanitized: return no rows.
  if v_athlete_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.training_plans tp
    cross join lateral jsonb_array_elements(tp.plan_json -> 'weeks') as w
    cross join lateral jsonb_array_elements(w -> 'days') as d
    where tp.id = p_plan_id
      and tp.athlete_id = v_athlete_id
      and (w ->> 'weekNumber')::integer = p_week_number
      and (d ->> 'dayNumber')::integer = p_day_number
  ) then
    raise exception 'Week/day does not exist in plan'
      using errcode = '22023';
  end if;

  perform public.consume_plan_session_feedback_write_limit(v_athlete_id);

  return query
  insert into public.plan_session_feedback as psf (
    plan_id,
    athlete_id,
    week_number,
    day_number,
    feedback_text
  )
  values (
    p_plan_id,
    v_athlete_id,
    p_week_number::smallint,
    p_day_number::smallint,
    v_feedback_text
  )
  on conflict on constraint plan_session_feedback_plan_id_week_number_day_number_key
  do update
    set athlete_id = excluded.athlete_id,
        feedback_text = excluded.feedback_text,
        updated_at = now()
  returning
    psf.id,
    psf.plan_id,
    psf.athlete_id,
    psf.week_number,
    psf.day_number,
    psf.feedback_text,
    psf.created_at,
    psf.updated_at;
end;
$$;

create or replace function public.upsert_plan_session_feedback_v2(
  p_code char(6),
  p_plan_id uuid,
  p_week_number integer,
  p_day_number integer,
  p_session_date date,
  p_session_status text,
  p_wellbeing integer,
  p_pain_score integer,
  p_session_rpe integer default null,
  p_pain_location text default null,
  p_pain_side text default null,
  p_feedback_text text default null
)
returns table (
  id uuid,
  plan_id uuid,
  athlete_id uuid,
  week_number smallint,
  day_number smallint,
  feedback_text text,
  session_date date,
  session_status text,
  session_rpe smallint,
  wellbeing smallint,
  pain_score smallint,
  pain_location text,
  pain_side text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_athlete_id uuid;
  v_feedback_text text;
begin
  if p_week_number is null or p_week_number < 1 or p_week_number > 4 then
    raise exception 'Invalid week number'
      using errcode = '22023';
  end if;

  if p_day_number is null or p_day_number < 1 or p_day_number > 7 then
    raise exception 'Invalid day number'
      using errcode = '22023';
  end if;

  if p_session_date is null then
    raise exception 'session_date is required'
      using errcode = '22023';
  end if;

  if p_session_date > (pg_catalog.now() at time zone 'Europe/Warsaw')::date then
    raise exception 'session_date cannot be in the future'
      using errcode = '22023';
  end if;

  if p_session_status is null
     or p_session_status not in ('completed', 'partial', 'skipped') then
    raise exception 'Invalid session_status'
      using errcode = '22023';
  end if;

  if p_wellbeing is null or p_wellbeing < 1 or p_wellbeing > 5 then
    raise exception 'wellbeing must be between 1 and 5'
      using errcode = '22023';
  end if;

  if p_pain_score is null or p_pain_score < 0 or p_pain_score > 10 then
    raise exception 'pain_score must be between 0 and 10'
      using errcode = '22023';
  end if;

  if p_session_status in ('completed', 'partial') then
    if p_session_rpe is null or p_session_rpe < 1 or p_session_rpe > 10 then
      raise exception 'session_rpe must be between 1 and 10'
        using errcode = '22023';
    end if;
  elsif p_session_rpe is not null then
    raise exception 'session_rpe must be null when session_status is skipped'
      using errcode = '22023';
  end if;

  if p_pain_location is not null
     and p_pain_location not in (
       'head',
       'neck',
       'shoulder',
       'chest_ribs',
       'abdomen',
       'upper_back',
       'lower_back',
       'pelvis_sacrum',
       'arm',
       'elbow',
       'wrist_hand',
       'hip_groin',
       'buttock',
       'thigh',
       'knee',
       'lower_leg',
       'ankle_achilles',
       'foot',
       'other'
     ) then
    raise exception 'Invalid pain_location'
      using errcode = '22023';
  end if;

  if p_pain_side is not null
     and p_pain_side not in ('left', 'right', 'bilateral', 'central') then
    raise exception 'Invalid pain_side'
      using errcode = '22023';
  end if;

  if p_pain_side is not null and p_pain_location is null then
    raise exception 'pain_side requires pain_location'
      using errcode = '22023';
  end if;

  if p_pain_score = 0 and (p_pain_location is not null or p_pain_side is not null) then
    raise exception 'pain_score 0 requires no pain location/side'
      using errcode = '22023';
  end if;

  if p_feedback_text is null then
    v_feedback_text := null;
  else
    -- Strip all C0 control chars except TAB (0x09) and LF (0x0A), then trim.
    v_feedback_text := btrim(
      regexp_replace(
        p_feedback_text,
        E'[\\x00-\\x08\\x0B-\\x1F]',
        '',
        'g'
      )
    );

    if length(v_feedback_text) < 1 then
      raise exception 'Feedback cannot be empty when provided'
        using errcode = '22023';
    end if;

    if length(v_feedback_text) > 2000 then
      raise exception 'Feedback too long'
        using errcode = '22023';
    end if;
  end if;

  select a.id
  into v_athlete_id
  from public.athletes a
  join public.training_plans tp
    on tp.athlete_id = a.id
   and tp.id = p_plan_id
  where a.share_code = pg_catalog.upper(p_code)
    and a.share_active = true;

  if v_athlete_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.training_plans tp
    cross join lateral pg_catalog.jsonb_array_elements(tp.plan_json -> 'weeks') as w
    cross join lateral pg_catalog.jsonb_array_elements(w -> 'days') as d
    where tp.id = p_plan_id
      and tp.athlete_id = v_athlete_id
      and (w ->> 'weekNumber')::integer = p_week_number
      and (d ->> 'dayNumber')::integer = p_day_number
  ) then
    raise exception 'Week/day does not exist in plan'
      using errcode = '22023';
  end if;

  perform public.consume_plan_session_feedback_write_limit(v_athlete_id);

  return query
  insert into public.plan_session_feedback as psf (
    plan_id,
    athlete_id,
    week_number,
    day_number,
    feedback_text,
    session_date,
    session_status,
    session_rpe,
    wellbeing,
    pain_score,
    pain_location,
    pain_side
  )
  values (
    p_plan_id,
    v_athlete_id,
    p_week_number::smallint,
    p_day_number::smallint,
    v_feedback_text,
    p_session_date,
    p_session_status,
    p_session_rpe::smallint,
    p_wellbeing::smallint,
    p_pain_score::smallint,
    p_pain_location,
    p_pain_side
  )
  on conflict on constraint plan_session_feedback_plan_id_week_number_day_number_key
  do update
    set athlete_id = excluded.athlete_id,
        feedback_text = excluded.feedback_text,
        session_date = excluded.session_date,
        session_status = excluded.session_status,
        session_rpe = excluded.session_rpe,
        wellbeing = excluded.wellbeing,
        pain_score = excluded.pain_score,
        pain_location = excluded.pain_location,
        pain_side = excluded.pain_side,
        updated_at = now()
  returning
    psf.id,
    psf.plan_id,
    psf.athlete_id,
    psf.week_number,
    psf.day_number,
    psf.feedback_text,
    psf.session_date,
    psf.session_status,
    psf.session_rpe,
    psf.wellbeing,
    psf.pain_score,
    psf.pain_location,
    psf.pain_side,
    psf.created_at,
    psf.updated_at;
end;
$$;

create or replace function public.get_plan_session_feedback_by_share_code_v2(
  p_code char(6),
  p_plan_id uuid,
  p_week_number integer,
  p_day_number integer
)
returns table (
  id uuid,
  plan_id uuid,
  athlete_id uuid,
  week_number smallint,
  day_number smallint,
  feedback_text text,
  session_date date,
  session_status text,
  session_rpe smallint,
  wellbeing smallint,
  pain_score smallint,
  pain_location text,
  pain_side text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_athlete_id uuid;
begin
  if p_week_number is null or p_week_number < 1 or p_week_number > 4 then
    raise exception 'Invalid week number'
      using errcode = '22023';
  end if;

  if p_day_number is null or p_day_number < 1 or p_day_number > 7 then
    raise exception 'Invalid day number'
      using errcode = '22023';
  end if;

  select a.id
  into v_athlete_id
  from public.athletes a
  join public.training_plans tp
    on tp.athlete_id = a.id
   and tp.id = p_plan_id
  where a.share_code = pg_catalog.upper(p_code)
    and a.share_active = true;

  if v_athlete_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.training_plans tp
    cross join lateral pg_catalog.jsonb_array_elements(tp.plan_json -> 'weeks') as w
    cross join lateral pg_catalog.jsonb_array_elements(w -> 'days') as d
    where tp.id = p_plan_id
      and tp.athlete_id = v_athlete_id
      and (w ->> 'weekNumber')::integer = p_week_number
      and (d ->> 'dayNumber')::integer = p_day_number
  ) then
    raise exception 'Week/day does not exist in plan'
      using errcode = '22023';
  end if;

  return query
  select
    psf.id,
    psf.plan_id,
    psf.athlete_id,
    psf.week_number,
    psf.day_number,
    psf.feedback_text,
    psf.session_date,
    psf.session_status,
    psf.session_rpe,
    psf.wellbeing,
    psf.pain_score,
    psf.pain_location,
    psf.pain_side,
    psf.created_at,
    psf.updated_at
  from public.plan_session_feedback psf
  where psf.plan_id = p_plan_id
    and psf.athlete_id = v_athlete_id
    and psf.week_number = p_week_number::smallint
    and psf.day_number = p_day_number::smallint
  limit 1;
end;
$$;

revoke all on function public.upsert_plan_session_feedback_v2(
  char,
  uuid,
  integer,
  integer,
  date,
  text,
  integer,
  integer,
  integer,
  text,
  text,
  text
) from public, anon, authenticated, authenticator, service_role;
grant execute on function public.upsert_plan_session_feedback_v2(
  char,
  uuid,
  integer,
  integer,
  date,
  text,
  integer,
  integer,
  integer,
  text,
  text,
  text
) to anon, authenticated;

revoke all on function public.get_plan_session_feedback_by_share_code_v2(
  char,
  uuid,
  integer,
  integer
) from public, anon, authenticated, authenticator, service_role;
grant execute on function public.get_plan_session_feedback_by_share_code_v2(
  char,
  uuid,
  integer,
  integer
) to anon, authenticated;

revoke all on function public.upsert_plan_session_feedback(
  char,
  uuid,
  integer,
  integer,
  text
) from public, anon, authenticated;
grant execute on function public.upsert_plan_session_feedback(
  char,
  uuid,
  integer,
  integer,
  text
) to anon, authenticated;

comment on table public.plan_session_feedback_write_limits is
  'Per-athlete public feedback write quota for share-code RPC paths. Stores no share code or health payload.';
comment on function public.consume_plan_session_feedback_write_limit(uuid) is
  'Consumes one public feedback write for an athlete; raises PT429 with Retry-After seconds in HINT when exhausted.';
comment on function public.upsert_plan_session_feedback_v2(
  char,
  uuid,
  integer,
  integer,
  date,
  text,
  integer,
  integer,
  integer,
  text,
  text,
  text
) is
  'Upserts structured athlete session outcome feedback for one concrete plan day. Access gated by active share_code and plan ownership.';
comment on function public.get_plan_session_feedback_by_share_code_v2(
  char,
  uuid,
  integer,
  integer
) is
  'Returns one structured feedback row for a concrete plan day via active share_code. Returns zero rows when no feedback exists.';

do $$
begin
  if to_regprocedure(
    'public.upsert_plan_session_feedback(character,uuid,integer,integer,text)'
  ) is null then
    raise exception 'US-022 post-check failed: v1 upsert RPC missing';
  end if;

  if to_regprocedure(
    'public.upsert_plan_session_feedback_v2(character,uuid,integer,integer,date,text,integer,integer,integer,text,text,text)'
  ) is null then
    raise exception 'US-022 post-check failed: v2 upsert RPC missing';
  end if;

  if to_regprocedure(
    'public.get_plan_session_feedback_by_share_code_v2(character,uuid,integer,integer)'
  ) is null then
    raise exception 'US-022 post-check failed: v2 read RPC missing';
  end if;

  if has_function_privilege(
    'public',
    'public.upsert_plan_session_feedback_v2(character,uuid,integer,integer,date,text,integer,integer,integer,text,text,text)',
    'execute'
  ) or has_function_privilege(
    'public',
    'public.get_plan_session_feedback_by_share_code_v2(character,uuid,integer,integer)',
    'execute'
  ) then
    raise exception 'US-022 post-check failed: v2 RPC executable by PUBLIC';
  end if;

  if not has_function_privilege(
    'anon',
    'public.upsert_plan_session_feedback_v2(character,uuid,integer,integer,date,text,integer,integer,integer,text,text,text)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.upsert_plan_session_feedback_v2(character,uuid,integer,integer,date,text,integer,integer,integer,text,text,text)',
    'execute'
  ) or not has_function_privilege(
    'anon',
    'public.get_plan_session_feedback_by_share_code_v2(character,uuid,integer,integer)',
    'execute'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_plan_session_feedback_by_share_code_v2(character,uuid,integer,integer)',
    'execute'
  ) then
    raise exception 'US-022 post-check failed: v2 RPC ACL regression';
  end if;
end;
$$;

commit;
