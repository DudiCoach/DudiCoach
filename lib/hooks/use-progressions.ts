"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProgression,
  deleteProgression,
  fetchProgressions,
  progressionKeys,
  updateProgression,
} from "@/lib/api/progressions";
import type {
  CreateProgressionInput,
  UpdateProgressionInput,
} from "@/lib/validation/progression";

export function useProgressions(athleteId: string) {
  return useQuery({
    queryKey: progressionKeys.list(athleteId),
    queryFn: () => fetchProgressions(athleteId),
  });
}

export function useCreateProgression(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProgressionInput) =>
      createProgression(athleteId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: progressionKeys.list(athleteId),
      });
    },
  });
}

interface UpdateProgressionMutationInput {
  entryId: string;
  input: UpdateProgressionInput;
}

export function useUpdateProgression(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, input }: UpdateProgressionMutationInput) =>
      updateProgression(athleteId, entryId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: progressionKeys.list(athleteId),
      });
    },
  });
}

interface DeleteProgressionMutationInput {
  entryId: string;
}

export function useDeleteProgression(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId }: DeleteProgressionMutationInput) =>
      deleteProgression(athleteId, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: progressionKeys.list(athleteId),
      });
    },
  });
}