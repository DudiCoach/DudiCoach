"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CycleSummary } from "@/lib/data/cycle-summary";

// =============================================================================
// KEYS
// =============================================================================

export const summaryKeys = {
  all: (athleteId: string) => ["athletes", athleteId, "summaries"] as const,
  list: (athleteId: string) => [...summaryKeys.all(athleteId), "list"] as const,
  detail: (athleteId: string, summaryId: string) =>
    [...summaryKeys.all(athleteId), summaryId] as const,
};

// =============================================================================
// TYPES
// =============================================================================

interface SummariesResponse {
  data: CycleSummary[];
}

interface SummaryResponse {
  data: CycleSummary;
}

interface CreateSummaryInput {
  plan_id: string;
  cycle_number: number;
  title: string;
  notes?: string;
  results?: Array<{
    metric: string;
    before: string;
    after: string;
    improvement?: string;
  }>;
}

interface UpdateSummaryInput {
  title?: string;
  notes?: string;
  results?: Array<{
    metric: string;
    before: string;
    after: string;
    improvement?: string;
  }>;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetch all cycle summaries for an athlete.
 */
export function useCycleSummaries(athleteId: string) {
  return useQuery({
    queryKey: summaryKeys.list(athleteId),
    queryFn: async (): Promise<CycleSummary[]> => {
      const response = await fetch(`/api/athletes/${athleteId}/summaries`);
      if (!response.ok) {
        throw new Error("Failed to fetch summaries");
      }
      const json = (await response.json()) as SummariesResponse;
      return json.data;
    },
  });
}

/**
 * Create a new cycle summary.
 */
export function useCreateCycleSummary(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSummaryInput): Promise<CycleSummary> => {
      const response = await fetch(`/api/athletes/${athleteId}/summaries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to create summary");
      }

      const json = (await response.json()) as SummaryResponse;
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: summaryKeys.list(athleteId),
      });
    },
  });
}

/**
 * Update a cycle summary.
 */
export function useUpdateCycleSummary(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      summaryId,
      input,
    }: {
      summaryId: string;
      input: UpdateSummaryInput;
    }): Promise<void> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/summaries/${summaryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to update summary");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: summaryKeys.list(athleteId),
      });
    },
  });
}

/**
 * Delete a cycle summary.
 */
export function useDeleteCycleSummary(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (summaryId: string): Promise<void> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/summaries/${summaryId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to delete summary");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: summaryKeys.list(athleteId),
      });
    },
  });
}
