"use client";

import { pl } from "@/lib/i18n/pl";
import type { SessionFeedback } from "@/lib/data/session-feedback";

interface FeedbackDisplayProps {
  feedback?: SessionFeedback | null;
  isCoach?: boolean;
}

/**
 * Displays feedback for a specific training day.
 * Follows US-014 acceptance criteria:
 * - Plain text rendering (no dangerouslySetInnerHTML)
 * - Line breaks via whitespace-pre-wrap
 * - React escaping handles <script> tags safely
 */
export default function FeedbackDisplay({
  feedback,
  isCoach = false,
}: FeedbackDisplayProps) {
  if (!feedback) {
    return null;
  }

  return (
    <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/30">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {isCoach
            ? pl.coach.athlete.plans.viewer.athleteFeedback
            : pl.athletePanel.feedback.yourFeedback}
        </span>
        <span className="text-muted-foreground text-xs">
          {new Date(feedback.updated_at).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-foreground whitespace-pre-wrap text-sm">
        {feedback.feedback_text}
      </p>
    </div>
  );
}
