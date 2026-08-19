"use client";

import { useEffect, useRef, useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useDeleteDiagnostic, useUpdateDiagnostic } from "@/lib/hooks/use-diagnostics";
import type { DiagnosticFinding } from "@/lib/api/diagnostics";
import { getMuscleByKey } from "@/lib/constants/muscles";
import { SEVERITIES } from "@/lib/validation/diagnostic";

interface DiagnosticCardProps {
  athleteId: string;
  finding: DiagnosticFinding;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function DiagnosticCard({
  athleteId,
  finding,
}: DiagnosticCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [severity, setSeverity] = useState(finding.severity);
  const [notes, setNotes] = useState(finding.notes ?? "");
  const [observedAt, setObservedAt] = useState(finding.observed_at);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const lastPersistedSeverity = useRef(finding.severity);
  const lastPersistedNotes = useRef(finding.notes ?? "");
  const lastPersistedObservedAt = useRef(finding.observed_at);

  const updateMutation = useUpdateDiagnostic(athleteId);
  const deleteMutation = useDeleteDiagnostic(athleteId);

  const muscle = getMuscleByKey(finding.muscle_key);

  useEffect(() => {
    if (saveState === "idle") return;
    const timer = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [saveState]);

  function persist(patch: {
    severity?: "weak" | "very_weak" | "dysfunction";
    notes?: string | null;
    observed_at?: string;
  }) {
    setSaveState("saving");
    updateMutation.mutate(
      { findingId: finding.id, input: patch },
      {
        onSuccess: () => {
          if (patch.severity !== undefined) {
            lastPersistedSeverity.current = patch.severity;
          }
          if (patch.notes !== undefined) {
            lastPersistedNotes.current = patch.notes ?? "";
          }
          if (patch.observed_at !== undefined) {
            lastPersistedObservedAt.current = patch.observed_at;
          }
          setSaveState("saved");
        },
        onError: () => {
          setSeverity(lastPersistedSeverity.current);
          setNotes(lastPersistedNotes.current);
          setObservedAt(lastPersistedObservedAt.current);
          setSaveState("error");
        },
      },
    );
  }

  function handleDelete() {
    if (!window.confirm(pl.coach.athlete.diagnostics.deleteConfirm)) return;
    deleteMutation.mutate({ findingId: finding.id });
  }

  const title = muscle
    ? `${muscle.namePl} (${muscle.nameLatin})`
    : finding.muscle_key;

  return (
    <article className="rounded-card border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          disabled={deleteMutation.isPending || updateMutation.isPending}
          className="text-left flex-1"
          aria-expanded={expanded}
        >
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pl.coach.athlete.diagnostics.side[
              finding.side as keyof typeof pl.coach.athlete.diagnostics.side
            ] ?? finding.side}
            {" • "}
            {observedAt}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                severity === "dysfunction"
                  ? "bg-destructive/15 text-destructive"
                  : severity === "very_weak"
                    ? "bg-warning/15 text-warning"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {pl.coach.athlete.diagnostics.severity[
                severity as keyof typeof pl.coach.athlete.diagnostics.severity
              ] ?? severity}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="rounded-input border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
          aria-label={pl.common.delete}
        >
          {deleteMutation.isPending
            ? pl.coach.athlete.diagnostics.deleting
            : pl.common.delete}
        </button>
      </div>

      {saveState !== "idle" && (
        <p
          role="status"
          className={`mt-2 text-xs ${
            saveState === "error" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {saveState === "saving" && pl.coach.athlete.diagnostics.saving}
          {saveState === "saved" && pl.coach.athlete.diagnostics.saved}
          {saveState === "error" && pl.coach.athlete.diagnostics.saveFailed}
        </p>
      )}

      {(deleteMutation.error || updateMutation.error) && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {pl.coach.athlete.diagnostics.errorGeneric}
        </p>
      )}

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <label
              htmlFor={`diag-severity-${finding.id}`}
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {pl.coach.athlete.diagnostics.field.severity}
            </label>
            <select
              id={`diag-severity-${finding.id}`}
              value={severity}
              disabled={updateMutation.isPending}
              onChange={(event) => {
                const next = event.target.value as
                  | "weak"
                  | "very_weak"
                  | "dysfunction";
                setSeverity(next);
                persist({ severity: next });
              }}
              className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {pl.coach.athlete.diagnostics.severity[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`diag-date-${finding.id}`}
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {pl.coach.athlete.diagnostics.field.observedAt}
            </label>
            <input
              id={`diag-date-${finding.id}`}
              type="date"
              value={observedAt}
              disabled={updateMutation.isPending}
              onChange={(event) => {
                const next = event.target.value;
                setObservedAt(next);
                persist({ observed_at: next });
              }}
              className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor={`diag-notes-${finding.id}`}
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {pl.coach.athlete.diagnostics.field.notes}
            </label>
            <textarea
              id={`diag-notes-${finding.id}`}
              rows={3}
              value={notes}
              disabled={updateMutation.isPending}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => {
                if (notes === lastPersistedNotes.current) return;
                persist({ notes: notes === "" ? null : notes });
              }}
              className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm resize-y disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
      )}
    </article>
  );
}