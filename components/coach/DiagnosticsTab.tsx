"use client";

import { useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useDiagnostics } from "@/lib/hooks/use-diagnostics";
import { getMuscleByKey } from "@/lib/constants/muscles";
import type { Athlete } from "@/lib/api/athletes";
import type { DiagnosticFinding } from "@/lib/api/diagnostics";
import DiagnosticCard from "./DiagnosticCard";
import DiagnosticCreateForm from "./DiagnosticCreateForm";

interface DiagnosticsTabProps {
  athlete: Athlete;
}

const REGION_ORDER = ["upper", "lower", "foot"] as const;

const SEVERITY_RANK: Record<string, number> = {
  weak: 0,
  very_weak: 1,
  dysfunction: 2,
};

function regionFor(finding: DiagnosticFinding) {
  return getMuscleByKey(finding.muscle_key)?.region ?? "upper";
}

function severityRank(finding: DiagnosticFinding) {
  return SEVERITY_RANK[finding.severity] ?? 0;
}

export default function DiagnosticsTab({ athlete }: DiagnosticsTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const diagnosticsQuery = useDiagnostics(athlete.id);
  const findings = diagnosticsQuery.data ?? [];
  const hasError = Boolean(diagnosticsQuery.error);
  const hasFindings = findings.length > 0;
  const showInitialLoading = diagnosticsQuery.isLoading && !hasFindings;
  const showEmptyState = !showInitialLoading && !hasError && findings.length === 0;

  async function handleRetry() {
    await diagnosticsQuery.refetch();
  }

  const grouped = REGION_ORDER.map((region) => ({
    region,
    findings: findings
      .filter((finding) => regionFor(finding) === region)
      .sort(
        (a, b) =>
          severityRank(b) - severityRank(a) ||
          (a.observed_at < b.observed_at ? 1 : -1),
      ),
  })).filter((group) => group.findings.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {pl.coach.athlete.diagnostics.sectionTitle}
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
        <DiagnosticCreateForm
          athleteId={athlete.id}
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

      {hasError && !hasFindings && (
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

      {grouped.map((group) => (
        <section key={group.region} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {pl.coach.athlete.diagnostics.region[group.region]}
          </h3>
          <div className="space-y-3">
            {group.findings.map((finding) => (
              <DiagnosticCard
                key={finding.id}
                athleteId={athlete.id}
                finding={finding}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}