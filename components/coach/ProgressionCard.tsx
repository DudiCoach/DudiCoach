"use client";

import { useEffect, useRef, useState } from "react";

import { pl } from "@/lib/i18n/pl";
import { useDeleteProgression, useUpdateProgression } from "@/lib/hooks/use-progressions";
import type { LoadProgression } from "@/lib/api/progressions";
import ProgressionChart from "./ProgressionChart";

interface ProgressionCardProps {
  athleteId: string;
  exerciseName: string;
  entries: LoadProgression[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

function formatWeight(weight: number): string {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(
    weight,
  );
}

function entryCountLabel(count: number): string {
  if (count === 1) return "wpis";
  const mod100 = count % 100;
  if (mod100 >= 12 && mod100 <= 14) return "wpisów";
  const mod10 = count % 10;
  if (mod10 >= 2 && mod10 <= 4) return "wpisy";
  return "wpisów";
}

export default function ProgressionCard({
  athleteId,
  exerciseName,
  entries,
}: ProgressionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const deleteMutation = useDeleteProgression(athleteId);

  const sorted = [...entries].sort((a, b) =>
    a.entry_date < b.entry_date
      ? -1
      : a.entry_date > b.entry_date
        ? 1
        : a.created_at < b.created_at
          ? -1
          : a.created_at > b.created_at
            ? 1
            : 0,
  );
  const last = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  const changeDelta =
    last && previous ? last.weight_kg - previous.weight_kg : null;

  function changeBadge() {
    if (changeDelta === null) return null;
    const text =
      changeDelta === 0
        ? pl.coach.athlete.progressions.changeBadge.unchanged
        : changeDelta > 0
          ? pl.coach.athlete.progressions.changeBadge.up.replace(
              "{delta}",
              formatWeight(changeDelta),
            )
          : pl.coach.athlete.progressions.changeBadge.down.replace(
              "{delta}",
              formatWeight(Math.abs(changeDelta)),
            );
    const tone =
      changeDelta === 0
        ? "bg-muted text-muted-foreground"
        : changeDelta > 0
          ? "bg-success/15 text-success"
          : "bg-destructive/15 text-destructive";
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
      >
        {text}
      </span>
    );
  }

  useEffect(() => {
    if (saveState === "idle") return;
    const timer = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [saveState]);

  function handleDelete(entryId: string) {
    if (!window.confirm(pl.coach.athlete.progressions.deleteConfirm)) return;
    deleteMutation.mutate({ entryId });
  }

  return (
    <article className="rounded-card border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        disabled={deleteMutation.isPending}
        className="text-left w-full"
        aria-expanded={expanded}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{exerciseName}</p>
          {changeBadge()}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {entries.length} {entryCountLabel(entries.length)}
        </p>
      </button>

      <div className="mt-3">
        <ProgressionChart entries={sorted} exerciseName={exerciseName} />
      </div>

      {saveState !== "idle" && (
        <p
          role="status"
          className={`mt-2 text-xs ${
            saveState === "error" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {saveState === "saving" && pl.coach.athlete.progressions.saving}
          {saveState === "saved" && pl.coach.athlete.progressions.saved}
          {saveState === "error" && pl.coach.athlete.progressions.saveFailed}
        </p>
      )}

      {(deleteMutation.error) && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {pl.coach.athlete.progressions.errorGeneric}
        </p>
      )}

      {expanded && (
        <ul className="mt-4 space-y-3 border-t border-border pt-4">
          {sorted.map((entry) => (
            <ProgressionEntryRow
              key={entry.id}
              athleteId={athleteId}
              entry={entry}
              onDelete={() => handleDelete(entry.id)}
              deletePending={deleteMutation.isPending}
              onSaveStateChange={setSaveState}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

interface ProgressionEntryRowProps {
  athleteId: string;
  entry: LoadProgression;
  onDelete: () => void;
  deletePending: boolean;
  onSaveStateChange: (state: SaveState) => void;
}

function ProgressionEntryRow({
  athleteId,
  entry,
  onDelete,
  deletePending,
  onSaveStateChange,
}: ProgressionEntryRowProps) {
  const [weight, setWeight] = useState(String(entry.weight_kg));
  const [reps, setReps] = useState(entry.reps ?? "");
  const [sets, setSets] = useState(entry.sets ?? "");
  const [note, setNote] = useState(entry.note ?? "");
  const [entryDate, setEntryDate] = useState(entry.entry_date);
  const [conflictError, setConflictError] = useState(false);

  const lastPersistedWeight = useRef(String(entry.weight_kg));
  const lastPersistedReps = useRef(entry.reps ?? "");
  const lastPersistedSets = useRef(entry.sets ?? "");
  const lastPersistedNote = useRef(entry.note ?? "");
  const lastPersistedDate = useRef(entry.entry_date);

  const updateMutation = useUpdateProgression(athleteId);

  function persist(patch: {
    weight_kg?: number;
    reps?: string;
    sets?: string;
    note?: string;
    entry_date?: string;
  }) {
    setConflictError(false);
    onSaveStateChange("saving");
    updateMutation.mutate(
      { entryId: entry.id, input: patch },
      {
        onSuccess: () => {
          if (patch.weight_kg !== undefined) {
            lastPersistedWeight.current = String(patch.weight_kg);
          }
          if (patch.reps !== undefined) {
            lastPersistedReps.current = patch.reps;
          }
          if (patch.sets !== undefined) {
            lastPersistedSets.current = patch.sets;
          }
          if (patch.note !== undefined) {
            lastPersistedNote.current = patch.note;
          }
          if (patch.entry_date !== undefined) {
            lastPersistedDate.current = patch.entry_date;
          }
          onSaveStateChange("saved");
        },
        onError: (error) => {
          setWeight(lastPersistedWeight.current);
          setReps(lastPersistedReps.current);
          setSets(lastPersistedSets.current);
          setNote(lastPersistedNote.current);
          setEntryDate(lastPersistedDate.current);
          if (
            error instanceof Error &&
            error.message.includes("już istnieje")
          ) {
            setConflictError(true);
          } else {
            onSaveStateChange("error");
          }
        },
      },
    );
  }

  const disabled = updateMutation.isPending;

  return (
    <li className="rounded-input border border-border bg-input/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor={`prog-weight-${entry.id}`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {pl.coach.athlete.progressions.field.weight}
          </label>
          <input
            id={`prog-weight-${entry.id}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            max="9999.9"
            value={weight}
            disabled={disabled}
            onChange={(event) => setWeight(event.target.value)}
            onBlur={() => {
              const parsed = Number(weight);
              if (
                Number.isNaN(parsed) ||
                parsed <= 0 ||
                parsed > 9999.9 ||
                parsed === Number(lastPersistedWeight.current)
              ) {
                setWeight(lastPersistedWeight.current);
                return;
              }
              persist({ weight_kg: parsed });
            }}
            className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor={`prog-reps-${entry.id}`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {pl.coach.athlete.progressions.field.reps}
          </label>
          <input
            id={`prog-reps-${entry.id}`}
            value={reps}
            disabled={disabled}
            onChange={(event) => setReps(event.target.value)}
            onBlur={() => {
              if (reps === lastPersistedReps.current) return;
              persist({ reps });
            }}
            className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor={`prog-sets-${entry.id}`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {pl.coach.athlete.progressions.field.sets}
          </label>
          <input
            id={`prog-sets-${entry.id}`}
            value={sets}
            disabled={disabled}
            onChange={(event) => setSets(event.target.value)}
            onBlur={() => {
              if (sets === lastPersistedSets.current) return;
              persist({ sets });
            }}
            className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor={`prog-date-${entry.id}`}
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {pl.coach.athlete.progressions.field.entryDate}
          </label>
          <input
            id={`prog-date-${entry.id}`}
            type="date"
            value={entryDate}
            disabled={disabled}
            onChange={(event) => setEntryDate(event.target.value)}
            onBlur={() => {
              if (
                entryDate === lastPersistedDate.current ||
                entryDate === ""
              ) {
                setEntryDate(lastPersistedDate.current);
                return;
              }
              persist({ entry_date: entryDate });
            }}
            className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
          {conflictError && (
            <p role="alert" className="mt-1.5 text-xs text-destructive">
              {pl.coach.athlete.progressions.duplicate}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <label
          htmlFor={`prog-note-${entry.id}`}
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          {pl.coach.athlete.progressions.field.note}
        </label>
        <textarea
          id={`prog-note-${entry.id}`}
          rows={2}
          value={note}
          disabled={disabled}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => {
            if (note === lastPersistedNote.current) return;
            persist({ note });
          }}
          className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm resize-y disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">
          {formatWeight(entry.weight_kg)} kg • {entry.reps || "—"} ×{" "}
          {entry.sets || "—"}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={deletePending}
          className="rounded-input border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
          aria-label={pl.common.delete}
        >
          {deletePending ? pl.coach.athlete.progressions.deleting : pl.common.delete}
        </button>
      </div>
    </li>
  );
}