/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import DiagnosticCard from "@/components/coach/DiagnosticCard";
import type { DiagnosticFinding } from "@/lib/api/diagnostics";

const mockUseUpdateDiagnostic = vi.fn();
const mockUseDeleteDiagnostic = vi.fn();

vi.mock("@/lib/hooks/use-diagnostics", () => ({
  useUpdateDiagnostic: (...args: unknown[]) =>
    mockUseUpdateDiagnostic(...(args as [])),
  useDeleteDiagnostic: (...args: unknown[]) =>
    mockUseDeleteDiagnostic(...(args as [])),
}));

function makeFinding(overrides: Partial<DiagnosticFinding> = {}): DiagnosticFinding {
  return {
    id: "finding-uuid-001",
    athlete_id: "athlete-uuid-001",
    muscle_key: "anterior_deltoid",
    side: "left",
    severity: "weak",
    notes: "początkowa notatka",
    observed_at: "2026-08-19",
    created_at: "2026-08-19T12:00:00Z",
    updated_at: "2026-08-19T12:00:00Z",
    ...overrides,
  };
}

function setupMutations() {
  const updateMutate = vi.fn();
  const deleteMutate = vi.fn();
  mockUseUpdateDiagnostic.mockReturnValue({
    isPending: false,
    error: null,
    mutate: updateMutate,
  });
  mockUseDeleteDiagnostic.mockReturnValue({
    isPending: false,
    error: null,
    mutate: deleteMutate,
  });
  return { updateMutate, deleteMutate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DiagnosticCard", () => {
  it("shows the muscle title and side", () => {
    setupMutations();
    render(<DiagnosticCard athleteId="a1" finding={makeFinding()} />);
    expect(
      screen.getByText("Naramienny przedni (Anterior Deltoid)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lewa/)).toBeInTheDocument();
  });

  it("persists a severity change and shows the saved state", () => {
    const { updateMutate } = setupMutations();
    render(<DiagnosticCard athleteId="a1" finding={makeFinding()} />);

    fireEvent.click(screen.getByRole("button", { name: /Naramienny przedni/i }));
    fireEvent.change(screen.getByLabelText(/Stopień/i), {
      target: { value: "dysfunction" },
    });

    expect(updateMutate).toHaveBeenCalledWith(
      { findingId: "finding-uuid-001", input: { severity: "dysfunction" } },
      expect.any(Object),
    );
    const onSuccess = updateMutate.mock.calls[0][1].onSuccess as () => void;
    act(() => onSuccess());
    expect(screen.getByText("Zapisano")).toBeInTheDocument();
  });

  it("reverts the severity to the persisted value when the save fails", () => {
    const { updateMutate } = setupMutations();
    render(<DiagnosticCard athleteId="a1" finding={makeFinding()} />);

    fireEvent.click(screen.getByRole("button", { name: /Naramienny przedni/i }));
    fireEvent.change(screen.getByLabelText(/Stopień/i), {
      target: { value: "dysfunction" },
    });
    const onError = updateMutate.mock.calls[0][1].onError as () => void;
    act(() => onError());

    expect(screen.getByLabelText(/Stopień/i)).toHaveValue("weak");
    expect(screen.getByText("Błąd zapisu")).toBeInTheDocument();
  });

  it("does not re-PATCH notes on blur after a successful save", () => {
    const { updateMutate } = setupMutations();
    render(<DiagnosticCard athleteId="a1" finding={makeFinding()} />);

    fireEvent.click(screen.getByRole("button", { name: /Naramienny przedni/i }));
    const textarea = screen.getByLabelText(/Notatki/i);

    fireEvent.change(textarea, { target: { value: "nowa notatka" } });
    fireEvent.blur(textarea);
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).toHaveBeenCalledWith(
      { findingId: "finding-uuid-001", input: { notes: "nowa notatka" } },
      expect.any(Object),
    );

    const onSuccess = updateMutate.mock.calls[0][1].onSuccess as () => void;
    act(() => onSuccess());
    fireEvent.blur(textarea);
    expect(updateMutate).toHaveBeenCalledTimes(1);
  });

  it("deletes only after a confirmed dialog", () => {
    const { deleteMutate } = setupMutations();
    const confirmMock = vi.fn().mockReturnValue(false);
    window.confirm = confirmMock;
    render(<DiagnosticCard athleteId="a1" finding={makeFinding()} />);

    fireEvent.click(screen.getByRole("button", { name: /Usuń/i }));
    expect(deleteMutate).not.toHaveBeenCalled();

    confirmMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Usuń/i }));
    expect(deleteMutate).toHaveBeenCalledWith({ findingId: "finding-uuid-001" });
  });
});