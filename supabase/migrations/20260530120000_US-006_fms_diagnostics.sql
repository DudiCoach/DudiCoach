-- Migration: US-006 - FMS diagnostics table + RLS
-- Applied: 2026-05-30
-- Story: backlog/stories/US-006-fms-diagnostics.md

-- ---------------------------------------------------------------------------
-- Table: public.fms_diagnostics
-- ---------------------------------------------------------------------------

create table public.fms_diagnostics (
  id          uuid        primary key default gen_random_uuid(),
  athlete_id  uuid        not null references public.athletes(id) on delete cascade,
  coach_id    uuid        not null references auth.users(id) on delete cascade,
  region      text        not null check (region in ('upper', 'lower', 'foot')),
  side        text        not null check (side in ('left', 'right', 'center')),
  muscle      text        not null,
  severity    text        not null check (severity in ('weak', 'very_weak', 'dysfunction')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.fms_diagnostics is
  'FMS diagnostic findings per athlete, managed by the coach.';
comment on column public.fms_diagnostics.region is
  'Body region: upper, lower, or foot.';
comment on column public.fms_diagnostics.side is
  'Body side: left, right, or center (for midline structures).';
comment on column public.fms_diagnostics.muscle is
  'Muscle name in format "Polish (Latin)".';
comment on column public.fms_diagnostics.severity is
  'Severity level: weak, very_weak, or dysfunction.';

-- ---------------------------------------------------------------------------
-- Trigger: auto-touch updated_at on fms_diagnostics update
-- ---------------------------------------------------------------------------

create trigger fms_diagnostics_updated_at
  before update on public.fms_diagnostics
  for each row execute function extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_fms_diagnostics_athlete_id
  on public.fms_diagnostics (athlete_id);

create index idx_fms_diagnostics_athlete_region
  on public.fms_diagnostics (athlete_id, region);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.fms_diagnostics enable row level security;

create policy "fms_diagnostics_select_own"
  on public.fms_diagnostics
  for select
  to authenticated
  using (
    athlete_id in (
      select id from public.athletes where coach_id = auth.uid()
    )
  );

create policy "fms_diagnostics_insert_own"
  on public.fms_diagnostics
  for insert
  to authenticated
  with check (
    coach_id = auth.uid()
    and athlete_id in (
      select id from public.athletes where coach_id = auth.uid()
    )
  );

create policy "fms_diagnostics_update_own"
  on public.fms_diagnostics
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

create policy "fms_diagnostics_delete_own"
  on public.fms_diagnostics
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

alter publication supabase_realtime add table public.fms_diagnostics;
