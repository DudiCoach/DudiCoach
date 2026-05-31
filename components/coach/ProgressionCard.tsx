"use client";

import { useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useDeleteProgression } from "@/lib/hooks/use-progressions";
import type { Progression } from "@/lib/api/progressions";
import ProgressionChart from "./ProgressionChart";

interface ProgressionCardProps {
  athleteId: string;
  exerciseName: string;
  progressions: Progression[];
}

export default function ProgressionCard({
  athleteId,
  exerciseName,
  progressions,
}: ProgressionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteMutation = useDeleteProgression(athleteId);

  const latestWeight = progressions[progressions.length - 1]?.weight_kg ?? 0;
  const previousWeight = progressions.length > 1
    ? progressions[progressions.length - 2].weight_kg
    : latestWeight;
  const change = latestWeight - previousWeight;
  const changePercent = previousWeight > 0
    ? Math.round((change / previousWeight) * 100)
    : 0;

  function handleDeleteLast() {
    if (!window.confirm(pl.coach.athlete.progressions.deleteConfirm)) return;
    const lastEntry = progressions[progressions.length - 1];
    if (!lastEntry) return;
    setIsDeleting(true);
    deleteMutation.mutate(
      { progressionId: lastEntry.id },
      { onSettled: () => setIsDeleting(false) },
    );
  }

  return (
    <div className="rounded-card border border-border bg-card overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left flex items-center justify-between gap-3 hover:bg-input/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {exerciseName}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {progressions.length} wpisów
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-foreground">
              {latestWeight} kg
            </div>
            {change !== 0 && (
              <div
                className={`text-xs font-medium ${
                  change > 0
                    ? "text-green-500"
                    : change < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              >
                {change > 0 ? "+" : ""}
                {change} kg ({changePercent > 0 ? "+" : ""}
                {changePercent}%)
              </div>
            )}
          </div>

          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded content with chart */}
      {isExpanded && (
        <div className="border-t border-border p-3 space-y-3">
          <ProgressionChart data={progressions} />

          {/* History list */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {[...progressions]
              .reverse()
              .map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-input/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("pl-PL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </span>
                    {p.source === "athlete" && (
                      <span className="rounded-pill bg-green-500/10 text-green-500 px-1.5 py-0.5 text-[10px]">
                        zawodnik
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-foreground font-medium">
                      {p.weight_kg} kg
                    </span>
                    {p.sets && p.reps && (
                      <span className="text-muted-foreground">
                        {p.sets}×{p.reps}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Delete last entry */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleDeleteLast}
              disabled={isDeleting}
              className="rounded-input text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              {pl.coach.athlete.progressions.deleteLast}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
