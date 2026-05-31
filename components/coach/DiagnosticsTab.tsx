"use client";

import { useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useFmsDiagnostics } from "@/lib/hooks/use-fms-diagnostics";
import type { Athlete } from "@/lib/api/athletes";
import type { FmsDiagnostic } from "@/lib/api/fms-diagnostics";
import type { FmsRegion } from "@/lib/constants/fms-muscles";
import { REGION_LABELS } from "@/lib/constants/fms-muscles";
import FmsCreateForm from "./FmsCreateForm";
import FmsDiagnosticCard from "./FmsDiagnosticCard";
import FmsSnapshotHistory from "./FmsSnapshotHistory";

interface DiagnosticsTabProps {
  athlete: Athlete;
}

function groupByRegion(diagnostics: FmsDiagnostic[]): Record<FmsRegion, FmsDiagnostic[]> {
  const groups: Record<FmsRegion, FmsDiagnostic[]> = {
    upper: [],
    lower: [],
    foot: [],
  };

  for (const d of diagnostics) {
    const region = d.region as FmsRegion;
    if (region in groups) {
      groups[region].push(d);
    }
  }

  return groups;
}

export default function DiagnosticsTab({ athlete }: DiagnosticsTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const diagnosticsQuery = useFmsDiagnostics(athlete.id);
  const diagnostics = diagnosticsQuery.data ?? [];
  const hasError = Boolean(diagnosticsQuery.error);
  const hasDiagnostics = diagnostics.length > 0;
  const showInitialLoading = diagnosticsQuery.isLoading && !hasDiagnostics;
  const showEmptyState =
    !showInitialLoading && !hasError && diagnostics.length === 0;

  const grouped = groupByRegion(diagnostics);

  async function handleRetry() {
    await diagnosticsQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {pl.coach.athlete.tabs.diagnostics}
        </h2>

        <button
          type="button"
          onClick={() => setIsCreateOpen((prev) => !prev)}
          disabled={isCreateSubmitting}
          className="rounded-input bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreateOpen
            ? pl.coach.athlete.diagnostics.closeCreate
            : pl.coach.athlete.diagnostics.addButton}
        </button>
      </div>

      {isCreateOpen && (
        <FmsCreateForm
          athlete={athlete}
          onClose={() => setIsCreateOpen(false)}
          onSubmittingChange={setIsCreateSubmitting}
        />
      )}

      {showInitialLoading && (
        <div className="rounded-card border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {pl.coach.athlete.diagnostics.loading}
          </p>
        </div>
      )}

      {hasError && !hasDiagnostics && (
        <div className="rounded-card border border-destructive/30 bg-card px-4 py-3 space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {pl.coach.athlete.diagnostics.errorGeneric}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={diagnosticsQuery.isFetching}
            className="rounded-input border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-input disabled:cursor-not-allowed disabled:opacity-60"
          >
            {diagnosticsQuery.isFetching
              ? pl.common.loading
              : pl.common.tryAgain}
          </button>
        </div>
      )}

      {showEmptyState && (
        <div className="rounded-card border border-border bg-card px-4 py-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            {pl.coach.athlete.diagnostics.empty}
          </p>
          <p className="text-xs text-muted-foreground">
            {pl.coach.athlete.diagnostics.emptyHint}
          </p>
        </div>
      )}

      {hasDiagnostics && (
        <div className="space-y-6">
          {/* Current diagnostics by region */}
          <div className="space-y-4">
            {(Object.keys(grouped) as FmsRegion[]).map((region) => {
              const items = grouped[region];
              if (items.length === 0) return null;

              const regionEmoji =
                region === "upper" ? "💪" : region === "lower" ? "🦵" : "🦶";

              return (
                <div key={region} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {regionEmoji} {REGION_LABELS[region]} ({items.length})
                  </h3>
                  <div className="space-y-2">
                    {items.map((d) => (
                      <FmsDiagnosticCard
                        key={d.id}
                        athleteId={athlete.id}
                        diagnostic={d}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Snapshot history */}
          {diagnostics.length > 1 && (
            <FmsSnapshotHistory diagnostics={diagnostics} />
          )}
        </div>
      )}
    </div>
  );
}
