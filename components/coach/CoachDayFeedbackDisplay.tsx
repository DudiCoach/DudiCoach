"use client";

import { pl } from "@/lib/i18n/pl";
import type { PlanSessionFeedbackRow } from "@/lib/api/plan-feedback";

interface CoachDayFeedbackDisplayProps {
  feedback: PlanSessionFeedbackRow | null;
}

/**
 * Read-only athlete feedback display for one plan day/session on coach view.
 * Plain-text rendering only (React escaping + whitespace-pre-wrap).
 */
export default function CoachDayFeedbackDisplay({
  feedback,
}: CoachDayFeedbackDisplayProps) {
  if (!feedback) return null;

  const updatedAt = new Date(feedback.updated_at).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="mt-4 rounded-input border border-border bg-input/40 p-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {pl.coach.athlete.plans.feedback.label}
      </p>
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">
        {feedback.feedback_text}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {pl.coach.athlete.plans.feedback.updatedAt}: {updatedAt}
      </p>
    </section>
  );
}
