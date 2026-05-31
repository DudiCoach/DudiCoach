"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createFmsDiagnostic,
  deleteFmsDiagnostic,
  fetchFmsDiagnostics,
  fmsDiagnosticKeys,
  updateFmsDiagnostic,
  type FmsDiagnostic,
} from "@/lib/api/fms-diagnostics";
import type {
  CreateFmsDiagnosticInput,
  UpdateFmsDiagnosticInput,
} from "@/lib/validation/fms-diagnostic";

export function useFmsDiagnostics(athleteId: string) {
  return useQuery({
    queryKey: fmsDiagnosticKeys.list(athleteId),
    queryFn: () => fetchFmsDiagnostics(athleteId),
  });
}

export function useCreateFmsDiagnostic(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFmsDiagnosticInput) =>
      createFmsDiagnostic(athleteId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: fmsDiagnosticKeys.list(athleteId),
      });
    },
  });
}

interface UpdateFmsDiagnosticMutationInput {
  diagnosticId: string;
  input: UpdateFmsDiagnosticInput;
}

export function useUpdateFmsDiagnostic(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ diagnosticId, input }: UpdateFmsDiagnosticMutationInput) =>
      updateFmsDiagnostic(athleteId, diagnosticId, input),
    onSuccess: (updated: FmsDiagnostic) => {
      queryClient.setQueryData(
        fmsDiagnosticKeys.list(athleteId),
        (previous: FmsDiagnostic[] | undefined) =>
          previous?.map((d) => (d.id === updated.id ? updated : d)) ?? [
            updated,
          ],
      );
    },
  });
}

interface DeleteFmsDiagnosticMutationInput {
  diagnosticId: string;
}

export function useDeleteFmsDiagnostic(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ diagnosticId }: DeleteFmsDiagnosticMutationInput) =>
      deleteFmsDiagnostic(athleteId, diagnosticId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: fmsDiagnosticKeys.list(athleteId),
      });
    },
  });
}
