"use client";

import { useState, useMemo } from "react";
import { pl } from "@/lib/i18n/pl";
import type { FmsDiagnostic } from "@/lib/api/fms-diagnostics";
import type { FmsRegion } from "@/lib/constants/fms-muscles";
import { REGION_LABELS } from "@/lib/constants/fms-muscles";

interface FmsSnapshotHistoryProps {
  diagnostics: FmsDiagnostic[];
}

interface Snapshot {
  date: string;
  dateLabel: string;
  diagnostics: FmsDiagnostic[];
  regionCounts: Record<FmsRegion, number>;
}

/**
 * Groups diagnostics by date to create snapshots.
 * Allows viewing historical FMS diagnostic data over time.
 */
export default function FmsSnapshotHistory({ diagnostics }: FmsSnapshotHistoryProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);

  const snapshots = useMemo(() => {
    const grouped = new Map<string, FmsDiagnostic[]>();

    for (const d of diagnostics) {
      const date = new Date(d.created_at).toISOString().split("T")[0];
      const existing = grouped.get(date) ?? [];
      existing.push(d);
      grouped.set(date, existing);
    }

    const result: Snapshot[] = [];
    for (const [date, items] of grouped) {
      const regionCounts: Record<FmsRegion, number> = {
        upper: 0,
        lower: 0,
        foot: 0,
      };

      for (const item of items) {
        const region = item.region as FmsRegion;
        if (region in regionCounts) {
          regionCounts[region]++;
        }
      }

      result.push({
        date,
        dateLabel: new Date(date).toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        diagnostics: items,
        regionCounts,
      });
    }

    // Sort by date descending (newest first)
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [diagnostics]);

  if (snapshots.length === 0) {
    return null;
  }

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <h2 className="text-foreground mb-4 text-lg font-semibold">
        {pl.coach.athlete.diagnostics.historyTitle}
      </h2>

      <div className="space-y-3">
        {snapshots.map((snapshot) => (
          <div
            key={snapshot.date}
            className="rounded-card border border-border p-3"
          >
            <div
              data-testid={`snapshot-${snapshot.date}`}
              role="button"
              tabIndex={0}
              onClick={() =>
                setSelectedSnapshot(
                  selectedSnapshot === snapshot.date ? null : snapshot.date,
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedSnapshot(
                    selectedSnapshot === snapshot.date ? null : snapshot.date,
                  );
                }
              }}
              className="flex cursor-pointer items-center justify-between"
            >
              <div>
                <p className="text-foreground font-medium">
                  {snapshot.dateLabel}
                </p>
                <p className="text-muted-foreground text-xs">
                  {snapshot.diagnostics.length} wpisów
                  {snapshot.regionCounts.upper > 0 &&
                    ` • ${snapshot.regionCounts.upper} górna`}
                  {snapshot.regionCounts.lower > 0 &&
                    ` • ${snapshot.regionCounts.lower} dolna`}
                  {snapshot.regionCounts.foot > 0 &&
                    ` • ${snapshot.regionCounts.foot} stopa`}
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className={`text-muted-foreground transition-transform ${
                  selectedSnapshot === snapshot.date ? "rotate-180" : ""
                }`}
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {selectedSnapshot === snapshot.date && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {snapshot.diagnostics.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {REGION_LABELS[d.region as FmsRegion]} • {d.muscle}
                      {d.side && ` (${d.side})`}
                    </span>
                    <span className="text-muted-foreground">
                      Stopień: {d.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
