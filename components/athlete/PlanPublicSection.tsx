"use client";

import { useState } from "react";
import { pl } from "@/lib/i18n/pl";
import type { PublicTrainingPlan } from "@/lib/types/plan-public";
import type { SessionFeedback } from "@/lib/data/session-feedback";
import PlanHeader from "@/components/coach/PlanHeader";
import WeekNavigation from "@/components/coach/WeekNavigation";
import WeekViewWithFeedback from "./WeekViewWithFeedback";
import PlanFooter from "@/components/coach/PlanFooter";

interface PlanPublicSectionProps {
  plan: PublicTrainingPlan | null;
  shareCode: string;
  initialFeedback?: SessionFeedback[];
}

/**
 * Read-only plan viewer for the public athlete panel.
 * Renders the most recent training plan passed from the server component.
 * Shows an empty state when no plan exists yet.
 * Includes feedback functionality per US-014.
 */
export default function PlanPublicSection({
  plan,
  shareCode,
  initialFeedback = [],
}: PlanPublicSectionProps) {
  const [activeWeek, setActiveWeek] = useState(1);
  const [feedback, setFeedback] = useState<SessionFeedback[]>(initialFeedback);

  if (!plan) {
    return (
      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="text-foreground mb-2 text-lg font-semibold">
          {pl.athletePanel.plan.sectionTitle}
        </h2>
        <p className="text-muted-foreground text-sm">
          {pl.athletePanel.plan.empty}
        </p>
      </section>
    );
  }

  const week = plan.plan_json.weeks.find((w) => w.weekNumber === activeWeek);

  const handleFeedbackUpdate = (updatedFeedback: SessionFeedback) => {
    setFeedback((prev) => {
      const existing = prev.find(
        (f) =>
          f.plan_id === updatedFeedback.plan_id &&
          f.week_number === updatedFeedback.week_number &&
          f.day_number === updatedFeedback.day_number,
      );

      if (existing) {
        return prev.map((f) =>
          f.id === updatedFeedback.id ? updatedFeedback : f,
        );
      } else {
        return [...prev, updatedFeedback];
      }
    });
  };

  return (
    <section className="space-y-5">
      <div className="rounded-card border border-border bg-card p-5">
        <PlanHeader plan={plan} />
        <p className="text-muted-foreground mt-3 text-xs">
          {pl.athletePanel.plan.generatedOn}:{" "}
          {new Date(plan.created_at).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
      <WeekNavigation activeWeek={activeWeek} onWeekChange={setActiveWeek} />
      {week && (
        <WeekViewWithFeedback
          week={week}
          planId={plan.id}
          shareCode={shareCode}
          feedback={feedback}
          onFeedbackUpdate={handleFeedbackUpdate}
        />
      )}
      <PlanFooter plan={plan.plan_json} />
    </section>
  );
}
