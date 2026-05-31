"use client";

import { pl } from "@/lib/i18n/pl";
import type { Week } from "@/lib/validation/training-plan";
import type { SessionFeedback } from "@/lib/data/session-feedback";
import DayCardWithFeedback from "./DayCardWithFeedback";

interface WeekViewWithFeedbackProps {
  week: Week;
  planId: string;
  shareCode: string;
  feedback: SessionFeedback[];
  onFeedbackUpdate: (feedback: SessionFeedback) => void;
}

/**
 * Renders all days of the selected week with feedback functionality.
 * Shows the week's "focus" header, then a stack of expandable DayCards
 * with feedback forms and displays.
 */
export default function WeekViewWithFeedback({
  week,
  planId,
  shareCode,
  feedback,
  onFeedbackUpdate,
}: WeekViewWithFeedbackProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
          {pl.coach.athlete.plans.viewer.focus}
        </p>
        <p className="text-foreground text-sm leading-relaxed">{week.focus}</p>
      </div>

      <div className="space-y-3">
        {week.days.map((day) => {
          const dayFeedback = feedback.find(
            (f) =>
              f.week_number === week.weekNumber &&
              f.day_number === day.dayNumber,
          );

          return (
            <DayCardWithFeedback
              key={day.dayNumber}
              day={day}
              weekNumber={week.weekNumber}
              planId={planId}
              shareCode={shareCode}
              feedback={dayFeedback}
              onFeedbackUpdate={onFeedbackUpdate}
            />
          );
        })}
      </div>
    </div>
  );
}
