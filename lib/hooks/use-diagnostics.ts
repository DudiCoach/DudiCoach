"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDiagnostic,
  deleteDiagnostic,
  diagnosticKeys,
  fetchDiagnostics,
  updateDiagnostic,
  type DiagnosticFinding,
} from "@/lib/api/diagnostics";
import type {
  CreateDiagnosticInput,
  UpdateDiagnosticInput,
} from "@/lib/validation/diagnostic";

export function useDiagnostics(athleteId: string) {
  return useQuery({
    queryKey: diagnosticKeys.list(athleteId),
    queryFn: () => fetchDiagnostics(athleteId),
  });
}

export function useCreateDiagnostic(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDiagnosticInput) =>
      createDiagnostic(athleteId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: diagnosticKeys.list(athleteId),
      });
    },
  });
}

interface UpdateDiagnosticMutationInput {
  findingId: string;
  input: UpdateDiagnosticInput;
}

export function useUpdateDiagnostic(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, input }: UpdateDiagnosticMutationInput) =>
      updateDiagnostic(athleteId, findingId, input),
    onSuccess: (updated: DiagnosticFinding) => {
      queryClient.setQueryData(
        diagnosticKeys.list(athleteId),
        (previous: DiagnosticFinding[] | undefined) =>
          previous?.map((finding) =>
            finding.id === updated.id ? updated : finding,
          ) ?? [updated],
      );
    },
  });
}

interface DeleteDiagnosticMutationInput {
  findingId: string;
}

export function useDeleteDiagnostic(athleteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId }: DeleteDiagnosticMutationInput) =>
      deleteDiagnostic(athleteId, findingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: diagnosticKeys.list(athleteId),
      });
    },
  });
}