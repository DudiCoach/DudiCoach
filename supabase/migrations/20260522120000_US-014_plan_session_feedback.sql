-- Migration: US-014 - plan session/day feedback (backend MVP)
-- Story: backlog/stories/US-014-plan-session-feedback.md
-- Design: docs/design/US-014-plan-session-feedback-design.md

begin;

-- ---------------------------------------------------------------------------
-- Table: public.plan_session_feedback
-- One feedback row per (plan_id, week_number, day_number).
-- ---------------------------------------------------------------------------

create table public.plan_session_feedback (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.training_plans(id) on delete cascade,
  athlete_id    uuid not null references public.athletes(id) on delete cascade,
  week_number   smallint not null check (week_number between 1 and 4),
  day_number    smallint not null check (day_number between 1 and 7),
  feedback_text text not null check (length(feedback_text) between 1 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(plan_id, week_number, day_number)
);

comment on table public.plan_session_feedback is
  'Athlete feedback bound to one concrete plan day (plan_id + week_number + day_number).';
comment on column public.plan_session_feedback.feedback_text is
  'Sanitized plain text feedback (trimmed, control chars removed except TAB/LF).';

-- Coach-side lookup helper index (unique constraint already covers plan/day lookup).
create index idx_plan_session_feedback_athlete_created
  on public.plan_session_feedback (athlete_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Consistency trigger: athlete_id must match training_plans.athlete_id for plan_id.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_plan_session_feedback_athlete_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_plan_athlete_id uuid;
begin
  select tp.athlete_id
  into v_plan_athlete_id
  from public.training_plans tp
  where tp.id = new.plan_id;

  if v_plan_athlete_id is null then
    raise exception 'Plan not found'
      using errcode = 'P0001';
  end if;

  if new.athlete_id is distinct from v_plan_athlete_id then
    raise exception 'athlete_id does not match plan owner'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger plan_session_feedback_enforce_athlete_consistency
  before insert or update of plan_id, athlete_id
  on public.plan_session_feedback
  for each row execute function public.enforce_plan_session_feedback_athlete_consistency();

-- Keep updated_at in sync with existing project pattern.
create trigger plan_session_feedback_updated_at
  before update on public.plan_session_feedback
  for each row execute function extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- RLS: coach read-only via ownership chain. No direct table writes for clients.
-- ---------------------------------------------------------------------------

alter table public.plan_session_feedback enable row level security;

create policy "plan_session_feedback_select_own"
  on public.plan_session_feedback
  for select
  to authenticated
  using (
    athlete_id in (
      select id from public.athletes where coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: upsert_plan_session_feedback
-- Public athlete write path by active share code.
-- ---------------------------------------------------------------------------

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
  insert into public.plan_session_feedback (
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
  on conflict (plan_id, week_number, day_number)
  do update
    set athlete_id = excluded.athlete_id,
        feedback_text = excluded.feedback_text,
        updated_at = now()
  returning
    plan_session_feedback.id,
    plan_session_feedback.plan_id,
    plan_session_feedback.athlete_id,
    plan_session_feedback.week_number,
    plan_session_feedback.day_number,
    plan_session_feedback.feedback_text,
    plan_session_feedback.created_at,
    plan_session_feedback.updated_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_plan_session_feedback_by_share_code
-- Public athlete read path by active share code.
-- ---------------------------------------------------------------------------

create or replace function public.get_plan_session_feedback_by_share_code(
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
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
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
  where a.share_code = upper(p_code)
    and a.share_active = true;

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
  select
    psf.id,
    psf.plan_id,
    psf.athlete_id,
    psf.week_number,
    psf.day_number,
    psf.feedback_text,
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

-- ---------------------------------------------------------------------------
-- Grants: no implicit PUBLIC surface. Explicit anon/authenticated execution.
-- ---------------------------------------------------------------------------

revoke all on function public.upsert_plan_session_feedback(char, uuid, integer, integer, text) from public;
revoke all on function public.upsert_plan_session_feedback(char, uuid, integer, integer, text) from anon;
revoke all on function public.upsert_plan_session_feedback(char, uuid, integer, integer, text) from authenticated;
grant execute on function public.upsert_plan_session_feedback(char, uuid, integer, integer, text) to anon;
grant execute on function public.upsert_plan_session_feedback(char, uuid, integer, integer, text) to authenticated;

revoke all on function public.get_plan_session_feedback_by_share_code(char, uuid, integer, integer) from public;
revoke all on function public.get_plan_session_feedback_by_share_code(char, uuid, integer, integer) from anon;
revoke all on function public.get_plan_session_feedback_by_share_code(char, uuid, integer, integer) from authenticated;
grant execute on function public.get_plan_session_feedback_by_share_code(char, uuid, integer, integer) to anon;
grant execute on function public.get_plan_session_feedback_by_share_code(char, uuid, integer, integer) to authenticated;

comment on function public.upsert_plan_session_feedback(char, uuid, integer, integer, text) is
  'Upserts athlete feedback for one concrete plan day. Access gated by active share_code and plan ownership.';
comment on function public.get_plan_session_feedback_by_share_code(char, uuid, integer, integer) is
  'Returns one feedback row for a concrete plan day via active share_code. Returns zero rows when no feedback exists.';

commit;
