-- Migration: US-007 - progressions table + RLS
-- Applied: 2026-05-30
-- Story: backlog/stories/US-007-progressions.md

-- ---------------------------------------------------------------------------
-- Table: public.progressions
-- ---------------------------------------------------------------------------

create table public.progressions (
  id            uuid        primary key default gen_random_uuid(),
  athlete_id    uuid        not null references public.athletes(id) on delete cascade,
  exercise_name text        not null,
  weight_kg     numeric(6,2) not null,
  reps          text,
  sets          text,
  note          text,
  source        text        not null default 'coach'
                          check (source in ('coach', 'athlete')),
  created_at    timestamptz not null default now()
);

comment on table public.progressions is
  'Exercise progression log per athlete.';
comment on column public.progressions.exercise_name is
  'Name of the exercise (e.g., Back Squat, Bench Press).';
comment on column public.progressions.weight_kg is
  'Weight used in kilograms.';
comment on column public.progressions.source is
  'Who logged this entry: coach or athlete.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_progressions_athlete_exercise
  on public.progressions (athlete_id, exercise_name);

create index idx_progressions_athlete_exercise_created
  on public.progressions (athlete_id, exercise_name, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.progressions enable row level security;

create policy "progressions_select_own"
  on public.progressions
  for select
  to authenticated
  using (
    athlete_id in (
      select id from public.athletes where coach_id = auth.uid()
    )
  );

create policy "progressions_insert_own"
  on public.progressions
  for insert
  to authenticated
  with check (
    athlete_id in (
      select id from public.athletes where coach_id = auth.uid()
    )
  );

create policy "progressions_update_own"
  on public.progressions
  for update
  to authenticated
  using (
    athlete_id in (
      select id from public.athletes where coach_id = auth.uid()
    )
  )
  with check (
    athlete_id in (
      select id from public.athletes where coach_id = auth.uid()
    )
  );

create policy "progressions_delete_own"
  on public.progressions
  for delete
  to authenticated
  using (
    athlete_id in (
      select id from public.athletes where coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.progressions;
