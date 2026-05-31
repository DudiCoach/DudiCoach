"use client";

import { useEffect, useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useCreateProgression } from "@/lib/hooks/use-progressions";
import type { Athlete } from "@/lib/api/athletes";

interface ProgressionCreateFormProps {
  athlete: Athlete;
  exercises: string[];
  onClose: () => void;
  onSubmittingChange: (isSubmitting: boolean) => void;
}

export default function ProgressionCreateForm({
  athlete,
  exercises,
  onClose,
  onSubmittingChange,
}: ProgressionCreateFormProps) {
  const [exerciseName, setExerciseName] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [note, setNote] = useState("");

  const createMutation = useCreateProgression(athlete.id);

  useEffect(() => {
    onSubmittingChange(createMutation.isPending);
  }, [createMutation.isPending, onSubmittingChange]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    createMutation.mutate(
      {
        exercise_name: exerciseName,
        weight_kg: parseFloat(weightKg),
        sets: sets || null,
        reps: reps || null,
        note: note || null,
        source: "coach",
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-border bg-card p-4 space-y-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {pl.coach.athlete.progressions.createTitle}
      </h3>

      {/* Exercise Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {pl.coach.athlete.progressions.field.exerciseName}
        </label>
        <input
          type="text"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          list="exercise-suggestions"
          required
          className="w-full rounded-input border border-border bg-input px-3 py-2 text-sm text-foreground"
          placeholder="np. Back Squat, Bench Press..."
        />
        <datalist id="exercise-suggestions">
          {exercises.map((ex) => (
            <option key={ex} value={ex} />
          ))}
        </datalist>
      </div>

      {/* Weight */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {pl.coach.athlete.progressions.field.weightKg}
        </label>
        <input
          type="number"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          required
          min="0"
          max="1000"
          step="0.5"
          className="w-full rounded-input border border-border bg-input px-3 py-2 text-sm text-foreground"
          placeholder="np. 80"
        />
      </div>

      {/* Sets + Reps */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {pl.coach.athlete.progressions.field.sets}
          </label>
          <input
            type="text"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            className="w-full rounded-input border border-border bg-input px-3 py-2 text-sm text-foreground"
            placeholder="np. 3"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {pl.coach.athlete.progressions.field.reps}
          </label>
          <input
            type="text"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="w-full rounded-input border border-border bg-input px-3 py-2 text-sm text-foreground"
            placeholder="np. 8-10"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {pl.coach.athlete.progressions.field.notes}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full rounded-input border border-border bg-input px-3 py-2 text-sm text-foreground"
          placeholder="Opcjonalna notatka..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-input border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-input"
        >
          {pl.common.cancel}
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || !exerciseName || !weightKg}
          className="rounded-input bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createMutation.isPending
            ? pl.coach.athlete.progressions.creating
            : pl.coach.athlete.progressions.createSubmit}
        </button>
      </div>
    </form>
  );
}
