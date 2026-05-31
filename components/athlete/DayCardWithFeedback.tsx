"use client";

import { useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { cn } from "@/lib/utils";
import type { Day } from "@/lib/validation/training-plan";
import type { SessionFeedback } from "@/lib/data/session-feedback";
import ExerciseRow from "@/components/coach/ExerciseRow";
import FeedbackForm from "./FeedbackForm";
import FeedbackDisplay from "./FeedbackDisplay";

interface DayCardWithFeedbackProps {
  day: Day;
  weekNumber: number;
  planId: string;
  shareCode: string;
  feedback?: SessionFeedback;
  onFeedbackUpdate: (feedback: SessionFeedback) => void;
}

/**
 * Expandable day card in the week view with feedback functionality.
 * Header (always visible): day name + duration.
 * Body (expandable, default expanded): warmup, exercises, cooldown, feedback.
 */
export default function DayCardWithFeedback({
  day,
  weekNumber,
  planId,
  shareCode,
  feedback,
  onFeedbackUpdate,
}: DayCardWithFeedbackProps) {
  const [expanded, setExpanded] = useState(true);
  const { viewer } = pl.coach.athlete.plans;

  function toggleExpanded() {
    setExpanded((prev) => !prev);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpanded();
    }
  }

  return (
    <div className="bg-card border-border rounded-card border overflow-hidden">
      {/* Header — always visible, clickable to expand/collapse */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer",
          "hover:bg-border/20 transition-colors",
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-foreground text-sm font-semibold truncate">
            {day.dayName}
          </span>
          {feedback && (
            <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full px-2 py-0.5 text-xs">
              Feedback
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-muted-foreground text-xs">
            {viewer.duration}: {day.duration}
          </span>
          {/* Chevron */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={cn(
              "text-muted-foreground transition-transform duration-200",
              expanded ? "rotate-180" : "rotate-0",
            )}
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Body — collapsible */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border">
          {/* Warmup */}
          <div className="pt-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              {viewer.warmup}
            </p>
            <p className="text-foreground text-sm leading-relaxed">
              {day.warmup}
            </p>
          </div>

          {/* Exercises */}
          <div>
            <div>
              {day.exercises.map((exercise, i) => (
                <ExerciseRow key={i} exercise={exercise} index={i} />
              ))}
            </div>
          </div>

          {/* Cooldown */}
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1">
              {viewer.cooldown}
            </p>
            <p className="text-foreground text-sm leading-relaxed">
              {day.cooldown}
            </p>
          </div>

          {/* Feedback Section */}
          <div className="border-t border-border pt-4">
            {feedback ? (
              <FeedbackDisplay feedback={feedback} />
            ) : (
              <FeedbackForm
                shareCode={shareCode}
                planId={planId}
                weekNumber={weekNumber}
                dayNumber={day.dayNumber}
                onSuccess={(newFeedback) => onFeedbackUpdate(newFeedback)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
