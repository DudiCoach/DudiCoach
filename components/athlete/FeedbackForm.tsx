"use client";

import { useState } from "react";
import { pl } from "@/lib/i18n/pl";
import { useUpsertSessionFeedback } from "@/lib/hooks/use-session-feedback";

interface FeedbackFormProps {
  shareCode: string;
  planId: string;
  weekNumber: number;
  dayNumber: number;
  existingFeedback?: string;
  onSuccess?: (feedback: import("@/lib/data/session-feedback").SessionFeedback) => void;
}

/**
 * Form for athletes to submit or edit feedback for a specific training day.
 * Follows US-014 acceptance criteria:
 * - Plain text only (no dangerouslySetInnerHTML)
 * - Max 2000 characters
 * - Trim and sanitize on submit
 */
export default function FeedbackForm({
  shareCode,
  planId,
  weekNumber,
  dayNumber,
  existingFeedback,
  onSuccess,
}: FeedbackFormProps) {
  const [text, setText] = useState(existingFeedback ?? "");
  const [isEditing, setIsEditing] = useState(!existingFeedback);
  const upsertMutation = useUpsertSessionFeedback(shareCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    try {
      const result = await upsertMutation.mutateAsync({
        plan_id: planId,
        week_number: weekNumber,
        day_number: dayNumber,
        feedback_text: trimmed,
      });
      setIsEditing(false);
      onSuccess?.(result);
    } catch {
      // Error is handled by the mutation
    }
  };

  if (!isEditing && existingFeedback) {
    return (
      <div className="rounded-md bg-muted/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            {pl.athletePanel.feedback.yourFeedback}
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-primary text-xs hover:underline"
          >
            {pl.athletePanel.feedback.edit}
          </button>
        </div>
        <p className="text-foreground whitespace-pre-wrap text-sm">
          {existingFeedback}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="text-muted-foreground text-xs font-medium">
        {pl.athletePanel.feedback.addFeedback}
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={3}
        className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
        placeholder={pl.athletePanel.feedback.placeholder}
      />
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {text.length}/2000
        </span>
        <div className="flex gap-2">
          {existingFeedback && (
            <button
              type="button"
              onClick={() => {
                setText(existingFeedback);
                setIsEditing(false);
              }}
              className="bg-secondary text-foreground hover:bg-secondary/80 rounded-md px-3 py-1.5 text-xs"
            >
              {pl.athletePanel.feedback.cancel}
            </button>
          )}
          <button
            type="submit"
            disabled={upsertMutation.isPending || text.trim().length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {upsertMutation.isPending
              ? pl.athletePanel.feedback.saving
              : pl.athletePanel.feedback.save}
          </button>
        </div>
      </div>
      {upsertMutation.isError && (
        <p className="text-destructive text-xs">
          {upsertMutation.error.message}
        </p>
      )}
    </form>
  );
}
