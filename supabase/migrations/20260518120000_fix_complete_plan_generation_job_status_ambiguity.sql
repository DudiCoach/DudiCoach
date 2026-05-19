-- Migration: Fix ambiguous status reference in complete_plan_generation_job (US-026)
-- Issue: PostgreSQL 42702 "column reference \"status\" is ambiguous"
-- Scope: function body only (no schema/RLS/grants changes)

begin;

create or replace function public.complete_plan_generation_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_plan_name text,
  p_phase text,
  p_plan_json jsonb
)
returns table (
  job_id uuid,
  plan_id uuid,
  status public.plan_generation_job_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.plan_generation_jobs%rowtype;
  v_plan_id uuid;
begin
  select *
  into v_job
  from public.plan_generation_jobs j
  where j.id = p_job_id
    and j.claim_token = p_claim_token
    and j.status = 'processing'
    and j.claim_expires_at is not null
    and j.claim_expires_at >= now()
  for update;

  if not found then
    return;
  end if;

  insert into public.training_plans (
    athlete_id,
    plan_name,
    phase,
    plan_json
  )
  values (
    v_job.athlete_id,
    p_plan_name,
    p_phase,
    p_plan_json
  )
  returning id into v_plan_id;

  update public.plan_generation_jobs
  set
    status = 'succeeded',
    plan_id = v_plan_id,
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    completed_at = now(),
    error_code = null,
    error_message = null,
    updated_at = now()
  where id = p_job_id;

  return query
  select
    j.id as job_id,
    j.plan_id,
    j.status
  from public.plan_generation_jobs j
  where j.id = p_job_id;
end;
$$;

commit;
