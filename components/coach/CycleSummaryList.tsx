"use client";

import { useState } from "react";
import { pl } from "@/lib/i18n/pl";
import type { CycleSummary } from "@/lib/data/cycle-summary";

interface CycleSummaryListProps {
  summaries: CycleSummary[];
  onCreateNew: () => void;
}

/**
 * Displays a list of cycle summaries for an athlete.
 */
export default function CycleSummaryList({
  summaries,
  onCreateNew,
}: CycleSummaryListProps) {
  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">
          {pl.coach.athlete.summaries.sectionTitle}
        </h2>
        <button
          type="button"
          onClick={onCreateNew}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-pill px-4 py-1.5 text-sm font-medium transition-colors"
        >
          {pl.common.add}
        </button>
      </div>

      {summaries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {pl.coach.athlete.summaries.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => (
            <SummaryCard key={summary.id} summary={summary} />
          ))}
        </div>
      )}
    </section>
  );
}

interface SummaryCardProps {
  summary: CycleSummary;
}

function SummaryCard({ summary }: SummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-card border border-border p-4">
      <div
        data-testid={`summary-${summary.id}`}
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="flex cursor-pointer items-start justify-between"
      >
        <div>
          <h3 className="text-foreground font-medium">{summary.title}</h3>
          <p className="text-muted-foreground text-xs">
            Cykl {summary.cycle_number} •{" "}
            {new Date(summary.completed_at).toLocaleDateString("pl-PL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className={`text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
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

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {summary.notes && (
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Notatki
              </p>
              <p className="text-foreground whitespace-pre-wrap text-sm">
                {summary.notes}
              </p>
            </div>
          )}

          {summary.results.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Wyniki
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 text-left">Metryka</th>
                    <th className="py-1 text-left">Przed</th>
                    <th className="py-1 text-left">Po</th>
                    <th className="py-1 text-left">Poprawa</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.results.map((result, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1">{result.metric}</td>
                      <td className="py-1">{result.before}</td>
                      <td className="py-1">{result.after}</td>
                      <td className="py-1 text-success">
                        {result.improvement}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
