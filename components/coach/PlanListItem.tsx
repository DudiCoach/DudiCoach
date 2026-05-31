"use client";

import { pl } from "@/lib/i18n/pl";
import { cn } from "@/lib/utils";
import type { TrainingPlan } from "@/lib/api/plans";
import { formatPlanDate } from "@/lib/utils/format-plan-date";
import { useArchivePlan, useActivatePlan, useDuplicatePlan } from "@/lib/hooks/use-plan-archive";

interface PlanListItemProps {
  plan: TrainingPlan;
  athleteId: string;
  selected: boolean;
  onClick: () => void;
}

type PhaseKey = keyof typeof pl.coach.athlete.phase;

/**
 * Single plan card in the plan list.
 * Shows plan name, localized phase, and formatted creation date.
 * Highlights when selected with a primary border/ring.
 * Shows active status and archive/activate buttons.
 */
export default function PlanListItem({
  plan,
  athleteId,
  selected,
  onClick,
}: PlanListItemProps) {
  const archiveMutation = useArchivePlan(athleteId);
  const activateMutation = useActivatePlan(athleteId);
  const duplicateMutation = useDuplicatePlan(athleteId);

  const phaseKey = plan.phase as PhaseKey | null;
  const phaseLabel =
    phaseKey && phaseKey in pl.coach.athlete.phase
      ? pl.coach.athlete.phase[phaseKey]
      : plan.phase ?? "—";

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation();
    archiveMutation.mutate(plan.id);
  }

  function handleActivate(e: React.MouseEvent) {
    e.stopPropagation();
    activateMutation.mutate(plan.id);
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    duplicateMutation.mutate({ planId: plan.id, newName: `Kopia: ${plan.plan_name}` });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-pressed={selected}
      className={cn(
        "bg-card border rounded-card p-4 cursor-pointer transition-colors",
        "focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-primary/50",
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-foreground font-medium text-sm leading-snug truncate">
          {plan.plan_name}
        </p>
        {plan.is_active && (
          <span className="bg-success/20 text-success rounded-full px-2 py-0.5 text-xs font-medium">
            Aktywny
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <span className="text-muted-foreground text-xs">{phaseLabel}</span>
        <span className="text-muted-foreground text-xs">
          {formatPlanDate(plan.created_at)}
        </span>
      </div>

      {/* Archive/Activate/Duplicate buttons */}
      <div className="mt-2 flex gap-2">
        {plan.is_active ? (
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
            className="text-muted-foreground hover:text-foreground text-xs hover:underline disabled:opacity-50"
          >
            Archiwizuj
          </button>
        ) : (
          <button
            type="button"
            onClick={handleActivate}
            disabled={activateMutation.isPending}
            className="text-primary hover:text-primary/80 text-xs hover:underline disabled:opacity-50"
          >
            Aktywuj
          </button>
        )}
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={duplicateMutation.isPending}
          className="text-muted-foreground hover:text-foreground text-xs hover:underline disabled:opacity-50"
        >
          Duplikuj
        </button>
      </div>
    </div>
  );
}
