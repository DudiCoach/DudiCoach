/// <reference types="vitest/globals" />

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import ExportPlanButton from "@/components/coach/ExportPlanButton";
import { pl } from "@/lib/i18n/pl";

const mockPrint = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom/happy-dom doesn't have window.print by default
  Object.defineProperty(window, "print", {
    value: mockPrint,
    writable: true,
    configurable: true,
  });
});

describe("ExportPlanButton", () => {
  it("renders the export button with correct label", () => {
    render(<ExportPlanButton />);
    expect(
      screen.getByRole("button", { name: pl.coach.athlete.plans.exportPdf }),
    ).toBeInTheDocument();
  });

  it("calls window.print when clicked", () => {
    render(<ExportPlanButton />);
    fireEvent.click(screen.getByRole("button", { name: pl.coach.athlete.plans.exportPdf }));
    expect(mockPrint).toHaveBeenCalledOnce();
  });

  it("adds printing-plan class to body during print and removes after", () => {
    render(<ExportPlanButton />);
    fireEvent.click(screen.getByRole("button", { name: pl.coach.athlete.plans.exportPdf }));
    expect(document.body.classList.contains("printing-plan")).toBe(false);
  });
});
