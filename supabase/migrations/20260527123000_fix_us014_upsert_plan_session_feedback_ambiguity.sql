-- Migration: Fix US-014 upsert_plan_session_feedback ambiguity (42702)
-- Scope: replace only public.upsert_plan_session_feedback(...) to remove
-- ambiguous ON CONFLICT target against RETURNS TABLE output variables.

begin;

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

commit;