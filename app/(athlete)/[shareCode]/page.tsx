import { notFound } from "next/navigation";

import { getAthleteByShareCode } from "@/lib/data/athlete";
import { getInjuries } from "@/lib/data/injury";
import { getLatestPlanByShareCode } from "@/lib/data/training-plan";
import { getSessionFeedbackByPlan } from "@/lib/data/session-feedback";
import type { AthletePublic } from "@/lib/types/athlete-public";
import type { Injury } from "@/lib/api/injuries";
import type { PublicTrainingPlan } from "@/lib/types/plan-public";
import type { SessionFeedback } from "@/lib/data/session-feedback";
import AthletePanel from "@/components/athlete/AthletePanel";

// Next.js 16: dynamic params come as a Promise.
type PageProps = { params: Promise<{ shareCode: string }> };

const SHARE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

/**
 * Public athlete panel page. Validates the share code, fetches initial
 * profile via Firestore, then hands off to a client component
 * that subscribes to the realtime broadcast channel.
 *
 * Returns 404 (Next.js notFound) when the code is malformed, unused, or
 * the athlete's `share_active` flag is false.
 */
export default async function AthletePanelPage({ params }: PageProps) {
  const { shareCode } = await params;
  const normalized = shareCode.toUpperCase();

  if (!SHARE_CODE_REGEX.test(normalized)) {
    notFound();
  }

  // Fetch athlete by share code
  const athlete = await getAthleteByShareCode(normalized);

  if (!athlete || !athlete.share_active) {
    notFound();
  }

  // Fetch injuries, plan, and feedback in parallel
  const [injuries, plan] = await Promise.all([
    getInjuries(athlete.id),
    getLatestPlanByShareCode(normalized),
  ]);

  // Fetch feedback if plan exists
  let initialFeedback: SessionFeedback[] = [];
  if (plan) {
    initialFeedback = await getSessionFeedbackByPlan(athlete.id, plan.id);
  }

  // Filter to active injuries for public view
  const activeInjuries: Injury[] = injuries.filter(
    (injury) => injury.status === "active",
  );

  // Build public athlete data (exclude coach_id)
  const initialData: AthletePublic = {
    id: athlete.id,
    name: athlete.name,
    age: athlete.age ?? null,
    weight_kg: athlete.weight_kg ?? null,
    height_cm: athlete.height_cm ?? null,
    sport: athlete.sport ?? null,
    training_start_date: athlete.training_start_date ?? null,
    training_days_per_week: athlete.training_days_per_week ?? null,
    session_minutes: athlete.session_minutes ?? null,
    current_phase: athlete.current_phase ?? null,
    goal: athlete.goal ?? null,
    notes: athlete.notes ?? null,
    share_code: athlete.share_code,
    updated_at: athlete.updated_at,
  };

  // Convert to PublicTrainingPlan format
  const initialPlan: PublicTrainingPlan | null = plan
    ? {
        id: plan.id,
        plan_name: plan.plan_name,
        phase: plan.phase,
        plan_json: plan.plan_json,
        created_at: plan.created_at,
      }
    : null;

  return (
    <AthletePanel
      shareCode={normalized}
      initialData={initialData}
      initialInjuries={activeInjuries}
      initialPlan={initialPlan}
      initialFeedback={initialFeedback}
    />
  );
}
