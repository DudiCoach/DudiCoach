"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProgression,
  deleteProgression,
  fetchProgressions,
  progressionKeys,
  updateProgression,
  type Progression,
} from "@/lib/api/progressions";
import type {
  CreateProgressionInput,
  UpdateProgressionInput,
} from "@/lib/validation/progression";

export function useProgressions(athleteId: string, exercise?: string) {
  return useQuery({
    queryKey: exercise
      ? progressionKeys.byExercise(athleteId, exercise)
      : progressionKeys.list(athleteId),
    queryFn: () => fetchProgressions(athleteId, exercise),
  });
}

export function useCreateProgression(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProgressionInput) =>
      createProgression(athleteId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: progressionKeys.all(athleteId),
      });
    },
  });
}

interface UpdateProgressionMutationInput {
  progressionId: string;
  input: UpdateProgressionInput;
}

export function useUpdateProgression(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ progressionId, input }: UpdateProgressionMutationInput) =>
      updateProgression(athleteId, progressionId, input),
    onSuccess: (updated: Progression) => {
      queryClient.setQueryData(
        progressionKeys.list(athleteId),
        (previous: { data: Progression[]; exercises: string[] } | undefined) =>
          previous
            ? {
                ...previous,
                data: previous.data.map((p) =>
                  p.id === updated.id ? updated : p,
                ),
              }
            : undefined,
      );
    },
  });
}

interface DeleteProgressionMutationInput {
  progressionId: string;
}

export function useDeleteProgression(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ progressionId }: DeleteProgressionMutationInput) =>
      deleteProgression(athleteId, progressionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: progressionKeys.all(athleteId),
      });
    },
  });
}
