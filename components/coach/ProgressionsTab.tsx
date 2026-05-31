"use client";

import { useMemo, useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useProgressions } from "@/lib/hooks/use-progressions";
import type { Athlete } from "@/lib/api/athletes";
import type { Progression } from "@/lib/api/progressions";
import ProgressionCreateForm from "./ProgressionCreateForm";
import ProgressionCard from "./ProgressionCard";

interface ProgressionsTabProps {
  athlete: Athlete;
}

export default function ProgressionsTab({ athlete }: ProgressionsTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const progressionsQuery = useProgressions(athlete.id);

  const allProgressions = progressionsQuery.data?.data ?? [];
  const exercises = progressionsQuery.data?.exercises ?? [];
  const hasError = Boolean(progressionsQuery.error);
  const hasProgressions = allProgressions.length > 0;
  const showInitialLoading = progressionsQuery.isLoading && !hasProgressions;
  const showEmptyState = !showInitialLoading && !hasError && !hasProgressions;

  // Group progressions by exercise
  const grouped = useMemo(() => {
    const groups: Record<string, Progression[]> = {};
    for (const p of allProgressions) {
      if (!groups[p.exercise_name]) {
        groups[p.exercise_name] = [];
      }
      groups[p.exercise_name].push(p);
    }
    return groups;
  }, [allProgressions]);

  async function handleRetry() {
    await progressionsQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {pl.coach.athlete.tabs.progressions}
        </h2>

        <button
          type="button"
          onClick={() => setIsCreateOpen((prev) => !prev)}
          disabled={isCreateSubmitting}
          className="rounded-input bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreateOpen
            ? pl.coach.athlete.progressions.closeCreate
            : pl.coach.athlete.progressions.addButton}
        </button>
      </div>

      {isCreateOpen && (
        <ProgressionCreateForm
          athlete={athlete}
          exercises={exercises}
          onClose={() => setIsCreateOpen(false)}
          onSubmittingChange={setIsCreateSubmitting}
        />
      )}

      {showInitialLoading && (
        <div className="rounded-card border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {pl.coach.athlete.progressions.loading}
          </p>
        </div>
      )}

      {hasError && !hasProgressions && (
        <div className="rounded-card border border-destructive/30 bg-card px-4 py-3 space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {pl.coach.athlete.progressions.errorGeneric}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={progressionsQuery.isFetching}
            className="rounded-input border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-input disabled:cursor-not-allowed disabled:opacity-60"
          >
            {progressionsQuery.isFetching
              ? pl.common.loading
              : pl.common.tryAgain}
          </button>
        </div>
      )}

      {showEmptyState && (
        <div className="rounded-card border border-border bg-card px-4 py-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            {pl.coach.athlete.progressions.empty}
          </p>
          <p className="text-xs text-muted-foreground">
            {pl.coach.athlete.progressions.emptyHint}
          </p>
        </div>
      )}

      {hasProgressions && (
        <div className="space-y-3">
          {Object.entries(grouped).map(([exercise, items]) => (
            <ProgressionCard
              key={exercise}
              athleteId={athlete.id}
              exerciseName={exercise}
              progressions={items}
            />
          ))}
        </div>
      )}
    </div>
  );
}
