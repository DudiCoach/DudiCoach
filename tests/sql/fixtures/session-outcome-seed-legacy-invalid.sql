-- One legacy feedback row that is VALID under the legacy constraint
-- (length 1..2000) but INVALID under the new POSIX-whitespace trim rule.
-- The outcome schema migration pre-check must reject this row.

set client_min_messages to warning;

insert into public.plan_session_feedback (
  id, plan_id, athlete_id, week_number, day_number, feedback_text
)
values (
  'f0000000-0000-0000-0000-000000000099',
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  1, 4, '   '
);