"use client";

import { useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useProgressions } from "@/lib/hooks/use-progressions";
import type { Athlete } from "@/lib/api/athletes";
import type { LoadProgression } from "@/lib/api/progressions";
import ProgressionCard from "./ProgressionCard";
import ProgressionCreateForm from "./ProgressionCreateForm";

interface ProgressionsTabProps {
  athlete: Athlete;
}

export default function ProgressionsTab({ athlete }: ProgressionsTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const progressionsQuery = useProgressions(athlete.id);
  const entries = progressionsQuery.data ?? [];
  const hasError = Boolean(progressionsQuery.error);
  const showInitialLoading = progressionsQuery.isLoading && entries.length === 0;
  const showEmptyState =
    !showInitialLoading && !hasError && entries.length === 0;

  async function handleRetry() {
    await progressionsQuery.refetch();
  }

  const byExercise = new Map<string, LoadProgression[]>();
  for (const entry of entries) {
    const group = byExercise.get(entry.exercise_name) ?? [];
    group.push(entry);
    byExercise.set(entry.exercise_name, group);
  }
  const exerciseGroups = [...byExercise.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "pl"),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {pl.coach.athlete.progressions.sectionTitle}
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
          athleteId={athlete.id}
          onClose={() => setIsCreateOpen(false)}
          onSubmittingChange={setIsCreateSubmitting}
          exerciseSuggestions={exerciseGroups.map(([name]) => name)}
        />
      )}

      {showInitialLoading && (
        <div className="rounded-card border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {pl.coach.athlete.progressions.loading}
          </p>
        </div>
      )}

      {hasError && entries.length === 0 && (
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

      {exerciseGroups.map(([name, groupEntries]) => (
        <ProgressionCard
          key={name}
          athleteId={athlete.id}
          exerciseName={name}
          entries={groupEntries}
        />
      ))}
    </div>
  );
}