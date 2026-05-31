"use client";

import { useState } from "react";
import { useUpsertRpeReport } from "@/lib/hooks/use-rpe-report";

interface RpeFormProps {
  shareCode: string;
  planId: string;
  weekNumber: number;
  dayNumber: number;
  existingReport?: {
    rpe: number;
    pain_level?: number | null;
    pain_location?: string | null;
    notes?: string | null;
  } | null;
  onSuccess?: () => void;
}

const RPE_LABELS: Record<number, string> = {
  1: "Bardzo latwe",
  2: "Latwe",
  3: "Umiarkowane",
  4: "Srednio trudne",
  5: "Trudne",
  6: "Bardzo trudne",
  7: "Wymagajace",
  8: "Bardzo wymagajace",
  9: "Ekstremalne",
  10: "Maksymalne",
};

/**
 * Form for athletes to report RPE (Rate of Perceived Exertion) for a training day.
 * Also includes optional pain level and location.
 */
export default function RpeForm({
  shareCode,
  planId,
  weekNumber,
  dayNumber,
  existingReport,
  onSuccess,
}: RpeFormProps) {
  const [rpe, setRpe] = useState(existingReport?.rpe ?? 5);
  const [painLevel, setPainLevel] = useState(existingReport?.pain_level ?? 0);
  const [painLocation, setPainLocation] = useState(existingReport?.pain_location ?? "");
  const [notes, setNotes] = useState(existingReport?.notes ?? "");
  const [isEditing, setIsEditing] = useState(!existingReport);
  const upsertMutation = useUpsertRpeReport(shareCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await upsertMutation.mutateAsync({
        plan_id: planId,
        week_number: weekNumber,
        day_number: dayNumber,
        rpe,
        pain_level: painLevel > 0 ? painLevel : undefined,
        pain_location: painLocation.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setIsEditing(false);
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  if (!isEditing && existingReport) {
    return (
      <div className="rounded-md bg-muted/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            RPE: {existingReport.rpe}/10 — {RPE_LABELS[existingReport.rpe] ?? ""}
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-primary text-xs hover:underline"
          >
            Edytuj
          </button>
        </div>
        {existingReport.pain_level != null && existingReport.pain_level > 0 && (
          <p className="text-muted-foreground text-xs">
            Ból: {existingReport.pain_level}/10
            {existingReport.pain_location && ` — ${existingReport.pain_location}`}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          RPE (1-10): <span className="text-foreground font-semibold">{rpe}</span> — {RPE_LABELS[rpe] ?? ""}
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={rpe}
          onChange={(e) => setRpe(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 - Bardzo latwe</span>
          <span>10 - Maksymalne</span>
        </div>
      </div>

      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          Poziom bolu (0-10): {painLevel}
        </label>
        <input
          type="range"
          min={0}
          max={10}
          value={painLevel}
          onChange={(e) => setPainLevel(Number(e.target.value))}
          className="w-full"
        />
        {painLevel > 0 && (
          <input
            type="text"
            value={painLocation}
            onChange={(e) => setPainLocation(e.target.value)}
            className="border-input bg-background mt-1 w-full rounded-md border px-2 py-1 text-xs"
            placeholder="Lokalizacja bolu (np. kolano, plecy)"
          />
        )}
      </div>

      <div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="border-input bg-background w-full rounded-md border px-2 py-1 text-xs"
          placeholder="Notatki (opcjonalnie)"
        />
      </div>

      <div className="flex justify-end gap-2">
        {existingReport && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="bg-secondary text-foreground hover:bg-secondary/80 rounded-md px-3 py-1.5 text-xs"
          >
            Anuluj
          </button>
        )}
        <button
          type="submit"
          disabled={upsertMutation.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {upsertMutation.isPending ? "Zapisywanie..." : "Zapisz"}
        </button>
      </div>
    </form>
  );
}
