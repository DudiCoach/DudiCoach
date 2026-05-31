"use client";

import { useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useDeleteFmsDiagnostic } from "@/lib/hooks/use-fms-diagnostics";
import type { FmsDiagnostic } from "@/lib/api/fms-diagnostics";
import {
  REGION_LABELS,
  SIDE_LABELS,
  SEVERITY_LABELS,
  MUSCLES_BY_REGION,
  type FmsRegion,
  type FmsSide,
  type FmsSeverity,
} from "@/lib/constants/fms-muscles";

interface FmsDiagnosticCardProps {
  athleteId: string;
  diagnostic: FmsDiagnostic;
}

const SEVERITY_COLORS: Record<FmsSeverity, string> = {
  weak: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  very_weak: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  dysfunction: "bg-red-500/10 text-red-500 border-red-500/30",
};

export default function FmsDiagnosticCard({
  athleteId,
  diagnostic,
}: FmsDiagnosticCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteMutation = useDeleteFmsDiagnostic(athleteId);

  const region = diagnostic.region as FmsRegion;
  const side = diagnostic.side as FmsSide;
  const severity = diagnostic.severity as FmsSeverity;

  // Find the muscle Latin name for display
  const musclesInRegion = MUSCLES_BY_REGION[region] ?? [];
  const muscleDef = musclesInRegion.find((m) => m.label === diagnostic.muscle);
  const latinName = muscleDef?.latinName ?? "";

  function handleDelete() {
    if (!window.confirm(pl.coach.athlete.diagnostics.deleteConfirm)) return;
    setIsDeleting(true);
    deleteMutation.mutate(
      { diagnosticId: diagnostic.id },
      { onSettled: () => setIsDeleting(false) },
    );
  }

  return (
    <div className="rounded-card border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {diagnostic.muscle}
            </span>
            {latinName && (
              <span className="text-xs text-muted-foreground italic">
                ({latinName})
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {REGION_LABELS[region]}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {SIDE_LABELS[side]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-pill border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[severity]}`}
          >
            {SEVERITY_LABELS[severity]}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-input text-muted-foreground hover:text-destructive transition-colors"
            title={pl.common.delete}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {diagnostic.notes && (
        <p className="text-xs text-muted-foreground">{diagnostic.notes}</p>
      )}
    </div>
  );
}
