"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlanGenerationJob } from "@/lib/data/plan-job";

// =============================================================================
// KEYS
// =============================================================================

export const planJobKeys = {
  all: (athleteId: string) => ["athletes", athleteId, "plan-jobs"] as const,
  detail: (athleteId: string, jobId: string) =>
    [...planJobKeys.all(athleteId), jobId] as const,
};

// =============================================================================
// TYPES
// =============================================================================

interface JobResponse {
  data: PlanGenerationJob;
}

interface StartJobResponse {
  data: PlanGenerationJob;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Start a new plan generation job.
 */
export function useStartPlanJob(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<PlanGenerationJob> => {
      const response = await fetch(`/api/athletes/${athleteId}/plans/job`, {
        method: "POST",
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to start plan generation");
      }

      const json = (await response.json()) as StartJobResponse;
      return json.data;
    },
    onSuccess: () => {
      // Invalidate plan queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: ["athletes", athleteId, "plans"],
      });
    },
  });
}

/**
 * Poll job status with adaptive interval.
 * - 2s for first 30s
 * - 3s between 30-90s
 * - 5s after 90s
 * - Stops after 180s
 */
export function usePlanJob(athleteId: string, jobId: string | null) {
  return useQuery({
    queryKey: planJobKeys.detail(athleteId, jobId ?? ""),
    queryFn: async (): Promise<PlanGenerationJob> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/plans/job/${jobId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch job status");
      }

      const json = (await response.json()) as JobResponse;
      return json.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job) return 2000;

      // Terminal states — stop polling
      if (job.status === "succeeded" || job.status === "failed") {
        return false;
      }

      // Calculate time since job was created
      const createdAt = new Date(job.created_at).getTime();
      const elapsed = Date.now() - createdAt;

      // Adaptive polling cadence
      if (elapsed < 30_000) return 2000; // 2s for first 30s
      if (elapsed < 90_000) return 3000; // 3s between 30-90s
      if (elapsed < 180_000) return 5000; // 5s after 90s

      // Stop after 180s
      return false;
    },
    staleTime: 1000,
  });
}
