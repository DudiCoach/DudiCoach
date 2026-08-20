"use client";

import { useEffect, useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useCreateProgression } from "@/lib/hooks/use-progressions";

interface ProgressionCreateFormProps {
  athleteId: string;
  onClose: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  exerciseSuggestions: string[];
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProgressionCreateForm({
  athleteId,
  onClose,
  onSubmittingChange,
  exerciseSuggestions,
}: ProgressionCreateFormProps) {
  const mutation = useCreateProgression(athleteId);
  const [exerciseName, setExerciseName] = useState("");
  const [entryDate, setEntryDate] = useState(todayDateString());
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [note, setNote] = useState("");

  const isSubmitting = mutation.isPending;
  const weightParsed = Number(weight);
  const canSubmit =
    exerciseName.trim().length > 0 &&
    !Number.isNaN(weightParsed) &&
    weightParsed > 0 &&
    weightParsed <= 9999.9;

  useEffect(() => {
    if (!onSubmittingChange) return;
    onSubmittingChange(isSubmitting);
    return () => onSubmittingChange(false);
  }, [isSubmitting, onSubmittingChange]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      await mutation.mutateAsync({
        exercise_name: exerciseName,
        entry_date: entryDate,
        weight_kg: weightParsed,
        reps: reps.trim() === "" ? undefined : reps.trim(),
        sets: sets.trim() === "" ? undefined : sets.trim(),
        note: note.trim() === "" ? undefined : note.trim(),
      });
      onClose();
    } catch {
      // mutation.error is rendered below; keep the form open for a retry.
    }
  }

  const mutationError = mutation.error?.message
    ? mutation.error.message
    : mutation.error
      ? pl.coach.athlete.progressions.errorGeneric
      : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-border bg-card p-4 space-y-4"
      aria-busy={isSubmitting}
    >
      <fieldset disabled={isSubmitting} className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          {pl.coach.athlete.progressions.createTitle}
        </h3>

        <div>
          <label
            htmlFor="progression-create-exercise"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {pl.coach.athlete.progressions.field.exerciseName}
          </label>
          <input
            id="progression-create-exercise"
            list="progression-exercise-suggestions"
            value={exerciseName}
            onChange={(event) => setExerciseName(event.target.value)}
            placeholder={pl.coach.athlete.progressions.field.exerciseNamePlaceholder}
            maxLength={100}
            className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
          <datalist id="progression-exercise-suggestions">
            {exerciseSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {exerciseName.trim().length === 0 && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {pl.coach.athlete.progressions.field.exerciseNameRequired}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="progression-create-date"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {pl.coach.athlete.progressions.field.entryDate}
            </label>
            <input
              id="progression-create-date"
              type="date"
              value={entryDate}
              onChange={(event) => setEntryDate(event.target.value)}
              className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="progression-create-weight"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {pl.coach.athlete.progressions.field.weight}
            </label>
            <input
              id="progression-create-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              max="9999.9"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="80"
              className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
            {weight.trim() !== "" &&
              (Number.isNaN(weightParsed) ||
                weightParsed <= 0 ||
                weightParsed > 9999.9) && (
                <p role="alert" className="mt-1.5 text-xs text-destructive">
                  {pl.coach.athlete.progressions.validation.weightInvalid}
                </p>
              )}
          </div>

          <div>
            <label
              htmlFor="progression-create-reps"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {pl.coach.athlete.progressions.field.reps}
            </label>
            <input
              id="progression-create-reps"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              placeholder={pl.coach.athlete.progressions.field.repsPlaceholder}
              maxLength={20}
              className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="progression-create-sets"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {pl.coach.athlete.progressions.field.sets}
            </label>
            <input
              id="progression-create-sets"
              value={sets}
              onChange={(event) => setSets(event.target.value)}
              placeholder={pl.coach.athlete.progressions.field.setsPlaceholder}
              maxLength={20}
              className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="progression-create-note"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {pl.coach.athlete.progressions.field.note}
            </label>
            <textarea
              id="progression-create-note"
              rows={1}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={pl.coach.athlete.progressions.field.notePlaceholder}
              maxLength={1000}
              className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm resize-y disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
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
              ? pl.coach.athlete.progressions.creating
              : pl.coach.athlete.progressions.createSubmit}
          </button>
        </div>
      </fieldset>
    </form>
  );
}