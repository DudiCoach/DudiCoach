"use client";

import { useState } from "react";
import { pl } from "@/lib/i18n/pl";
import { useCreateCycleSummary } from "@/lib/hooks/use-cycle-summaries";
import type { CycleResult } from "@/lib/data/cycle-summary";

interface CycleSummaryFormProps {
  athleteId: string;
  planId: string;
  cycleNumber: number;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Form for creating a new cycle summary.
 */
export default function CycleSummaryForm({
  athleteId,
  planId,
  cycleNumber,
  onSuccess,
  onCancel,
}: CycleSummaryFormProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [results, setResults] = useState<CycleResult[]>([]);
  const createMutation = useCreateCycleSummary(athleteId);

  const addResult = () => {
    setResults([...results, { metric: "", before: "", after: "", improvement: "" }]);
  };

  const updateResult = (index: number, field: keyof CycleResult, value: string) => {
    const updated = [...results];
    updated[index] = { ...updated[index], [field]: value };
    setResults(updated);
  };

  const removeResult = (index: number) => {
    setResults(results.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    try {
      await createMutation.mutateAsync({
        plan_id: planId,
        cycle_number: cycleNumber,
        title: title.trim(),
        notes: notes.trim(),
        results: results.filter((r) => r.metric.trim() && r.before.trim() && r.after.trim()),
      });
      onSuccess();
    } catch {
      // Error is handled by the mutation
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          Tytuł podsumowania
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="np. Podsumowanie cyklu bazowego"
          required
        />
      </div>

      <div>
        <label className="text-muted-foreground mb-1 block text-xs font-medium">
          Notatki trenera
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Obserwacje, wnioski, zalecenia..."
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-muted-foreground text-xs font-medium">
            Wyniki (opcjonalnie)
          </label>
          <button
            type="button"
            onClick={addResult}
            className="text-primary text-xs hover:underline"
          >
            + Dodaj wynik
          </button>
        </div>

        {results.map((result, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              type="text"
              value={result.metric}
              onChange={(e) => updateResult(i, "metric", e.target.value)}
              className="border-input bg-background flex-1 rounded-md border px-2 py-1 text-xs"
              placeholder="Metryka"
            />
            <input
              type="text"
              value={result.before}
              onChange={(e) => updateResult(i, "before", e.target.value)}
              className="border-input bg-background w-20 rounded-md border px-2 py-1 text-xs"
              placeholder="Przed"
            />
            <input
              type="text"
              value={result.after}
              onChange={(e) => updateResult(i, "after", e.target.value)}
              className="border-input bg-background w-20 rounded-md border px-2 py-1 text-xs"
              placeholder="Po"
            />
            <input
              type="text"
              value={result.improvement}
              onChange={(e) => updateResult(i, "improvement", e.target.value)}
              className="border-input bg-background w-20 rounded-md border px-2 py-1 text-xs"
              placeholder="Poprawa"
            />
            <button
              type="button"
              onClick={() => removeResult(i)}
              className="text-destructive text-xs hover:underline"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="bg-secondary text-foreground hover:bg-secondary/80 rounded-pill px-4 py-2 text-sm"
        >
          {pl.common.cancel}
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending || !title.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-pill px-4 py-2 text-sm disabled:opacity-50"
        >
          {createMutation.isPending ? pl.common.saving : pl.common.save}
        </button>
      </div>
    </form>
  );
}
