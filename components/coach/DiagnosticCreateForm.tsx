"use client";

import { useEffect, useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useCreateDiagnostic } from "@/lib/hooks/use-diagnostics";
import { SIDES, SEVERITIES } from "@/lib/validation/diagnostic";
import MuscleCombobox from "./MuscleCombobox";

interface DiagnosticCreateFormProps {
  athleteId: string;
  onClose: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export default function DiagnosticCreateForm({
  athleteId,
  onClose,
  onSubmittingChange,
}: DiagnosticCreateFormProps) {
  const mutation = useCreateDiagnostic(athleteId);
  const [muscleKey, setMuscleKey] = useState<string | null>(null);
  const [side, setSide] = useState<(typeof SIDES)[number]>("left");
  const [severity, setSeverity] =
    useState<(typeof SEVERITIES)[number]>("weak");
  const [observedAt, setObservedAt] = useState(todayDateString());
  const [notes, setNotes] = useState("");

  const isSubmitting = mutation.isPending;
  const canSubmit = muscleKey !== null;

  useEffect(() => {
    if (!onSubmittingChange) return;
    onSubmittingChange(isSubmitting);
    return () => onSubmittingChange(false);
  }, [isSubmitting, onSubmittingChange]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!muscleKey || !canSubmit) return;
    await mutation.mutateAsync({
      muscle_key: muscleKey,
      side,
      severity,
      observed_at: observedAt,
      notes: notes === "" ? undefined : notes,
    });
    onClose();
  }

  const mutationError = mutation.error?.message
    ? mutation.error.message
    : mutation.error
      ? pl.coach.athlete.diagnostics.errorGeneric
      : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-border bg-card p-4 space-y-4"
      aria-busy={isSubmitting}
    >
      <fieldset disabled={isSubmitting} className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          {pl.coach.athlete.diagnostics.createTitle}
        </h3>

        <div>
          <label
            htmlFor="diagnostic-create-muscle"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {pl.coach.athlete.diagnostics.field.muscle}
          </label>
          <MuscleCombobox
            id="diagnostic-create-muscle"
            selectedKey={muscleKey}
            onSelect={setMuscleKey}
            disabled={isSubmitting}
          />
          {!muscleKey && (
            <p
              role="alert"
              className="mt-1.5 text-xs text-destructive"
            >
              {pl.coach.athlete.diagnostics.field.muscleRequired}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              {pl.coach.athlete.diagnostics.field.side}
            </span>
            <div className="flex gap-2">
              {SIDES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSide(value)}
                  aria-pressed={side === value}
                  className={`rounded-input flex-1 border px-3 py-2 text-sm font-medium transition-colors ${
                    side === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-input text-foreground hover:border-primary/60"
                  }`}
                >
                  {pl.coach.athlete.diagnostics.side[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              {pl.coach.athlete.diagnostics.field.severity}
            </span>
            <div className="flex flex-wrap gap-2">
              {SEVERITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSeverity(value)}
                  aria-pressed={severity === value}
                  className={`rounded-input flex-1 border px-3 py-2 text-sm font-medium transition-colors ${
                    severity === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-input text-foreground hover:border-primary/60"
                  }`}
                >
                  {pl.coach.athlete.diagnostics.severity[value]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="diagnostic-create-date"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {pl.coach.athlete.diagnostics.field.observedAt}
          </label>
          <input
            id="diagnostic-create-date"
            type="date"
            value={observedAt}
            onChange={(event) => setObservedAt(event.target.value)}
            className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="diagnostic-create-notes"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {pl.coach.athlete.diagnostics.field.notes}
          </label>
          <textarea
            id="diagnostic-create-notes"
            rows={3}
            placeholder={pl.coach.athlete.diagnostics.field.notesPlaceholder}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm resize-y disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {mutationError && (
          <p role="alert" className="text-sm text-destructive">
            {mutationError}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-input border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pl.common.cancel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="rounded-input bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? pl.coach.athlete.diagnostics.creating
              : pl.coach.athlete.diagnostics.createSubmit}
          </button>
        </div>
      </fieldset>
    </form>
  );
}