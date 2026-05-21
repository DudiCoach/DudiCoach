---
id: US-014
title: Athlete text feedback per plan session/day
role: zawodnik
priority: P1
estimate: M
status: Ready
lane: C
dependencies: [US-004, US-005, US-025, US-026]
epic: EPIC-C
design_required: true
design_doc: docs/design/US-014-plan-session-feedback-design.md
created: 2026-05-21
updated: 2026-05-21
sprint: Backlog-v1.1
---

# US-014 - Athlete text feedback per plan session/day

## User story

Jako zawodnik,
chce dodac lub zaktualizowac krotka informacje zwrotna dla konkretnego dnia sesji treningowej,
aby trener widzial postepy i trudnosci dokladnie w kontekscie danego dnia planu.

Jako trener,
chce widziec ten feedback przy odpowiednim dniu planu,
aby szybciej korygowac kolejne decyzje treningowe.

## Acceptance criteria (MVP)

1. Feedback zapisuje sie per `plan_id + week_number + day_number`.
2. Zawodnik przez publiczny flow moze dodac i edytowac text feedback dla istniejacego dnia planu.
3. Trener widzi feedback dla tego dnia w istniejacym widoku tygodniowym.
4. Feedback dla nieistniejacego dnia (week/day spoza planu) jest odrzucany.
5. Walidacja dlugosci dziala w obu warstwach:
   - DB check: `length(feedback_text) between 1 and 2000`
   - zod validation: min 1, max 2000
6. Sanitisation serwerowa:
   - trim
   - reject all-whitespace
   - opcjonalne usuwanie control chars (`\x00-\x1F` bez `\n` i `\t`)
7. UI renderuje plain text:
   - bez `dangerouslySetInnerHTML`
   - React escaping
   - line breaks przez `whitespace-pre-wrap`
8. Test UI potwierdza, ze `<script>` jest pokazany jako tekst escaped.
9. RPC i granty sa zgodne z least privilege:
   - SECURITY DEFINER
   - `set search_path = public`
   - revoke from `public`
   - grant execute tylko do wymaganych rol
10. Share-code normalisation (`upper(p_code)`) dziala w obu nowych RPC.

## Out of scope (this story)

- Audio/video feedback.
- Exercise-level feedback.
- Exercise library.
- AI prompt/worker changes.
- Weekly UI redesign.
- Video storage implementation.

## Technical notes

- Uzyj nowej tabeli `plan_session_feedback` z denormalized `athlete_id`.
- Wymus `athlete_id` consistency trigger/check:
  `athlete_id = training_plans.athlete_id` dla `plan_id`.
- Publiczny write/read przez nowe RPC:
  - `upsert_plan_session_feedback(...)`
  - `get_plan_session_feedback_by_share_code(...)`
- Nie zapisuj feedbacku w `training_plans.plan_json`.
- Zachowaj kompatybilnosc pod przyszle `exercise_id` i metadata video URI (object storage/CDN).

## Security notes

- Lane C: wymagane G7.
- Brak bezposredniego anon write do tabeli.
- Public write tylko przez SECURITY DEFINER RPC z aktywnym share code gate.
- Nie logowac `feedback_text`, share code, tokenow, cookies, JWT.

## Test expectations

- Integration:
  - valid upsert
  - invalid/inactive share code denied
  - non-existent day denied
  - cross-athlete misuse denied
  - length/sanitisation behavior
- SQL/RPC:
  - function grants matrix
  - SECURITY DEFINER + search_path
  - trigger consistency (athlete_id vs plan_id)
- UI:
  - escaped script rendering
  - line-break rendering
  - athlete submit/edit + coach visibility

## Required gates

- G2 architecture/design approval (done: approved with modifications M1-M9).
- G7 security review mandatory before merge.
- G9 runtime smoke mandatory before closeout.

## Delivery split

- PR1: backend Lane C (migration + RPC + routes + tests).
- PR2: UI feedback input/display + UI tests.
