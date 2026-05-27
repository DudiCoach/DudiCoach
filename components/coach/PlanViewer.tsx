"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { TrainingPlan } from "@/lib/api/plans";
import {
  fetchCoachPlanFeedback,
  planFeedbackKeys,
} from "@/lib/api/plan-feedback";
import { pl } from "@/lib/i18n/pl";
import PlanHeader from "./PlanHeader";
import WeekNavigation from "./WeekNavigation";
import WeekView from "./WeekView";
import PlanFooter from "./PlanFooter";
import CoachDayFeedbackDisplay from "./CoachDayFeedbackDisplay";

interface PlanViewerProps {
  plan: TrainingPlan;
}

/**
 * Renders a single training plan: header, week navigation, week view, footer.
 * Manages the active week selection (default: week 1).
 *
 * Resets to week 1 implicitly when a different plan is selected — handled by
 * React unmounting/remounting via the parent's `key={plan.id}` prop.
 */
export default function PlanViewer({ plan }: PlanViewerProps) {
  const [activeWeek, setActiveWeek] = useState(1);
  const feedbackQuery = useQuery({
    queryKey: planFeedbackKeys.coachPlan(plan.athlete_id, plan.id),
    queryFn: () => fetchCoachPlanFeedback({ athleteId: plan.athlete_id, planId: plan.id }),
  });

  const week = plan.plan_json.weeks.find((w) => w.weekNumber === activeWeek);
  const feedbackByDayKey = useMemo(
    () =>
      new Map(
        (feedbackQuery.data ?? []).map((row) => [
          `${row.week_number}-${row.day_number}`,
          row,
        ]),
      ),
    [feedbackQuery.data],
  );

  return (
    <div className="space-y-5">
      <div className="bg-card border-border rounded-card border p-5">
        <PlanHeader plan={plan} />
      </div>

      <WeekNavigation activeWeek={activeWeek} onWeekChange={setActiveWeek} />

      {feedbackQuery.isError && (
        <p
          role="alert"
          className="rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {pl.coach.athlete.plans.feedback.loadError}
        </p>
      )}

      {feedbackQuery.isSuccess && (feedbackQuery.data?.length ?? 0) === 0 && (
        <p className="rounded-card border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {pl.coach.athlete.plans.feedback.empty}
        </p>
      )}

      {week && (
        <WeekView
          week={week}
          renderDayFooter={(day) => {
            const key = `${week.weekNumber}-${day.dayNumber}`;
            return (
              <CoachDayFeedbackDisplay
                feedback={feedbackByDayKey.get(key) ?? null}
              />
            );
          }}
        />
      )}

      <PlanFooter plan={plan.plan_json} />
    </div>
  );
}
