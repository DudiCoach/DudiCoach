"use client";

import { useEffect, useMemo, useState } from "react";

import { pl } from "@/lib/i18n/pl";
import {
  PlanFeedbackNotFoundError,
  PlanFeedbackRequestError,
  PlanFeedbackValidationError,
  fetchPublicDayFeedback,
  upsertPublicDayFeedback,
} from "@/lib/api/plan-feedback";
import {
  feedbackTextSchema,
  sanitizeFeedbackText,
} from "@/lib/validation/plan-session-feedback";

interface PublicDayFeedbackSectionProps {
  shareCode: string;
  planId: string;
  weekNumber: number;
  dayNumber: number;
}

const FEEDBACK_MAX_LENGTH = 2000;

/**
 * Public athlete feedback form for one concrete plan day/session.
 * Loads existing feedback, allows upsert, and keeps messages sanitized.
 */
export default function PublicDayFeedbackSection({
  shareCode,
  planId,
  weekNumber,
  dayNumber,
}: PublicDayFeedbackSectionProps) {
  const [draft, setDraft] = useState("");
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const label = useMemo(
    () =>
      pl.athletePanel.plan.feedback.textareaLabel
        .replace("{week}", String(weekNumber))
        .replace("{day}", String(dayNumber)),
    [weekNumber, dayNumber],
  );

  const textAreaId = useMemo(
    () => `feedback-${planId}-${weekNumber}-${dayNumber}`,
    [planId, weekNumber, dayNumber],
  );

  const charCount = draft.length;
  const isOverLimit = charCount > FEEDBACK_MAX_LENGTH;

  useEffect(() => {
    let active = true;

    setIsLoadingInitial(true);
    setFieldError(null);
    setRequestError(null);
    setIsSaved(false);

    void (async () => {
      try {
        const row = await fetchPublicDayFeedback({
          shareCode,
          planId,
          weekNumber,
          dayNumber,
        });

        if (!active) return;
        setDraft(row?.feedback_text ?? "");
      } catch (error) {
        if (!active) return;

        // Missing row is a valid state for first write.
        if (error instanceof PlanFeedbackNotFoundError) {
          setDraft("");
        } else {
          setRequestError(pl.athletePanel.plan.feedback.loadError);
        }
      } finally {
        if (!active) return;
        setIsLoadingInitial(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [shareCode, planId, weekNumber, dayNumber]);

  function validateDraft(value: string): { ok: true; sanitized: string } | { ok: false; message: string } {
    const sanitized = sanitizeFeedbackText(value);

    if (sanitized.length === 0) {
      return {
        ok: false,
        message: pl.athletePanel.plan.feedback.emptyError,
      };
    }

    if (sanitized.length > FEEDBACK_MAX_LENGTH) {
      return {
        ok: false,
        message: pl.athletePanel.plan.feedback.maxLengthError,
      };
    }

    const parsed = feedbackTextSchema.safeParse(value);
    if (!parsed.success) {
      return {
        ok: false,
        message: pl.athletePanel.plan.feedback.saveError,
      };
    }

    return { ok: true, sanitized: parsed.data };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFieldError(null);
    setRequestError(null);

    const validation = validateDraft(draft);
    if (!validation.ok) {
      setIsSaved(false);
      setFieldError(validation.message);
      return;
    }

    setIsSaving(true);
    setIsSaved(false);

    try {
      const row = await upsertPublicDayFeedback({
        shareCode,
        planId,
        weekNumber,
        dayNumber,
        feedbackText: validation.sanitized,
      });

      setDraft(row.feedback_text);
      setIsSaved(true);
      setFieldError(null);
    } catch (error) {
      if (error instanceof PlanFeedbackValidationError) {
        setFieldError(pl.athletePanel.plan.feedback.saveError);
      } else if (
        error instanceof PlanFeedbackNotFoundError ||
        error instanceof PlanFeedbackRequestError
      ) {
        setRequestError(pl.athletePanel.plan.feedback.saveError);
      } else {
        setRequestError(pl.athletePanel.plan.feedback.saveError);
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(event.target.value);
    setIsSaved(false);
    if (fieldError) setFieldError(null);
    if (requestError) setRequestError(null);
  }

  return (
    <section className="mt-4 rounded-input border border-border bg-input/40 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {pl.athletePanel.plan.feedback.sectionTitle}
      </p>

      {isLoadingInitial ? (
        <p role="status" className="text-xs text-muted-foreground" aria-live="polite">
          {pl.athletePanel.plan.feedback.loading}
        </p>
      ) : (
        <form onSubmit={handleSubmit} aria-busy={isSaving} className="space-y-2">
          <label htmlFor={textAreaId} className="block text-xs font-medium text-foreground">
            {label}
          </label>

          <textarea
            id={textAreaId}
            value={draft}
            onChange={handleChange}
            rows={3}
            disabled={isSaving}
            className="w-full rounded-input border border-border bg-card px-3 py-2 text-sm text-foreground resize-y"
            placeholder={pl.athletePanel.plan.feedback.placeholder}
          />

          <div className="flex items-center justify-between gap-3">
            <span
              className={
                isOverLimit
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {pl.athletePanel.plan.feedback.counter.replace(
                "{count}",
                String(charCount),
              )}
            </span>

            <button
              type="submit"
              disabled={isSaving || isLoadingInitial}
              className="rounded-input bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? pl.athletePanel.plan.feedback.saving
                : pl.athletePanel.plan.feedback.save}
            </button>
          </div>

          {isSaved && (
            <p role="status" aria-live="polite" className="text-xs text-success">
              {pl.athletePanel.plan.feedback.saved}
            </p>
          )}

          {fieldError && (
            <p role="alert" className="text-xs text-destructive">
              {fieldError}
            </p>
          )}

          {requestError && (
            <p role="alert" className="text-xs text-destructive">
              {requestError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
