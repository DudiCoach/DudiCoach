-- Athlete Session Outcome schema foundation (PR1A).
-- Scope: additive outcome columns, validation constraints, date trigger, index,
-- and column documentation. Existing RLS, policies, grants, and RPCs are not changed.

begin;

-- Fail fast without exposing feedback content or athlete data.
do $$
declare
  v_existing_outcome_columns integer;
  v_invalid_legacy_rows bigint;
begin
  if to_regclass('public.plan_session_feedback') is null then
    raise exception 'Required table public.plan_session_feedback is missing';
  end if;

  select count(*)
  into v_existing_outcome_columns
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'plan_session_feedback'
    and c.column_name in (
      'session_date',
      'session_status',
      'session_rpe',
      'wellbeing',
      'pain_score',
      'pain_location',
      'pain_side'
    );

  if v_existing_outcome_columns <> 0 then
    raise exception 'Outcome schema pre-check failed: % outcome column(s) already exist',
      v_existing_outcome_columns;
  end if;

  if not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'plan_session_feedback'
      and c.column_name = 'feedback_text'
      and c.data_type = 'text'
      and c.is_nullable = 'NO'
  ) then
    raise exception 'Expected non-null text feedback_text column is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.plan_session_feedback'::regclass
      and c.conname = 'plan_session_feedback_feedback_text_check'
      and c.contype = 'c'
  ) then
    raise exception 'Expected legacy feedback_text check constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.plan_session_feedback'::regclass
      and c.conname = 'plan_session_feedback_plan_id_week_number_day_number_key'
      and c.contype = 'u'
  ) then
    raise exception 'Expected plan/day unique constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.plan_session_feedback'::regclass
      and t.tgname = 'plan_session_feedback_enforce_athlete_consistency'
      and not t.tgisinternal
  ) then
    raise exception 'Expected athlete consistency trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.plan_session_feedback'::regclass
      and t.tgname = 'plan_session_feedback_updated_at'
      and not t.tgisinternal
  ) then
    raise exception 'Expected updated_at trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'plan_session_feedback'
      and c.relrowsecurity
  ) then
    raise exception 'Expected RLS-enabled plan_session_feedback table';
  end if;

  select count(*)
  into v_invalid_legacy_rows
  from public.plan_session_feedback psf
  where psf.feedback_text is null
    or psf.feedback_text !~ '[^[:space:]]'
    or length(
      regexp_replace(
        psf.feedback_text,
        '^[[:space:]]+|[[:space:]]+$',
        '',
        'g'
      )
    ) not between 1 and 2000;

  if v_invalid_legacy_rows <> 0 then
    raise exception 'Legacy feedback pre-check failed: % invalid row(s)',
      v_invalid_legacy_rows;
  end if;
end;
$$;

alter table public.plan_session_feedback
  add column session_date date,
  add column session_status text,
  add column session_rpe smallint,
  add column wellbeing smallint,
  add column pain_score smallint,
  add column pain_location text,
  add column pain_side text;

-- Constraint 1: outcome fields are all NULL, or form one complete outcome.
alter table public.plan_session_feedback
  add constraint plan_session_feedback_outcome_complete
  check (
    (
      session_date is null
      and session_status is null
      and session_rpe is null
      and wellbeing is null
      and pain_score is null
      and pain_location is null
      and pain_side is null
    )
    or
    (
      session_date is not null
      and session_status is not null
      and session_status in ('completed', 'partial', 'skipped')
      and wellbeing is not null
      and wellbeing between 1 and 5
      and pain_score is not null
      and pain_score between 0 and 10
      and (
        (
          session_status in ('completed', 'partial')
          and session_rpe is not null
          and session_rpe between 1 and 10
        )
        or (
          session_status = 'skipped'
          and session_rpe is null
        )
      )
      and (
        pain_location is null
        or pain_location in (
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
        )
      )
      and (
        pain_side is null
        or pain_side in ('left', 'right', 'bilateral', 'central')
      )
      and (pain_side is null or pain_location is not null)
      and (
        pain_score <> 0
        or (pain_location is null and pain_side is null)
      )
    )
  ) not valid;

-- Constraint 2: optional feedback is non-whitespace and 1-2000 chars after trim.
alter table public.plan_session_feedback
  add constraint plan_session_feedback_feedback_text_valid
  check (
    feedback_text is null
    or (
      feedback_text ~ '[^[:space:]]'
      and length(
        regexp_replace(
          feedback_text,
          '^[[:space:]]+|[[:space:]]+$',
          '',
          'g'
        )
      ) between 1 and 2000
    )
  ) not valid;

-- Constraint 3: each row has a complete outcome or non-empty feedback text.
-- Constraint 1 guarantees that non-NULL session_status implies completeness.
alter table public.plan_session_feedback
  add constraint plan_session_feedback_has_content
  check (
    session_status is not null
    or (
      feedback_text is not null
      and feedback_text ~ '[^[:space:]]'
    )
  ) not valid;

alter table public.plan_session_feedback
  validate constraint plan_session_feedback_outcome_complete;
alter table public.plan_session_feedback
  validate constraint plan_session_feedback_feedback_text_valid;
alter table public.plan_session_feedback
  validate constraint plan_session_feedback_has_content;

-- The validated replacement constraints are in place before relaxing legacy text.
alter table public.plan_session_feedback
  drop constraint plan_session_feedback_feedback_text_check,
  alter column feedback_text drop not null;

-- A trigger is used instead of a time-dependent CHECK constraint.
create function public.enforce_plan_session_feedback_session_date_not_future()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.session_date is not null
     and new.session_date > (now() at time zone 'Europe/Warsaw')::date then
    raise exception 'session_date cannot be in the future'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger plan_session_feedback_session_date_not_future
  before insert or update of session_date
  on public.plan_session_feedback
  for each row
  execute function public.enforce_plan_session_feedback_session_date_not_future();

create index idx_plan_session_feedback_athlete_session_date
  on public.plan_session_feedback (athlete_id, session_date desc)
  where session_date is not null;

comment on table public.plan_session_feedback is
  'Athlete feedback and optional structured outcome bound to one concrete plan day.';
comment on column public.plan_session_feedback.feedback_text is
  'Optional plain-text athlete feedback; non-whitespace and 1-2000 characters after full whitespace trim.';
comment on column public.plan_session_feedback.session_date is
  'Athlete-supplied local session date; required for structured outcomes, has no default, and cannot be later than the current Europe/Warsaw date.';
comment on column public.plan_session_feedback.session_status is
  'Structured outcome status: completed, partial, or skipped.';
comment on column public.plan_session_feedback.session_rpe is
  'Session RPE: 1 = very easy, 10 = maximum effort; required for completed/partial and NULL for skipped.';
comment on column public.plan_session_feedback.wellbeing is
  'Athlete wellbeing: 1 = very poor, 5 = very good; required for structured outcomes.';
comment on column public.plan_session_feedback.pain_score is
  'Athlete-reported pain: 0 = no pain, 10 = maximum perceived pain; required for structured outcomes.';
comment on column public.plan_session_feedback.pain_location is
  'Optional controlled pain location: head, neck, shoulder, chest_ribs, abdomen, upper_back, lower_back, pelvis_sacrum, arm, elbow, wrist_hand, hip_groin, buttock, thigh, knee, lower_leg, ankle_achilles, foot, or other; NULL when pain is zero.';
comment on column public.plan_session_feedback.pain_side is
  'Optional pain laterality: left, right, bilateral, or central; NULL means not provided/not applicable, and central means a midline location rather than unspecified.';
comment on function public.enforce_plan_session_feedback_session_date_not_future() is
  'Rejects future session_date values using the Europe/Warsaw calendar date.';

-- Assert the intended schema end-state without changing policies, grants, or RPCs.
do $$
declare
  v_nullable_outcome_columns integer;
  v_validated_constraints integer;
begin
  select count(*)
  into v_nullable_outcome_columns
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'plan_session_feedback'
    and c.column_name in (
      'session_date',
      'session_status',
      'session_rpe',
      'wellbeing',
      'pain_score',
      'pain_location',
      'pain_side'
    )
    and c.is_nullable = 'YES'
    and c.column_default is null;

  if v_nullable_outcome_columns <> 7 then
    raise exception 'Outcome schema post-check failed: expected 7 nullable columns without defaults, found %',
      v_nullable_outcome_columns;
  end if;

  select count(*)
  into v_validated_constraints
  from pg_constraint c
  where c.conrelid = 'public.plan_session_feedback'::regclass
    and c.conname in (
      'plan_session_feedback_outcome_complete',
      'plan_session_feedback_feedback_text_valid',
      'plan_session_feedback_has_content'
    )
    and c.contype = 'c'
    and c.convalidated;

  if v_validated_constraints <> 3 then
    raise exception 'Outcome schema post-check failed: expected 3 validated constraints, found %',
      v_validated_constraints;
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.plan_session_feedback'::regclass
      and t.tgname = 'plan_session_feedback_session_date_not_future'
      and t.tgenabled <> 'D'
      and not t.tgisinternal
  ) then
    raise exception 'Outcome schema post-check failed: date trigger missing or disabled';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'plan_session_feedback'
      and c.relrowsecurity
  ) then
    raise exception 'Outcome schema post-check failed: RLS is not enabled';
  end if;

  if to_regprocedure(
    'public.upsert_plan_session_feedback(character,uuid,integer,integer,text)'
  ) is null then
    raise exception 'Outcome schema post-check failed: upsert RPC signature changed';
  end if;

  if to_regprocedure(
    'public.get_plan_session_feedback_by_share_code(character,uuid,integer,integer)'
  ) is null then
    raise exception 'Outcome schema post-check failed: read RPC signature changed';
  end if;
end;
$$;

commit;