-- Valid legacy text-only feedback rows (pre-outcome-schema shape).
-- Covers: plain text, whitespace-padded text (valid under the new trimmed
-- rule), and the trimmed 2000-character boundary.

set client_min_messages to warning;

insert into public.plan_session_feedback (
  id, plan_id, athlete_id, week_number, day_number, feedback_text
)
values
  (
    'f0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    1, 1, 'First legacy feedback'
  ),
  (
    'f0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    1, 2, '  padded  legacy  feedback  '
  ),
  (
    'f0000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    1, 3, repeat('a', 2000)
  );