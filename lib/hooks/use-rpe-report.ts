"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RpeReport } from "@/lib/data/rpe-report";

// =============================================================================
// TYPES
// =============================================================================

interface RpeReportResponse {
  data: RpeReport[];
}

interface RpeReportSingleResponse {
  data: RpeReport;
}

interface UpsertRpeInput {
  plan_id: string;
  week_number: number;
  day_number: number;
  rpe: number;
  pain_level?: number;
  pain_location?: string;
  notes?: string;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetch all RPE reports for a plan (coach view).
 */
export function useRpeReports(athleteId: string, planId: string) {
  return useQuery({
    queryKey: ["athletes", athleteId, "rpe", planId],
    queryFn: async (): Promise<RpeReport[]> => {
      const response = await fetch(
        `/api/athletes/${athleteId}/rpe?plan_id=${planId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch RPE reports");
      }
      const json = (await response.json()) as RpeReportResponse;
      return json.data;
    },
    staleTime: 30_000,
  });
}

/**
 * Fetch all RPE reports for a plan by share code (athlete view).
 */
export function usePublicRpeReports(shareCode: string, planId: string) {
  return useQuery({
    queryKey: ["public", "rpe", shareCode, planId],
    queryFn: async (): Promise<RpeReport[]> => {
      const response = await fetch(
        `/api/athlete/${shareCode}/rpe?plan_id=${planId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch RPE reports");
      }
      const json = (await response.json()) as RpeReportResponse;
      return json.data;
    },
    staleTime: 30_000,
  });
}

/**
 * Create or update an RPE report for a specific day (athlete view).
 */
export function useUpsertRpeReport(shareCode: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertRpeInput): Promise<RpeReport> => {
      const response = await fetch(`/api/athlete/${shareCode}/rpe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Failed to save RPE report");
      }

      const json = (await response.json()) as RpeReportSingleResponse;
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["public", "rpe", shareCode],
      });
    },
  });
}
