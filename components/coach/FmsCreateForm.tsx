"use client";

import { useEffect, useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useCreateFmsDiagnostic } from "@/lib/hooks/use-fms-diagnostics";
import type { Athlete } from "@/lib/api/athletes";
import {
  FMS_REGIONS,
  FMS_SIDES,
  FMS_SEVERITY_LEVELS,
  MUSCLES_BY_REGION,
  REGION_LABELS,
  SEVERITY_LABELS,
  SIDE_LABELS,
  type FmsRegion,
  type FmsSide,
  type FmsSeverity,
} from "@/lib/constants/fms-muscles";

interface FmsCreateFormProps {
  athlete: Athlete;
  onClose: () => void;
  onSubmittingChange: (isSubmitting: boolean) => void;
}

export default function FmsCreateForm({
  athlete,
  onClose,
  onSubmittingChange,
}: FmsCreateFormProps) {
  const [region, setRegion] = useState<FmsRegion>("upper");
  const [side, setSide] = useState<FmsSide>("left");
  const [muscle, setMuscle] = useState("");
  const [severity, setSeverity] = useState<FmsSeverity>("weak");
  const [notes, setNotes] = useState("");

  const createMutation = useCreateFmsDiagnostic(athlete.id);

  useEffect(() => {
    onSubmittingChange(createMutation.isPending);
  }, [createMutation.isPending, onSubmittingChange]);

  const availableMuscles = MUSCLES_BY_REGION[region] ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    createMutation.mutate(
      { region, side, muscle, severity, notes: notes || null },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-border bg-card p-4 space-y-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {pl.coach.athlete.diagnostics.createTitle}
      </h3>

      {/* Region */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {pl.coach.athlete.diagnostics.field.region}
        </label>
        <div className="flex gap-2">
          {FMS_REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRegion(r);
                setMuscle("");
              }}
              className={`rounded-input border px-3 py-1.5 text-sm font-medium transition-colors ${
                region === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-input"
              }`}
            >
              {REGION_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Side */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {pl.coach.athlete.diagnostics.field.side}
        </label>
        <div className="flex gap-2">
          {FMS_SIDES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`rounded-input border px-3 py-1.5 text-sm font-medium transition-colors ${
                side === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-input"
              }`}
            >
              {SIDE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Muscle */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {pl.coach.athlete.diagnostics.field.muscle}
        </label>
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          required
          className="w-full rounded-input border border-border bg-input px-3 py-2 text-sm text-foreground"
        >
          <option value="">Wybierz mięsień...</option>
          {availableMuscles.map((m) => (
            <option key={m.key} value={m.label}>
              {m.label} ({m.latinName})
            </option>
          ))}
        </select>
      </div>

      {/* Severity */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {pl.coach.athlete.diagnostics.field.severity}
        </label>
        <div className="flex gap-2">
          {FMS_SEVERITY_LEVELS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={`rounded-input border px-3 py-1.5 text-sm font-medium transition-colors ${
                severity === s
                  ? s === "weak"
                    ? "border-yellow-500 bg-yellow-500/10 text-yellow-500"
                    : s === "very_weak"
                      ? "border-orange-500 bg-orange-500/10 text-orange-500"
                      : "border-red-500 bg-red-500/10 text-red-500"
                  : "border-border text-muted-foreground hover:bg-input"
              }`}
            >
              {SEVERITY_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {pl.coach.athlete.diagnostics.field.notes}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
          disabled={createMutation.isPending || !muscle}
          className="rounded-input bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createMutation.isPending
            ? pl.coach.athlete.diagnostics.creating
            : pl.coach.athlete.diagnostics.createSubmit}
        </button>
      </div>
    </form>
  );
}
