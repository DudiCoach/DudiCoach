/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { pl } from "@/lib/i18n/pl";
import DiagnosticCreateForm from "@/components/coach/DiagnosticCreateForm";

const mockUseCreateDiagnostic = vi.fn();

vi.mock("@/lib/hooks/use-diagnostics", () => ({
  useCreateDiagnostic: (...args: unknown[]) =>
    mockUseCreateDiagnostic(...(args as [])),
}));

function setupMutation(overrides: Record<string, unknown> = {}) {
  const mutateAsync = vi.fn();
  const mutation = {
    isPending: false,
    error: null as Error | null,
    mutateAsync,
    ...overrides,
  };
  mockUseCreateDiagnostic.mockReturnValue(mutation);
  return mutation;
}

function selectMuscle(name: string) {
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "deltoid" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveAttribute("placeholder", `${name} (${nameLatin[name]})`);
}

const nameLatin: Record<string, string> = {
  "Naramienny przedni": "Anterior Deltoid",
};

function submitForm() {
  const form = screen.getByText(pl.coach.athlete.diagnostics.createTitle)
    .closest("form");
  if (!form) throw new Error("create form not found");
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DiagnosticCreateForm", () => {
  it("keeps the submit button disabled until a muscle is selected", () => {
    setupMutation();
    render(
      <DiagnosticCreateForm athleteId="a1" onClose={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /^Dodaj znalezisko$/i })).toBeDisabled();

    selectMuscle("Naramienny przedni");
    expect(screen.getByRole("button", { name: /^Dodaj znalezisko$/i })).toBeEnabled();
  });

  it("submits the expected payload and closes the form on success", async () => {
    const mutation = setupMutation();
    mutation.mutateAsync.mockResolvedValue({ id: "f1" });
    const onClose = vi.fn();
    render(<DiagnosticCreateForm athleteId="a1" onClose={onClose} />);

    selectMuscle("Naramienny przedni");
    fireEvent.change(screen.getByLabelText(/Data badania/i), {
      target: { value: "2026-08-19" },
    });
    fireEvent.change(screen.getByLabelText(/Notatki/i), {
      target: { value: "stabilizator" },
    });
    await act(async () => {
      submitForm();
    });

    expect(mutation.mutateAsync).toHaveBeenCalledWith({
      muscle_key: "anterior_deltoid",
      side: "left",
      severity: "weak",
      observed_at: "2026-08-19",
      notes: "stabilizator",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces the server error message (e.g. 409 conflict) and stays open", async () => {
    const mutation = setupMutation();
    const onClose = vi.fn();
    const conflictMessage = "Znalezisko dla tego mięśnia i strony już istnieje.";
    mutation.mutateAsync.mockImplementation(async () => {
      mutation.error = new Error(conflictMessage);
      throw mutation.error;
    });
    const { rerender } = render(<DiagnosticCreateForm athleteId="a1" onClose={onClose} />);

    selectMuscle("Naramienny przedni");
    await act(async () => {
      submitForm();
    });
    rerender(<DiagnosticCreateForm athleteId="a1" onClose={onClose} />);

    expect(screen.getByRole("alert").textContent).toContain(conflictMessage);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables all fields while submitting", () => {
    setupMutation({ isPending: true });
    render(
      <DiagnosticCreateForm athleteId="a1" onClose={() => {}} />,
    );

    expect(screen.getByRole("button", { name: /Dodaję/ })).toBeDisabled();
    expect(screen.getByText(pl.coach.athlete.diagnostics.creating)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});