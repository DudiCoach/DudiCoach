"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { planKeys } from "@/lib/api/plans";

/**
 * Archive a training plan.
 */
export function useArchivePlan(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string): Promise<void> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/plans/${planId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        },
      );

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to archive plan");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: planKeys.byAthlete(athleteId),
      });
    },
  });
}

/**
 * Activate a training plan.
 */
export function useActivatePlan(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string): Promise<void> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/plans/${planId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "activate" }),
        },
      );

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to activate plan");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: planKeys.byAthlete(athleteId),
      });
    },
  });
}

/**
 * Duplicate a training plan.
 */
export function useDuplicatePlan(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      planId,
      newName,
    }: {
      planId: string;
      newName: string;
    }): Promise<void> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/plans/${planId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "duplicate", plan_name: newName }),
        },
      );

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to duplicate plan");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: planKeys.byAthlete(athleteId),
      });
    },
  });
}
