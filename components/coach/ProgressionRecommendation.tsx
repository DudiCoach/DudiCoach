"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

interface Recommendation {
  exerciseName: string;
  currentLoad: string;
  recommendedLoad: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

interface RecommendationResponse {
  recommendations: Recommendation[];
  summary: string;
}

interface ProgressionRecommendationProps {
  athleteId: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-success/10 text-success border-success/30",
};

/**
 * AI-powered progression recommendation panel.
 * Fetches data and calls the API to get AI recommendations.
 */
export default function ProgressionRecommendation({
  athleteId,
}: ProgressionRecommendationProps) {
  const [result, setResult] = useState<RecommendationResponse | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<RecommendationResponse> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/progression-recommendation`,
        { method: "POST" },
      );

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to get recommendations");
      }

      const json = (await response.json()) as { data: RecommendationResponse };
      return json.data;
    },
    onSuccess: (data) => setResult(data),
  });

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">
          Rekomendacje AI
        </h2>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-pill px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? "Analizowanie..." : "Generuj rekomendacje"}
        </button>
      </div>

      <p className="text-muted-foreground mb-4 text-sm">
        AI przeanalizuje raporty RPE, informacje zwrotne, diagnostykę FMS i
        obecne progresje, aby zaproponować zmiany w obciążeniach.
      </p>

      {mutation.isError && (
        <p role="alert" className="text-destructive text-sm">
          {mutation.error.message}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <p className="text-foreground text-sm leading-relaxed">
            {result.summary}
          </p>

          {result.recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Szczegółowe rekomendacje
              </h3>
              {result.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={`rounded-card border p-3 ${PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.medium}`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-foreground font-medium text-sm">
                      {rec.exerciseName}
                    </p>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium">
                      {rec.priority}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Obecne: </span>
                      <span className="text-foreground">{rec.currentLoad}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Zalecane: </span>
                      <span className="text-foreground">
                        {rec.recommendedLoad}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {rec.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
