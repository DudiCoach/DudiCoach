"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionFeedback } from "@/lib/data/session-feedback";

// =============================================================================
// KEYS
// =============================================================================

export const feedbackKeys = {
  all: (athleteId: string, planId: string) =>
    ["athletes", athleteId, "feedback", planId] as const,
  list: (athleteId: string, planId: string) =>
    [...feedbackKeys.all(athleteId, planId), "list"] as const,
};

// =============================================================================
// TYPES
// =============================================================================

interface FeedbackResponse {
  data: SessionFeedback[];
}

interface UpsertFeedbackInput {
  plan_id: string;
  week_number: number;
  day_number: number;
  feedback_text: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetch all feedback for an athlete's plan (coach view).
 */
export function useSessionFeedback(athleteId: string, planId: string) {
  return useQuery({
    queryKey: feedbackKeys.list(athleteId, planId),
    queryFn: async (): Promise<SessionFeedback[]> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/feedback?plan_id=${planId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch feedback");
      }
      const json = (await response.json()) as FeedbackResponse;
      return json.data;
    },
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Fetch all feedback for a plan by share code (athlete view).
 */
export function usePublicSessionFeedback(shareCode: string, planId: string) {
  return useQuery({
    queryKey: ["public", "feedback", shareCode, planId],
    queryFn: async (): Promise<SessionFeedback[]> => {
      const response = await fetch(
        `/api/athlete/${shareCode}/feedback?plan_id=${planId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch feedback");
      }
      const json = (await response.json()) as FeedbackResponse;
      return json.data;
    },
    staleTime: 30_000,
  });
}

/**
 * Create or update feedback for a specific day (athlete view).
 */
export function useUpsertSessionFeedback(shareCode: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertFeedbackInput): Promise<SessionFeedback> => {
      const response = await fetch(`/api/athlete/${shareCode}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to save feedback");
      }

      const json = (await response.json()) as { data: SessionFeedback };
      return json.data;
    },
    onSuccess: () => {
      // Invalidate all feedback queries for this share code
      queryClient.invalidateQueries({
        queryKey: ["public", "feedback", shareCode],
      });
    },
  });
}
