/// <reference types="vitest/globals" />

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import MuscleCombobox from "@/components/coach/MuscleCombobox";

describe("MuscleCombobox", () => {
  it("shows the placeholder when nothing is selected", () => {
    render(<MuscleCombobox id="m1" selectedKey={null} onSelect={() => {}} />);
    expect(
      screen.getByRole("combobox"),
    ).toHaveAttribute("placeholder", 'Szukaj mięśnia (np. "naramienny" lub "deltoid")...');
  });

  it("shows the selected muscle label in the placeholder", () => {
    render(
      <MuscleCombobox
        id="m1"
        selectedKey="anterior_deltoid"
        onSelect={() => {}}
      />,
    );
    expect(
      screen.getByRole("combobox"),
    ).toHaveAttribute(
      "placeholder",
      "Naramienny przedni (Anterior Deltoid)",
    );
  });

  it("opens the listbox on focus with all 68 muscles grouped by region", () => {
    render(<MuscleCombobox id="m1" selectedKey={null} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(68);
    expect(screen.getByText("Góra")).toBeInTheDocument();
    expect(screen.getByText("Dół")).toBeInTheDocument();
    expect(screen.getByText("Stopa")).toBeInTheDocument();
  });

  it("filters by Latin name", () => {
    render(<MuscleCombobox id="m1" selectedKey={null} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "deltoid" } });

    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByText(/Anterior Deltoid/)).toBeInTheDocument();
  });

  it("filters diacritic-insensitively by Polish name", () => {
    render(<MuscleCombobox id="m1" selectedKey={null} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "lydki" } });

    expect(screen.getByText(/Brzuchaty łydki/)).toBeInTheDocument();
  });

  it("shows a no-results message for an unknown query", () => {
    render(<MuscleCombobox id="m1" selectedKey={null} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "xyzabc" } });

    expect(screen.getByText("Brak wyników")).toBeInTheDocument();
  });

  it("selects with Enter the option highlighted by ArrowDown", () => {
    const onSelect = vi.fn();
    render(
      <MuscleCombobox id="m1" selectedKey={null} onSelect={onSelect} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "deltoid" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("lateral_deltoid");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selects the first highlighted option with Enter", () => {
    const onSelect = vi.fn();
    render(
      <MuscleCombobox id="m1" selectedKey={null} onSelect={onSelect} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "deltoid" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("anterior_deltoid");
  });

  it("closes on Escape and selects on option click", () => {
    const onSelect = vi.fn();
    render(
      <MuscleCombobox id="m1" selectedKey={null} onSelect={onSelect} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.mouseDown(screen.getByText(/Naramienny przedni/));
    expect(onSelect).toHaveBeenCalledWith("anterior_deltoid");
  });

  it("exposes the expected ARIA combobox contract", () => {
    render(<MuscleCombobox id="m1" selectedKey={null} onSelect={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(input).toHaveAttribute("aria-haspopup", "listbox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", "m1-listbox");
    expect(input).toHaveAttribute("aria-activedescendant", "m1-option-0");
  });
});